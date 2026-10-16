import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access, symlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { makeBundle, encodeBundle, decodeBundle, writeStudentProject, STATE_PATH, CURRENT_LESSON } from '../scripts/lib/distribution.js';
import { applyUpdate, planUpdate, rollbackUpdate, readInstallation } from '../scripts/lib/update-core.js';
const repository='blockquest-academy/blockquest-starter';
const data=object=>Object.fromEntries(Object.entries(object).map(([path,text])=>[path,Buffer.from(text)]));
const base=data({'games/blockquest/main.js':'old engine','public/old.svg':'old asset','package.json':'{"name":"fixture","dependencies":{}}','student/config.js':'baseline config','student/rules.js':'baseline rule',[CURRENT_LESSON]:'lesson-01'});
async function fixture(t) {
  const root=await mkdtemp(resolve(tmpdir(),'bq-update-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeStudentProject(root,base,{version:'0.2.0',repository});return root;
}
const update=(changes={})=>makeBundle({...base,...data(changes)},{version:'0.2.1',repository});
async function put(root,path,content){await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),content);}

test('обновление заменяет движок, сохраняет оба файла ученика и выбор урока буквально',async t=>{
  const root=await fixture(t);
  await put(root,'student/config.js','my config: even broken syntax');await put(root,'student/rules.js','my shield rule');await put(root,CURRENT_LESSON,'lesson-07 selected by teacher');
  const result=await applyUpdate(root,update({'games/blockquest/main.js':'new engine','student/config.js':'new baseline',[CURRENT_LESSON]:'lesson-09'}));
  assert.equal(await readFile(resolve(root,'games/blockquest/main.js'),'utf8'),'new engine');
  assert.equal(await readFile(resolve(root,'student/config.js'),'utf8'),'my config: even broken syntax');
  assert.equal(await readFile(resolve(root,'student/rules.js'),'utf8'),'my shield rule');
  assert.equal(await readFile(resolve(root,CURRENT_LESSON),'utf8'),'lesson-07 selected by teacher');
  assert.equal((await readInstallation(root)).state.version,'0.2.1');assert.ok(result.backup);
});
test('добавляются только отсутствующие заготовки; существующий новый файл не затирается',async t=>{
  const root=await fixture(t);await put(root,'student/inventory.js','my experiment');
  const result=await applyUpdate(root,update({'student/inventory.js':'baseline inventory','student/items.js':'new item starter'}));
  assert.equal(await readFile(resolve(root,'student/inventory.js'),'utf8'),'my experiment');
  assert.equal(await readFile(resolve(root,'student/items.js'),'utf8'),'new item starter');
  assert.deepEqual(result.addedStudentFiles,['student/items.js']);
});
test('собственная правка движка останавливает обновление до любых замен',async t=>{
  const root=await fixture(t);await put(root,'games/blockquest/main.js','my engine edit');
  await assert.rejects(applyUpdate(root,update({'games/blockquest/main.js':'new engine','public/new.svg':'new asset'})),/Ничего не заменено/);
  assert.equal(await readFile(resolve(root,'games/blockquest/main.js'),'utf8'),'my engine edit');
  await assert.rejects(access(resolve(root,'public/new.svg')));
  assert.equal((await readInstallation(root)).state.version,'0.2.0');
});
test('удалённый или занятый пользователем путь требует разбора, одинаковые файлы принимаются',async t=>{
  const root=await fixture(t);await rm(resolve(root,'games/blockquest/main.js'));
  await assert.rejects(applyUpdate(root,update({'games/blockquest/main.js':'new engine'})),/собственные изменения/);
  await put(root,'games/blockquest/main.js','new engine');
  await applyUpdate(root,update({'games/blockquest/main.js':'new engine'}));
  assert.equal((await readInstallation(root)).state.version,'0.2.1');
});
test('удаляются устаревшие файлы движка и возвращаются при откате',async t=>{
  const root=await fixture(t);const files={...base};delete files['public/old.svg'];
  await applyUpdate(root,makeBundle(files,{version:'0.2.1',repository}));
  await assert.rejects(access(resolve(root,'public/old.svg')));
  await rollbackUpdate(root);assert.equal(await readFile(resolve(root,'public/old.svg'),'utf8'),'old asset');
});
test('откат восстанавливает предыдущую версию и сохраняет работу и новые учебные файлы',async t=>{
  const root=await fixture(t);
  await applyUpdate(root,update({'games/blockquest/main.js':'new engine','public/new.svg':'new asset','student/items.js':'new starter'}));
  await put(root,'student/items.js','my completed task');await put(root,'student/rules.js','my new rule');
  await rollbackUpdate(root);
  assert.equal(await readFile(resolve(root,'games/blockquest/main.js'),'utf8'),'old engine');
  await assert.rejects(access(resolve(root,'public/new.svg')));
  assert.equal(await readFile(resolve(root,'student/items.js'),'utf8'),'my completed task');
  assert.equal(await readFile(resolve(root,'student/rules.js'),'utf8'),'my new rule');
  assert.equal((await readInstallation(root)).state.version,'0.2.0');
  await assert.rejects(rollbackUpdate(root),/Нет обновления/);
});
test('откат не затирает новую авторскую правку движка',async t=>{
  const root=await fixture(t);await applyUpdate(root,update({'games/blockquest/main.js':'new engine'}));
  await put(root,'games/blockquest/main.js','edited after update');
  await assert.rejects(rollbackUpdate(root),/Откат остановлен/);
  assert.equal(await readFile(resolve(root,'games/blockquest/main.js'),'utf8'),'edited after update');
  assert.equal((await readInstallation(root)).state.version,'0.2.1');
});
test('ошибка во время записи возвращает уже заменённые файлы и старый номер версии',async t=>{
  const root=await fixture(t);
  await assert.rejects(applyUpdate(root,update({'games/blockquest/main.js':'new engine','public/new.svg':'new asset'}),{beforeWrite:(_path,index)=>{if(index===1)throw new Error('simulated disk error');}}),/Предыдущая версия восстановлена/);
  assert.equal(await readFile(resolve(root,'games/blockquest/main.js'),'utf8'),'old engine');
  assert.equal((await readInstallation(root)).state.version,'0.2.0');
});
test('чужой репозиторий, откат версией пакета и изменение уже выпущенной версии отклоняются',async t=>{
  const root=await fixture(t);
  await assert.rejects(applyUpdate(root,makeBundle(base,{version:'0.2.1',repository:'other-owner/starter'})),/другим репозиторием/);
  await assert.rejects(applyUpdate(root,makeBundle(base,{version:'0.1.0',repository})),/Старая версия/);
  await assert.rejects(applyUpdate(root,makeBundle({...base,...data({'public/a.svg':'a'})},{version:'0.2.0',repository})),/новый номер версии/);
  assert.equal((await planUpdate(root,makeBundle(base,{version:'0.2.0',repository}))).current,true);
});
test('архив проверяет хеши, пути, регистр и исключает служебные и преподавательские файлы',()=>{
  const bundle=update();assert.deepEqual(decodeBundle(encodeBundle(bundle)),bundle);
  const broken=structuredClone(bundle);broken.files['games/blockquest/main.js'].content=Buffer.from('tampered').toString('base64');
  assert.throws(()=>encodeBundle(broken),/Повреждён/);
  for(const path of ['../outside.js','student/../outside.js','teacher/solutions/answer.js','.git/config','C:/outside.js','public/CON.txt','public/a\\b.js'])assert.throws(()=>makeBundle(data({[path]:'oops'}),{version:'0.2.1',repository}),/Неверный файл/);
  assert.throws(()=>makeBundle(data({'public/A.svg':'a','public/a.svg':'b'}),{version:'0.2.1',repository}),/Неверный файл/);
});
test('символическая ссылка в обновляемом пути не позволяет записать за пределами проекта',async t=>{
  const root=await fixture(t),outside=await mkdtemp(resolve(tmpdir(),'bq-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));
  await rm(resolve(root,'public'),{recursive:true});await symlink(outside,resolve(root,'public'),'dir');
  await assert.rejects(applyUpdate(root,update({'public/new.svg':'new asset'})),/Символическая ссылка/);
  await assert.rejects(access(resolve(outside,'new.svg')));
});
test('зависимости устанавливаются только при изменении их набора, а не номера пакета',async t=>{
  const root=await fixture(t);
  const result=await applyUpdate(root,update({'package.json':'{"name":"fixture","version":"0.2.1","dependencies":{}}'}));
  assert.equal(result.needsInstall,false);
  const next=makeBundle({...base,...data({'package.json':'{"name":"fixture","dependencies":{"example":"1.0.0"}}'})},{version:'0.2.2',repository});
  assert.equal((await applyUpdate(root,next)).needsInstall,true);
});
