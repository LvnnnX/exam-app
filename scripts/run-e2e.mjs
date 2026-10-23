// Runs every tests/e2e/*.mjs sequentially against one base URL (default http://localhost:3100).
// A file fails if it exits non-zero OR prints a line starting with "FAIL". Exit 1 if any file failed.
// Usage: npm run test:e2e [-- <baseUrl>] [-- --only=<substring>]
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--')) || process.env.E2E_BASE_URL || 'http://localhost:3100';
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const dir = join(import.meta.dirname, '..', 'tests', 'e2e');
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs') && (!only || f.includes(only))).sort();

const summary = [];
for (const f of files) {
  console.log(`\n=== ${f} @ ${base}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(dir, f), base], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  const failLines = (r.stdout || '').split(/\r?\n/).filter((l) => /^\s*FAIL\b/.test(l)).length;
  const passLines = (r.stdout || '').split(/\r?\n/).filter((l) => /^\s*PASS\b/.test(l)).length;
  const okFile = r.status === 0 && failLines === 0;
  summary.push({ f, okFile, status: r.status, passLines, failLines, s: ((Date.now() - t0) / 1000).toFixed(0) });
}

console.log('\n=== E2E SUMMARY');
for (const s of summary) {
  console.log(`${s.okFile ? 'OK  ' : 'FAIL'} ${s.f} exit=${s.status} pass=${s.passLines} fail=${s.failLines} ${s.s}s`);
}
const bad = summary.filter((s) => !s.okFile).length;
console.log(`${summary.length - bad}/${summary.length} file lolos`);
process.exit(bad || summary.length === 0 ? 1 : 0);
