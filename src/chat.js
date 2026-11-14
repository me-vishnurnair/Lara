import { now, newGoal, ensureCapacity, approval, text } from './domain.js';
import { uid } from './db.js';

// The no-key operator is deliberately bounded. It routes natural-language work
// into audited tools and answers from saved state; it never pretends to be an LLM.
export function respond(state, message) {
  const lower=message.toLowerCase(); let content,goal,item;
  const remember=message.match(/^(?:remember(?: that)?|save (?:to )?memory)\s*[:,-]?\s*(.+)$/is);
  if(remember){
    const value=remember[1].trim();
    const named=value.match(/^(?:my name is|call me)\s+(.+)$/i);
    const kv=value.match(/^([^:=]{1,60})\s*[:=]\s*([\s\S]+)$/);
    const key=named?'Name':kv?kv[1].trim():`Note ${state.memories.length+1}`;
    const val=text(named?named[1].trim():kv?kv[2].trim():value,named?80:4000,named?'Name':'Memory');
    if(state.memories.length>=100 && !state.memories.some(m=>m.key.toLowerCase()===key.toLowerCase())) content='Your memory has reached 100 entries. You can edit or remove entries on the Memory page.';
    else {const found=state.memories.find(m=>m.key.toLowerCase()===key.toLowerCase());if(found){found.value=val;found.updatedAt=now();}else state.memories.push({id:uid(),key,value:val,updatedAt:now()});if(named)state.user.name=val.slice(0,80);content=`Saved to memory: ${key} — ${val}. I can use this in a new session, too.`;}
  } else if (/\b(forget|delete|remove)\b/.test(lower) && /\b(memory|remember|note)\b/.test(lower)) {
    content='Open Memory and choose Delete on the entry you want removed. I’ll show a one-tap approval for that exact entry before changing it.';
  } else if (/\b(send|email|pay|purchase|buy|security settings)\b/.test(lower) && !/\b(build|make|create|draft|site|page|app|budget)\b/.test(lower)) {
    content='I can prepare a draft or artifact. Sending messages, payments, and device security changes need dedicated integrations, which this installation does not have. I haven’t taken any external action.';
  } else if (/\b(publish|put .*live)\b/.test(lower)) {
    const artifact=[...state.artifacts].reverse().find(a=>lower.includes(a.title.toLowerCase())) || state.artifacts.at(-1);
    if(!artifact) content='Build an artifact first. Then I can ask for your approval to publish a public link.';
    else {item=approval(state,{kind:'publish',subjectId:artifact.id,title:`Publish “${artifact.title}”`,detail:'Anyone with the generated link will be able to read this artifact. Review its content before approving.'});content=`I’ve prepared an approval to publish “${artifact.title}”. It stays private until you approve.`;}
  } else if (/\b(pause|stop|kill|cancel|resume|run)\b/.test(lower) && /\b(goal|task|all|last|latest)\b/.test(lower) && !/\b(build|create|make)\b/.test(lower)) {
    const action=/\b(kill|cancel)\b/.test(lower)?'cancel':/\b(pause|stop)\b/.test(lower)?'pause':'run';
    const candidates=[...state.goals].reverse().filter(g=>!['completed','failed','cancelled'].includes(g.status));
    const targets=/\ball\b/.test(lower)?candidates:candidates.slice(0,1);
    for(const g of targets){g.status=action==='cancel'?'cancelled':action==='pause'?'paused':'queued';g.updatedAt=now();g.trace.push({at:now(),phase:'control',message:`${action} requested in conversation.`});}
    content=targets.length?`${action==='cancel'?'Cancelled':action==='pause'?'Paused':'Queued'} ${targets.length} goal${targets.length===1?'':'s'}. You can see the live state on Goals.`:'There are no matching active goals.';
  } else {
    const requestsWork=/\b(build|make|create|generate|research|investigate|review|audit|scan|test|pen\s?test|penetration)\b/i.test(message);
    let kind;
    if(/\b(security|audit|pen\s?test|penetration|vulnerabilit|scan)/i.test(message))kind='security';
    else if(/\b(budget|spreadsheet|workbook|xlsx)\b/.test(lower))kind='budget';
    else if(/\b(research|sources|sourced|investigate|compare)\b/.test(lower))kind='research';
    else if(/\b(app|timer|pomodoro|todo|to-do|tracker|calculator)\b/.test(lower))kind='app';
    else if(/\b(site|website|landing|page)\b/.test(lower))kind='site';
    if(requestsWork && kind){
      if(kind==='security' && /https?:\/\/|\b(device|phone|router|network|ip address)\b/.test(lower)){
        content='I can perform a non-destructive HTTPS security review of a public website you control. In New goal → Security, add the target and place your workspace’s ownership token at the shown URL. I can also review Lara itself now. Direct device access and exploit-based penetration testing require a separately installed, authorized runner; they are not available in this web app.';
      } else {
        ensureCapacity(state);
        const urls=message.match(/https:\/\/[^\s<>"']+/g)||[];
        const memories=state.memories.slice(0,20).map(m=>`${m.key}: ${m.value}`).join('\n');
        goal=newGoal({kind,title:message.replace(/^(please\s+)?(build|make|create|generate)\s+/i,'').slice(0,90),prompt:`${message}\n\nWorkspace context (user supplied):\n${memories}`.slice(0,5000),sourceUrls:urls.slice(0,5)});state.goals.push(goal);
        content=`I’ve queued “${goal.title}”. I’ll ${goal.plan.map(s=>s.charAt(0).toLowerCase()+s.slice(1)).join(', then ')}. You can pause or cancel it from Goals.`;
      }
    } else if (/\b(remember|memory|who am i|my name|about me|working on)\b/.test(lower)) {
      content=state.memories.length?`Here’s what I have saved:\n${state.memories.map(m=>`• ${m.key}: ${m.value}`).join('\n')}`:'You haven’t saved any memory yet. Say “Remember: project = …” to add some.';
      if(state.goals.length)content+=`\n\nYour latest work: ${state.goals.slice(-3).map(g=>`${g.title} (${g.status.replaceAll('_',' ')})`).join('; ')}.`;
    } else if (/\b(status|progress|goals|tasks|done|finished)\b/.test(lower)) {
      content=state.goals.length?state.goals.slice(-8).map(g=>`• ${g.title} — ${g.status.replaceAll('_',' ')}${g.evidence.length?` (${g.evidence.filter(e=>e.passed).length}/${g.evidence.length} checks passed)`:''}`).join('\n'):'There are no goals yet. Tell me what you’d like to make.';
    } else if (/^(hi|hello|hey|good morning|good evening)[\s!.]*$/i.test(message)) {
      content=`Hi ${state.user.name}. ${state.goals.some(g=>g.status==='running')?'I’m working on your queued goals.':'Ready when you are.'} What would you like to make or check?`;
    } else if (/\b(thank|thanks)\b/.test(lower)) content='You’re welcome. Your work and memory are saved in this workspace.';
    else if (/\b(recovery|lost|recover|backup|device)\b/.test(lower)) content='Your Recovery Kit unlocks this same workspace on another device without a phone or email. Keep it somewhere you can reach independently. Download a separate data backup in Settings, too: the recovery key restores access, while the backup can restore data after hosting loss.';
    else if (/\b(yes|do it|go ahead)\b/.test(lower)) content='For a pending permission, use its Approve button so the approval is tied to the exact action. To start new work, tell me what to build or use a starter goal.';
    else content=`I can turn a concrete brief into a page, a small app, an Excel budget, a sourced note, or a security review. I also remember facts and track your goals across sessions.\n\nTry “Build a website for my photography”, “Create a monthly budget in INR”, or “Remember: current project = …”. This built-in operator uses a bounded set of tools; open-ended reasoning needs the optional local AI mode.`;
  }
  // Keep all saved replies inside the same limits the backup importer accepts.
  if (content.length > 16000) content = content.slice(0, 15850) + '\n\nMore saved information is available on the Memory and Goals pages.';
  const assistant={id:uid(),role:'assistant',content,createdAt:now()};
  state.messages.push({id:uid(),role:'user',content:message,createdAt:now()},assistant);state.messages=state.messages.slice(-120);
  return {message:assistant,...(goal?{goal}:{}),...(item?{approval:item}:{})};
}
