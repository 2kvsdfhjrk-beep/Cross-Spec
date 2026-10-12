/* The sitemap's lastmod for a page: the date of the last commit that touched any of its source files.
   Falls back to the files' modification time for anything not yet committed. */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

export function lastmod(sources: string[]): string {
  const cwd = process.cwd();
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...sources], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) return out.slice(0, 10);
  } catch { /* not a git checkout */ }
  const newest = Math.max(...sources.map((s) => { try { return statSync(resolve(cwd, s)).mtimeMs; } catch { return 0; } }));
  return new Date(newest || Date.now()).toISOString().slice(0, 10);
}
