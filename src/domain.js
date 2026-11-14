import { randomBytes } from 'node:crypto';
import { uid } from './db.js';

export const now = () => new Date().toISOString();
export const token = () => randomBytes(32).toString('base64url');
export const recoveryKey = () => `LARA-${token()}`;
export const kinds = ['site','budget','research','security','app'];
export const ACTIVE = ['queued','running','awaiting_approval'];
export const PLANS = {
  site: ['Interpret the brief and assemble the page', 'Build a standalone responsive HTML file', 'Verify structure, escaping and runnable content', 'Save the page and verification evidence'],
  app: ['Choose an application from the brief', 'Build a standalone app with interactive behavior', 'Verify structure and JavaScript syntax', 'Save the app and verification evidence'],
  budget: ['Set up editable income and expense inputs', 'Build a workbook with calculated totals', 'Reopen the workbook and verify formulas', 'Save the spreadsheet and verification evidence'],
  research: ['Select sources from the supplied URLs or public reference search', 'Fetch bounded public sources', 'Extract attributed excerpts with citations', 'Save the sourced note with retrieval evidence'],
  security: ['Confirm scope and authorization', 'Inspect security controls without exploitation', 'Record findings and limits', 'Save evidence and remediation recommendations']
};
export class HttpError extends Error { constructor(status, message) { super(message); this.status=status; } }
export function text(value, max, name = 'Value', fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `${name} must contain 1–${max} characters.`);
  return value.trim();
}
export function newGoal(input, status='queued') {
  if (!kinds.includes(input.kind)) throw new HttpError(400, 'Choose site, budget, research, security, or app.');
  const prompt = text(input.prompt || input.title, 5000, 'Goal brief');
  const title = text(input.title || prompt.slice(0, 90), 160, 'Title');
  if (input.sourceUrls !== undefined && (!Array.isArray(input.sourceUrls) || input.sourceUrls.length > 5 || input.sourceUrls.some(u => typeof u !== 'string' || u.length > 2000))) throw new HttpError(400, 'Supply up to five HTTPS source URLs.');
  const targetUrl = input.targetUrl ? text(input.targetUrl,2000,'Target URL') : '';
  const generatedHtml = input.generatedHtml ? text(input.generatedHtml,300000,'Generated HTML') : undefined;
  if(generatedHtml && !['app','site'].includes(input.kind))throw new HttpError(400,'Generated HTML is only supported for app and site goals.');
  if (targetUrl && input.authorization !== true) throw new HttpError(400,'Confirm authorization for this target.');
  return { id:uid(),title,prompt,kind:input.kind,status,step:0,createdAt:now(),updatedAt:now(),plan:PLANS[input.kind],evidence:[],trace:[],artifactIds:[],sourceUrls:input.sourceUrls || [],targetUrl,authorization:input.authorization===true,attempts:0,...(generatedHtml?{generatedHtml}:{}) };
}
export function appendTrace(goal, phase, message) {
  goal.trace.push({at:now(),phase,message});
  goal.trace=goal.trace.slice(-100); goal.updatedAt=now();
}
export function initialState(id, name) {
  return { version:1,user:{id,name,createdAt:now()},securityChallenge:`lara-verify-${token()}`,goals:[
    newGoal({kind:'site',title:'My corner of the internet',prompt:`Build a personal one-page website for ${name}. A thoughtful introduction, current projects, and a clear way to connect.`},'paused'),
    newGoal({kind:'budget',title:'A budget I can actually use',prompt:'Build a monthly budget in INR with income, expenses, savings, editable assumptions and working formulas.'},'paused'),
    newGoal({kind:'security',title:'Review Lara’s security',prompt:'Review the security controls of this Lara workspace and write a clear remediation checklist.'},'paused'),
    newGoal({kind:'app',title:'My focus companion',prompt:'Build a working Pomodoro focus timer with a task list and saved preferences.'},'paused')
  ],artifacts:[],memories:[{id:uid(),key:'Name',value:name,updatedAt:now()}],messages:[{id:uid(),role:'assistant',content:`Hi ${name}. I’m Lara. Tell me what you want to make, or run one of your starter goals. I can build pages, small apps and formula-based spreadsheets, gather sourced notes, and review security controls. I’ll save the work and show you what I checked.`,createdAt:now()}],approvals:[] };
}
export function approval(state, input) {
  for(const a of state.approvals)if(a.status==='pending'&&Date.parse(a.expiresAt)<Date.now())a.status='expired';
  const duplicate=state.approvals.find(a=>a.status==='pending' && a.kind===input.kind && a.subjectId===input.subjectId);
  if(duplicate) return duplicate;
  const item={id:uid(),...input,status:'pending',createdAt:now(),expiresAt:new Date(Date.now()+15*60000).toISOString()};
  state.approvals.push(item);state.approvals=state.approvals.slice(-100);return item;
}
export function ensureCapacity(state) {
  if(state.goals.reduce((sum,g)=>sum+(g.generatedHtml?.length||0),0)>5*1024*1024)throw new HttpError(409,'Generated draft storage reached its 5 MB limit. Finish and verify drafts before adding more.');
  if(state.goals.length>=100) throw new HttpError(409,'This workspace has reached its 100-goal limit. Export a backup before starting another workspace.');
  if(state.goals.filter(g=>ACTIVE.includes(g.status)).length>=5) throw new HttpError(409,'Five goals are already active. Pause or finish one first.');
}
