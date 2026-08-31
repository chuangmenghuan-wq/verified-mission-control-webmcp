import test from 'node:test';
import assert from 'node:assert/strict';
import { ProvenanceStore } from '../provenance-store.mjs';

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){this.map.set(key,value)}
  removeItem(key){this.map.delete(key)}
}

function fixture(){
  const storage=new MemoryStorage();
  let tick=0;
  const clock=()=>`2026-08-31T00:00:${String(tick++).padStart(2,'0')}.000Z`;
  return {storage,clock};
}
test('persists and verifies across store instances',async()=>{
  const {storage,clock}=fixture();
  const a=new ProvenanceStore({storage,clock});
  const run=await a.startRun({scenarioId:'sensors',scenarioLabel:'Sensor fulfillment',goal:{quantity:500}});
  await a.append(run,'HUMAN_GOAL_LOCKED',{quantity:500});
  await a.finalize(run,{status:'PASS',receiptId:'R1'});
  const b=new ProvenanceStore({storage,clock});
  const verified=await b.verifyRun(run);
  assert.equal(verified.ok,true);
  assert.equal(b.listRuns()[0].status,'PASS');
  assert.equal(verified.event_count,2);
});

test('detects payload tampering',async()=>{
  const {storage,clock}=fixture();
  const store=new ProvenanceStore({storage,clock});
  const run=await store.startRun({scenarioId:'x',scenarioLabel:'X',goal:{}});
  await store.append(run,'HUMAN_DECISION',{choice:'A'});
  const db=JSON.parse(storage.getItem('vmc.provenance.v1'));
  db.runs[0].events[0].payload.choice='B';
  storage.setItem('vmc.provenance.v1',JSON.stringify(db));
  const verified=await store.verifyRun(run);
  assert.equal(verified.ok,false);
  assert.equal(verified.reason,'EVENT_HASH_MISMATCH');
  assert.equal(verified.broken_at,1);
});

test('replays verified events in order without execution side effects',async()=>{
  const {storage,clock}=fixture();
  const store=new ProvenanceStore({storage,clock});
  const run=await store.startRun({scenarioId:'deployment',scenarioLabel:'Deployment',goal:{}});
  await store.append(run,'TOOL_RESULT',{tool:'repair_plan'});
  await store.append(run,'HUMAN_FINAL_APPROVAL',{approved:true});
  const seen=[];
  const result=await store.replay(run,{onEvent:event=>seen.push(event.type)});
  assert.equal(result.ok,true);
  assert.deepEqual(seen,['TOOL_RESULT','HUMAN_FINAL_APPROVAL']);
});
