import { uid } from './db.js';
import { appendTrace, now } from './domain.js';
import { buildArtifact } from './builders.js';

export function createWorker(db, capabilities, {interval=1000, concurrency=2, builder=buildArtifact}={}) {
  const runner=uid(),active=new Map();let timer,stopped=false,ticking=false,idleUntil=0;
  async function tick(){
    if(stopped || ticking || active.size>=concurrency || (active.size===0 && Date.now()<idleUntil))return;
    ticking=true;
    try {
      const {rows}=await db.query('SELECT id,state FROM accounts');
      let foundWork=false;
      for(const row of rows){
        if(stopped || active.size>=concurrency)break;
        const snapshot=JSON.parse(row.state);
        const candidate=snapshot.goals.find(g=>!active.has(g.id) && (g.status==='queued' || (g.status==='running' && (g.leaseUntil||0)<Date.now())));
        if(!candidate)continue;
        const claim=await db.mutate(row.id,state=>{
          const goal=state.goals.find(g=>g.id===candidate.id);
          if(!goal || !(goal.status==='queued'||(goal.status==='running'&&(goal.leaseUntil||0)<Date.now())))return null;
          if(goal.attempts>=6){goal.status='failed';appendTrace(goal,'error','Stopped after six interrupted attempts. Retry manually to reset the attempt count.');return null;}
          goal.status='running';goal.runner=runner;goal.runToken=uid();goal.leaseUntil=Date.now()+120000;goal.attempts++;goal.step=0;
          appendTrace(goal,'plan',goal.attempts===1?'Worker claimed this goal. Starting the saved plan.':'Resuming from durable state. The build will be rechecked before completion.');
          return {goal:structuredClone(goal),challenge:state.securityChallenge};
        });
        if(claim){
          foundWork=true;
          const controller=new AbortController();
          const job=run(row.id,claim,controller).catch(error=>console.error('Worker persistence error:',error.code||error.name)).finally(()=>{active.delete(claim.goal.id);idleUntil=0;});
          active.set(claim.goal.id,{controller,job,userId:row.id});
        }
      }
      if(!foundWork&&active.size===0)idleUntil=Date.now()+10*60000;
    } catch(error){console.error('Worker polling unavailable:',error.code||error.name);}finally{ticking=false;}
  }
  async function run(userId,{goal,challenge},controller){
    let heartbeat;
    const check=async()=>{
      if(stopped || controller.signal.aborted)throw new DOMException('Execution stopped','AbortError');
      const state=await db.read(userId),current=state?.goals.find(g=>g.id===goal.id);
      if(!current || current.status!=='running' || current.runToken!==goal.runToken){controller.abort();throw new DOMException('Goal is no longer running','AbortError');}
    };
    const progress=async(phase,message)=>{
      await check();await db.mutate(userId,state=>{
        const current=state.goals.find(g=>g.id===goal.id);
        if(current?.status==='running'&&current.runToken===goal.runToken){appendTrace(current,phase,String(message).slice(0,2000));current.step=Math.min(3,current.step+1);current.leaseUntil=Date.now()+120000;}
      });
    };
    try{
      heartbeat=setInterval(()=>db.mutate(userId,state=>{
        const current=state.goals.find(g=>g.id===goal.id);
        if(current?.status==='running'&&current.runToken===goal.runToken)current.leaseUntil=Date.now()+120000;
        else controller.abort();
      }).catch(()=>controller.abort()),20000);heartbeat.unref?.();
      await check();
      const result=await builder({...goal,targetAuthToken:challenge,check,progress,signal:controller.signal,capabilities});
      await check();
      if(!Array.isArray(result.evidence)||!result.evidence.length||(result.evidence.some(e=>e.passed!==true)&&!result.requiresReview))throw new Error('Verification did not pass. The goal is not complete.');
      const content=Buffer.isBuffer(result.content)?result.content:Buffer.from(result.content);
      if(!content.length || content.length>3*1024*1024)throw new Error('Artifact must contain between 1 byte and 3 MB.');
      const artifactId=goal.id;
      const metadata={id:artifactId,goalId:goal.id,title:goal.title,filename:result.filename,mime:result.mime,size:content.length,createdAt:now(),verification:result.evidence,status:'private'};
      await db.transaction(userId,async(state,query)=>{
        const current=state.goals.find(g=>g.id===goal.id);
        if(current?.status!=='running'||current.runToken!==goal.runToken)return;
        if(state.artifacts.reduce((sum,a)=>sum+a.size,0)+content.length>20*1024*1024)throw new Error('Workspace artifact storage reached its 20 MB limit. Export a backup.');
        await query('INSERT INTO artifacts (id,user_id,data,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[artifactId,userId,JSON.stringify({...metadata,content:content.toString('base64')}),Date.now()]);
        if(!state.artifacts.some(a=>a.id===artifactId))state.artifacts.push(metadata);
        current.evidence=result.evidence;current.artifactIds=[artifactId];current.status=result.requiresReview?'paused':'completed';current.needsReview=Boolean(result.requiresReview);current.step=result.requiresReview?3:4;delete current.runner;delete current.runToken;delete current.leaseUntil;
        delete current.generatedHtml;
        appendTrace(current,result.requiresReview?'review':'verified',result.requiresReview?'Draft saved. Static checks passed, but interactive behavior still needs testing. Open the artifact and record your check before marking this goal complete.':`${result.evidence.length} checks passed. ${result.summary || 'Artifact saved and ready to open.'}`);
        state.messages.push({id:uid(),role:'assistant',content:result.requiresReview?`“${goal.title}” is saved as a draft. Its code passed static checks, but the goal remains paused until its interactive behavior is tested. Open it from Goals and record your check.`:`“${goal.title}” is ready. ${result.summary || 'Open it in Artifacts.'} ${result.evidence.length} verification checks passed.`,createdAt:now()});state.messages=state.messages.slice(-120);
      });
    }catch(error){
      await db.mutate(userId,state=>{
        const current=state.goals.find(g=>g.id===goal.id);
        if(current?.status!=='running'||current.runToken!==goal.runToken)return;
        if(error.name==='AbortError'){current.status=stopped?'queued':'paused';appendTrace(current,'control',stopped?'Server stopping. Work is saved for the next worker.':'Execution stopped before committing an artifact.');}
        else{current.status='failed';appendTrace(current,'error',String(error.message).slice(0,1500));current.evidence=[{label:'Build and verification',passed:false,detail:String(error.message).slice(0,1000)}];}
        delete current.runner;delete current.runToken;delete current.leaseUntil;
      });
    }finally{clearInterval(heartbeat);}
  }
  return {
    start(){timer=setInterval(tick,interval);timer.unref?.();void tick();},
    wake(){idleUntil=0;void tick();},
    interrupt(userId,goalId){const job=active.get(goalId);if(job?.userId===userId)job.controller.abort();},
    async stop(){stopped=true;clearInterval(timer);for(const job of active.values())job.controller.abort();await Promise.allSettled([...active.values()].map(j=>j.job));}
  };
}
