import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const target = process.env.VMC_PRODUCTION_URL || 'https://verified-mission-control-webmcp.vercel.app/?judge-eval=1';
const port = Number(process.env.VMC_CDP_PORT || 9246);
const profile = path.join(os.tmpdir(), `vmc-webmcp-eval-${process.pid}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function waitForPage() {
  const endpoint = `http://127.0.0.1:${port}/json`;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const pages = await getJson(endpoint);
      const page = pages.find(item => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}
function createCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const resolver = pending.get(message.id);
    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  };
  const opened = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const send = async (method, params = {}) => {
    await opened;
    return new Promise(resolve => {
      const id = nextId++;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  return { socket, send };
}
async function main() {
  const chrome = findChrome();
  assert.ok(chrome, 'Chrome not found; set CHROME_BIN to a WebMCP-capable Chrome executable');
  fs.mkdirSync(profile, { recursive: true });
  const child = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-experimental-web-platform-features',
    '--enable-features=WebMCPTesting,DevToolsWebMCPSupport',
    target,
  ], { stdio: 'ignore' });

  try {
    const page = await waitForPage();
    const { socket, send } = createCdp(page.webSocketDebuggerUrl);
    const evaluate = async expression => {
      const message = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (message.result?.exceptionDetails) throw new Error(JSON.stringify(message.result.exceptionDetails));
      return message.result?.result?.value;
    };
    await sleep(1800);
    const ready = await evaluate(`(async()=>({
      native: verifiedMissionControl.nativeExecutionReady,
      secure: isSecureContext,
      oac: window.originAgentCluster === true,
      tools: (await document.modelContext.getTools()).map(x=>x.name).sort()
    }))()`);
    const expectedTools = [
      'commit_plan','discover_options','generate_candidate_plans','get_evidence_receipt',
      'get_goal_contract','repair_plan','request_final_approval','request_human_decision',
      'verify_candidate_plans'
    ];
    assert.equal(ready.native, true);
    assert.equal(ready.secure, true);
    assert.equal(ready.oac, true);
    assert.deepEqual(ready.tools, expectedTools);

    await evaluate(`localStorage.removeItem('vmc.provenance.v1')`);
    await send('Page.reload');
    await sleep(1600);
    async function runScenario(scenarioId, planId) {
      await evaluate(`verifiedMissionControl.selectScenario('${scenarioId}')`);
      await evaluate(`verifiedMissionControl.runDecisionDemo()`);
      const blocked = await evaluate(`verifiedMissionControl.invokeTool('commit_plan')`);
      assert.equal(blocked.ok, false);
      assert.equal(blocked.error, 'HUMAN_TRADEOFF_DECISION_REQUIRED');
      assert.equal(await evaluate(`[...document.querySelectorAll('.trace-mode')].every(x=>x.innerText==='NATIVE')`), true);

      await evaluate(`verifiedMissionControl.humanAuthorizePlan('${planId}')`);
      await sleep(3200);
      const finalGate = await evaluate(`verifiedMissionControl.invokeTool('commit_plan')`);
      assert.equal(finalGate.ok, false);
      assert.equal(finalGate.error, 'FINAL_COMMIT_APPROVAL_REQUIRED');

      await evaluate(`verifiedMissionControl.humanApproveFinal()`);
      const committed = await evaluate(`verifiedMissionControl.invokeTool('commit_plan')`);
      const receipt = await evaluate(`verifiedMissionControl.invokeTool('get_evidence_receipt')`);
      assert.equal(committed.status, 'GOAL_ACHIEVED');
      assert.equal(receipt.goal_status, 'PASS');
      assert.equal(receipt.durable_provenance.integrity, 'VERIFIED');
      return { committed, receipt };
    }
    const sensor = await runScenario('sensors', 'sensor_budget');
    const sensorRun = sensor.receipt.durable_provenance.run_id;
    await send('Page.reload');
    await sleep(1600);
    const persisted = await evaluate(`(async()=>{
      const runs=verifiedMissionControl.provenanceStore.listRuns();
      const verify=await verifiedMissionControl.provenanceStore.verifyRun('${sensorRun}');
      return {runs,verify,committed:verifiedMissionControl.state.committed};
    })()`);
    assert.equal(persisted.runs.some(run => run.run_id === sensorRun), true);
    assert.equal(persisted.verify.ok, true);
    assert.equal(persisted.committed, false, 'reload/replay must not restore irreversible execution state');

    const replay = await evaluate(`verifiedMissionControl.provenanceStore.replay('${sensorRun}',{delayMs:0})`);
    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, true);
    assert.equal(replay.event_count, sensor.receipt.durable_provenance.event_count);

    const deployment = await runScenario('deployment', 'deploy_budget');
    const finalRuns = await evaluate(`(async()=>{
      const runs=verifiedMissionControl.provenanceStore.listRuns();
      const checks=[];
      for(const run of runs) checks.push(await verifiedMissionControl.provenanceStore.verifyRun(run.run_id));
      return {runs,checks};
    })()`);
    assert.equal(finalRuns.runs.length >= 2, true);
    assert.equal(finalRuns.checks.every(check => check.ok), true);

    console.log(JSON.stringify({
      production_url: target,
      native_webmcp: true,
      tools: ready.tools,
      sensor: { status: sensor.committed.status, provenance: sensor.receipt.durable_provenance },
      reload_persistence: persisted.verify.ok,
      replay_read_only: persisted.committed === false && replay.ok,
      deployment: { status: deployment.committed.status, provenance: deployment.receipt.durable_provenance },
      all_chains_verified: finalRuns.checks.every(check => check.ok),
    }, null, 2));
    socket.close();
  } finally {
    child.kill();
    await sleep(400);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
