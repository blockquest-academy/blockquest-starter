import { readFile, writeFile, mkdir, rename, rm, readdir, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { STATE_PATH, seedPath, validPath, validVersion, validRepository, validateBundle, sha, installation, assertNoSymlink } from './distribution.js';

const digest = data => data === null ? null : sha(data);
async function contents(root,path) {
  await assertNoSymlink(root,path);
  try { return await readFile(resolve(root,path)); } catch(error) { if(error.code === 'ENOENT')return null; throw error; }
}
async function atomic(root,path,data) {
  await assertNoSymlink(root,path);
  const target = resolve(root,path);
  if(data === null) { await rm(target,{force:true}); return; }
  await mkdir(dirname(target),{recursive:true});
  const temp = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temp,data,{flag:'wx'}); await rename(temp,target); }
  finally { await rm(temp,{force:true}); }
}
export async function readInstallation(root) {
  const data = await contents(root,STATE_PATH);
  if(!data)throw new Error('Обновление запускается из ученической копии. Создайте её через npm run student:copy.');
  const state = JSON.parse(data.toString());
  if(state.schema !== 1 || !validVersion(state.version) || !validRepository(state.repository) || !state.files || typeof state.files !== 'object' || Array.isArray(state.files))throw new Error('Повреждена запись версии Академии. Покажите её преподавателю.');
  for(const [path,hash] of Object.entries(state.files))if(!validPath(path) || seedPath(path) || !/^[a-f0-9]{64}$/.test(hash))throw new Error('Повреждён список файлов установленной версии.');
  return {state,data};
}
const compareVersions = (a,b) => { const av=a.split('.').map(Number),bv=b.split('.').map(Number);for(let i=0;i<3;i++)if(av[i]!==bv[i])return Math.sign(av[i]-bv[i]);return 0; };
export async function planUpdate(root,bundle) {
  validateBundle(bundle);
  const {state,data} = await readInstallation(root);
  if(bundle.repository !== state.repository)throw new Error('Обновление выпущено другим репозиторием.');
  if(compareVersions(bundle.version,state.version)<0)throw new Error('Старая версия не устанавливается как обновление. Используйте отмену последнего обновления.');
  const next = installation(bundle);
  if(bundle.version === state.version) {
    if(JSON.stringify(Object.entries(next.files).sort()) !== JSON.stringify(Object.entries(state.files).sort()))throw new Error('Содержимое этой версии изменилось. Преподавателю нужно выпустить новый номер версии.');
    return {state,next,changes:[],seeds:[],stateBefore:data,current:true};
  }
  const changes=[],seeds=[],conflicts=[];
  for(const path of [...new Set([...Object.keys(state.files),...Object.keys(next.files)])].sort()) {
    const before=await contents(root,path),actual=digest(before),expected=state.files[path] || null,afterHash=next.files[path] || null;
    if(actual === afterHash)continue;
    if(actual !== expected) { conflicts.push(path);continue; }
    changes.push({path,before,after:bundle.files[path] ? Buffer.from(bundle.files[path].content,'base64') : null});
  }
  for(const [path,file] of Object.entries(bundle.files))if(seedPath(path)) {
    // Существующий учебный файл сохраняется буквально, даже если в нём ошибка.
    try { await lstat(resolve(root,path)); }
    catch(error) { if(error.code !== 'ENOENT')throw error;await assertNoSymlink(root,path);seeds.push({path,data:Buffer.from(file.content,'base64')}); }
  }
  if(conflicts.length)throw new Error(`Есть собственные изменения вне student/. Ничего не заменено:\n${conflicts.join('\n')}\nСохраните их и разберите обновление с преподавателем.`);
  return {state,next,changes,seeds,stateBefore:data,current:false};
}
function dependencySignature(data) {
  if(!data)return '';
  const pkg=JSON.parse(data.toString());
  return JSON.stringify(['dependencies','devDependencies','optionalDependencies'].map(key=>Object.entries(pkg[key] || {}).sort()));
}
async function saveJournal(root,id,journal) { await atomic(root,`backups/updates/${id}/update.json`,Buffer.from(JSON.stringify(journal,null,2)+'\n')); }
export async function applyUpdate(root,bundle,{beforeWrite}={}) {
  const plan=await planUpdate(root,bundle);
  if(plan.current)return {version:plan.state.version,current:true,changed:[],addedStudentFiles:[]};
  const id=`update-${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}`;
  const stateAfter=Buffer.from(JSON.stringify(plan.next,null,2)+'\n');
  const changes=[...plan.changes,{path:STATE_PATH,before:plan.stateBefore,after:stateAfter}];
  const journal={schema:1,from:plan.state.version,to:bundle.version,repository:bundle.repository,status:'applying',files:changes.map(change=>({path:change.path,before:change.before?.toString('base64') ?? null,beforeSha:digest(change.before),afterSha:digest(change.after)}))};
  await saveJournal(root,id,journal);
  const written=[];const added=[];
  try {
    for(const [index,change] of changes.entries()) {
      if(digest(await contents(root,change.path)) !== digest(change.before))throw new Error(`Файл изменился во время обновления: ${change.path}`);
      if(beforeWrite)await beforeWrite(change.path,index);
      await atomic(root,change.path,change.after);written.push(change);
    }
    for(const seed of plan.seeds) {
      await assertNoSymlink(root,seed.path);await mkdir(dirname(resolve(root,seed.path)),{recursive:true});
      try { await writeFile(resolve(root,seed.path),seed.data,{flag:'wx'});added.push(seed.path); }
      catch(error) { if(error.code !== 'EEXIST')throw error; }
    }
    journal.status='applied';await saveJournal(root,id,journal);
  } catch(error) {
    const failed=[];
    for(const change of written.reverse()) {
      try {
        if(digest(await contents(root,change.path)) !== digest(change.after))throw new Error('Изменён после записи');
        await atomic(root,change.path,change.before);
      } catch {failed.push(change.path);}
    }
    journal.status=failed.length ? 'needs-review' : 'failed-restored';
    await saveJournal(root,id,journal);
    throw new Error(`${error.message}\n${failed.length ? `Проверьте файлы: ${failed.join(', ')}.` : 'Предыдущая версия восстановлена.'}\nРезервная копия: backups/updates/${id}`);
  }
  const packageChange=plan.changes.find(change=>change.path === 'package.json');
  return {version:bundle.version,current:false,backup:id,changed:plan.changes.map(change=>change.path),addedStudentFiles:added,needsInstall:Boolean(packageChange && dependencySignature(packageChange.before)!==dependencySignature(packageChange.after))};
}
export async function rollbackUpdate(root,requested) {
  await readInstallation(root);
  await assertNoSymlink(root,'backups/updates');
  let ids;
  try { ids=(await readdir(resolve(root,'backups/updates'))).filter(id=>/^update-[A-Za-z0-9.-]+$/.test(id)).sort().reverse(); }
  catch(error) { if(error.code !== 'ENOENT')throw error;ids=[]; }
  if(requested) { if(!ids.includes(requested))throw new Error('Резервная копия обновления не найдена.');ids=[requested]; }
  for(const id of ids) {
    const journalData=await contents(root,`backups/updates/${id}/update.json`);
    if(!journalData)continue;
    const journal=JSON.parse(journalData.toString());
    if(!['applied','applying','needs-review'].includes(journal.status))continue;
    if(journal.schema!==1 || !Array.isArray(journal.files) || !validVersion(journal.from))throw new Error('Повреждена резервная копия обновления.');
    const paths=new Set(),restore=[];
    for(const file of journal.files) {
      if((!validPath(file.path) && file.path!==STATE_PATH) || seedPath(file.path) || paths.has(file.path))throw new Error('Неверный путь в резервной копии.');
      paths.add(file.path);
      const before=file.before===null ? null : Buffer.from(file.before,'base64');
      if(digest(before)!==file.beforeSha || file.afterSha!==null && !/^[a-f0-9]{64}$/.test(file.afterSha))throw new Error('Повреждена резервная копия файла.');
      const actual=digest(await contents(root,file.path));
      if(actual!==file.afterSha && actual!==file.beforeSha)throw new Error(`После обновления изменён ${file.path}. Откат остановлен, работа сохранена.`);
      if(actual!==file.beforeSha)restore.push({path:file.path,data:before});
    }
    for(const file of restore)await atomic(root,file.path,file.data);
    journal.status='rolled-back';await saveJournal(root,id,journal);
    return {version:journal.from,backup:id,changed:restore.map(file=>file.path)};
  }
  throw new Error('Нет обновления, которое можно отменить.');
}
