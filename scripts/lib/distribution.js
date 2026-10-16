import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const STATE_PATH = '.academy/installation.json';
export const CURRENT_LESSON = 'teacher/lessons/current.md';
const fixed = ['package.json','package-lock.json','.gitignore','index.html','vite.config.js','AGENTS.md','README.md','academy.config.json','.vscode/tasks.json','.github/workflows/ci.yml'];
const directories = ['games/blockquest/','public/','curriculum/','teacher/lessons/','scripts/lib/','scripts/templates/','tests/'];
const publicScripts = ['scripts/create-student-copy.js','scripts/reset-lesson.js','scripts/update-academy.js','scripts/browser-smoke.js'];
const teacherTests = ['distribution.test.js','release.test.js'];
export const sha = data => createHash('sha256').update(data).digest('hex');
export const validVersion = version => /^\d+\.\d+\.\d+$/.test(version || '');
export const validRepository = repository => /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repository || '');
export const seedPath = path => path.startsWith('student/') || path === CURRENT_LESSON;
export function validPath(path) {
  if (typeof path !== 'string' || !path || path.length > 240 || /[\\:\x00-\x1f]/.test(path)) return false;
  if (!fixed.includes(path) && path.split('/').some(part=>part.startsWith('.'))) return false;
  if (path.split('/').some(part => !part || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' ') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) return false;
  return fixed.includes(path) || publicScripts.includes(path) || directories.some(prefix => path.startsWith(prefix)) || /^student\/[A-Za-z0-9_-]+\.js$/.test(path);
}
export async function assertNoSymlink(root, path) {
  const parts = path.split('/');
  let target = resolve(root);
  for (const part of parts) {
    target = resolve(target, part);
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error(`Символическая ссылка не обновляется: ${path}`); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
  }
}
async function walk(root, path) {
  const stat = await lstat(resolve(root,path));
  if (stat.isSymbolicLink()) throw new Error(`В сборке найдена символическая ссылка: ${path}`);
  if (!stat.isDirectory()) return [path];
  const paths = [];
  for (const entry of (await readdir(resolve(root,path))).sort()) {
    if(entry.startsWith('.') || ['node_modules','backups','workspaces','test-results','dist'].includes(entry))continue;
    paths.push(...await walk(root,`${path}/${entry}`));
  }
  return paths;
}
export async function studentFiles(root) {
  const paths = [];
  const required = ['package.json','package-lock.json','.gitignore','index.html','vite.config.js','AGENTS.md'];
  const optional = ['academy.config.json','.vscode/tasks.json','.github/workflows/ci.yml',...publicScripts];
  for (const path of required) paths.push(path);
  for (const path of optional) { try { await lstat(resolve(root,path)); paths.push(path); } catch(error) { if(error.code !== 'ENOENT')throw error; } }
  for (const path of ['public','games','curriculum','scripts/templates','tests','teacher/lessons']) paths.push(...await walk(root,path));
  try { paths.push(...await walk(root,'scripts/lib')); } catch(error) { if(error.code !== 'ENOENT')throw error; }
  const files = {};
  for (const path of paths) {
    if (!validPath(path) || path.startsWith('tests/') && teacherTests.includes(path.split('/').at(-1))) continue;
    await assertNoSymlink(root,path);
    files[path] = await readFile(resolve(root,path));
  }
  const instructions = files['AGENTS.md'].toString('utf8');
  if (!instructions.trim()) throw new Error('Заполните инструкции AI в AGENTS.md перед созданием ученической копии.');
  const pkg = JSON.parse(files['package.json'].toString());
  for (const key of Object.keys(pkg.scripts || {})) if (['academy:package','academy:release'].includes(key)) delete pkg.scripts[key];
  files['package.json'] = Buffer.from(JSON.stringify(pkg,null,2)+'\n');
  files['README.md'] = await readFile(resolve(root,'curriculum/season-1/lesson-01/student-start.md'));
  for (const name of ['config','rules']) files[`student/${name}.js`] = await readFile(resolve(root,`scripts/templates/${name}.js`));
  for (const name of await readdir(resolve(root,'scripts/templates'))) {
    if (/^[A-Za-z0-9_-]+\.js$/.test(name)) files[`student/${name}`] = await readFile(resolve(root,`scripts/templates/${name}`));
  }
  return files;
}
export function installation(bundle) {
  return { schema:1, version:bundle.version, repository:bundle.repository,
    files:Object.fromEntries(Object.entries(bundle.files).filter(([path])=>!seedPath(path)).map(([path,file])=>[path,file.sha256])) };
}
export async function writeStudentProject(root, files, { version = '0.2.0', repository = 'blockquest-academy/blockquest-starter' } = {}) {
  const bundle = makeBundle(files, {version,repository});
  for (const [path, data] of Object.entries(files)) { await mkdir(dirname(resolve(root,path)),{recursive:true}); await writeFile(resolve(root,path),data,{flag:'wx'}); }
  await mkdir(resolve(root,'.academy'),{recursive:true});
  await writeFile(resolve(root,STATE_PATH),JSON.stringify(installation(bundle),null,2)+'\n',{flag:'wx'});
  return bundle;
}
export function makeBundle(files, {version,repository}) {
  if (!validVersion(version) || !validRepository(repository)) throw new Error('Нужны версия x.y.z и репозиторий owner/name.');
  const bundle = {schema:1,version,repository,files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,data])=>[path,{sha256:sha(data),content:Buffer.from(data).toString('base64')}]))};
  validateBundle(bundle);
  return bundle;
}
export function validateBundle(bundle) {
  if (bundle?.schema !== 1 || !validVersion(bundle.version) || !validRepository(bundle.repository) || !bundle.files || typeof bundle.files !== 'object' || Array.isArray(bundle.files)) throw new Error('Неверный формат обновления Академии.');
  const seen = new Set(); let total = 0;
  for (const [path,file] of Object.entries(bundle.files)) {
    const key = path.normalize('NFC').toLowerCase();
    if (!validPath(path) || seen.has(key) || !/^[a-f0-9]{64}$/.test(file?.sha256 || '') || typeof file.content !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) throw new Error(`Неверный файл обновления: ${path}`);
    seen.add(key); const data = Buffer.from(file.content,'base64'); total += data.length;
    if (sha(data) !== file.sha256) throw new Error(`Повреждён файл обновления: ${path}`);
    if (total > 16*1024*1024 || seen.size > 2000) throw new Error('Обновление превышает допустимый размер.');
  }
  return bundle;
}
export const encodeBundle = bundle => gzipSync(Buffer.from(JSON.stringify(validateBundle(bundle))));
export function decodeBundle(data) {
  if (data.length > 16*1024*1024) throw new Error('Слишком большой пакет обновления.');
  return validateBundle(JSON.parse(gunzipSync(data,{maxOutputLength:24*1024*1024}).toString('utf8')));
}
