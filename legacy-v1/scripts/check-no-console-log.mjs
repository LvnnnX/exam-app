#!/usr/bin/env node
/**
 * Block accidental `console.log` in server actions. The exam runtime
 * previously leaked question IDs to provider logs through debug logs.
 * This guard runs from lint-staged before every commit.
 *
 * Usage: node scripts/check-no-console-log.mjs <file> [<file> ...]
 */
import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const FORBIDDEN = /\bconsole\.log\s*\(/g;
const ALLOWED_HINT = '// allow-console-log';

const files = argv.slice(2);
let violations = 0;

for (const file of files) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`[check-no-console-log] cannot read ${file}: ${err.message}`);
    violations += 1;
    continue;
  }

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (FORBIDDEN.test(line) && !line.includes(ALLOWED_HINT)) {
      violations += 1;
      console.error(
        `${file}:${i + 1}: console.log is not allowed in server actions. ` +
        `Use a structured logger or remove. Add "${ALLOWED_HINT}" to override.`
      );
    }
  }
}

if (violations > 0) {
  console.error(
    `\n[check-no-console-log] ${violations} violation(s) found. Aborting commit.`
  );
  exit(1);
}
