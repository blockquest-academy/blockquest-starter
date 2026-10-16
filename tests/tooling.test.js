import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { resetLesson } from '../scripts/reset-lesson.js';
import { createStudentCopy } from '../scripts/create-student-copy.js';

test('сброс требует подтверждения и сохраняет точную копию старой работы', async t => {
  const root=await mkdtemp(resolve(tmpdir(),'blockquest-reset-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(resolve(root,'student'));await mkdir(resolve(root,'scripts/templates'),{recursive:true});
  await writeFile(resolve(root,'student/config.js'),'broken syntax or a student idea');
  await writeFile(resolve(root,'scripts/templates/config.js'),'export const playerSpeed = 3;');
  await assert.rejects(resetLesson(root),/подтверждения/);
  assert.equal(await readFile(resolve(root,'student/config.js'),'utf8'),'broken syntax or a student idea');
  await writeFile(resolve(root,'student/rules.js'),'my rule');
  await writeFile(resolve(root,'scripts/templates/rules.js'),'empty rule');
  const backup=await resetLesson(root,{confirmed:true});
  assert.equal(await readFile(resolve(backup,'config.js'),'utf8'),'broken syntax or a student idea');
  assert.equal(await readFile(resolve(root,'student/config.js'),'utf8'),'export const playerSpeed = 3;');
  assert.equal(await readFile(resolve(backup,'rules.js'),'utf8'),'my rule');
  assert.equal(await readFile(resolve(root,'student/rules.js'),'utf8'),'empty rule');
  await writeFile(resolve(root,'student/config.js'),'keep this experiment');
  await writeFile(resolve(root,'student/rules.js'),'second rule');
  const ruleBackup=await resetLesson(root,{confirmed:true,exercise:'rules'});
  assert.equal(await readFile(resolve(root,'student/config.js'),'utf8'),'keep this experiment');
  assert.equal(await readFile(resolve(ruleBackup,'rules.js'),'utf8'),'second rule');
  await assert.rejects(resetLesson(root,{confirmed:true,exercise:'bad'}),/Задание/);
});
test('ученическая копия самостоятельна, без решений; существующая не затирается', async t => {
  const root=await mkdtemp(resolve(tmpdir(),'blockquest-copy-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const dir of ['public','student','games','curriculum/season-1/lesson-01','scripts/templates','tests','teacher/solutions','teacher/lessons','teacher/lesson-guides']) await mkdir(resolve(root,dir),{recursive:true});
  for(const f of ['package.json','package-lock.json','.gitignore','index.html','vite.config.js']) await writeFile(resolve(root,f),'test');
  await writeFile(resolve(root,'package.json'),JSON.stringify({name:'fixture',version:'0.2.0',type:'module',scripts:{dev:'vite'}}));
  await writeFile(resolve(root,'AGENTS.md'),'mentor instructions');
  await writeFile(resolve(root,'teacher/lessons/lesson-01.md'),'lesson 01: numbers and one if');
  await writeFile(resolve(root,'teacher/lesson-guides/lesson-01.md'),'teacher guide');
  await writeFile(resolve(root,'scripts/templates/config.js'),'baseline');await writeFile(resolve(root,'student/config.js'),'teacher demo');
  await writeFile(resolve(root,'teacher/solutions/private.js'),'solution');await writeFile(resolve(root,'curriculum/season-1/lesson-01/student-start.md'),'student instructions');
  await writeFile(resolve(root,'scripts/templates/rules.js'),'empty rule');
  await writeFile(resolve(root,'student/rules.js'),'teacher solution');
  const destination=await createStudentCopy(root,'student-a');
  assert.equal(await readFile(resolve(destination,'student/config.js'),'utf8'),'baseline');
  assert.deepEqual(await readdir(resolve(destination,'student')),['config.js','rules.js']);
  assert.equal(await readFile(resolve(destination,'student/rules.js'),'utf8'),'empty rule');
  assert.equal(await readFile(resolve(destination,'README.md'),'utf8'),'student instructions');
  assert.equal(await readFile(resolve(destination,'AGENTS.md'),'utf8'),'mentor instructions');
  assert.equal(await readFile(resolve(destination,'teacher/lessons/lesson-01.md'),'utf8'),'lesson 01: numbers and one if');
  assert.deepEqual(await readdir(resolve(destination,'teacher')),['lessons']);
  await assert.rejects(access(resolve(destination,'teacher/solutions')));
  await assert.rejects(access(resolve(destination,'teacher/lesson-guides')));
  await writeFile(resolve(destination,'student/config.js'),'my work');
  await assert.rejects(createStudentCopy(root,'student-a'),/уже существует/);
  assert.equal(await readFile(resolve(destination,'student/config.js'),'utf8'),'my work');
  await assert.rejects(createStudentCopy(root,'../oops'),/Имя/);
});

test('пустые или отсутствующие инструкции не создают копию без правил наставника', async t => {
  const root=await mkdtemp(resolve(tmpdir(),'blockquest-instructions-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(resolve(root,'AGENTS.md'),'\n');
  await assert.rejects(createStudentCopy(root,'student-a'),/Заполните инструкции AI/);
  await assert.rejects(access(resolve(root,'workspaces')));
  await rm(resolve(root,'AGENTS.md'));
  await assert.rejects(createStudentCopy(root,'student-a'),{code:'ENOENT'});
});

test('отсутствующий шаблон не оставляет частично сброшенное задание', async t => {
  const root=await mkdtemp(resolve(tmpdir(),'blockquest-incomplete-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(resolve(root,'student'));await mkdir(resolve(root,'scripts/templates'),{recursive:true});
  await writeFile(resolve(root,'student/config.js'),'my numbers');await writeFile(resolve(root,'student/rules.js'),'my rule');
  await writeFile(resolve(root,'scripts/templates/config.js'),'defaults');
  await assert.rejects(resetLesson(root,{confirmed:true}),{code:'ENOENT'});
  assert.equal(await readFile(resolve(root,'student/config.js'),'utf8'),'my numbers');
  assert.equal(await readFile(resolve(root,'student/rules.js'),'utf8'),'my rule');
});
