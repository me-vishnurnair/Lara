import express from 'express';
import helmet from 'helmet';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, hash, uid } from './db.js';
import { token,recoveryKey,initialState,newGoal,text,HttpError,approval,ensureCapacity,now,appendTrace } from './domain.js';
import { respond } from './chat.js';
import { createWorker } from './worker.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const cleanGoal=goal=>{const {runner,runToken,leaseUntil,generatedHtml,...safe}=goal;return safe;};
const escapeHeader=value=>String(value).replace(/[^a-zA-Z0-9._-]/g,'_');

export async function createApp({db,workerOptions={},startWorker=true,publicOrigin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL}={}){
  db ||= await openDatabase();
  const app=express();
  app.disable('x-powered-by');
  if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'wasm-unsafe-eval'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:","blob:"],connectSrc:["'self'",'https://huggingface.co','https://*.huggingface.co','https://*.hf.co','https://raw.githubusercontent.com','https://mlc-ai.github.io'],frameSrc:["'self'","blob:"],workerSrc:["'self'","blob:"],objectSrc:["'none'"],baseUri:["'none'"],formAction:["'self'"],frameAncestors:["'none'"],upgradeInsecureRequests:publicOrigin?.startsWith('https:')?[]:null}},crossOriginEmbedderPolicy:false}));
  app.use((req,res,next)=>{res.set('Permissions-Policy','camera=(), geolocation=(), payment=(), usb=(), microphone=(self)');next();});
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  const smallJson=express.json({limit:'512kb',strict:true});
  app.use((req,res,next)=>req.path==='/api/import'?next():smallJson(req,res,next));
  const capabilities={engine:'Built-in operator',database:db.kind,persistent:true,paidApiRequired:false,voice:'Browser speech support varies by device. Speech recognition may use your browser’s service.',securityScope:'Self-review and ownership-verified public HTTPS review. No device exploitation or arbitrary code execution.',approvalRequired:['publish','delete memory','rotate recovery key','unpublish'],tools:['site','budget','research','security','app'],checks:{httpOnlySessions:true,csrfProtection:true,tenantIsolation:true,artifactSandbox:true,ssrfProtection:true,approvalGate:true,durableDatabase:true,recoveryKeyBits:256},limits:{goals:100,memories:100,artifactBytes:20*1024*1024},hosting:process.env.RENDER?'Render free compute can sleep when idle; persistent data lives in PostgreSQL. Tasks resume on wake.':'Runs while the server is available. Data persists in the configured database.'};
  const worker=createWorker(db,capabilities,workerOptions);
  function cookie(req,res,value,maxAge=30*86400){res.append('Set-Cookie',`lara_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${req.secure||publicOrigin?.startsWith('https:')?'; Secure':''}`);}
  const sessionToken=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lara_session='))?.slice(13)||'';
  const origin=req=>publicOrigin||`${req.protocol}://${req.get('host')}`;
  app.use('/api',asyncRoute(async(req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      // Requiring JSON also makes cross-site form and simple fetch CSRF impossible.
      if(!req.is('application/json'))throw new HttpError(415,'Use application/json.');
      const supplied=req.headers.origin;
      if((supplied && supplied!==origin(req)) || ['cross-site','none'].includes(req.headers['sec-fetch-site']) && supplied!==origin(req))throw new HttpError(403,'Request origin is not allowed.');
    }
    next();
  }));
  app.get('/healthz',asyncRoute(async(req,res)=>{await db.ping();res.json({status:'ok',version:'1.0.0',database:db.kind});}));
  app.post('/api/auth/create',asyncRoute(async(req,res)=>{
    if(!await db.rate(`create:${req.ip}`,5,3600000))throw new HttpError(429,'Too many workspaces created. Try again in an hour.');
    const name=text(req.body.name,80,'Name'),id=uid(),key=recoveryKey(),state=initialState(id,name),session=token();
    await db.createAccount(id,hash(key),state,session);cookie(req,res,session);
    res.status(201).json({user:state.user,recoveryKey:key});
  }));
  app.post('/api/auth/recover',asyncRoute(async(req,res)=>{
    if(!await db.rate(`recover:${req.ip}`,12,15*60000))throw new HttpError(429,'Too many recovery attempts. Try again in 15 minutes.');
    const key=text(req.body.recoveryKey,100,'Recovery key');
    const id=await db.findRecovery(key);
    if(!id)throw new HttpError(401,'Recovery key not recognized. Check your saved Recovery Kit.');
    const session=token();await db.addSession(id,session);cookie(req,res,session);res.json({user:(await db.read(id)).user});
  }));
  app.use('/api',asyncRoute(async(req,res,next)=>{
    const raw=sessionToken(req);if(!raw)throw new HttpError(401,'Open or recover a workspace to continue.');
    const id=await db.session(raw);if(!id)throw new HttpError(401,'Your session expired. Use your Recovery Kit to sign in.');
    req.userId=id;req.sessionHash=hash(raw);
    if(!['GET','HEAD'].includes(req.method)&&!await db.rate(`write:${id}`,120,60000))throw new HttpError(429,'Too many requests. Try again in a minute.');
    next();
  }));
  app.get('/api/session',asyncRoute(async(req,res)=>{const state=await db.read(req.userId);res.json({user:state.user,capabilities:{...capabilities,securityChallenge:state.securityChallenge}});}));
  app.post('/api/auth/logout',asyncRoute(async(req,res)=>{await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.sessionHash]);cookie(req,res,'',0);res.json({ok:true});}));
  app.get('/api/state',asyncRoute(async(req,res)=>{const state=await db.read(req.userId);res.json({...state,goals:state.goals.map(cleanGoal),capabilities:{...capabilities,securityChallenge:state.securityChallenge}});}));
  app.patch('/api/profile',asyncRoute(async(req,res)=>{const name=text(req.body.name,80,'Name');const user=await db.mutate(req.userId,s=>{s.user.name=name;const m=s.memories.find(m=>m.key==='Name');if(m){m.value=name;m.updatedAt=now();}return s.user;});res.json({user});}));
  app.post('/api/chat',asyncRoute(async(req,res)=>{const message=text(req.body.message,5000,'Message');let result;
    if(req.body.localReply!==undefined){const reply=text(req.body.localReply,16000,'Local AI reply');result=await db.mutate(req.userId,s=>{const assistant={id:uid(),role:'assistant',content:reply,createdAt:now(),engine:'on-device AI'};s.messages.push({id:uid(),role:'user',content:message,createdAt:now()},assistant);s.messages=s.messages.slice(-120);return {message:assistant};});}
    else result=await db.mutate(req.userId,s=>respond(s,message));worker.wake();res.json(result);
  }));
  app.post('/api/goals',asyncRoute(async(req,res)=>{const result=await db.mutate(req.userId,s=>{ensureCapacity(s);const goal=newGoal(req.body);s.goals.push(goal);return goal;});worker.wake();res.status(201).json({goal:cleanGoal(result)});}));
  app.patch('/api/goals/:id',asyncRoute(async(req,res)=>{
    const action=req.body.action;if(!['run','pause','resume','cancel'].includes(action))throw new HttpError(400,'Unknown goal control.');
    const goal=await db.mutate(req.userId,s=>{const g=s.goals.find(g=>g.id===req.params.id);if(!g)throw new HttpError(404,'Goal not found.');
      if(['completed','cancelled'].includes(g.status))throw new HttpError(409,'This goal has already finished. Create a new goal to run it again.');
      if(g.needsReview&&['run','resume'].includes(action))throw new HttpError(409,'This draft needs a behavioral check. Open it, test its controls, and record your check.');
      if(['run','resume'].includes(action)){
        if(g.status==='running'||g.status==='queued')return g;
        if(s.goals.filter(x=>['running','queued'].includes(x.status)).length>=5)throw new HttpError(409,'Five goals are already active.');
        g.status='queued';g.attempts=0;
      }else g.status=action==='pause'?'paused':'cancelled';
      appendTrace(g,'control',`${action} requested by you.`);return g;
    });
    if(['pause','cancel'].includes(action))worker.interrupt(req.userId,goal.id);else worker.wake();res.json({goal:cleanGoal(goal)});
  }));
  app.post('/api/goals/:id/verify',asyncRoute(async(req,res)=>{
    const notes=text(req.body.notes,2000,'What you tested');
    if(notes.length<12)throw new HttpError(400,'Describe the behavior you tested and the result (at least 12 characters).');
    const goal=await db.transaction(req.userId,async(s,query)=>{
      const g=s.goals.find(g=>g.id===req.params.id);
      if(!g)throw new HttpError(404,'Goal not found.');
      if(g.status!=='paused'||!g.needsReview||!g.artifactIds.length)throw new HttpError(409,'This goal is not awaiting a draft check.');
      const artifact=s.artifacts.find(a=>a.id===g.artifactIds[0]);
      if(!artifact)throw new HttpError(404,'Draft artifact not found.');
      const evidence={label:'Interactive behavior checked by workspace owner',passed:true,detail:`${now()}: ${notes}`};
      g.evidence=g.evidence.filter(e=>e.passed===true);g.evidence.push(evidence);g.needsReview=false;g.status='completed';g.step=4;delete g.generatedHtml;
      appendTrace(g,'verified',`Manual behavioral check recorded by you: ${notes}`);artifact.verification=g.evidence;
      const {rows}=await query('SELECT data FROM artifacts WHERE id=$1 AND user_id=$2',[artifact.id,req.userId]);
      if(!rows[0])throw new HttpError(404,'Draft content not found.');
      const data=JSON.parse(rows[0].data);data.verification=g.evidence;await query('UPDATE artifacts SET data=$1 WHERE id=$2 AND user_id=$3',[JSON.stringify(data),artifact.id,req.userId]);
      return cleanGoal(g);
    });res.json({goal});
  }));
  app.post('/api/memory',asyncRoute(async(req,res)=>{const key=text(req.body.key,80,'Memory title'),value=text(req.body.value,4000,'Memory');const memory=await db.mutate(req.userId,s=>{if(s.memories.length>=100)throw new HttpError(409,'Memory limit reached. Edit or delete an existing memory.');const m={id:uid(),key,value,updatedAt:now()};s.memories.push(m);return m;});res.status(201).json({memory});}));
  app.patch('/api/memory/:id',asyncRoute(async(req,res)=>{const key=text(req.body.key,80,'Memory title'),value=text(req.body.value,4000,'Memory');const memory=await db.mutate(req.userId,s=>{const m=s.memories.find(m=>m.id===req.params.id);if(!m)throw new HttpError(404,'Memory not found.');m.key=key;m.value=value;m.updatedAt=now();return m;});res.json({memory});}));
  app.delete('/api/memory/:id',asyncRoute(async(req,res)=>{const item=await db.mutate(req.userId,s=>{const m=s.memories.find(m=>m.id===req.params.id);if(!m)throw new HttpError(404,'Memory not found.');return approval(s,{kind:'delete_memory',subjectId:m.id,title:`Delete memory “${m.key}”`,detail:`Permanently remove this entry: ${m.value.slice(0,300)}`,snapshot:hash(JSON.stringify(m))});});res.json({approval:item});}));
  app.post('/api/artifacts/:id/publish',asyncRoute(async(req,res)=>{const item=await db.mutate(req.userId,s=>{const a=s.artifacts.find(a=>a.id===req.params.id);if(!a)throw new HttpError(404,'Artifact not found.');if(a.status==='published')throw new HttpError(409,'This artifact is already published.');return approval(s,{kind:'publish',subjectId:a.id,title:`Publish “${a.title}”`,detail:'Anyone with the generated link will be able to read this artifact. Review it before approving.'});});res.json({approval:item});}));
  app.post('/api/artifacts/:id/unpublish',asyncRoute(async(req,res)=>{const item=await db.mutate(req.userId,s=>{const a=s.artifacts.find(a=>a.id===req.params.id);if(!a||a.status!=='published')throw new HttpError(404,'Published artifact not found.');return approval(s,{kind:'unpublish',subjectId:a.id,title:`Unpublish “${a.title}”`,detail:'The public link will stop working. Your private copy stays in this workspace.'});});res.json({approval:item});}));
  app.post('/api/recovery/rotate',asyncRoute(async(req,res)=>{const item=await db.mutate(req.userId,s=>approval(s,{kind:'rotate_recovery',subjectId:s.user.id,title:'Replace your recovery key',detail:'Your previous Recovery Kit and other device sessions will stop working. Save the new kit immediately after approval.'}));res.json({approval:item});}));
  app.post('/api/approvals/:id',asyncRoute(async(req,res)=>{
    if(!['approve','deny'].includes(req.body.decision))throw new HttpError(400,'Choose approve or deny.');
    const result=await db.transaction(req.userId,async(s,query)=>{
      const a=s.approvals.find(a=>a.id===req.params.id);if(!a)throw new HttpError(404,'Approval not found.');if(a.status!=='pending')throw new HttpError(409,'This approval has already been handled.');
      if(req.body.decision==='approve'&&Date.parse(a.expiresAt)<=Date.now())throw new HttpError(409,'Approval expired. Request the action again.');
      if(req.body.decision==='deny'){a.status='denied';a.resolvedAt=now();return {approval:a};}
      let key;
      if(a.kind==='delete_memory'){
        const m=s.memories.find(m=>m.id===a.subjectId);if(!m)throw new HttpError(404,'Memory no longer exists.');if(hash(JSON.stringify(m))!==a.snapshot)throw new HttpError(409,'Memory changed after the request. Deny this approval and request deletion again.');s.memories=s.memories.filter(m=>m.id!==a.subjectId);
      }else if(a.kind==='publish'){
        const artifact=s.artifacts.find(x=>x.id===a.subjectId);if(!artifact)throw new HttpError(404,'Artifact not found.');
        const publicToken=token();await query('INSERT INTO publications (token,user_id,artifact_id) VALUES ($1,$2,$3)',[publicToken,req.userId,artifact.id]);artifact.status='published';artifact.publishedUrl=`${origin(req)}/p/${publicToken}`;artifact.publishedToken=publicToken;
      }else if(a.kind==='unpublish'){
        const artifact=s.artifacts.find(x=>x.id===a.subjectId);if(!artifact)throw new HttpError(404,'Artifact not found.');await query('DELETE FROM publications WHERE artifact_id=$1 AND user_id=$2',[artifact.id,req.userId]);artifact.status='private';delete artifact.publishedUrl;delete artifact.publishedToken;
      }else if(a.kind==='rotate_recovery'){
        key=recoveryKey();await query('UPDATE accounts SET recovery_hash=$1 WHERE id=$2',[hash(key),req.userId]);await query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2',[req.userId,req.sessionHash]);
      }else throw new HttpError(400,'Unknown approval action.');
      a.status='approved';a.resolvedAt=now();s.messages.push({id:uid(),role:'assistant',content:`Approved and applied: ${a.title}.`,createdAt:now()});s.messages=s.messages.slice(-120);return {approval:a,...(key?{recoveryKey:key}:{})};
    });res.json(result);
  }));
  function sendArtifact(req,res,artifact){
    const type=['text/html','text/markdown','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/json','text/plain'].includes(artifact.mime)?artifact.mime:'application/octet-stream';
    res.set({'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-downloads",'X-Content-Type-Options':'nosniff','Content-Type':type,'Referrer-Policy':'no-referrer','Content-Disposition':`${req.query.download==='1'||type.includes('spreadsheet')?'attachment':'inline'}; filename="${escapeHeader(artifact.filename)}"`});res.send(Buffer.from(artifact.content,'base64'));
  }
  app.get(['/api/artifacts/:id/content','/api/artifacts/:id/preview'],asyncRoute(async(req,res)=>{const a=await db.artifact(req.params.id,req.userId);if(!a)throw new HttpError(404,'Artifact not found.');sendArtifact(req,res,a);}));
  app.get('/p/:token',asyncRoute(async(req,res)=>{const {rows}=await db.query('SELECT user_id,artifact_id FROM publications WHERE token=$1',[req.params.token]);if(!rows[0])throw new HttpError(404,'This public link is unavailable.');const state=await db.read(rows[0].user_id),meta=state.artifacts.find(a=>a.id===rows[0].artifact_id&&a.status==='published'&&a.publishedToken===req.params.token);if(!meta)throw new HttpError(404,'This public link is unavailable.');const a=await db.artifact(meta.id,rows[0].user_id);if(!a)throw new HttpError(404,'Artifact not found.');sendArtifact(req,res,a);}));
  app.get('/api/export',asyncRoute(async(req,res)=>{const state=await db.read(req.userId);const {rows}=await db.query('SELECT data FROM artifacts WHERE user_id=$1',[req.userId]);const backup={format:'lara-backup-v1',exportedAt:now(),state:{user:state.user,memories:state.memories,messages:state.messages,goals:state.goals.map(cleanGoal)},artifacts:rows.map(r=>JSON.parse(r.data))};res.set('Content-Disposition','attachment; filename="lara-backup.json"').json(backup);}));
  app.post('/api/import',express.json({limit:'30mb',strict:true}),asyncRoute(async(req,res)=>{
    const b=req.body.backup;
    if(!b||b.format!=='lara-backup-v1'||!b.state||!Array.isArray(b.state.memories)||!Array.isArray(b.state.goals)||!Array.isArray(b.artifacts)||!Array.isArray(b.state.messages))throw new HttpError(400,'Choose a Lara data backup, not a Recovery Kit.');
    if(b.state.memories.length>100||b.state.goals.length>100||b.artifacts.length>100||b.state.messages.length>120)throw new HttpError(400,'Backup exceeds workspace limits.');
    const memories=b.state.memories.map(m=>({id:uid(),key:text(m.key,80,'Memory title'),value:text(m.value,4000,'Memory'),updatedAt:now()}));
    const goalMap=new Map(),artifactMap=new Map();let bytes=0;
    const importedArtifacts=b.artifacts.map(a=>{
      if(typeof a.id!=='string'||artifactMap.has(a.id))throw new HttpError(400,'Duplicate artifact identifier.');
      if(typeof a.content!=='string'||a.content.length>4.1*1024*1024||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.content))throw new HttpError(400,'Invalid artifact content.');
      const data=Buffer.from(a.content,'base64');bytes+=data.length;const id=uid();artifactMap.set(a.id,id);
      const allowed=['text/html','text/markdown','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/json','text/plain'];
      return {id,goalId:a.goalId,title:text(a.title,160,'Artifact title'),filename:escapeHeader(text(a.filename,160,'Filename')),mime:allowed.includes(a.mime)?a.mime:'application/octet-stream',size:data.length,content:a.content,createdAt:now(),status:'private',verification:[{label:'Imported backup',passed:false,detail:'Imported content is untrusted and has not been reverified by this server.'}]};
    });
    if(bytes>20*1024*1024)throw new HttpError(400,'Backup exceeds 20 MB of artifacts.');
    const goals=b.state.goals.map(old=>{if(typeof old.id!=='string'||goalMap.has(old.id))throw new HttpError(400,'Invalid goal identifier.');const g=newGoal({title:old.title,prompt:old.prompt,kind:old.kind},'paused');goalMap.set(old.id,g.id);g.artifactIds=Array.isArray(old.artifactIds)?old.artifactIds.map(id=>artifactMap.get(id)).filter(Boolean):[];appendTrace(g,'import','Imported from backup. Paused until you explicitly run it; previous completion evidence was not trusted.');return g;});
    for(const a of importedArtifacts)a.goalId=goalMap.get(a.goalId)||null;
    const messages=b.state.messages.map(m=>({id:uid(),role:m.role==='user'?'user':'assistant',content:text(m.content,16000,'Message'),createdAt:now()}));
    const result=await db.transaction(req.userId,async(s,query)=>{
      const freshMemories=memories.filter(m=>!s.memories.some(e=>e.key===m.key&&e.value===m.value));
      if(s.memories.length+freshMemories.length>100||s.goals.length+goals.length>100||s.artifacts.reduce((n,a)=>n+a.size,0)+bytes>20*1024*1024)throw new HttpError(409,'The combined workspace would exceed its storage limits. Import into a new workspace.');
      for(const a of importedArtifacts){await query('INSERT INTO artifacts (id,user_id,data,created_at) VALUES ($1,$2,$3,$4)',[a.id,req.userId,JSON.stringify(a),Date.now()]);const {content,...meta}=a;s.artifacts.push(meta);}
      s.memories.push(...freshMemories);s.goals.push(...goals);s.messages=[...s.messages,...messages].slice(-120);
      return {memories:freshMemories.length,goals:goals.length,artifacts:importedArtifacts.length};
    });res.json({imported:result});
  }));
  app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found.'}));
  app.use(express.static(resolve(root,'public'),{etag:true,setHeaders(res,path){if(/sw\.js$|index\.html$/.test(path))res.set('Cache-Control','no-cache');}}));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error.status || (error.type==='entity.too.large'?413:500);
    if(status>=500)console.error('Request failed:',error.code||error.name);
    res.status(status).json({error:status>=500?'The server could not finish that request. Your saved work is still available; try again.':error.message});
  });
  if(startWorker)worker.start();
  return {app,db,worker,capabilities,async close(){await worker.stop();await db.close();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const instance=await createApp();
  const server=instance.app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Lara listening on port ${process.env.PORT||3000}; database: ${instance.db.kind}`));
  let stopping=false;
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close();instance.close().then(()=>process.exit(0));setTimeout(()=>process.exit(1),25000).unref();});
}
