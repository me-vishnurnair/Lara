'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const tabs = [ ['talk', 'Talk', 'chat'], ['goals', 'Goals', 'target'], ['artifacts', 'Artifacts', 'folder'], ['memory', 'Memory', 'brain'], ['settings', 'Settings', 'settings'] ];
const kinds = {site:{label:'One-page site',icon:'globe'},budget:{label:'Budget spreadsheet',icon:'sheet'},research:{label:'Research note',icon:'search'},security:{label:'Security review',icon:'shield'},app:{label:'Working app',icon:'code'}};
const statuses = {queued:'Queued',running:'Working',paused:'Paused',review:'Review needed',awaiting_approval:'Needs approval',completed:'Verified',failed:'Needs attention',cancelled:'Cancelled',idle:'Ready'};
const paths = {
  chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',
  target:'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8M16 4h4v4',
  folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 9h18',
  brain:'M12 5a3 3 0 0 0-5.9-.8 3.5 3.5 0 0 0-2.2 5.9 4 4 0 0 0 1.7 7.6A3.5 3.5 0 0 0 12 20V5Zm0 0a3 3 0 0 1 5.9-.8 3.5 3.5 0 0 1 2.2 5.9 4 4 0 0 1-1.7 7.6A3.5 3.5 0 0 1 12 20M7 9c3 0 3 3 3 3m7-3c-3 0-3 3-3 3M7 16c2 0 3-1 3-3m7 3c-2 0-3-1-3-3',
  settings:'M9.5 3h5l.5 3 2 1.2 2.8-1 2.5 4.3-2.3 2v2.3l2.3 2-2.5 4.3-2.8-1-2 1.2-.5 3h-5l-.5-3-2-1.2-2.8 1L1.7 17l2.3-2v-2.3l-2.3-2 2.5-4.3 2.8 1L9 6l.5-3ZM15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  shield:'M12 3 3 7v5c0 5.5 9 9 9 9s9-3.5 9-9V7l-9-4Zm-4 9 3 3 5-6',
  lock:'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3m-4 5v2',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z',
  sheet:'M5 3h14v18H5V3Zm0 6h14M5 15h14M11 9v12',
  code:'m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16',
  search:'M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 5 6',
  plus:'M12 5v14M5 12h14',
  arrow:'M5 12h14m-6-6 6 6-6 6',
  arrowUp:'M12 19V5m-6 6 6-6 6 6',
  chevron:'m9 5 7 7-7 7',
  chevronDown:'m6 9 6 6 6-6',
  mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8',
  speaker:'M4 9h4l5-4v14l-5-4H4V9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute:'M4 9h4l5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6',
  sparkle:'m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  play:'m8 4 12 8-12 8V4Z',
  pause:'M8 5v14M16 5v14',
  stop:'M6 6h12v12H6V6Z',
  check:'m5 12 4 4L19 6',
  checkCircle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 12l3 3 5-6',
  close:'m6 6 12 12M6 18 18 6',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
  external:'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
  edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  key:'M14 5a5 5 0 1 1-2 8l-8 8H1v-3l8-8a5 5 0 0 1 5-5Zm3 1h.01',
  device:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm-2 15h14m-7 3h.01',
  logout:'M10 3H4v18h6M9 12h12m-5-5 5 5-5 5',
  info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10h.01',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  copy:'M9 8h12v13H9V8Zm-4 9H3V3h12v2',
  file:'M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8m-8 4h5',
  cloud:'M6 18a4 4 0 0 1-1-7.9A7 7 0 0 1 18.8 9 4.5 4.5 0 1 1 .7 9H6Z',
  refresh:'M21 4v6h-6M3 20v-6h6M5.4 8a7 7 0 0 1 11.6-3L21 10M3 14l4 5a7 7 0 0 0 11.6-3'
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'hidden') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
function icon(name) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('class', 'icon'); node.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[name] || paths.file); node.append(path); return node;
}
function button(text, style = 'secondary', action, iconName) {
  const node = el('button', {class:`button ${style}`,type:'button'}, iconName ? icon(iconName) : null, text);
  if (action) node.addEventListener('click', () => act(node, action));
  return node;
}
function iconButton(name, title, action) {
  const node = el('button', {class:'icon-button',type:'button',title,'aria-label':title}, icon(name));
  if (action) node.addEventListener('click', () => act(node, action)); return node;
}
function field(label, input, help) {
  const id = input.id || `field-${crypto.randomUUID()}`; input.id = id;
  const helpId = `${id}-help`;
  if (help) input.setAttribute('aria-describedby', helpId);
  return el('div',{class:'field'},el('label',{for:id},label),input,help ? el('div',{class:'field-help',id:helpId},help) : null);
}
function readableError(err) { return err?.message || 'Something went wrong. Please try again.'; }
function toast(message, error = false) {
  const node = el('div',{class:`toast${error ? ' error' : ''}`,role:error?'alert':'status'},icon(error?'info':'checkCircle'),el('span',{},message));
  node.append(iconButton('close','Dismiss notification',()=>node.remove()));const stack=$('#toasts');const limit=window.innerWidth<=650?2:3;while(stack.children.length>=limit)stack.firstElementChild.remove();stack.append(node);
  setTimeout(()=>node.remove(),error ? 14000 : 6500);
}
async function act(node, action) {
  if (node.disabled) return; node.disabled = true;
  try { await action(); } catch (err) { toast(readableError(err),true); }
  finally { if (node.isConnected) node.disabled = false; }
}
let state = {user:null,goals:[],artifacts:[],memories:[],messages:[],approvals:[],capabilities:{}};
let currentTab = tabs.some(t=>t[0]===location.hash.slice(1)) ? location.hash.slice(1) : 'talk';
let isAuthenticated = false, refreshPromise = null, sessionVersion = 0, authMode = 'create', goalFilter = 'all', memorySearch = '';
let currentView = '', signatures = {}, expandedGoals = new Set(), focusGoal = null, pendingChat = false, pendingMessage = '';
let recoveryKeyToSave = null, installPrompt = null, lastFetchError = '', voiceState = 'idle', speakReplies = false, recognition = null;
let voiceDraft = '', draft = '', suppressRecognition = false;
let localAI = null, localAILoading = false, localAIHasLoaded = false, localAIStatus = 'Requires WebGPU and a supported desktop or Android browser. Downloads about 0.5 GB the first time. The model runs on your device.';
let localInference=false, generationCounter=0;
const supportsSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const supportsSpeaking = 'speechSynthesis' in window;
const sessionChannel = 'BroadcastChannel' in window ? new BroadcastChannel('lara-session') : null;

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),60000);
  const jsonRequest = !!options.body || !['GET','HEAD'].includes(options.method||'GET');
  const headers = {Accept:'application/json',...(jsonRequest ? {'Content-Type':'application/json'} : {}),...options.headers};
  try {
    const response = await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers,body:jsonRequest ? JSON.stringify(options.body||{}) : undefined,signal:controller.signal});
    let data; const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) data = await response.json(); else data = {error:await response.text()};
    if (!response.ok) {
      if (response.status===401 && isAuthenticated) resetSession('Your session has ended. Open your recovery kit to sign in again.');
      throw Object.assign(new Error(typeof data.error==='string' ? data.error : typeof data.message==='string' ? data.message : `Request failed (${response.status}).`),{status:response.status});
    }
    return data;
  } catch(err) {
    if (err.name==='AbortError') throw new Error('The server is taking longer than expected. Please try again; free hosting may need time to wake up.');
    if (err instanceof TypeError) throw new Error(navigator.onLine ? 'Lara could not reach the server. Please try again in a moment.' : 'You’re offline. Reconnect to continue.');
    throw err;
  } finally { clearTimeout(timeout); }
}
const post = (path,body) => api(path,{method:'POST',body:body||{}});
const patch = (path,body) => api(path,{method:'PATCH',body});
const shortDate = value => { const date = new Date(value); return Number.isNaN(+date) ? '' : date.toLocaleDateString(undefined,{month:'short',day:'numeric'}); };
const time = value => { const date = new Date(value); return Number.isNaN(+date) ? '' : date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); };
const fullDate = value => { const date = new Date(value); return Number.isNaN(+date) ? '' : date.toLocaleString(); };
const size = bytes => !bytes ? '' : bytes<1024 ? `${bytes} B` : bytes<1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
const statusBadge = status => el('span',{class:`status-badge ${Object.hasOwn(statuses,status)?status:''}`},statuses[status]||status||'Ready');
function initials(name) { return (name || 'You').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase(); }
function safeUrl(url) { try { const parsed = new URL(url,location.origin); return ['https:','http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; } }
function downloadJson(filename,data) {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob);
  const link = el('a',{href:url,download:filename}); document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function fileInput(accept,handler) {
  const input = el('input',{type:'file',accept,hidden:true});
  input.addEventListener('change',async()=>{
    const file = input.files[0]; if (!file) {input.remove();return;}
    try { await handler(file); } catch(err) { toast(readableError(err),true); } finally { input.remove(); }
  });
  document.body.append(input); input.click();
  input.addEventListener('cancel',()=>input.remove());
}
async function readJson(file,max = 30*1024*1024) {
  if (file.size>max) throw new Error(`This file is too large. Choose a JSON file under ${Math.round(max/1024/1024)} MB.`);
  try { return JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON. Choose an original Lara recovery kit or backup.'); }
}
function closeModal() { const modal = $('#modal-root dialog'); if(modal){modal.close();modal.remove();} }
function modal(title,subtitle,{wide=false,locked=false}={}) {
  closeModal();
  const dialog = el('dialog',{class:`modal${wide?' modal-wide':''}`,'aria-labelledby':'modal-title'});
  const head = el('div',{class:'modal-header'},el('div',{},el('h2',{id:'modal-title'},title),subtitle?el('p',{},subtitle):null));
  if(!locked)head.append(iconButton('close','Close dialog',()=>closeModal()));
  const body = el('div',{class:'modal-body'}); dialog.append(head,body);
  if(locked)dialog.addEventListener('cancel',event=>event.preventDefault());
  else dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
  dialog.addEventListener('close',()=>dialog.remove()); $('#modal-root').append(dialog); dialog.showModal();
  return {dialog,body};
}
function formError(form,message) { $('.form-error',form)?.remove(); const node=el('div',{class:'form-error',role:'alert'},message); form.append(node); node.scrollIntoView({block:'nearest'}); }
function orb() { return el('div',{class:'orb-wrap','aria-hidden':'true'},el('div',{class:'orb-aura'}),el('div',{class:'orb'})); }

function renderAuth(message) {
  currentView=''; signatures={};
  const art = el('section',{class:'auth-art','aria-label':'About Lara'},el('div',{class:'brand'},el('div',{class:'brand-mark'},'l'),el('div',{class:'brand-word'},'lara')),
    el('div',{class:'auth-art-content'},orb(),el('h1',{},'A little less to do.',el('br'),el('span',{},'A little more space.')),el('p',{},'A personal operator for the things you want to move forward. With a memory, a plan, and something real to show for it.')),
    el('div',{class:'auth-art-footer'},icon('lock'),'Your workspace. Your memory. Your control.'));
  const content = el('div',{class:'auth-content'},el('div',{class:'auth-mobile-brand'},el('div',{class:'brand-mark'},'l'),el('div',{class:'brand-word'},'lara')),
    el('div',{class:'eyebrow'},'A quieter kind of productivity'),el('h2',{},authMode==='create'?'Make room for more.':'Welcome back.'),el('p',{},authMode==='create'?'Meet Lara. Give your ideas a place to become useful, finished work.':'Your goals, memory, and artifacts are right where you left them.'));
  if(message)content.append(el('div',{class:'connection-error',role:'status'},message));
  content.append(el('div',{class:'auth-tabs',role:'tablist','aria-label':'Workspace access'},...['create','recover'].map(mode=>el('button',{type:'button',class:mode===authMode?'active':'',role:'tab','aria-selected':mode===authMode,onclick:()=>{authMode=mode;renderAuth();}},mode==='create'?'New workspace':'Recover workspace'))));
  const form=el('form'); const submit=button(authMode==='create'?'Create my workspace':'Open my workspace','primary full',null,'arrow'); submit.type='submit';
  if(authMode==='create'){
    const name=el('input',{name:'name',type:'text',autocomplete:'given-name',placeholder:'What should Lara call you?',required:true,maxlength:80});
    form.append(field('Your name',name),submit);
    form.addEventListener('submit',async event=>{event.preventDefault();await act(submit,async()=>{try{const result=await post('/api/auth/create',{name:name.value.trim()});await enterWorkspace(result);sessionChannel?.postMessage('signed-in');if(result.recoveryKey)showRecoveryKit(result.recoveryKey);}catch(err){formError(form,readableError(err));}});});
  }else{
    const key=el('textarea',{name:'recoveryKey',rows:'3',placeholder:'Paste the recovery key from your kit',required:true,autocomplete:'off',autocapitalize:'off',spellcheck:'false',maxlength:500});
    form.append(field('Recovery key',key,'Use the recovery kit you saved when you created this workspace. A phone, email, or password is not required.'),button('Choose recovery kit file','secondary full',()=>fileInput('.json,application/json',async file=>{const kit=await readJson(file,1024*1024);if(typeof kit.recoveryKey!=='string')throw new Error('This is not a Lara recovery kit. Your kit contains a recoveryKey.');key.value=kit.recoveryKey;toast('Recovery kit loaded. Open your workspace to continue.');}),'upload'),el('div',{style:'height:12px'}),submit);
    form.addEventListener('submit',async event=>{event.preventDefault();await act(submit,async()=>{try{const result=await post('/api/auth/recover',{recoveryKey:key.value.trim()});key.value='';await enterWorkspace(result);sessionChannel?.postMessage('signed-in');}catch(err){formError(form,readableError(err));}});});
  }
  content.append(form,el('div',{class:'auth-disclaimer'},icon('shield'),el('span',{},authMode==='create'?'No password. No phone dependency. You’ll save a recovery kit to securely open Lara on another device.':'Anyone with your recovery key can open your workspace. Enter it only on your Lara server.')));
  app.replaceChildren(el('div',{class:'auth-layout'},art,el('main',{class:'auth-panel',id:'main'},content)));
}
async function enterWorkspace(result) {
  sessionVersion++;isAuthenticated=true;state.user=result.user;state.capabilities=result.capabilities||{};renderShell();await refresh(true);
}
function resetSession(message) {
  sessionVersion++;generationCounter++;localInference=false;localAI?.interruptLocalAI?.();isAuthenticated=false;state={user:null,goals:[],artifacts:[],memories:[],messages:[],approvals:[],capabilities:{}};draft='';pendingMessage='';pendingChat=false;recoveryKeyToSave=null;localAI?.disableLocalAI();
  stopVoice();closeModal();authMode='recover';renderAuth(message);
}
function showRecoveryKit(key) {
  recoveryKeyToSave=key;
  const {body}=modal('Your way back in.','Save this once. Keep it somewhere you can access if you lose this device.',{locked:true});
  const kit={format:'lara-recovery-v1',server:location.origin,workspaceId:state.user?.id,name:state.user?.name,recoveryKey:key,createdAt:new Date().toISOString()};
  body.append(el('div',{class:'recovery-success'},icon('key')),el('div',{class:'callout warning'},'This key grants full access to your workspace. Lara cannot recover it for you. Save a copy in a password manager, encrypted drive, or a safe place on paper.'),el('code',{class:'recovery-key'},key));
  body.append(el('div',{class:'recovery-save-buttons'},button('Save recovery kit','primary',()=>{downloadJson('lara-recovery-kit.json',kit);toast('Recovery kit download started. Check that the file is saved.');},'download'),button('Copy key','secondary',async()=>{if(!navigator.clipboard)throw new Error('Clipboard is unavailable. Select the key above and copy it, or save the kit.');await navigator.clipboard.writeText(key);toast('Recovery key copied. Store it securely.');},'copy')));
  const checkbox=el('input',{type:'checkbox'});const done=button('Enter my workspace','primary full',()=>{recoveryKeyToSave=null;closeModal();},'arrow');done.disabled=true;
  checkbox.addEventListener('change',()=>done.disabled=!checkbox.checked);
  body.append(el('p',{class:'recovery-note'},'Your workspace data stays on the server. This kit restores access from another device. Download a separate data backup in Settings to recover if the server is ever lost.'),el('label',{class:'check-field'},checkbox,el('span',{},'I saved my recovery kit somewhere outside this device.')),done);
}

function renderShell() {
  const nav=el('nav',{class:'nav-list','aria-label':'Main navigation'},...tabs.map(([id,label,name])=>el('button',{type:'button',class:`nav-button${currentTab===id?' active':''}`,dataset:{tab:id},'aria-current':currentTab===id?'page':null,onclick:()=>navigate(id)},icon(name),el('span',{},label),id==='goals'?el('span',{class:'nav-count',id:'goal-nav-count',hidden:true}):null)));
  const sidebar=el('aside',{class:'sidebar'},el('div',{class:'brand'},el('div',{class:'brand-mark'},'l'),el('div',{class:'brand-word'},'lara')),el('div',{class:'brand-subtitle'},'Your personal operator'),nav,
    el('div',{class:'sidebar-bottom'},el('div',{class:'workspace-note'},icon('shield'),el('span',{},'A private space to think,',el('br'),'make, and move forward.')),el('button',{class:'profile-button',type:'button',onclick:()=>navigate('settings')},el('div',{class:'avatar',id:'profile-avatar'},initials(state.user?.name)),el('div',{class:'profile-meta'},el('strong',{id:'profile-name'},state.user?.name||'Your workspace'),el('span',{},'Personal workspace')),icon('chevronDown'))));
  const approvals=iconButton('bell','View permissions and approvals',showApprovals);approvals.id='approval-button';approvals.append(el('span',{class:'notification-dot',id:'approval-count',hidden:true}));
  const topbar=el('header',{class:'topbar'},el('div',{class:'breadcrumb'},el('span',{},'Workspace'),icon('chevron'),el('strong',{id:'breadcrumb-current'},tabs.find(t=>t[0]===currentTab)[1])),el('div',{class:'top-actions'},el('div',{class:'status-pill',title:'Private data is stored on your Lara server.'},el('span',{class:'online-dot'}),'Private workspace'),approvals));
  app.replaceChildren(el('div',{class:'shell'},sidebar,el('div',{class:'workspace'},topbar,el('main',{class:'main',id:'main',tabindex:'-1'}))));
  currentView='';signatures={};renderCurrent();
}
function navigate(tab) {
  if(!tabs.some(t=>t[0]===tab))return;currentTab=tab;location.hash=tab;
  for(const node of document.querySelectorAll('.nav-button')){node.classList.toggle('active',node.dataset.tab===tab);if(node.dataset.tab===tab)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
  if($('#breadcrumb-current'))$('#breadcrumb-current').textContent=tabs.find(t=>t[0]===tab)[1];
  renderCurrent();
}
function renderCurrent() {
  if(!isAuthenticated||!$('#main'))return;
  if(currentView!==currentTab){currentView=currentTab;signatures[currentTab]='';$('#main').replaceChildren();({talk:buildTalk,goals:buildGoals,artifacts:buildArtifacts,memory:buildMemory,settings:buildSettings}[currentTab])();}
  updateChrome();({talk:updateTalk,goals:updateGoals,artifacts:updateArtifacts,memory:updateMemory,settings:updateSettings}[currentTab])();
}
function updateChrome() {
  const active=state.goals.filter(goal=>['running','queued','awaiting_approval'].includes(goal.status)).length;
  const count=$('#goal-nav-count');if(count){count.textContent=active;count.hidden=!active;}
  const pending=state.approvals.filter(approval=>approval.status==='pending').length;
  const approvals=$('#approval-count');if(approvals){approvals.textContent=pending;approvals.hidden=!pending;$('#approval-button').setAttribute('aria-label',`View permissions and approvals${pending?`, ${pending} pending`:''}`);}
  if($('#profile-name'))$('#profile-name').textContent=state.user?.name||'Your workspace';
  if($('#profile-avatar'))$('#profile-avatar').textContent=initials(state.user?.name);
}
async function refresh(force=false) {
  if(!isAuthenticated||(!force&&document.hidden))return;
  if(refreshPromise){if(!force)return refreshPromise;await refreshPromise;if(!isAuthenticated)return;}
  const version=sessionVersion;
  refreshPromise=(async()=>{
    try {
      const data=await api('/api/state');if(version!==sessionVersion||!isAuthenticated)return;
      state={...state,...data};for(const key of ['goals','artifacts','memories','messages','approvals'])if(!Array.isArray(state[key]))state[key]=[];
      lastFetchError='';renderCurrent();
    }catch(err){if(isAuthenticated&&force)throw err;if(isAuthenticated&&lastFetchError!==readableError(err)){lastFetchError=readableError(err);toast(lastFetchError,true);}}
    finally{refreshPromise=null;}
  })();
  return refreshPromise;
}
function pageHeader(eyebrow,title,description,action) {
  return el('div',{class:'section-head'},el('div',{},el('div',{class:'eyebrow'},eyebrow),el('h1',{},title),el('p',{},description)),action);
}
function empty(iconName,title,description,action) {return el('div',{class:'empty'},icon(iconName),el('h2',{},title),el('p',{},description),action);}
function buildTalk() {
  const page=el('div',{class:'talk-page',id:'talk-page'},el('div',{class:'talk-topline'},el('div',{class:'eyebrow'},'A little space for your next thing'),el('div',{class:'engine-label',id:'engine-label',title:'Built-in operator. Runs supported workflows without a paid model API.'},icon('sparkle'),'Built-in operator')),
    el('section',{class:'talk-hero',id:'talk-hero'},orb(),el('h1',{},'A little less to do.',el('br'),el('span',{class:'soft'},'A little more space.')),el('p',{id:'greeting'},`Hi ${state.user?.name||'there'}. What would you like to move forward?`)),
    el('div',{class:'chat-stream',id:'chat-stream',role:'log','aria-live':'polite','aria-relevant':'additions text','aria-label':'Conversation'}));
  const input=el('textarea',{id:'chat-input',rows:2,placeholder:'Give me something to work on…','aria-label':'Message Lara',maxlength:5000,value:draft});
  input.addEventListener('input',()=>{draft=input.value;input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,150)}px`;updateVoiceUI();});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&window.innerWidth>650){event.preventDefault();sendChat();}});
  const mic=iconButton('mic',supportsSpeech?'Tap to dictate a message':'Voice input is unavailable in this browser',toggleListening);mic.id='mic-button';if(!supportsSpeech){mic.disabled=true;mic.setAttribute('aria-disabled','true');}
  const speaker=iconButton(speakReplies?'speaker':'mute',speakReplies?'Turn spoken replies off':'Turn spoken replies on',()=>{speakReplies=!speakReplies;if(!speakReplies)stopSpeaking();updateVoiceUI();toast(speakReplies?'Spoken replies are on.':'Spoken replies are off.');});speaker.id='speaker-button';speaker.disabled=!supportsSpeaking;
  const send=el('button',{class:'send-button',type:'submit',id:'send-button','aria-label':'Send message',title:'Send message'},icon('arrowUp'));
  const stop=iconButton('stop','Stop generation',stopGeneration);stop.id='stop-generation';stop.hidden=true;
  const form=el('form',{class:'composer',onsubmit:event=>{event.preventDefault();sendChat();}},input,el('div',{class:'composer-bottom'},el('div',{class:'composer-tools'},mic,speaker,stop,el('span',{class:'composer-mode',id:'voice-status',role:'status'},icon('sparkle'),'Ready when you are')),send));
  page.append(el('div',{class:'composer-wrap'},form,el('div',{class:'composer-hint',id:'composer-hint'},'Lara can make mistakes. Every completed goal includes verification evidence.')));
  const suggestions=[{kind:'site',title:'Make something',sub:'A one-page site for your idea',icon:'globe'},{kind:'budget',title:'Get organized',sub:'A budget that adds up',icon:'sheet'},{kind:'security',title:'Check your setup',sub:'A private security review',icon:'shield'}];
  page.append(el('div',{class:'suggestions',id:'talk-suggestions'},...suggestions.map(item=>el('button',{type:'button',class:'suggestion',onclick:()=>showNewGoal(item.kind)},el('div',{class:'suggestion-icon'},icon(item.icon)),el('strong',{},item.title),el('span',{},item.sub)))));
  page.append(el('section',{class:'workspace-overview',id:'workspace-overview'},el('div',{class:'mini-heading'},el('h2',{},'A few things we could start'),el('button',{class:'text-link',type:'button',onclick:()=>navigate('goals')},'View all goals',icon('arrow'))),el('div',{class:'mini-goals',id:'mini-goals'})),el('div',{class:'talk-footer'},icon('lock'),'Private by default',el('span',{},'·'),'You approve the important things',el('span',{},'·'),'You’re always in control'));
  $('#main').append(page);updateVoiceUI();
}
function updateTalk() {
  const signature=JSON.stringify([state.messages,pendingChat,pendingMessage]);
  const actual=state.messages.length>1||state.messages.some(message=>message.role==='user')||pendingChat;
  $('#talk-page').classList.toggle('has-conversation',actual);$('#talk-hero').classList.toggle('compact',actual);
  if(signatures.talk!==signature){
    signatures.talk=signature;const stream=$('#chat-stream');const nearBottom=stream.scrollHeight-stream.clientHeight-stream.scrollTop<100;
    stream.replaceChildren(...state.messages.map(renderMessage));
    if(pendingMessage&&!state.messages.some(message=>message.role==='user'&&message.content===pendingMessage))stream.append(renderMessage({role:'user',content:pendingMessage}));
    if(pendingChat)stream.append(el('div',{class:'message pending'},el('div',{class:'message-mark'},'l'),el('div',{class:'message-body'},el('div',{class:'message-name'},'Lara'),el('div',{class:'typing-dots','aria-label':'Lara is thinking'},el('span'),el('span'),el('span')))));
    if(nearBottom||pendingChat)requestAnimationFrame(()=>stream.scrollTop=stream.scrollHeight);
  }
  const mini=$('#mini-goals');const next=state.goals.slice(0,3);mini.replaceChildren(...next.map(goal=>el('button',{class:'mini-goal',type:'button',onclick:()=>{expandedGoals.add(goal.id);focusGoal=goal.id;navigate('goals');}},icon(kinds[goal.kind]?.icon||'target'),el('div',{},el('strong',{},goal.title),el('span',{},statuses[goal.status]||'Ready to start')))));
  $('#workspace-overview').hidden=!next.length;$('#greeting').textContent=`Hi ${state.user?.name||'there'}. What would you like to move forward?`;updateVoiceUI();updateLocalAIUI();
}
function renderMessage(message) {
  const user=message.role==='user';return el('article',{class:`message ${user?'user':'assistant'}`},user?null:el('div',{class:'message-mark','aria-hidden':'true'},'l'),el('div',{class:'message-body'},el('div',{class:'message-name'},user?'You':message.engine==='on-device AI'?'Lara · on-device AI':'Lara',message.createdAt?el('time',{datetime:message.createdAt},time(message.createdAt)):null),el('div',{class:'message-content'},message.content||'')));
}
async function sendChat() {
  if(pendingChat)return;const input=$('#chat-input');const message=(input?.value||draft).trim();if(!message)return;
  if(!navigator.onLine){toast('You’re offline. Your message is still here; reconnect to send it.',true);return;}
  const version=sessionVersion,generation=++generationCounter;
  const ensureActive=()=>{if(version!==sessionVersion||generation!==generationCounter)throw Object.assign(new Error('Generation stopped. Your prompt is still in the composer.'),{cancelled:true});};
  stopSpeaking();if(recognition){suppressRecognition=true;recognition.stop();}pendingChat=true;pendingMessage=message;draft='';if(input){input.value='';input.style.height='auto';}voiceState='thinking';updateTalk();
  try{
    let response;
    const localReady=localAI?.isLocalAIReady();
    const wantsArtifact=/\b(build|make|create|generate|design)\b/i.test(message)&&/\b(app|application|website|web page|site|landing page)\b/i.test(message);
    const builtIn=/\b(remember|forget|memory|pause|resume|stop|cancel|kill|run|approve|deny|publish|unpublish|delete|export|import|recovery|security|scan|pentest|penetration|budget|spreadsheet|research|sources?|status|goals?|tasks?|progress)\b/i.test(message);
    if(localReady&&wantsArtifact&&!builtIn){
      localInference=true;updateVoiceUI();
      const kind=/\b(app|application)\b/i.test(message)?'app':'site';
      const html=await localAI.generateLocalArtifact(message,kind,state);
      ensureActive();localInference=false;updateVoiceUI();
      const result=await post('/api/goals',{kind,title:message.slice(0,100),prompt:message,generatedHtml:html});
      ensureActive();
      response=await post('/api/chat',{message,localReply:'I generated a draft and sent it through the server’s checks. Open the goal to review the result. Its behavior needs to be tested before it can be marked complete.'});
      response.goal=result.goal||result;
    }else if(localReady&&!builtIn){
      localInference=true;updateVoiceUI();
      const reply=await localAI.localConversation(message,state);
      ensureActive();localInference=false;updateVoiceUI();
      response=await post('/api/chat',{message,localReply:reply});
    }else response=await post('/api/chat',{message});
    ensureActive();await refresh(true);ensureActive();
    if(response.approval)toast('An action is waiting for your approval. Open the bell to review it.');
    if(response.goal)toast('Goal added. Follow its progress in Goals.');
    const answer=typeof response.message==='string'?response.message:response.message?.content;
    if(speakReplies&&answer)speak(answer);
  }catch(err){if(version===sessionVersion){draft=message;if($('#chat-input'))$('#chat-input').value=message;toast(readableError(err),!err.cancelled);}}
  finally{if(version===sessionVersion){localInference=false;pendingChat=false;pendingMessage='';if(['thinking','stopping'].includes(voiceState))voiceState='idle';if(currentTab==='talk')updateTalk();}}
}
function stopGeneration(){if(!localInference)return;generationCounter++;localAI?.interruptLocalAI?.();localInference=false;voiceState='stopping';updateVoiceUI();}
function updateVoiceUI() {
  const status=$('#voice-status');if(!status)return;
  const labels={idle:'Ready when you are',listening:'Listening…',thinking:'Thinking…',speaking:'Speaking…',stopping:'Stopping…'};
  status.replaceChildren(icon(voiceState==='listening'?'mic':'sparkle'),labels[voiceState]||labels.idle);
  const mic=$('#mic-button');mic?.classList.toggle('listening',voiceState==='listening');if(mic&&supportsSpeech)mic.title=voiceState==='listening'?'Stop dictation':'Tap to dictate a message';
  const speaker=$('#speaker-button');if(speaker){speaker.classList.toggle('active',speakReplies);speaker.replaceChildren(icon(speakReplies?'speaker':'mute'));speaker.setAttribute('aria-pressed',String(speakReplies));speaker.setAttribute('aria-label',speakReplies?'Turn spoken replies off':'Turn spoken replies on');}
  if($('#send-button'))$('#send-button').disabled=pendingChat||!($('#chat-input')?.value||draft).trim();
  if($('#stop-generation'))$('#stop-generation').hidden=!localInference;
  if($('#composer-hint'))$('#composer-hint').textContent=voiceState==='listening'?'Listening. Tap the microphone to stop; review your words before sending.':!supportsSpeech?'Voice input isn’t supported in this browser. Typing and available spoken replies still work.':'Lara can make mistakes. Every completed goal includes verification evidence.';
}
function toggleListening() {
  if(!supportsSpeech)return;
  if(recognition){recognition.stop();return;}
  stopSpeaking();const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;recognition=new SpeechRecognition();recognition.lang=navigator.language||'en-US';recognition.interimResults=true;recognition.continuous=false;
  voiceDraft=$('#chat-input')?.value||draft;suppressRecognition=false;
  recognition.onstart=()=>{voiceState='listening';updateVoiceUI();};
  recognition.onresult=event=>{if(suppressRecognition)return;let transcript='';for(let i=0;i<event.results.length;i++)transcript+=event.results[i][0].transcript;draft=[voiceDraft,transcript].filter(Boolean).join(' ');if($('#chat-input'))$('#chat-input').value=draft;updateVoiceUI();};
  recognition.onerror=event=>{if(event.error==='aborted')return;const message=event.error==='not-allowed'?'Microphone permission was denied. Allow it in your browser settings, or keep typing.':event.error==='no-speech'?'No speech was detected. Tap the microphone and try again.':'Voice recognition is unavailable right now. You can keep typing.';toast(message,true);};
  recognition.onend=()=>{recognition=null;if(voiceState==='listening')voiceState='idle';updateVoiceUI();};
  try{recognition.start();}catch(err){recognition=null;voiceState='idle';updateVoiceUI();toast('Voice input could not start. Please try again or type your message.',true);}
}
function speak(text) {if(!supportsSpeaking)return;stopSpeaking();const utterance=new SpeechSynthesisUtterance(text.slice(0,6000));utterance.rate=1;utterance.onstart=()=>{voiceState='speaking';updateVoiceUI();};utterance.onend=utterance.onerror=()=>{if(voiceState==='speaking')voiceState='idle';updateVoiceUI();};speechSynthesis.speak(utterance);}
function stopSpeaking(){if(supportsSpeaking)speechSynthesis.cancel();if(voiceState==='speaking')voiceState='idle';updateVoiceUI();}
function stopVoice(){if(recognition){suppressRecognition=true;recognition.abort();recognition=null;}stopSpeaking();voiceState='idle';}
async function enableLocalAI(){
  if(localAILoading)return;localAILoading=true;updateLocalAIUI();
  try{
    localAI ||= await import('/local-ai.js');
    await localAI.initializeLocalAI({getState:()=>state,onStatus:status=>{localAIStatus=String(status);updateLocalAIUI();}});
    localAIHasLoaded=true;toast('On-device AI is ready. Routine actions still use Lara’s checked workflows.');
  }catch(error){localAIStatus=readableError(error);toast(localAIStatus,true);}
  finally{localAILoading=false;updateLocalAIUI();}
}
function updateLocalAIUI(){
  const ready=!!localAI?.isLocalAIReady();
  const load=$('#ai-load');if(load){load.disabled=localAILoading||ready;load.replaceChildren(icon('sparkle'),localAILoading?'Loading on-device AI…':ready?'On-device AI enabled':'Enable on-device AI');}
  const status=$('#ai-status');if(status)status.textContent=localAIStatus;
  const toggle=$('#ai-enabled');if(toggle){toggle.disabled=!localAIHasLoaded||localAILoading;toggle.checked=ready;}
  const engine=$('#engine-label');if(engine){engine.replaceChildren(icon('sparkle'),ready?'On-device AI + operator':'Built-in operator');engine.title=ready?'Conversation runs on this device. Supported actions use server workflows and permission checks.':'Built-in operator. Runs supported workflows without a paid model API.';}
}

function buildGoals() {
  $('#main').append(pageHeader('From intention to something real','Your goals','Give Lara an outcome. Watch the work, check the evidence, and take over whenever you need to.',button('New goal','primary',()=>showNewGoal(),'plus')),
    el('div',{class:'filter-row',id:'goal-filters'},...['all','active','completed','paused'].map(filter=>el('button',{type:'button',class:`filter-button${goalFilter===filter?' active':''}`,dataset:{filter},onclick:()=>{goalFilter=filter;signatures.goals='';updateGoals();}},({all:'All goals',active:'In progress',completed:'Verified',paused:'Paused'})[filter])),el('span',{class:'filter-summary',id:'goal-summary'})),el('div',{class:'goal-list',id:'goal-list'}),el('div',{class:'page-note'},icon('checkCircle'),'A goal is complete only after its output passes the workflow’s checks. Evidence shows exactly what was tested.'));
}
function filteredGoals() {return state.goals.filter(goal=>goalFilter==='all'||goalFilter==='active'&&['running','queued','awaiting_approval'].includes(goal.status)||goalFilter==='completed'&&goal.status==='completed'||goalFilter==='paused'&&['paused','idle'].includes(goal.status));}
function updateGoals() {
  const signature=JSON.stringify([state.goals,state.artifacts,goalFilter,[...expandedGoals]]);if(signatures.goals===signature)return;signatures.goals=signature;
  for(const node of document.querySelectorAll('#goal-filters .filter-button'))node.classList.toggle('active',node.dataset.filter===goalFilter);
  const goals=filteredGoals();$('#goal-summary').textContent=`${goals.length} ${goals.length===1?'goal':'goals'}`;
  $('#goal-list').replaceChildren(...(goals.length?goals.map(renderGoal):[empty('target','A little room for your next idea.','Create a goal and Lara will plan, make, and verify the result.',button('Create a goal','primary',()=>showNewGoal(),'plus'))]));
  if(focusGoal){const id=focusGoal;focusGoal=null;requestAnimationFrame(()=>{const node=document.getElementById(`goal-${id}`);node?.scrollIntoView({block:'nearest',behavior:'smooth'});node?.classList.add('goal-highlight');});}
}
function renderGoal(goal) {
  const kind=kinds[goal.kind]||{icon:'target',label:'Goal'};const expanded=expandedGoals.has(goal.id);const needsReview=goal.needsReview&&goal.status==='paused';
  const top=el('div',{class:'goal-card-top'},el('div',{class:`kind-icon ${kinds[goal.kind]?goal.kind:''}`},icon(kind.icon)),el('div',{class:'goal-title-block'},el('div',{class:'goal-title'},el('h2',{},goal.title),statusBadge(needsReview?'review':goal.status)),el('p',{},goal.prompt||kind.label),el('div',{class:'goal-meta'},el('span',{},kind.label),el('span',{},shortDate(goal.createdAt)),goal.artifactIds?.length?el('span',{},`${goal.artifactIds.length} artifact${goal.artifactIds.length===1?'':'s'}`):null)));
  const controls=el('div',{class:'goal-controls'});
  if(['paused','idle','failed'].includes(goal.status)&&!goal.needsReview)controls.append(button(goal.status==='failed'?'Retry':goal.status==='paused'&&goal.trace?.length?'Resume':'Run goal','primary sm',()=>goalAction(goal,goal.status==='paused'&&goal.trace?.length?'resume':'run'),'play'));
  if(needsReview){const artifact=state.artifacts.find(item=>item.goalId===goal.id);if(artifact)controls.append(artifactLink(artifact,'Open draft','secondary sm','external'));controls.append(button('Record check','primary sm',()=>showVerification(goal),'checkCircle'));}
  if(['running','queued'].includes(goal.status))controls.append(button('Pause','secondary sm',()=>goalAction(goal,'pause'),'pause'));
  if(['running','queued','paused','awaiting_approval'].includes(goal.status))controls.append(button('Stop','quiet sm',()=>goalAction(goal,'cancel'),'stop'));
  if(goal.status==='awaiting_approval')controls.append(button('Review','primary sm',showApprovals,'shield'));
  if(goal.status==='completed'&&goal.artifactIds?.length)controls.append(button('Open output','secondary sm',()=>{navigate('artifacts');},'folder'));
  const detailButton=button(expanded?'Hide details':'View trace & checks','quiet sm',()=>{expandedGoals.has(goal.id)?expandedGoals.delete(goal.id):expandedGoals.add(goal.id);signatures.goals='';updateGoals();},expanded?'chevronDown':'chevron');detailButton.setAttribute('aria-expanded',String(expanded));detailButton.setAttribute('aria-controls',`details-${goal.id}`);
  const card=el('article',{class:'goal-card',id:`goal-${goal.id}`},top,el('div',{class:'goal-card-bottom'},controls,detailButton));
  if(expanded){
    const plan=el('section',{class:'detail-section'},el('h3',{},'The plan'),goal.plan?.length?el('ol',{class:'plan-list'},...goal.plan.map((step,index)=>el('li',{},el('span',{class:'step-number'},index+1),typeof step==='string'?step:step.title||step.description||JSON.stringify(step)))):el('p',{class:'small muted'},'The plan is created when this goal starts.'));
    const evidence=el('div',{class:'evidence-list'},el('h3',{},'Verification evidence'));
    if(goal.evidence?.length)evidence.append(...goal.evidence.map(check=>el('div',{class:`evidence-item${check.passed===false?' failed':''}`},icon(check.passed===false?'info':'checkCircle'),el('div',{},el('strong',{},check.label||check.name||'Check'),el('p',{},check.detail||check.details||'')))));else evidence.append(el('p',{class:'small muted'},'Checks will appear here after the work is produced.'));
    plan.append(evidence);
    const trace=el('section',{class:'detail-section'},el('h3',{},'Live activity'),goal.trace?.length?el('ol',{class:'trace'},...goal.trace.map(event=>el('li',{},el('time',{datetime:event.at||event.createdAt||''},time(event.at||event.createdAt)),el('span',{class:'trace-phase'},event.phase?`${event.phase} · `:''),event.message||event.detail||''))):el('p',{class:'small muted'},'Nothing has run yet. Start this goal to follow the work.'));
    const details=el('div',{class:'goal-details',id:`details-${goal.id}`},el('div',{class:'detail-columns'},plan,trace));
    const outputs=state.artifacts.filter(artifact=>artifact.goalId===goal.id);if(outputs.length)details.append(el('div',{class:'detail-artifacts'},...outputs.map(artifact=>artifactLink(artifact,'Open '+artifact.title,'secondary sm','external'))));
    card.append(details);
  }
  return card;
}
async function goalAction(goal,action){await patch(`/api/goals/${encodeURIComponent(goal.id)}`,{action});await refresh(true);toast(action==='cancel'?'Goal stopped.':action==='pause'?'Goal paused.':'Goal queued. Follow the trace as Lara works.');}
function showVerification(goal){
  const {body}=modal('Check the draft in use.','Static checks cannot prove an app behaves correctly. Record the testing you actually performed.');
  const form=el('form');const artifact=state.artifacts.find(item=>item.goalId===goal.id);
  const notes=el('textarea',{name:'notes',rows:5,required:true,minlength:20,maxlength:2000,placeholder:'e.g. I started, paused, and reset the timer. I changed the duration and checked that the countdown used the new value. All controls behaved as expected.'});
  const confirmed=el('input',{type:'checkbox',required:true});const submit=button('Record passing check','primary',null,'checkCircle');submit.type='submit';
  form.append(el('div',{class:'callout warning'},'Open the draft and test its main controls, inputs, and mobile layout. If something fails, keep the goal as a draft. A passing check records your verification as human evidence.'),artifact?artifactLink(artifact,'Open the draft to test','secondary','external'):null,el('div',{style:'height:18px'}),field('What did you test, and what happened?',notes),el('label',{class:'check-field'},confirmed,el('span',{},'I tested this output and the behavior described above worked.')),el('div',{class:'modal-actions'},button('Keep as draft','secondary',closeModal),submit));
  form.addEventListener('submit',async event=>{event.preventDefault();await act(submit,async()=>{try{await post(`/api/goals/${encodeURIComponent(goal.id)}/verify`,{notes:notes.value.trim()});closeModal();await refresh(true);toast('Your verification evidence was recorded.');}catch(error){formError(form,readableError(error));}});});body.append(form);
}
function showNewGoal(initialKind='site') {
  const {body}=modal('What shall we make?','Give Lara a clear outcome. It will plan the work and verify the result.');
  const form=el('form');const kind=el('select',{name:'kind'},...Object.entries(kinds).map(([value,item])=>el('option',{value},item.label)));kind.value=initialKind;
  const title=el('input',{name:'title',type:'text',placeholder:'A short name for this goal',maxlength:140,required:true});
  const prompt=el('textarea',{name:'prompt',rows:'4',placeholder:'Describe what you want, who it’s for, and any details that matter.',maxlength:5000,required:true});
  const extras=el('div',{id:'goal-extras'});const submit=button('Create & run','primary',null,'play');submit.type='submit';
  form.append(field('What do you want to make?',kind),field('Goal name',title),field('The outcome',prompt),extras,el('div',{class:'modal-actions'},button('Cancel','secondary',closeModal),submit));
  const defaults={site:{title:'My one-page site',prompt:'Create a polished one-page website for my personal project. Include a clear introduction, useful features, and a contact section.'},budget:{title:'My monthly budget',prompt:'Build a working monthly budget spreadsheet with income, expense categories, savings, totals, and formulas. Use INR and include clearly labeled example amounts I can edit.'},research:{title:'My research note',prompt:'Read the sources below and create a concise research note. Include direct source links, the main findings, and any limitations.'},security:{title:'Lara self-security review',prompt:'Review this Lara workspace’s security controls, recovery, permissions, and persistence. Report evidence and limitations clearly.'},app:{title:'My focus app',prompt:'Build a working focus timer app with start, pause, reset, and editable work duration. Make it usable on mobile and provide a downloadable HTML file.'}};
  let previousDefault=null;
  function changeKind(){const value=kind.value;const preset=defaults[value];if(!title.value||title.value===previousDefault?.title)title.value=preset.title;if(!prompt.value||prompt.value===previousDefault?.prompt)prompt.value=preset.prompt;previousDefault=preset;extras.replaceChildren();
    if(value==='research')extras.append(field('Source URLs',el('textarea',{name:'sourceUrls',rows:'3',placeholder:'https://example.org/article\nhttps://another-source.org/report',required:true,maxlength:4000}),'One public HTTPS URL per line. Lara fetches the sources and records what it can verify.'));
    if(value==='security'){
      const target=el('input',{name:'targetUrl',type:'url',placeholder:'https://your-site.example',maxlength:500});
      const challenge=state.capabilities?.securityChallenge;
      const targetDetails=el('div',{hidden:true});
      if(challenge)targetDetails.append(el('div',{class:'callout'},el('p',{},'Verify control of the target by serving this text at ',el('code',{id:'challenge-path'},'https://your-site.example/.well-known/lara-authorization.txt')),el('code',{},challenge),button('Copy verification text','quiet sm',async()=>{await navigator.clipboard.writeText(challenge);toast('Verification text copied.');},'copy')));
      targetDetails.append(el('label',{class:'check-field'},el('input',{name:'authorization',type:'checkbox'}),el('span',{},'I own this target or have permission to assess it. I authorize non-destructive HTTPS configuration checks.')));
      target.addEventListener('input',()=>{targetDetails.hidden=!target.value.trim();const authorization=$('input[name="authorization"]',targetDetails);authorization.required=!!target.value.trim();const path=$('#challenge-path',targetDetails);if(path){try{path.textContent=`${new URL(target.value).origin}/.well-known/lara-authorization.txt`;}catch{path.textContent='https://your-site.example/.well-known/lara-authorization.txt';}}});
      extras.append(field('Target website (optional)',target,'Leave blank to review Lara itself. External checks require target ownership verification. This workflow checks public HTTPS configuration; it does not exploit devices or scan private networks.'),targetDetails);
    }
    if(value==='app')extras.append(el('div',{class:'callout'},'Lara’s built-in app builder creates supported, standalone browser apps. The result runs in your browser and can be downloaded. Complex full-stack applications need a connected coding model and execution environment.'));
  }
  kind.addEventListener('change',changeKind);changeKind();
  form.addEventListener('submit',async event=>{event.preventDefault();await act(submit,async()=>{try{
    const data={title:title.value.trim(),prompt:prompt.value.trim(),kind:kind.value};
    if(kind.value==='research')data.sourceUrls=$('textarea[name="sourceUrls"]',extras).value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    if(kind.value==='security'){const target=$('input[name="targetUrl"]',extras).value.trim();if(target){data.targetUrl=target;data.authorization=$('input[name="authorization"]',extras).checked;}}
    const result=await post('/api/goals',data);closeModal();const goal=result.goal||result;if(goal.id){expandedGoals.add(goal.id);focusGoal=goal.id;}goalFilter='all';navigate('goals');await refresh(true);toast('Goal created. Lara is getting to work.');
  }catch(err){formError(form,readableError(err));}});});body.append(form);title.focus();
}

function buildArtifacts(){ $('#main').append(pageHeader('The work, made real','Your artifacts','Pages, spreadsheets, apps, and notes you can open, download, and keep.',button('Make something','primary',()=>showNewGoal(),'plus')),el('div',{class:'filter-row'},el('span',{class:'filter-button active'},'All artifacts'),el('span',{class:'filter-summary',id:'artifact-summary'})),el('div',{class:'artifact-grid',id:'artifact-grid'}),el('div',{class:'page-note'},icon('lock'),'Artifacts are private until you approve publishing. Downloaded files are yours to keep.')); }
function artifactLink(artifact,label,style='secondary sm',iconName='external',download=false){return el('a',{class:`button ${style}`,href:`/api/artifacts/${encodeURIComponent(artifact.id)}/content${download?'?download=1':''}`,target:download?null:'_blank',rel:download?null:'noopener noreferrer',download:download?artifact.filename:null},icon(iconName),label);}
function updateArtifacts(){
  const signature=JSON.stringify([state.artifacts,state.goals.map(goal=>[goal.id,goal.status,goal.needsReview])]);if(signatures.artifacts===signature)return;signatures.artifacts=signature;
  $('#artifact-summary').textContent=`${state.artifacts.length} ${state.artifacts.length===1?'file':'files'}`;
  const grid=$('#artifact-grid');grid.classList.toggle('artifact-grid',state.artifacts.length>0);
  grid.replaceChildren(...(state.artifacts.length?state.artifacts.map(artifact=>{
    const goal=state.goals.find(goal=>goal.id===artifact.goalId);const kind=goal?.kind||(/spreadsheet|excel|sheet/.test(artifact.mime)?'budget':/html/.test(artifact.mime)?'site':'research');const info=kinds[kind]||{icon:'file'};
    const published=artifact.status==='published'||!!artifact.publishedUrl;const checks=artifact.verification;const verified=Array.isArray(checks)&&checks.length>0&&checks.every(check=>check.passed===true)&&goal?.status==='completed';
    const card=el('article',{class:'artifact-card'},el('div',{class:`artifact-preview ${kind}`,'aria-hidden':'true'},el('div',{class:'artifact-mini-file'}),icon(info.icon)),el('div',{class:'artifact-info'},el('h2',{},artifact.title),el('div',{class:'artifact-meta'},el('span',{},(artifact.filename?.split('.').pop()||'file').toUpperCase()),el('span',{},'·'),el('span',{},size(artifact.size)),el('span',{},'·'),el('time',{datetime:artifact.createdAt||''},shortDate(artifact.createdAt))),el('div',{class:'artifact-verification'},icon(verified?'checkCircle':'info'),verified?'Verification checks passed':goal?.needsReview?'Draft · behavior check needed':'Not verified'),el('div',{class:'artifact-actions'},artifactLink(artifact,'Open','secondary','external'),artifactLink(artifact,'Download','quiet','download',true))));
    const foot=el('div',{class:'artifact-footer'},el('span',{},icon(published?'globe':'lock'),published?'Published':'Only you'));
    if(published&&safeUrl(artifact.publishedUrl))foot.append(el('a',{class:'text-link',href:safeUrl(artifact.publishedUrl),target:'_blank',rel:'noopener noreferrer'},'Public link',icon('external')),el('button',{class:'text-link',type:'button',onclick:async event=>act(event.currentTarget,async()=>{await post(`/api/artifacts/${encodeURIComponent(artifact.id)}/unpublish`);await refresh(true);showApprovals();})},'Unpublish'));
    else foot.append(el('button',{class:'text-link',type:'button',onclick:async event=>act(event.currentTarget,async()=>{await post(`/api/artifacts/${encodeURIComponent(artifact.id)}/publish`);await refresh(true);showApprovals();})},'Publish',icon('arrow')));
    card.append(foot);return card;
  }):[empty('folder','Good work deserves a place.','Run a goal to create your first artifact. Its output and verification evidence will appear here.',button('Explore goals','primary',()=>navigate('goals'),'arrow'))]));
}

function buildMemory(){
  const search=el('input',{type:'search',placeholder:'Find a memory…','aria-label':'Search your memory',value:memorySearch,oninput:event=>{memorySearch=event.target.value;signatures.memory='';updateMemory();}});
  $('#main').append(pageHeader('Context that stays with you','Your memory','A little understanding, carried from one conversation to the next.',button('Add memory','primary',()=>showMemoryEditor(),'plus')),
    el('div',{class:'memory-intro'},icon('brain'),el('div',{},el('strong',{},'You decide what Lara remembers.'),el('p',{},'Keep useful context here: what you’re working on, how you like things done, and what matters. Edit it anytime. Deletions wait for your approval.'))),el('div',{class:'memory-search'},icon('search'),search),el('div',{class:'memory-grid',id:'memory-grid'}),el('div',{class:'page-note'},icon('download'),'Your memory is included in workspace exports. Export or import a backup in Settings.'));
}
function updateMemory(){const signature=JSON.stringify([state.memories,memorySearch]);if(signatures.memory===signature)return;signatures.memory=signature;
  const memories=state.memories.filter(memory=>`${memory.key} ${memory.value}`.toLowerCase().includes(memorySearch.toLowerCase()));const grid=$('#memory-grid');grid.classList.toggle('memory-grid',!!memories.length);
  grid.replaceChildren(...(memories.length?memories.map(memory=>el('article',{class:'memory-card'},el('div',{class:'memory-card-top'},el('h2',{},memory.key),iconButton('edit',`Edit ${memory.key}`,()=>showMemoryEditor(memory))),el('p',{},memory.value),el('div',{class:'memory-card-footer'},el('time',{datetime:memory.updatedAt||''},`Updated ${shortDate(memory.updatedAt)}`),iconButton('trash',`Request deletion of ${memory.key}`,async()=>{await api(`/api/memory/${encodeURIComponent(memory.id)}`,{method:'DELETE'});await refresh(true);showApprovals();})))):[empty('brain',memorySearch?'No memories match that.':'A place to be understood.',memorySearch?'Try a different word or clear your search.':'Tell Lara something useful about you. It will be available in future conversations.',memorySearch?null:button('Add your first memory','primary',()=>showMemoryEditor(),'plus'))]));}
function showMemoryEditor(memory){const {body}=modal(memory?'Edit memory':'A little context goes a long way.','Save something useful for Lara to remember across conversations.');
  const form=el('form');const key=el('input',{type:'text',name:'key',required:true,maxlength:80,placeholder:'e.g. My current project',value:memory?.key||''});const value=el('textarea',{name:'value',rows:5,required:true,maxlength:4000,placeholder:'What would you like Lara to know?',value:memory?.value||''});const submit=button('Save memory','primary',null,'check');submit.type='submit';
  form.append(field('Name',key),field('Context',value,'Keep passwords, recovery keys, and sensitive credentials out of memory.'),el('div',{class:'modal-actions'},button('Cancel','secondary',closeModal),submit));
  form.addEventListener('submit',async event=>{event.preventDefault();await act(submit,async()=>{try{const data={key:key.value.trim(),value:value.value.trim()};if(memory)await patch(`/api/memory/${encodeURIComponent(memory.id)}`,data);else await post('/api/memory',data);closeModal();await refresh(true);toast('Memory saved. Lara can use it in future conversations.');}catch(err){formError(form,readableError(err));}});});body.append(form);key.focus();
}

function settingCard(title,name,...children){return el('section',{class:'settings-card'},el('div',{class:'settings-card-header'},icon(name),el('h2',{},title)),...children);}
function buildSettings(){
  const name=el('input',{type:'text',value:state.user?.name||'',required:true,maxlength:80,'aria-label':'Your name',autocomplete:'given-name'});const save=button('Save','secondary');save.type='submit';const profileForm=el('form',{class:'inline-form'},name,save);profileForm.addEventListener('submit',async event=>{event.preventDefault();await act(save,async()=>{await patch('/api/profile',{name:name.value.trim()});await refresh(true);toast('Your name has been updated.');});});
  const profile=settingCard('Your workspace','brain',el('p',{},'A personal space, available wherever you sign in.'),field('What Lara calls you',profileForm),el('div',{class:'account-id'},'Workspace ',state.user?.id||''));
  const recovery=settingCard('A way back in','key',el('p',{},'Your recovery kit opens this workspace on any device. Keep it somewhere independent of your usual device. You never need a phone number, password, or 2FA code.'),el('div',{class:'callout'},'Your recovery key is shown only when it is created. If you need a new one, rotate it below. You’ll review and approve the change first.'),button('Replace recovery key','secondary',async()=>{await post('/api/recovery/rotate');await refresh(true);showApprovals();},'refresh'),el('p',{class:'setting-note'},'Rotating the key invalidates the previous key and other sessions. Save the replacement kit when Lara shows it.'));
  const backup=settingCard('Keep a copy','download',el('p',{},'Export your memory, goals, conversations, and artifacts. A data backup lets you rebuild your workspace if the server is ever lost.'),el('div',{class:'button-group'},button('Export workspace','secondary',async()=>{const backup=await api('/api/export');downloadJson(`lara-backup-${new Date().toISOString().slice(0,10)}.json`,backup);toast('Workspace backup downloaded. Store it privately.');},'download'),button('Import backup','secondary',()=>fileInput('.json,application/json',async file=>{const backup=await readJson(file);showImport(backup,file.name);}),'upload')),el('p',{class:'setting-note'},'Backups may contain private data. Imports merge into the current workspace and do not delete existing work. A data backup is separate from your access key.'));
  const permissions=settingCard('You hold the controls','shield',el('p',{},'Reading, drafting, building, and updating memory can happen automatically. Publishing, deletion, recovery changes, and supported sensitive actions require your approval.'),el('div',{class:'setting-row'},el('span',{},'Routine work'),el('strong',{},'Automatic')),el('div',{class:'setting-row'},el('span',{},'Sensitive actions'),el('strong',{},'Ask first')),el('div',{class:'setting-row'},el('span',{},'Send or pay integrations'),el('strong',{},'Not connected')),button('Review approvals','quiet sm',showApprovals,'bell'));
  const engine=settingCard('Built to work without paid APIs','sparkle',el('p',{},'Lara’s built-in operator handles supported site, budget, app, research, and security workflows. It uses saved context to route requests and reports the work it can actually perform.'),el('div',{class:'setting-row'},el('span',{},'Operator'),el('strong',{},'Built-in workflows')),el('div',{class:'setting-row'},el('span',{},'Voice input'),el('strong',{},supportsSpeech?'Available in this browser':'Not supported here')),el('div',{class:'setting-row'},el('span',{},'Spoken replies'),el('strong',{},supportsSpeaking?'Available':'Not supported here')),el('p',{class:'setting-note'},'Built-in workflows have defined capabilities. Lara is not a general-purpose autonomous coding model. Browser voice recognition may use your browser provider’s service.'),el('div',{class:'server-capabilities',id:'server-capabilities'}));
  const aiButton=button('Enable on-device AI','secondary',enableLocalAI,'sparkle');aiButton.id='ai-load';
  const aiToggle=el('input',{type:'checkbox',id:'ai-enabled',disabled:true,onchange:async event=>{if(event.target.checked)await enableLocalAI();else{localAI?.disableLocalAI();localAIStatus='On-device AI is off. The built-in operator is available.';updateLocalAIUI();}}});
  const localAICard=settingCard('An optional thinking partner','sparkle',el('p',{},'Run a language model directly on this device for more open-ended conversation and generation. No paid API is required.'),aiButton,el('p',{id:'ai-status',class:'setting-note',role:'status'},localAIStatus),el('label',{class:'check-field'},aiToggle,el('span',{},'Use on-device AI for conversation')));
  const install=settingCard('Lara, a little closer','device',el('p',{},'Install Lara as an app for its own window and a place on your home screen.'),button('Install Lara','secondary',installApp,'plus'),el('div',{class:'install-help'},icon('info'),el('span',{},'On iPhone or iPad: Safari → Share → Add to Home Screen. On other devices, use your browser’s Install app option.')),el('p',{class:'setting-note'},'The app shell works offline. Private workspace data and goal execution require a connection to your server.'));
  const server=settingCard('Your server','cloud',el('div',{class:'setting-row'},el('span',{},'Address'),el('strong',{},location.host)),el('div',{class:'setting-row'},el('span',{},'Connection'),el('strong',{id:'connection-label'},navigator.onLine?'Online':'Offline')),el('div',{class:'setting-row'},el('span',{},'Persistence'),el('strong',{id:'persistence-label'},'Server database')),el('p',{class:'setting-note',id:'hosting-note'},'Free hosting can sleep between visits. Background work resumes when the service is available. Keep an independent workspace backup.'));
  $('#main').append(pageHeader('Make this space yours','Settings','Your workspace, your access, your rules.'),el('div',{class:'settings-grid'},el('div',{class:'settings-column'},profile,recovery,backup,settingCard('This device','logout',el('p',{},'Sign out on a shared device. Make sure your recovery kit is saved before you leave.'),button('Sign out','secondary',async()=>{await post('/api/auth/logout');sessionChannel?.postMessage('signed-out');resetSession('Signed out. Use your recovery kit to return.');},'logout'))),el('div',{class:'settings-column'},permissions,engine,localAICard,install,server)));
}
function updateSettings(){if($('#connection-label'))$('#connection-label').textContent=navigator.onLine?'Online':'Offline';const c=state.capabilities||{};if($('#persistence-label'))$('#persistence-label').textContent=c.persistence||c.database||'Server database';if($('#hosting-note')&&(c.hostingNote||c.hosting))$('#hosting-note').textContent=c.hostingNote||c.hosting;updateLocalAIUI();}
function showImport(backup,filename){const {body}=modal('Bring your context back.','Import this data backup into the current workspace.');body.append(el('div',{class:'callout'},el('strong',{},filename),el('p',{},'This merges supported memory, goals, conversations, and artifacts. Existing data remains in place. Imported goals do not run automatically.')),el('div',{class:'modal-actions'},button('Cancel','secondary',closeModal),button('Import backup','primary',async()=>{const result=await post('/api/import',{backup});closeModal();await refresh(true);const counts=result.counts||result.imported;const details=counts&&typeof counts==='object'?Object.entries(counts).filter(([,value])=>typeof value==='number').map(([key,value])=>`${value} ${key}`).join(', '):'';toast(details?`Imported ${details}.`:'Backup imported. Your workspace has been updated.');},'upload')));}
function showApprovals(){const {body}=modal('The important things are yours.','Review the exact action before Lara takes it. Approvals are scoped to one action.',{wide:true});const approvals=state.approvals.filter(item=>item.status==='pending');
  if(!approvals.length){
    body.append(empty('shield','Nothing needs your approval.','Lara will ask here before publishing, deleting data, or changing recovery settings.'));
    const history=state.approvals.filter(item=>item.status!=='pending').slice(-5).reverse();
    if(history.length){
      const list=el('div',{class:'approval-list',style:'margin-top:18px'});
      for(const item of history)list.append(el('article',{class:'approval-card'},el('div',{class:'approval-kicker'},item.status),el('h3',{},item.title),el('time',{datetime:item.createdAt||''},fullDate(item.createdAt))));
      body.append(list);
    }
    return;
  }
  body.append(el('div',{class:'approval-list'},...approvals.map(approval=>el('article',{class:'approval-card'},el('div',{class:'approval-kicker'},String(approval.kind||'Permission').replaceAll('_',' ')),el('h3',{},approval.title),el('p',{},approval.detail||approval.description||''),el('time',{datetime:approval.createdAt||''},fullDate(approval.createdAt)),el('div',{class:'button-group'},button('Approve this action','primary',()=>decideApproval(approval,'approve'),'check'),button('Deny','secondary',()=>decideApproval(approval,'deny'),'close'))))));
}
async function decideApproval(approval,decision){const result=await post(`/api/approvals/${encodeURIComponent(approval.id)}`,{decision});await refresh(true);if(result.recoveryKey){showRecoveryKit(result.recoveryKey);return;}toast(decision==='approve'?'Action approved and applied.':'Action denied. Nothing was changed.');showApprovals();}
async function installApp(){if(installPrompt){await installPrompt.prompt();const result=await installPrompt.userChoice;installPrompt=null;if(result.outcome==='accepted')toast('Lara is installed.');}else{const {body}=modal('Keep Lara close.','Install from your browser menu.');body.append(el('div',{class:'callout'},el('p',{},el('strong',{},'iPhone or iPad: '),'Open Lara in Safari, tap Share, then Add to Home Screen.'),el('p',{},el('strong',{},'Android: '),'Open the browser menu and choose Install app or Add to Home screen.'),el('p',{},el('strong',{},'Desktop: '),'Choose Install Lara from the address bar or browser menu, when available.')),button('Got it','primary full',closeModal));}}

window.addEventListener('lara-enable-ai',enableLocalAI);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Lara is installed. You can open it from your home screen.');});
window.addEventListener('hashchange',()=>{const tab=location.hash.slice(1);if(tab!==currentTab&&tabs.some(item=>item[0]===tab))navigate(tab);});
window.addEventListener('online',()=>{ $('#offline-banner').hidden=true; if(isAuthenticated)refresh(true).catch(err=>toast(readableError(err),true)); });
window.addEventListener('offline',()=>{ $('#offline-banner').hidden=false;updateSettings(); });
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isAuthenticated)refresh();if(document.hidden&&recognition){suppressRecognition=true;recognition.stop();}});
if(sessionChannel)sessionChannel.onmessage=event=>{if(event.data==='signed-out'&&isAuthenticated)resetSession('Signed out in another tab.');if(event.data==='signed-in'){if(isAuthenticated)resetSession('Workspace changed in another tab.');boot();}};
setInterval(()=>refresh(),3000);
async function boot(){
  $('#offline-banner').hidden=navigator.onLine;
  try{const response=await api('/api/session');await enterWorkspace(response);}catch(err){isAuthenticated=false;const message=readableError(err);renderAuth(err.status===401?null:message);}
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
window.laraUI={getState:()=>state,refresh,toast,navigate};
boot();
