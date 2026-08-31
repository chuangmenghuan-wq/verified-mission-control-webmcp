const DEFAULT_KEY='vmc.provenance.v1';

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}

export function canonicalJson(value){ return JSON.stringify(stable(value)); }

export async function sha256Hex(text){
  const bytes=new TextEncoder().encode(text);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }

export class ProvenanceStore{
  constructor({storage=globalThis.localStorage,key=DEFAULT_KEY,clock=()=>new Date().toISOString()}={}){
    this.storage=storage; this.key=key; this.clock=clock;
  }
  load(){
    try{const raw=this.storage?.getItem(this.key);return raw?JSON.parse(raw):{version:1,runs:[]};}
    catch{return {version:1,runs:[]};}
  }
  save(db){ this.storage?.setItem(this.key,JSON.stringify(db)); }
  listRuns(){
    return this.load().runs.map(r=>({run_id:r.run_id,scenario_id:r.scenario_id,scenario_label:r.scenario_label,status:r.status,started_at:r.started_at,finalized_at:r.finalized_at??null,event_count:r.events.length,final_hash:r.final_hash??r.events.at(-1)?.hash??null})).reverse();
  }
  getRun(runId){ const run=this.load().runs.find(r=>r.run_id===runId); return run?clone(run):null; }
  async startRun({scenarioId,scenarioLabel,goal}){
    const db=this.load();
    const startedAt=this.clock();
    const seed=`${scenarioId}|${startedAt}|${db.runs.length}`;
    const runId=`VMC-RUN-${(await sha256Hex(seed)).slice(0,12).toUpperCase()}`;
    const run={run_id:runId,scenario_id:scenarioId,scenario_label:scenarioLabel,started_at:startedAt,status:'IN_PROGRESS',goal:clone(goal),events:[],final_hash:null};
    db.runs.push(run); this.save(db); return runId;
  }
  async append(runId,type,payload={}){
    const db=this.load(); const run=db.runs.find(r=>r.run_id===runId);
    if(!run) throw new Error('PROVENANCE_RUN_NOT_FOUND');
    const seq=run.events.length+1, at=this.clock();
    const prevHash=run.events.at(-1)?.hash??'GENESIS';
    const core={run_id:runId,seq,at,type,payload:clone(payload),prev_hash:prevHash};
    const hash=await sha256Hex(canonicalJson(core));
    const event={...core,hash}; run.events.push(event); run.final_hash=hash; this.save(db); return clone(event);
  }
  async finalize(runId,{status='PASS',receiptId=null,summary=null}={}){
    await this.append(runId,'RUN_FINALIZED',{status,receipt_id:receiptId,summary});
    const db=this.load(); const run=db.runs.find(r=>r.run_id===runId);
    run.status=status; run.receipt_id=receiptId; run.summary=summary; run.finalized_at=this.clock(); run.final_hash=run.events.at(-1)?.hash??null;
    this.save(db); return clone(run);
  }
  async verifyRun(runId){
    const run=this.getRun(runId); if(!run) return {ok:false,error:'PROVENANCE_RUN_NOT_FOUND'};
    let prev='GENESIS';
    for(const event of run.events){
      if(event.prev_hash!==prev) return {ok:false,run_id:runId,broken_at:event.seq,reason:'PREVIOUS_HASH_MISMATCH'};
      const core={run_id:event.run_id,seq:event.seq,at:event.at,type:event.type,payload:event.payload,prev_hash:event.prev_hash};
      const expected=await sha256Hex(canonicalJson(core));
      if(expected!==event.hash) return {ok:false,run_id:runId,broken_at:event.seq,reason:'EVENT_HASH_MISMATCH'};
      prev=event.hash;
    }
    return {ok:true,run_id:runId,event_count:run.events.length,final_hash:prev,status:run.status};
  }
  async replay(runId,{onEvent=()=>{},delayMs=0}={}){
    const verification=await this.verifyRun(runId);
    if(!verification.ok) return verification;
    const run=this.getRun(runId);
    for(const event of run.events){
      await onEvent(clone(event));
      if(delayMs) await new Promise(r=>setTimeout(r,delayMs));
    }
    return {...verification,replayed:true};
  }
  exportRun(runId){
    const run=this.getRun(runId);
    return run?canonicalJson({schema:'verified-mission-control/provenance-run@v1',run}):null;
  }
  clear(){ this.storage?.removeItem(this.key); }
}
