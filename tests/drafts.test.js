import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {createApp} from '../src/server.js';

test('AI-generated code stays a draft until explicit behavioral evidence is recorded',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'lara-draft-'));const db=await openDatabase({url:'',dataDir:dir});const instance=await createApp({db,workerOptions:{interval:10}});const server=instance.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await instance.close();await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${server.address().port}`;let cookie;
  async function request(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return {status:r.status,body:await r.json()};}
  await request('/api/auth/create',{name:'Tester'});
  const g=await request('/api/goals',{kind:'app',title:'Generated counter',prompt:'Make a counter',generatedHtml:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Counter</title></head><body><button id="add">Add</button><output id="count">0</output><script>let n=0;document.getElementById("add").onclick=()=>document.getElementById("count").textContent=++n;</script></body></html>'});assert.equal(g.status,201);
  let current;
  for(let i=0;i<150;i++){current=(await request('/api/state')).body.goals.find(x=>x.id===g.body.goal.id);if(current.needsReview)break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(current.status,'paused');assert.equal(current.needsReview,true);assert(current.artifactIds.length);assert(current.evidence.some(e=>e.passed===false));
  const verified=await request(`/api/goals/${current.id}/verify`,{notes:'Opened the counter and pressed Add twice; the visible count increased from 0 to 2.'});assert.equal(verified.status,200);assert.equal(verified.body.goal.status,'completed');assert(verified.body.goal.evidence.some(e=>e.label.includes('workspace owner')));
  const replay=await request(`/api/goals/${current.id}/verify`,{notes:'Replayed the old verification request.'});assert.equal(replay.status,409);
});
