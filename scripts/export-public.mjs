// export-public.mjs — builds the public repository from this one's HEAD, without the files that must not be
// published: licensed music, sound effects, raw renders, local footage, large captures, raw reports, anything .env.
// The working repository's history (which does contain the music) is never pushed anywhere; the public repository
// has its own history, starting with one commit, "Tactile — Paper Key v1.0", and growing by ordinary commits.
//
//   node scripts/export-public.mjs                      rebuild _tmp/public-repo's files from HEAD, check, list. No commit.
//   node scripts/export-public.mjs --commit             also commit there (first run: git init + the v1.0 commit;
//                                                       later runs: one commit on top, history kept)
//     --name "Name" --email "id+user@users.noreply.github.com"   author for a new repository (required on the first commit)
//     --message "…"                                     message of an update commit (default: "Update from <sha>: <subject>")
//
// It never adds a remote and never pushes. Output: the file list in _tmp/public-repo-files.txt, total size, and the
// result of the checks (forbidden paths, oversized captures, secret patterns). Exit code 1 when a check fails.
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(repo, '_tmp/public-repo');
const stage = resolve(repo, '_tmp/public-export-stage');
const args = process.argv.slice(2);
const opt = (name, def = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const git = (cwd, a, o = {}) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...o }).trim();

/** Left out of the public repository. A trailing slash is a folder; `keep` lists what survives inside one. */
const EXCLUDE = [
  { path: 'CLAUDE.md' }, // a one-line pointer for a local tool; AGENTS.md, the guide it points to, stays
  { path: 'music/' }, // Suno tracks (licensed)
  { path: 'film/audio/music/' }, // the same tracks, as the film's mix reads them
  { path: 'film/audio/sfx/' }, // generated sound effects
  { path: 'film/render/' },
  { path: 'film/frames/' },
  { path: 'film/motion/stills/' }, // large stills and contact sheets
  { path: 'demo-footage/' }, // source clips; the page's own copies in apps/preview/public/footage stay
  { path: '_tmp/' },
  { path: 'apps/preview/public/_upload/' }, // files parked on the site for a moment (a video on its way to Mux)
  { path: 'design/implementation/', keep: ['design/implementation/icons.png'] }, // captures; the icon sheet is embedded in fidelity.md
  { path: 'design/lighthouse/', keep: ['design/lighthouse/README.md'] }, // raw reports; the README has the scores
];
/** Added to the public repository's .gitignore, so these cannot be committed there by accident. */
const IGNORE = ['film/audio/music/', 'film/audio/sfx/'];
const MAX_IMAGE = 500 * 1024;
const SECRET = /(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.|AIza[0-9A-Za-z_-]{35}|(api[_-]?key|secret|token|password|passwd|authorization)["' ]*[:=]["' ]*[A-Za-z0-9_/+=-]{16,})/i;
const LOCAL_PATH = /[A-Z]:[\\/]+(Users|Claude)|\/Users\/[A-Za-z]|OneDrive|AppData/;
// the personal GitHub account the project started under; spelled in two parts so this file passes its own check
const PERSONAL = new RegExp(['dorin', 'stratan'].join(''), 'i');
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|mp4|mp3|wav|blend\d?|pdf|zip)$/i;

const walk = (dir, base = dir, list = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, base, list);
    else list.push(p.slice(base.length + 1).split('\\').join('/'));
  }
  return list;
};

// ---- 1. HEAD, as committed
const head = git(repo, ['rev-parse', '--short', 'HEAD']);
const subject = git(repo, ['log', '-1', '--format=%s']);
if (git(repo, ['status', '--porcelain', '--untracked-files=no'])) console.warn('note: the working tree has uncommitted changes; the export is HEAD as committed, without them');
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
// git writes the tree itself, through a throwaway index: no tar (GNU tar reads 'D:' as a host), and this repo's own index is not touched
const index = resolve(repo, '_tmp/public-export.index');
const env = { ...process.env, GIT_INDEX_FILE: index };
git(repo, ['read-tree', 'HEAD'], { env });
git(repo, ['-c', 'core.autocrlf=false', '--work-tree', stage, 'checkout-index', '-a', '-f'], { env });
rmSync(index, { force: true });

// ---- 2. exclusions
let removed = 0;
for (const f of walk(stage)) {
  const rule = EXCLUDE.find((r) => f.startsWith(r.path));
  const env = /(^|\/)\.env/.test(f);
  if ((rule && !(rule.keep ?? []).includes(f)) || env) {
    rmSync(join(stage, f));
    removed++;
  }
}
// folders the exclusions emptied
const prune = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(join(dir, e.name));
  if (dir !== stage && !readdirSync(dir).length) rmSync(dir, { recursive: true });
};
prune(stage);
appendFileSync(join(stage, '.gitignore'), `\n# Not part of the public repository.\n${IGNORE.join('\n')}\n`);

// ---- 3. checks
const files = walk(stage).sort();
const problems = [];
let bytes = 0;
for (const f of files) {
  const size = statSync(join(stage, f)).size;
  bytes += size;
  const rule = EXCLUDE.find((r) => f.startsWith(r.path));
  if (rule && !(rule.keep ?? []).includes(f)) problems.push(`excluded path present: ${f}`);
  if (/(^|\/)\.env/.test(f)) problems.push(`.env file: ${f}`);
  if (/\.(mp3|wav|flac|m4a|ogg)$/i.test(f)) problems.push(`audio file: ${f}`);
  if (/\.(png|jpe?g)$/i.test(f) && size > MAX_IMAGE) problems.push(`image over 500 KB: ${f} (${Math.round(size / 1024)} KB)`);
  if (BINARY.test(f) || f.endsWith('package-lock.json')) continue;
  const text = readFileSync(join(stage, f), 'utf8');
  if (PERSONAL.test(text)) problems.push(`personal account name in ${f}`);
  // this script names the secret and path patterns it looks for
  if (f !== 'scripts/export-public.mjs') {
    const secret = text.match(SECRET);
    if (secret) problems.push(`secret pattern in ${f}: ${secret[0].slice(0, 24)}…`);
    if (LOCAL_PATH.test(text)) problems.push(`local path in ${f}`);
  }
}

// ---- 4. into the public repository's folder, keeping its .git
mkdirSync(out, { recursive: true });
for (const e of readdirSync(out)) if (e !== '.git') rmSync(join(out, e), { recursive: true, force: true });
cpSync(stage, out, { recursive: true });
rmSync(stage, { recursive: true, force: true });
writeFileSync(resolve(repo, '_tmp/public-repo-files.txt'), files.join('\n') + '\n');

console.log(`export of ${head} → ${out}`);
console.log(`${files.length} files, ${(bytes / 1048576).toFixed(2)} MB (${removed} left out); list in _tmp/public-repo-files.txt`);
console.log(problems.length ? `CHECKS FAILED:\n  ${problems.join('\n  ')}` : 'checks: no excluded paths, no .env, no audio, no image over 500 KB, no secret patterns, no local paths, no personal account name');
if (problems.length) process.exit(1);

// ---- 5. commit, on request. Never a remote, never a push.
if (args.includes('--commit')) {
  const fresh = !existsSync(join(out, '.git'));
  if (fresh) {
    const name = opt('--name');
    const email = opt('--email');
    if (!name || !email) {
      console.error('first commit: pass --name and --email (the GitHub noreply address)');
      process.exit(1);
    }
    git(out, ['init', '-q', '-b', 'main']);
    git(out, ['config', 'user.name', name]);
    git(out, ['config', 'user.email', email]);
  }
  git(out, ['add', '-A']);
  if (!git(out, ['status', '--porcelain'])) console.log('public repository: nothing to commit');
  else {
    const message = fresh ? 'Tactile — Paper Key v1.0' : opt('--message', `Update from ${head}: ${subject}`);
    git(out, ['commit', '-q', '-m', `${message}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`]);
    console.log(`public repository: ${git(out, ['log', '-1', '--format=%h %an <%ae> %s'])} (${git(out, ['rev-list', '--count', 'HEAD'])} commit${fresh ? '' : 's'})`);
  }
} else {
  console.log('no commit made (run with --commit)');
}
