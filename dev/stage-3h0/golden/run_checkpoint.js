/* Stage 3H0 - the equivalence gate run at every checkpoint after H0-1 (development only).
 *
 *   node dev/stage-3h0/golden/run_checkpoint.js LABEL [--skip-client] [--skip-server]
 *
 * Writes dev/stage-3h0/evidence/LABEL/:
 *   srv_golden_report.json   server traces: the accepted parent's server.js and the working tree's, same inputs, byte for byte; and the
 *                            working tree's traces against the H0-1 baseline (HTTP lines about files this stage changed are listed apart)
 *   cli_golden_report.json   client traces: the parent's mp.js and the working tree's mp.js (+ its helper scripts), byte for byte; and
 *                            against the H0-1 baseline
 *   contract_check.json      every message in the new traces against dev/stage-3h0/protocol_contract.json
 *   checkpoint.json          the summary: ok only when all three hold
 * Exit status 0 only when everything holds. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const HERE = __dirname, EV = path.resolve(HERE, '..', 'evidence'), BASE = path.join(EV, 'h0-1');
const label = process.argv[2]; if (!label) { console.error('usage: run_checkpoint.js LABEL'); process.exit(2); }
const OUT = path.join(EV, label); fs.mkdirSync(OUT, { recursive: true });
const keepS = fs.mkdtempSync(path.join(os.tmpdir(), 'h0cks-')), keepC = fs.mkdtempSync(path.join(os.tmpdir(), 'h0ckc-'));
const run = (args, timeout) => { const r = spawnSync(process.execPath, args, { stdio: 'inherit', timeout }); return r.status; };
const sum = { label, at: new Date().toISOString(), steps: {} };
if (!process.argv.includes('--skip-server')) sum.steps.server = run([path.join(HERE, 'srv_golden.js'), '--out', OUT, '--baseline', path.join(BASE, 'srv_traces'), '--keep', keepS], 1800000) === 0;
if (!process.argv.includes('--skip-client')) sum.steps.client = run([path.join(HERE, 'cli_golden.js'), '--out', OUT, '--baseline', path.join(BASE, 'cli_traces'), '--keep', keepC], 1800000) === 0;
const nd = d => { const t = fs.mkdtempSync(path.join(os.tmpdir(), 'h0n-')); for (const f of fs.readdirSync(d)) if (/\.new\.json(l)?$/.test(f)) fs.copyFileSync(path.join(d, f), path.join(t, f)); return t; };
sum.steps.contract = run([path.join(HERE, 'contract_check.js'), '--srv', nd(keepS), '--cli', nd(keepC), '--out', path.join(OUT, 'contract_check.json')], 600000) === 0;
sum.ok = Object.values(sum.steps).every(Boolean);
fs.writeFileSync(path.join(OUT, 'checkpoint.json'), JSON.stringify(sum, null, 1) + '\n');
fs.rmSync(keepS, { recursive: true, force: true }); fs.rmSync(keepC, { recursive: true, force: true });
console.log(`checkpoint ${label}: ${sum.ok ? 'ALL EQUIVALENT' : 'NOT EQUIVALENT'} ${JSON.stringify(sum.steps)}`);
process.exitCode = sum.ok ? 0 : 1;
