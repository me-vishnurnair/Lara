import { createHash, randomUUID } from 'node:crypto';
import { Script } from 'node:vm';
import ExcelJS from 'exceljs';
import { safeFetchText, validatePublicUrl } from './net.js';

export const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const jsonLiteral = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const filename = (title, suffix) => `${String(title || 'lara-artifact').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70).toLowerCase() || 'lara-artifact'}.${suffix}`;
const evidence = (label, passed, detail) => ({ label, passed, detail });
const short = (value, max = 260) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

const css = `:root{color-scheme:light;--ink:#262439;--muted:#666579;--purple:#6d51ce;--line:#e7e4ed;--paper:#fbfaf8;--accent:#e6ddff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--purple)}button,input,textarea,select{font:inherit}button{cursor:pointer;border:0;border-radius:12px;padding:12px 18px;background:var(--purple);color:white;font-weight:650}button.secondary{background:#ece8f6;color:var(--ink)}button.danger{background:#fee8e8;color:#8f3030}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #aa95e8;outline-offset:3px}input,textarea,select{width:100%;padding:12px;border:1px solid #cbc5d8;background:white;border-radius:10px;color:var(--ink)}input[type=checkbox]{width:22px;height:22px;accent-color:var(--purple)}label{display:block;font-weight:600;font-size:.88rem}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(2.2rem,7vw,4.8rem);line-height:1.06;letter-spacing:-.055em}h2{letter-spacing:-.035em;font-size:clamp(1.6rem,4vw,2.3rem)}h3{line-height:1.3}header,main,footer{max-width:1080px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{font-weight:750;letter-spacing:-.03em}.eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.16em;color:var(--purple);font-weight:750}.muted{color:var(--muted)}.hero{padding:72px 0 56px;max-width:790px}.hero p{font-size:1.2rem;max-width:700px}.pill{display:inline-block;background:var(--accent);border-radius:30px;padding:5px 12px;font-size:.8rem}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{border:1px solid var(--line);border-radius:18px;background:white;padding:25px}.row{display:flex;gap:12px;align-items:center}.row>*{min-width:0}.stack{display:grid;gap:16px}.metric{font-size:2rem;letter-spacing:-.04em;font-weight:720}section{margin-bottom:45px}footer{font-size:.8rem;color:var(--muted);border-top:1px solid var(--line)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1eef7;padding:16px;border-radius:12px}code{font-size:.9em}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}th{font-size:.8rem;color:var(--muted)}.table-wrap{overflow:auto}.status{font-size:.86rem;min-height:1.5em}.good{color:#217449}.bad{color:#a63434}.item{display:flex;align-items:center;gap:12px;padding:15px 0;border-bottom:1px solid var(--line)}.item span{flex:1;overflow-wrap:anywhere}.item.done span{text-decoration:line-through;color:var(--muted)}.item button{padding:6px 10px}.two{grid-template-columns:repeat(2,1fr)}.small{font-size:.86rem}.timer{font-size:clamp(4rem,16vw,7rem);font-variant-numeric:tabular-nums;font-weight:750;letter-spacing:-.055em}.notes-area{min-height:340px;resize:vertical}@media(max-width:640px){header,main,footer{padding:20px}.hero{padding:45px 0 25px}.grid,.two{grid-template-columns:1fr}.row.wrap{flex-wrap:wrap}.row.wrap>*{flex:1 1 130px}.card{padding:20px}button{min-height:44px}nav a{font-size:.85rem}th,td{padding:10px 7px}.hide-mobile{display:none}}@media print{button,.no-print{display:none!important}body{background:white}.hero{padding-top:20px}.card{break-inside:avoid}a{color:inherit}}`;

function documentHtml(title, body, script = '') {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${htmlEscape(title)}</title><style>${css}</style></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`;
}

function verifyHtml(content, expectsScript = false) {
  const tests = [
    evidence('Complete HTML document', /^<!doctype html>/i.test(content) && content.includes('</html>'), 'Checked the generated document boundaries and UTF-8 declaration.'),
    evidence('Mobile viewport included', content.includes('name="viewport"') && content.includes('@media(max-width:640px)'), 'The document includes responsive layout rules and a mobile viewport.'),
    evidence('Self-contained output', !/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(content), 'Styles and application code are embedded; no third-party runtime is required.'),
  ];
  if (expectsScript) {
    const scripts = [...content.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
    for (const script of scripts) new Script(script); // Parse only; generated programs are never executed on the server.
    tests.push(evidence('JavaScript syntax checked', scripts.length > 0, `${scripts.length} embedded script parsed successfully. Browser interaction should also be checked before public use.`));
  }
  if (tests.some(test => !test.passed)) throw new Error('The generated page did not pass document validation.');
  return tests;
}

function siteArtifact({ title, prompt }) {
  const name = short(title || 'A new beginning', 110);
  const brief = short(prompt || 'A clear, useful one-page home for this project.', 700);
  const isPortfolio = /portfolio|personal|freelanc|designer|developer|photograph/i.test(brief);
  const isEvent = /event|workshop|meetup|conference|gathering/i.test(brief);
  const type = isPortfolio ? 'Independent work, thoughtfully made' : isEvent ? 'A good reason to come together' : 'An idea, ready to take shape';
  const labels = isPortfolio ? ['Approach', 'Selected work', 'Let’s connect'] : isEvent ? ['The idea', 'What to expect', 'Stay in the loop'] : ['The purpose', 'The approach', 'What comes next'];
  const details = isPortfolio ? [
    'Start with the right problem. Make something useful. Refine the details that make it feel effortless.',
    'This page is the first piece of the project. Add your own work and outcomes to make it yours.',
    'Use the form below to prepare an inquiry. Your message stays on this device until you choose to share it.',
  ] : isEvent ? [
    'Create space for people to learn, exchange ideas, and leave with something worth remembering.',
    'Use this page to share your event’s purpose. Add the confirmed date, location, and schedule before publishing.',
    'Draft a message below to express interest. No registration is submitted and no personal data leaves this page.',
  ] : [
    'Make the project easy to understand, with a clear purpose and a straightforward way to take the next step.',
    'Keep the useful parts close at hand. This lightweight page opens anywhere and works without a build step.',
    'Prepare an inquiry below, then copy or download it to share through the channel you choose.',
  ];
  const body = `<header><span class="brand">${htmlEscape(name)}</span><nav><a href="#about">About</a> &nbsp; <a href="#contact">Get in touch</a></nav></header><main><section class="hero"><p class="eyebrow">${htmlEscape(type)}</p><h1>${htmlEscape(name)}</h1><p class="muted">${htmlEscape(brief)}</p><a class="pill" href="#contact">Start a conversation ↗</a></section><section id="about" class="grid">${labels.map((label, i) => `<article class="card"><p class="eyebrow">0${i + 1}</p><h2>${htmlEscape(label)}</h2><p class="muted">${htmlEscape(details[i])}</p></article>`).join('')}</section><section id="contact" class="card"><p class="eyebrow">The next step</p><h2>Let’s make a start.</h2><p class="muted">Prepare a message here. This is a private draft form; it does not send or collect submissions.</p><form id="inquiry" class="stack"><label>Your name<input id="name" maxlength="120" autocomplete="name" required></label><label>Your message<textarea id="message" rows="4" maxlength="4000" required></textarea></label><div class="row wrap"><button type="submit">Download your message</button><button type="button" class="secondary" id="copy">Copy message</button></div><p id="status" class="status" role="status"></p></form></section></main><footer>Created with Lara · A self-contained page you can edit and host anywhere.</footer>`;
  const script = `const title=${jsonLiteral(name)};const form=document.getElementById('inquiry');const status=document.getElementById('status');function draft(){return 'Inquiry about '+title+'\\n\\nFrom: '+document.getElementById('name').value.trim()+'\\n\\n'+document.getElementById('message').value.trim();}form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const url=URL.createObjectURL(new Blob([draft()],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='inquiry.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Your message was downloaded. Nothing was sent.';});document.getElementById('copy').addEventListener('click',async()=>{if(!form.reportValidity())return;try{await navigator.clipboard.writeText(draft());status.textContent='Copied. Nothing was sent.';}catch{status.textContent='Clipboard unavailable here. Use Download your message instead.';}});`;
  const content = documentHtml(name, body, script);
  return { filename: filename(name, 'html'), mime: 'text/html', content,
    evidence: [...verifyHtml(content, true), evidence('Draft-only contact action', true, 'The contact form creates a local text download or clipboard copy. It never sends an inquiry.')],
    summary: 'Built a responsive one-page site with working navigation and a local inquiry draft form.' };
}

const storageCode = `const status=document.getElementById('status');function announce(message){status.textContent=message;}function readStore(fallback){try{const raw=localStorage.getItem(storeKey);return raw?JSON.parse(raw):fallback;}catch{announce('Storage is unavailable here. Download this app and open it in your own browser to save between visits.');return fallback;}}function saveStore(value){try{localStorage.setItem(storeKey,JSON.stringify(value));announce('Saved on this device. Export a backup to keep a copy.');}catch{announce('Changes are in memory only. Export before closing this page.');}}function download(value,name,type='application/json'){const url=URL.createObjectURL(new Blob([value],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}function confirmDelete(button,message,action){let pending=false;let reset;const label=button.textContent;button.addEventListener('click',()=>{if(pending){clearTimeout(reset);pending=false;button.textContent=label;action();return;}pending=true;button.textContent='Confirm delete';announce(message+' Select Confirm delete to continue, or wait 10 seconds to cancel.');reset=setTimeout(()=>{pending=false;button.textContent=label;announce('Deletion cancelled.');},10000);});}`;

function appArtifact({ title, prompt }) {
  const text = `${title} ${prompt}`;
  const type = /pomodoro|focus timer|countdown|focus session/i.test(text) ? 'timer' : /expense|spend|budget|money/i.test(text) ? 'expenses' : /notes|journal|notepad|writing/i.test(text) ? 'notes' : 'tasks';
  const name = short(title || ({ timer: 'Focus room', expenses: 'Pocket ledger', notes: 'Quiet notes', tasks: 'A little progress' }[type]), 110);
  const id = randomUUID();
  let appBody, script;
  if (type === 'tasks') {
    appBody = `<div class="grid two"><section class="card"><p class="eyebrow">Make room for progress</p><h2>Your next steps</h2><form id="add" class="row"><input id="task" maxlength="240" aria-label="New task" placeholder="One thing to move forward…" required><button>Add</button></form><p id="count" class="small muted"></p><div id="list"></div><p id="empty" class="muted">Your list is clear. Add the first small step.</p></section><section class="card"><h2>A useful little system</h2><p class="muted">Add a task, check it off, and keep moving. Everything is saved locally in this browser when storage is available.</p><button id="export" class="secondary">Export your tasks</button><p class="small muted">Downloads a JSON copy you can keep. This standalone app does not sync with your Lara workspace.</p></section></div>`;
    script = `const storeKey=${jsonLiteral(`lara-app-${id}`)};${storageCode}let tasks=readStore([]);if(!Array.isArray(tasks))tasks=[];tasks=tasks.filter(t=>t&&typeof t.text==='string'&&typeof t.id==='string').slice(0,2000);const list=document.getElementById('list');function render(){list.replaceChildren();for(const task of tasks){const item=element('div',undefined,'item'+(task.done?' done':''));const box=element('input');box.type='checkbox';box.checked=Boolean(task.done);box.setAttribute('aria-label','Complete '+task.text);box.addEventListener('change',()=>{task.done=box.checked;saveStore(tasks);render();});const label=element('span',task.text);const remove=element('button','×','secondary');remove.setAttribute('aria-label','Delete '+task.text);confirmDelete(remove,'Delete this task?',()=>{tasks=tasks.filter(t=>t.id!==task.id);saveStore(tasks);render();});item.append(box,label,remove);list.append(item);}document.getElementById('count').textContent=tasks.filter(t=>t.done).length+' of '+tasks.length+' complete';document.getElementById('empty').hidden=tasks.length>0;}document.getElementById('add').addEventListener('submit',event=>{event.preventDefault();const input=document.getElementById('task');const text=input.value.trim();if(!text)return;if(tasks.length>=2000){announce('Export your tasks before adding more. The limit is 2,000.');return;}tasks.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),text,done:false});input.value='';saveStore(tasks);render();});document.getElementById('export').addEventListener('click',()=>download(JSON.stringify({format:'lara-tasks-v1',tasks},null,2),'tasks.json'));render();`;
  } else if (type === 'notes') {
    appBody = `<section class="card"><div class="row wrap" style="justify-content:space-between"><h2>A page for your thoughts</h2><span id="count" class="muted small"></span></div><label>Note title<input id="note-title" maxlength="150" placeholder="Untitled note"></label><label style="margin-top:16px">Your notes<textarea id="note" class="notes-area" maxlength="250000" placeholder="Start anywhere…"></textarea></label><div class="row wrap" style="margin-top:16px"><button id="export">Download as text</button><button id="backup" class="secondary">Export backup</button><button id="clear" class="danger">Clear note</button></div></section>`;
    script = `const storeKey=${jsonLiteral(`lara-app-${id}`)};${storageCode}let note=readStore({title:'',body:''});if(!note||typeof note!=='object')note={title:'',body:''};const titleInput=document.getElementById('note-title');const bodyInput=document.getElementById('note');titleInput.value=typeof note.title==='string'?note.title:'';bodyInput.value=typeof note.body==='string'?note.body:'';function update(){note={title:titleInput.value,body:bodyInput.value};saveStore(note);count();}function count(){const words=bodyInput.value.trim()?bodyInput.value.trim().split(/\\s+/).length:0;document.getElementById('count').textContent=words+' words · '+bodyInput.value.length+' characters';}titleInput.addEventListener('input',update);bodyInput.addEventListener('input',update);document.getElementById('export').addEventListener('click',()=>download((titleInput.value||'Untitled note')+'\\n\\n'+bodyInput.value,'note.txt','text/plain;charset=utf-8'));document.getElementById('backup').addEventListener('click',()=>download(JSON.stringify({format:'lara-note-v1',title:titleInput.value,body:bodyInput.value},null,2),'note-backup.json'));confirmDelete(document.getElementById('clear'),'Clear this note? Export a copy first if you need it.',()=>{titleInput.value='';bodyInput.value='';update();});count();`;
  } else if (type === 'timer') {
    appBody = `<div class="grid two"><section class="card" style="text-align:center"><p class="eyebrow">One thing at a time</p><div class="timer" id="clock" role="timer">25:00</div><p class="muted" id="mode">Ready when you are</p><div class="row wrap" style="justify-content:center"><button id="toggle">Start focus</button><button id="reset" class="secondary">Reset</button></div><label style="margin-top:24px">Session length in minutes<input id="minutes" type="number" min="1" max="180" step="1" value="25"></label></section><section class="card"><h2>Your focus record</h2><p class="metric" id="sessions">0</p><p class="muted">Completed sessions saved on this device.</p><button id="export" class="secondary">Export focus record</button><p class="small muted">The timer uses elapsed wall-clock time to stay accurate when this tab is in the background. Keep the page open; browser notifications are not required.</p></section></div>`;
    script = `const storeKey=${jsonLiteral(`lara-app-${id}`)};${storageCode}let history=readStore([]);if(!Array.isArray(history))history=[];let remaining=25*60,running=false,endsAt=0;const toggle=document.getElementById('toggle');const minutes=document.getElementById('minutes');function render(){const seconds=running?Math.max(0,Math.ceil((endsAt-Date.now())/1000)):remaining;document.getElementById('clock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');document.title=(running?'Focus · ':'')+document.getElementById('clock').textContent;document.getElementById('sessions').textContent=String(history.length);toggle.textContent=running?'Pause':'Start focus';minutes.disabled=running;}function tick(){if(running&&Date.now()>=endsAt){running=false;remaining=0;history.push({completedAt:new Date().toISOString(),minutes:Number(minutes.value)});history=history.slice(-5000);saveStore(history);document.getElementById('mode').textContent='Session complete. Take a breath.';}render();}toggle.addEventListener('click',()=>{if(running){remaining=Math.max(0,Math.ceil((endsAt-Date.now())/1000));running=false;document.getElementById('mode').textContent='Paused';}else{if(remaining<=0)remaining=(Number(minutes.value)||25)*60;endsAt=Date.now()+remaining*1000;running=true;document.getElementById('mode').textContent='A little less noise. A little more focus.';}render();});document.getElementById('reset').addEventListener('click',()=>{running=false;remaining=(Number(minutes.value)||25)*60;document.getElementById('mode').textContent='Ready when you are';render();});minutes.addEventListener('change',()=>{minutes.value=String(Math.min(180,Math.max(1,Math.round(Number(minutes.value)||25))));remaining=Number(minutes.value)*60;render();});document.getElementById('export').addEventListener('click',()=>download(JSON.stringify({format:'lara-focus-v1',sessions:history},null,2),'focus-record.json'));setInterval(tick,250);render();`;
  } else {
    appBody = `<section class="grid"><div class="card"><p class="muted">Total recorded</p><div class="metric" id="total">0.00</div></div><div class="card"><p class="muted">This month</p><div class="metric" id="month-total">0.00</div></div><div class="card"><p class="muted">Entries</p><div class="metric" id="entries">0</div></div></section><section class="card"><h2>Record an expense</h2><form id="add" class="stack"><div class="grid two"><label>Description<input id="description" maxlength="160" required placeholder="What was it for?"></label><label>Amount (your currency)<input id="amount" type="number" min="0.01" max="100000000" step="0.01" required></label><label>Category<select id="category"><option>Food</option><option>Home</option><option>Transport</option><option>Health</option><option>Learning</option><option>Fun</option><option>Other</option></select></label><label>Date<input id="date" type="date" required></label></div><button>Add expense</button></form></section><section class="card"><div class="row wrap" style="justify-content:space-between"><h2>The ledger</h2><button id="export" class="secondary">Export CSV</button><button id="backup" class="secondary">Export JSON</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table></div><p class="muted small" id="empty">No expenses yet. Record your first one above.</p></section>`;
    script = `const storeKey=${jsonLiteral(`lara-app-${id}`)};${storageCode}let expenses=readStore([]);if(!Array.isArray(expenses))expenses=[];expenses=expenses.filter(e=>e&&Number.isSafeInteger(e.cents)&&e.cents>0&&typeof e.id==='string'&&typeof e.date==='string').slice(0,10000);const rows=document.getElementById('rows');const money=cents=>(cents/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};document.getElementById('date').value=today();function render(){rows.replaceChildren();for(const expense of [...expenses].sort((a,b)=>b.date.localeCompare(a.date))){const row=element('tr');row.append(element('td',expense.date),element('td',expense.description),element('td',expense.category),element('td',money(expense.cents)));const cell=element('td');const remove=element('button','Delete','secondary');remove.setAttribute('aria-label','Delete '+expense.description);confirmDelete(remove,'Delete this expense?',()=>{expenses=expenses.filter(e=>e.id!==expense.id);saveStore(expenses);render();});cell.append(remove);row.append(cell);rows.append(row);}document.getElementById('total').textContent=money(expenses.reduce((sum,e)=>sum+e.cents,0));document.getElementById('month-total').textContent=money(expenses.filter(e=>e.date.startsWith(today().slice(0,7))).reduce((sum,e)=>sum+e.cents,0));document.getElementById('entries').textContent=String(expenses.length);document.getElementById('empty').hidden=expenses.length>0;}document.getElementById('add').addEventListener('submit',event=>{event.preventDefault();const description=document.getElementById('description').value.trim();const cents=Math.round(Number(document.getElementById('amount').value)*100);const date=document.getElementById('date').value;if(!description||!Number.isSafeInteger(cents)||cents<1||cents>10000000000||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return;if(expenses.length>=10000){announce('Export your ledger before adding more. The limit is 10,000.');return;}expenses.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),description,cents,category:document.getElementById('category').value,date});document.getElementById('description').value='';document.getElementById('amount').value='';saveStore(expenses);render();});function csvCell(value){const text=String(value);return '"'+(/^[=+@\\-\\t\\r]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"';}document.getElementById('export').addEventListener('click',()=>{const data=[['Date','Description','Category','Amount'],...expenses.map(e=>[e.date,e.description,e.category,(e.cents/100).toFixed(2)])];download(data.map(row=>row.map(csvCell).join(',')).join('\\r\\n'),'expenses.csv','text/csv;charset=utf-8');});document.getElementById('backup').addEventListener('click',()=>download(JSON.stringify({format:'lara-expenses-v1',expenses},null,2),'expenses.json'));render();`;
  }
  const body = `<header><span class="brand">${htmlEscape(name)}</span><span class="pill">Your space</span></header><main><section class="hero" style="padding-bottom:20px"><p class="eyebrow">A small app for everyday life</p><h1>${htmlEscape(name)}</h1><p class="muted">${htmlEscape(short(prompt || 'Useful tools. Yours to keep.', 350))}</p></section><p id="status" class="status" role="status" aria-live="polite"></p>${appBody}</main><footer>Created with Lara · Saved locally when available. Download this HTML file for the full standalone app; previews may restrict storage. Export your data before switching devices.</footer>`;
  const content = documentHtml(name, body, script);
  return { filename: filename(name, 'html'), mime: 'text/html', content,
    evidence: [...verifyHtml(content, true), evidence('Bounded app capabilities', true, `Created a ${type} app with local persistence, visible storage errors, and data export. No network access or server execution is embedded.`)],
    summary: `Built a working standalone ${type} app. Its own records stay in the browser; export them separately from your Lara workspace.` };
}

function amountFromPrompt(prompt, label, fallback) {
  const match = String(prompt).match(new RegExp(`(?:${label})\\s*(?:is|of|:|=)?\\s*(?:[$₹€£]|INR|USD|EUR|GBP|Rs\\.?)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i'));
  if (!match) return fallback;
  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(amount) && amount >= 0 && amount <= 100000000 ? amount : fallback;
}

async function budgetArtifact({ title, prompt, check, progress }) {
  const currency = /₹|\binr\b|rupees?|\brs\.?\s*\d/i.test(prompt) ? 'INR' : /€|\beur\b/i.test(prompt) ? 'EUR' : /£|\bgbp\b/i.test(prompt) ? 'GBP' : 'USD';
  const factor = currency === 'INR' ? 15 : 1;
  const salary = amountFromPrompt(prompt, 'salary|income|earnings|take.home', 5000 * factor);
  const plannedExpenses = [
    ['Housing', amountFromPrompt(prompt, 'rent|housing', Math.round(salary * .28)), 'Rent or mortgage'],
    ['Utilities', amountFromPrompt(prompt, 'utilities', Math.round(salary * .045)), 'Electricity, water, internet'],
    ['Food', amountFromPrompt(prompt, 'food|groceries', Math.round(salary * .10)), 'Groceries and meals'],
    ['Transport', amountFromPrompt(prompt, 'transport|travel', Math.round(salary * .06)), 'Public transport, fuel, rides'],
    ['Health', amountFromPrompt(prompt, 'health|insurance', Math.round(salary * .05)), 'Insurance and care'],
    ['Learning', Math.round(salary * .03), 'Books, courses, skills'],
    ['Lifestyle', Math.round(salary * .06), 'Entertainment and personal spending'],
    ['Savings', amountFromPrompt(prompt, 'saving(?:s)?', Math.round(salary * .20)), 'Planned savings transfer'],
    ['Other', Math.round(salary * .025), 'Everything else'],
  ];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lara'; workbook.subject = 'Editable monthly budget with checked formulas';
  workbook.created = new Date(); workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const guide = workbook.addWorksheet('Start here', { properties: { tabColor: { argb: 'FFAD9DD7' } } });
  const summary = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF6D51CE' } } });
  const income = workbook.addWorksheet('Income', { properties: { tabColor: { argb: 'FF43A67A' } } });
  const expenses = workbook.addWorksheet('Expenses', { properties: { tabColor: { argb: 'FFE4A26A' } } });
  const moneyFormat = `"${currency} "#,##0.00;[Red]("${currency} "#,##0.00);"${currency} "0.00`;
  const header = (sheet, row) => { sheet.getRow(row).font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D51CE' } }; sheet.getRow(row).height = 25; };
  const input = cell => { cell.font = { name: 'Calibri', color: { argb: 'FF2455A4' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF5FE' } }; cell.numFmt = moneyFormat; cell.dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [0, 100000000], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Use a non-negative amount', error: 'Enter a number from 0 to 100,000,000.' }; };
  const formula = (cell, expression, result) => { cell.value = { formula: expression, result }; cell.numFmt = moneyFormat; cell.font = { name: 'Calibri', color: { argb: 'FF236346' } }; };
  for (const sheet of workbook.worksheets) { sheet.views = [{ state: 'frozen', ySplit: 3 }]; sheet.properties.defaultRowHeight = 22; sheet.columns = [{ width: 27 }, { width: 21 }, { width: 21 }, { width: 23 }, { width: 43 }]; }
  guide.mergeCells('A1:E1'); guide.getCell('A1').value = title || 'Your monthly budget'; guide.getCell('A1').font = { size: 23, bold: true, color: { argb: 'FF3A2C68' } }; guide.getRow(1).height = 38;
  const instructions = [
    ['What this is', 'A working monthly budget. Starter planned amounts are editable assumptions, not your transaction history.'],
    ['Currency', `${currency}. Change displayed currency formats manually if needed; this workbook does not convert currencies.`],
    ['1. Plan income', 'Open Income. Blue cells contain editable planned and actual amounts.'],
    ['2. Plan expenses', 'Open Expenses. Update the blue planned cells for each category; enter actual spending as it happens.'],
    ['3. Read the summary', 'Summary calculates income, expenses, remaining balance, and spending ratio. All totals use formulas.'],
    ['Actuals start at zero', 'Actual amounts are intentionally zero until you enter your real figures.'],
    ['Variance', 'Income variance = actual minus planned. Expense variance = planned minus actual (positive means under budget).'],
    ['Recalculation', 'Excel, LibreOffice, and Google Sheets recalculate the formulas when you edit. Initial cached values are included.'],
    ['Savings treatment', 'Savings are included as a planned expense/transfer so the remaining balance reflects money still unallocated.'],
    ['Keep formulas', 'Green formula cells can be edited but should usually be left in place. Add entries within the existing categories.'],
    ['Your brief', short(prompt, 1200)],
  ];
  for (let i = 0; i < instructions.length; i++) { const row = i + 3; guide.getCell(row, 1).value = instructions[i][0]; guide.getCell(row, 1).font = { bold: true }; guide.mergeCells(row, 2, row, 5); guide.getCell(row, 2).value = instructions[i][1]; guide.getCell(row, 2).alignment = { wrapText: true, vertical: 'top' }; guide.getRow(row).height = 42; }
  income.mergeCells('A1:E1'); income.getCell('A1').value = 'INCOME / Monthly plan'; income.getCell('A1').font = { size: 19, bold: true };
  income.getRow(3).values = ['Source', 'Planned', 'Actual', 'Variance', 'Notes']; header(income, 3);
  [['Primary income', salary, 0, 'Editable starter assumption'], ['Additional income', 0, 0, 'Freelance or side income'], ['Other income', 0, 0, 'Any other income']].forEach(([name, planned, actual, note], i) => { const r = i + 4; income.getRow(r).values = [name, planned, actual, null, note]; input(income.getCell(r, 2)); input(income.getCell(r, 3)); formula(income.getCell(r, 4), `C${r}-B${r}`, actual - planned); });
  income.getCell('A8').value = 'TOTAL INCOME'; formula(income.getCell('B8'), 'SUM(B4:B6)', salary); formula(income.getCell('C8'), 'SUM(C4:C6)', 0); formula(income.getCell('D8'), 'C8-B8', -salary); income.getRow(8).font = { bold: true };
  expenses.mergeCells('A1:E1'); expenses.getCell('A1').value = 'EXPENSES / Monthly plan'; expenses.getCell('A1').font = { size: 19, bold: true };
  expenses.getRow(3).values = ['Category', 'Planned', 'Actual', 'Remaining budget', 'Notes']; header(expenses, 3);
  plannedExpenses.forEach(([name, planned, note], i) => { const r = i + 4; expenses.getRow(r).values = [name, planned, 0, null, note]; input(expenses.getCell(r, 2)); input(expenses.getCell(r, 3)); formula(expenses.getCell(r, 4), `B${r}-C${r}`, planned); });
  const totalExpenses = plannedExpenses.reduce((sum, row) => sum + row[1], 0);
  expenses.getCell('A14').value = 'TOTAL EXPENSES'; formula(expenses.getCell('B14'), 'SUM(B4:B12)', totalExpenses); formula(expenses.getCell('C14'), 'SUM(C4:C12)', 0); formula(expenses.getCell('D14'), 'B14-C14', totalExpenses); expenses.getRow(14).font = { bold: true };
  summary.mergeCells('A1:D1'); summary.getCell('A1').value = 'THE BIG PICTURE'; summary.getCell('A1').font = { size: 23, bold: true, color: { argb: 'FF3A2C68' } }; summary.getRow(1).height = 38;
  summary.getRow(3).values = ['Monthly overview', 'Planned', 'Actual', 'Difference']; header(summary, 3);
  summary.getCell('A4').value = 'Income'; formula(summary.getCell('B4'), 'Income!B8', salary); formula(summary.getCell('C4'), 'Income!C8', 0); formula(summary.getCell('D4'), 'C4-B4', -salary);
  summary.getCell('A5').value = 'Expenses & savings'; formula(summary.getCell('B5'), 'Expenses!B14', totalExpenses); formula(summary.getCell('C5'), 'Expenses!C14', 0); formula(summary.getCell('D5'), 'B5-C5', totalExpenses);
  summary.getCell('A6').value = 'Remaining balance'; formula(summary.getCell('B6'), 'B4-B5', salary - totalExpenses); formula(summary.getCell('C6'), 'C4-C5', 0); formula(summary.getCell('D6'), 'C6-B6', -(salary - totalExpenses)); summary.getRow(6).height = 30;
  summary.getCell('A8').value = 'Spending ratio'; formula(summary.getCell('B8'), 'IFERROR(B5/B4,0)', salary ? totalExpenses / salary : 0); formula(summary.getCell('C8'), 'IFERROR(C5/C4,0)', 0); summary.getCell('B8').numFmt = '0.0%'; summary.getCell('C8').numFmt = '0.0%';
  summary.mergeCells('A11:E11'); summary.getCell('A11').value = 'Blue cells on Income and Expenses are your inputs. Green cells are live formulas.'; summary.getCell('A11').alignment = { wrapText: true }; summary.getRow(11).height = 34;
  summary.mergeCells('A13:E13'); summary.getCell('A13').value = 'A positive remaining balance is unallocated. A negative balance means the plan spends more than it earns.'; summary.getCell('A13').alignment = { wrapText: true }; summary.getRow(13).height = 34;
  for (const sheet of [income, expenses]) { sheet.autoFilter = { from: 'A3', to: `E${sheet === income ? 6 : 12}` }; sheet.getColumn(5).alignment = { wrapText: true, vertical: 'middle' }; }
  await check();
  await progress('check', 'Reopening the generated workbook and checking its formulas and cached totals.');
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const reopened = new ExcelJS.Workbook(); await reopened.xlsx.load(buffer);
  let formulaCount = 0;
  reopened.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => { if (cell.formula) { formulaCount++; if (!Number.isFinite(cell.result)) throw new Error('A workbook formula is missing a finite calculated value.'); } })));
  const net = reopened.getWorksheet('Summary').getCell('B6');
  if (net.formula !== 'B4-B5' || net.result !== salary - totalExpenses || formulaCount < 20) throw new Error('Workbook formula verification failed.');
  await check();
  return { filename: filename(title || 'monthly-budget', 'xlsx'), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: buffer,
    evidence: [evidence('Workbook reopened successfully', true, `${reopened.worksheets.length} sheets read back from the actual XLSX file.`), evidence('Real formulas verified', true, `${formulaCount} formulas include finite initial cached results; Excel recalculates when inputs change.`), evidence('Budget arithmetic checked', true, `Planned income ${currency} ${salary.toFixed(2)} minus planned expenses ${totalExpenses.toFixed(2)} equals ${net.result.toFixed(2)}.`), evidence('Input cells validated', true, 'Income and expense inputs accept non-negative numbers. Actuals start at zero; starter plans are clearly labelled assumptions.')],
    summary: `Created a four-sheet ${currency} budget with ${formulaCount} formulas, editable inputs, and verified initial totals.` };
}

export function extractReadableText(html, limit = 16000) {
  return String(html).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|nav|footer|header|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, value) => Number(value) <= 0x10ffff ? String.fromCodePoint(Number(value)) : '')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}

async function discoverSources(topic, signal) {
  const query = short(topic.replace(/^(?:research|write|make|create|find|a |an |the |note |sourced |about |on )+/gi, ''), 180) || topic;
  const response = await safeFetchText(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=3`, { signal, limit: 200000, accept: 'application/json' });
  if (response.status !== 200) throw new Error(`Source discovery returned HTTP ${response.status}. Add one or more public HTTPS source URLs to this research goal.`);
  let data; try { data = JSON.parse(response.text); } catch { throw new Error('Source discovery did not return readable results. Add explicit HTTPS source URLs.'); }
  const results = data?.query?.search || [];
  if (!results.length) throw new Error('No sources were found for this topic. Add public HTTPS source URLs and try again.');
  return results.slice(0, 3).map(item => `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`);
}

async function researchArtifact({ title, prompt, sourceUrls, check, progress, signal }) {
  const urls = sourceUrls?.length ? sourceUrls.slice(0, 5) : await discoverSources(prompt || title, signal);
  const sources = []; const failures = [];
  for (const raw of [...new Set(urls)]) {
    await check();
    await progress('do', `Reading source ${sources.length + failures.length + 1} of ${urls.length}: ${new URL(raw).hostname}`);
    try {
      const response = await safeFetchText(raw, { signal });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const text = extractReadableText(response.text);
      if (text.length < 180) throw new Error('Not enough readable text was returned.');
      const pageTitle = short(extractReadableText(response.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(response.url).hostname), 180);
      sources.push({ title: pageTitle, url: response.url, text, accessed: new Date().toISOString(), bytes: response.bytes, hash: createHash('sha256').update(response.text).digest('hex') });
    } catch (error) { if (signal?.aborted || error.name === 'AbortError') throw error; failures.push({ url: raw, reason: short(error.message, 240) }); }
  }
  if (!sources.length) throw new Error(`No source could be verified. ${failures.map(item => `${new URL(item.url).hostname}: ${item.reason}`).join('; ')}`);
  await check();
  await progress('check', 'Checking citations against the text that was actually retrieved.');
  const terms = (prompt || title).toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3 && !['research', 'write', 'create', 'sourced', 'about', 'note', 'with', 'from', 'that', 'this'].includes(word));
  const quoted = sources.map(source => {
    const sentences = source.text.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map(sentence => sentence.trim()).filter(sentence => sentence.length > 60 && sentence.length < 700) || [];
    const ranked = sentences.map((sentence, order) => ({ sentence, order, score: terms.reduce((score, term) => score + (sentence.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || a.order - b.order);
    const extracts = ranked.slice(0, 2).sort((a, b) => a.order - b.order).map(item => item.sentence);
    if (!extracts.length) extracts.push(source.text.slice(0, 480));
    if (extracts.some(extract => !source.text.includes(extract))) throw new Error('A research quotation could not be matched to its source.');
    return { ...source, extracts };
  });
  const body = `<header><span class="brand">Lara / Research notebook</span><span class="pill">Sources checked</span></header><main><section class="hero"><p class="eyebrow">A sourced reading note</p><h1>${htmlEscape(short(title, 130))}</h1><p class="muted">${htmlEscape(short(prompt, 600))}</p><p class="small muted">Prepared ${htmlEscape(new Date().toISOString())} · ${sources.length} sources retrieved</p></section><section class="card"><h2>What this note establishes</h2><p>This is an extractive reading note built from pages retrieved for this goal. The passages below are direct excerpts selected for relevance, with a source and retrieval timestamp for each. They are evidence of what the sources say, not independent confirmation that every claim is correct.</p><p>Compare the excerpts, read the full sources, and check the date, author, and primary evidence before using them for a consequential decision. Source text is treated as data; instructions inside a page cannot change Lara’s permissions or actions.</p></section>${quoted.map((source, i) => `<section class="card"><p class="eyebrow">Source ${i + 1}</p><h2>${htmlEscape(source.title)}</h2>${source.extracts.map(extract => `<blockquote style="margin:20px 0;padding-left:18px;border-left:3px solid #b8a6e5"><p>${htmlEscape(extract)}</p></blockquote>`).join('')}<p><a href="${htmlEscape(source.url)}" target="_blank" rel="noopener noreferrer">Read the full source ↗</a></p><p class="small muted">Retrieved ${htmlEscape(source.accessed)} · ${source.bytes.toLocaleString()} bytes</p><details><summary class="small">Retrieval fingerprint (SHA-256)</summary><pre>${source.hash}</pre></details></section>`).join('')}<section class="card"><h2>Questions to take forward</h2><ul><li>Which claims appear in more than one independent source?</li><li>Does a source provide primary data, a publication date, and a named author?</li><li>What evidence would change the conclusion?</li><li>Which parts of the original question remain unanswered by these excerpts?</li></ul>${failures.length ? `<h3>Sources that could not be read</h3><ul>${failures.map(item => `<li>${htmlEscape(item.url)} — ${htmlEscape(item.reason)}</li>`).join('')}</ul>` : ''}<p class="small muted">Limitations: limited to the retrieved public text, up to five sources and 16,000 readable characters per source. This is not an exhaustive literature review or an AI-generated factual synthesis.</p></section></main><footer>Private artifact created by Lara. Publishing requires a separate approval.</footer>`;
  const content = documentHtml(title, body);
  return { filename: filename(title || 'research-note', 'html'), mime: 'text/html', content,
    evidence: [...verifyHtml(content), evidence('Sources fetched over validated HTTPS', true, `${sources.length} source pages returned HTTP 200; ${failures.length} unreadable sources are disclosed.`), evidence('Every excerpt matched to retrieved text', true, `${quoted.reduce((count, source) => count + source.extracts.length, 0)} excerpts were checked against their source text.`), evidence('Citations and fingerprints included', true, 'Each source includes its final URL, retrieval timestamp, and SHA-256 response fingerprint.')],
    summary: `Produced an extractive research note from ${sources.length} verified source pages${failures.length ? `; ${failures.length} sources could not be read` : ''}.` };
}

async function securityArtifact({ title, prompt, targetUrl, targetAuthToken, authorization, capabilities = {}, check, progress, signal }) {
  const findings = [];
  let scope = 'Lara configured application controls';
  let target = null;
  if (targetUrl) {
    const url = validatePublicUrl(targetUrl);
    if (!authorization) throw new Error('Confirm that you own this target or have permission before requesting a security review.');
    if (!targetAuthToken || !/^[A-Za-z0-9_-]{24,128}$/.test(targetAuthToken)) throw new Error('A valid ownership challenge token is required before reviewing this target.');
    scope = `Passive HTTPS review of ${url.origin}`;
    await progress('do', 'Verifying the exact ownership challenge on the target origin.');
    const proof = await safeFetchText(`${url.origin}/.well-known/lara-authorization.txt`, { signal, limit: 4096, maxRedirects: 0 });
    if (proof.status !== 200 || proof.text.trim() !== targetAuthToken) throw new Error('Target ownership was not verified. Host the exact challenge token at /.well-known/lara-authorization.txt on this HTTPS origin, with no redirect.');
    await check();
    await progress('do', 'Reading the verified origin’s public response and security headers.');
    target = await safeFetchText(`${url.origin}/`, { signal, maxRedirects: 0 });
    findings.push({ name: 'Ownership challenge', state: 'observed', detail: 'The exact per-workspace challenge token was served from the target origin over valid HTTPS.' });
    findings.push({ name: 'Valid TLS connection', state: target.tlsAuthorized ? 'observed' : 'needs attention', detail: `HTTPS certificate validation was required. Negotiated protocol: ${target.tlsProtocol}.` });
    findings.push({ name: 'HTTP response', state: target.status >= 200 && target.status < 400 ? 'observed' : 'needs attention', detail: `The root path returned HTTP ${target.status}. No authenticated paths were accessed.` });
    const checks = [
      ['Strict-Transport-Security', 'strict-transport-security', 'HSTS helps browsers require HTTPS on future visits. Verify max-age and subdomain scope for your deployment.'],
      ['Content-Security-Policy', 'content-security-policy', 'A restrictive CSP can reduce the impact of content injection. Header presence alone does not prove a strong policy.'],
      ['X-Content-Type-Options', 'x-content-type-options', 'Use nosniff to reduce MIME confusion.'],
      ['Referrer-Policy', 'referrer-policy', 'Set an intentional referrer policy to avoid leaking sensitive path/query information.'],
      ['Framing restrictions', null, 'Use CSP frame-ancestors or X-Frame-Options to control framing.'],
    ];
    for (const [name, headerName, guidance] of checks) {
      const value = headerName ? target.headers[headerName] : (target.headers['x-frame-options'] || (String(target.headers['content-security-policy'] || '').match(/frame-ancestors[^;]*/)?.[0]));
      findings.push({ name, state: value ? 'observed' : 'needs attention', detail: value ? `Observed: ${short(value, 800)}. ${guidance}` : `No applicable response header observed. ${guidance}` });
    }
    const cookies = target.headers['set-cookie'] || [];
    findings.push({ name: 'Cookie attributes', state: !cookies.length ? 'not assessed' : cookies.every(cookie => /;\s*Secure(?:;|$)/i.test(cookie) && /;\s*HttpOnly(?:;|$)/i.test(cookie) && /;\s*SameSite=/i.test(cookie)) ? 'observed' : 'needs attention', detail: !cookies.length ? 'The root response did not set cookies; authenticated session cookies were not inspected.' : `${cookies.length} Set-Cookie headers inspected for Secure, HttpOnly, and SameSite attributes. Cookie values are not included in this report. Some non-session cookies may intentionally be readable by JavaScript.` });
  } else {
    await progress('do', 'Inspecting the application’s declared live controls and identifying unverified areas.');
    const controls = [
      ['httpOnlyCookies', 'Session cookies', 'Sessions use HttpOnly cookies to keep credentials out of application JavaScript.'],
      ['secureCookies', 'HTTPS-only cookies', 'Production session cookies should require HTTPS. A local development server may use non-Secure cookies.'],
      ['csrfProtection', 'Cross-origin write protection', 'Mutating requests are checked against the application origin.'],
      ['rateLimiting', 'Request rate limits', 'Authentication and task creation use rate limits.'],
      ['tenantIsolation', 'Workspace isolation', 'Server queries scope memory, goals, approvals, and artifacts to the authenticated user.'],
      ['approvalGates', 'Sensitive-action approvals', 'Publishing, deleting, and recovery-key rotation require a recorded approval.'],
      ['sandboxedArtifacts', 'Artifact isolation', 'Generated HTML previews are sandboxed and cannot access the application session.'],
      ['ssrfProtection', 'Network request restrictions', 'Public HTTPS sources are validated and pinned to a public DNS address.'],
      ['hashedRecoveryKeys', 'Recovery credentials', 'Recovery credentials are stored as one-way hashes.'],
      ['persistentDatabase', 'Durable storage', 'Production data is stored in a configured persistent database.'],
    ];
    const reported = capabilities.checks || {};
    const live = capabilities.security || {
      httpOnlyCookies: reported.httpOnlySessions,
      secureCookies: reported.secureCookies,
      csrfProtection: reported.csrfProtection,
      rateLimiting: reported.rateLimiting,
      tenantIsolation: reported.tenantIsolation,
      approvalGates: reported.approvalGate,
      sandboxedArtifacts: reported.artifactSandbox,
      ssrfProtection: reported.ssrfProtection,
      hashedRecoveryKeys: reported.hashedRecoveryKeys,
      persistentDatabase: reported.durableDatabase,
    };
    for (const [key, name, detail] of controls) findings.push({ name, state: live[key] === true ? 'configured' : live[key] === false ? 'needs attention' : 'not assessed', detail: `${detail} ${live[key] === undefined ? 'The runtime did not provide a value for this control.' : 'This is a runtime configuration observation, not independent proof of resistance to attack.'}` });
  }
  await check();
  await progress('check', 'Separating observed settings from findings that require manual validation.');
  const attention = findings.filter(finding => finding.state === 'needs attention').length;
  const unknown = findings.filter(finding => finding.state === 'not assessed').length;
  const body = `<header><span class="brand">Lara / Security notebook</span><span class="pill">Bounded review</span></header><main><section class="hero"><p class="eyebrow">Evidence before assurance</p><h1>${htmlEscape(short(title || 'Security review', 130))}</h1><p class="muted">${htmlEscape(scope)}</p><p class="small muted">Checked ${htmlEscape(new Date().toISOString())}</p></section><section class="grid"><div class="card"><p class="muted">Controls reviewed</p><div class="metric">${findings.length}</div></div><div class="card"><p class="muted">Need attention</p><div class="metric">${attention}</div></div><div class="card"><p class="muted">Not assessed</p><div class="metric">${unknown}</div></div></section><section class="card"><h2>Scope and method</h2><p>${target ? 'Two bounded public GET requests: one exact ownership proof and the origin root. No port scan, credential guessing, exploitation, destructive test, or security-setting change was performed.' : 'This review records the runtime controls Lara reports as configured. It does not audit that those controls are effective, dynamically attack the service, or substitute for code review, dependency auditing, access-control tests, or an independent penetration test.'}</p><p class="muted">${htmlEscape(short(prompt, 700))}</p></section>${findings.map(finding => `<section class="card"><p class="eyebrow ${finding.state === 'needs attention' ? 'bad' : ''}">${htmlEscape(finding.state)}</p><h2>${htmlEscape(finding.name)}</h2><p class="muted">${htmlEscape(finding.detail)}</p></section>`).join('')}<section class="card"><h2>Next checks</h2><ul><li>Exercise cross-workspace access controls and recovery/session revocation in a test environment.</li><li>Review dependencies, secret handling, backup restoration, and logs.</li><li>Validate the effective content security policy and cookie behavior in a browser.</li><li>For deeper testing, agree on written scope, systems, test windows, and safe methods before using an appropriate testing environment.</li></ul><p><strong>No “secure” verdict is implied.</strong> Completing this goal means the scoped report and its evidence were produced, including any unresolved findings.</p></section></main><footer>Lara security review · Observation is not a guarantee of security.</footer>`;
  const content = documentHtml(title || 'Security review', body);
  return { filename: filename(title || 'security-review', 'html'), mime: 'text/html', content,
    evidence: [...verifyHtml(content), evidence('Review scope enforced', true, target ? 'Target ownership was verified before a passive HTTPS root request. No exploits or scans were run.' : 'Runtime control values are labelled as configured, needing attention, or not assessed; they are not audit results.'), evidence('Findings disclosed', true, `${findings.length} observations, ${attention} needing attention, ${unknown} not assessed. This is a completed report, not a clean-security verdict.`)],
    summary: `Completed the scoped security report: ${attention} items need attention; ${unknown} remain unassessed.` };
}

function generatedHtmlArtifact({ generatedHtml, kind, title }) {
  if (typeof generatedHtml !== 'string' || Buffer.byteLength(generatedHtml, 'utf8') > 300000) throw new Error('Generated HTML must be a string of at most 300 KB.');
  let content = generatedHtml.trim().replace(/^```(?:html)?\s*\n/i, '').replace(/\n```\s*$/, '').trim();
  if (!/^<!doctype html>/i.test(content) || !/<html\b/i.test(content) || !/<head\b/i.test(content) || !/<body\b/i.test(content) || !/<\/html>\s*$/i.test(content)) throw new Error('Generated output must be a complete HTML document with a doctype, head, body, and closing html tag.');
  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(content)) throw new Error('Generated HTML must include a mobile viewport meta tag.');
  if (/<(?:iframe|object|embed|base)\b/i.test(content) || /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(content)) throw new Error('Embedded frames, objects, base URLs, and automatic redirects are not supported in generated apps.');
  if (/<script\b[^>]*\bsrc\s*=/i.test(content) || /<link\b[^>]*\brel\s*=\s*["']?stylesheet/i.test(content) || /@import\s/i.test(content)) throw new Error('Generated apps must embed their scripts and styles; remote dependencies are not supported.');
  const scripts = [...content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  let scriptCount = 0;
  for (const [, attributes, script] of scripts) {
    const type = attributes.match(/\btype\s*=\s*["']([^"']*)["']/i)?.[1].toLowerCase();
    if (type && !['text/javascript', 'application/javascript'].includes(type)) {
      if (['application/json', 'application/ld+json'].includes(type)) { JSON.parse(script); continue; }
      throw new Error('Use ordinary embedded JavaScript, without module imports.');
    }
    if (/\bimport\s*(?:\(|["'{*])/m.test(script)) throw new Error('Module imports are not supported in self-contained generated apps.');
    new Script(script, { filename: 'generated-app.js' });
    scriptCount++;
  }
  if (kind === 'app' && !scriptCount) throw new Error('The generated app must include executable JavaScript.');
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'">`;
  content = content.replace(/<head\b[^>]*>/i, match => `${match}${policy}`);
  return { filename: filename(title || 'generated-app', 'html'), mime: 'text/html', content,
    evidence: [evidence('HTML structure checked', true, 'A complete document and mobile viewport are present. This is a structural check, not a visual layout test.'), evidence('JavaScript syntax checked', true, `${scriptCount} embedded scripts parsed with vm.Script without executing them on the server.`), evidence('Network isolation policy embedded', true, 'The document blocks network connections, external scripts, forms, frames, and plugins. The server also isolates previews with a sandbox.'), evidence('Interactive behavior not verified', false, 'AI-generated code requires browser testing. Open the artifact and check its inputs, results, and error handling before relying on it.')],
    requiresReview: true,
    summary: 'Saved the AI-generated HTML after static checks. Its interactive behavior is unverified; review it in the browser before relying on it.' };
}

export async function buildArtifact(options) {
  const args = { check: async () => {}, progress: async () => {}, sourceUrls: [], prompt: '', title: 'Lara artifact', ...options };
  await args.check();
  await args.progress('do', `Building ${args.kind === 'budget' ? 'a spreadsheet with real formulas' : args.kind === 'research' ? 'a note from live sources' : args.kind === 'security' ? 'a scoped security report' : args.kind === 'app' ? 'a standalone browser app' : 'a self-contained page'}.`);
  let result;
  switch (args.kind) {
    case 'site': result = args.generatedHtml ? generatedHtmlArtifact(args) : siteArtifact(args); break;
    case 'app': result = args.generatedHtml ? generatedHtmlArtifact(args) : appArtifact(args); break;
    case 'budget': result = await budgetArtifact(args); break;
    case 'research': result = await researchArtifact(args); break;
    case 'security': result = await securityArtifact(args); break;
    default: throw new Error('This goal kind is not supported. Choose site, app, budget, research, or security.');
  }
  await args.check();
  const buffer = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content, 'utf8');
  result.evidence.push(evidence('Artifact integrity fingerprint', true, `SHA-256 ${createHash('sha256').update(buffer).digest('hex')} · ${buffer.length} bytes`));
  await args.progress('check', result.requiresReview ? 'Static checks passed and an integrity fingerprint was recorded. Interactive behavior still needs review.' : 'Artifact validation passed and an integrity fingerprint was recorded.');
  return result;
}
