import { readFile, open, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { decodeBundle, sha, STATE_PATH, assertNoSymlink } from './lib/distribution.js';
import { readInstallation, planUpdate, applyUpdate, rollbackUpdate } from './lib/update-core.js';

async function download(repository) {
  const response=await fetch(`https://api.github.com/repos/${repository}/releases/latest`,{headers:{'User-Agent':'BlockQuest-Academy','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`GitHub: ${response.status}. Для обновления без интернета используйте --file путь-к-пакету.`);
  const release=await response.json();
  if(!/^v\d+\.\d+\.\d+$/.test(release.tag_name))throw new Error('Неверная версия выпуска.');
  const asset=release.assets.find(item=>item.name === `blockquest-academy-${release.tag_name}.json.gz`);
  if(!asset || asset.size>16*1024*1024 || !asset.browser_download_url.startsWith(`https://github.com/${repository}/releases/download/`))throw new Error('В выпуске нет пакета Академии.');
  const archive=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(30000)});
  if(!archive.ok)throw new Error(`Не удалось загрузить обновление: ${archive.status}.`);
  const data=Buffer.from(await archive.arrayBuffer());
  if(asset.digest && asset.digest !== `sha256:${sha(data)}`)throw new Error('Пакет загрузился с ошибкой. Попробуйте ещё раз.');
  const bundle=decodeBundle(data);
  if(`v${bundle.version}`!==release.tag_name)throw new Error('Версия пакета не совпадает с выпуском.');
  return bundle;
}
async function main() {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const args=process.argv.slice(2),allowed=new Set(['--file','--check','--rollback','--no-install']);
  let file;const options=new Set();
  for(let i=0;i<args.length;i++) {
    if(!allowed.has(args[i]))throw new Error(`Неизвестный аргумент: ${args[i]}`);
    if(args[i]==='--file') {file=args[++i];if(!file || file.startsWith('--'))throw new Error('После --file нужен путь к пакету.');}
    else options.add(args[i]);
  }
  if(options.has('--rollback') && (file || options.has('--check')))throw new Error('Отмена обновления запускается отдельной командой.');
  const {state}=await readInstallation(root);
  const lockPath=resolve(root,dirname(STATE_PATH),'update.lock');
  await assertNoSymlink(root,'.academy/update.lock');
  let lock;
  try {lock=await open(lockPath,'wx');}
  catch(error) {
    if(error.code!=='EEXIST')throw error;
    const old=JSON.parse(await readFile(lockPath,'utf8'));
    if(!Number.isInteger(old.pid) || old.pid<=0)throw new Error('Покажите преподавателю .academy/update.lock: запись предыдущей операции повреждена.');
    try {process.kill(old.pid,0);throw new Error('Обновление уже выполняется. Дождитесь его завершения.');}
    catch(check) {if(check.code!=='ESRCH')throw check;}
    await rm(lockPath);lock=await open(lockPath,'wx');
  }
  await lock.writeFile(JSON.stringify({pid:process.pid}));
  try {
    if(options.has('--rollback')) {
      const result=await rollbackUpdate(root);console.log(`Возвращена Академия ${result.version}. Код student/ и выбранный урок сохранены. При изменении зависимостей выполните npm ci.`);return;
    }
    const bundle=file ? decodeBundle(await readFile(resolve(file))) : await download(state.repository);
    const plan=await planUpdate(root,bundle);
    if(plan.current) {console.log(`Установлена актуальная Академия ${state.version}.`);return;}
    if(options.has('--check')) {console.log(`Доступна Академия ${bundle.version}. Файлов к обновлению: ${plan.changes.length}, новых заготовок: ${plan.seeds.length}. Для установки: npm run academy:update`);return;}
    const result=await applyUpdate(root,bundle);
    console.log(`Академия обновлена: ${state.version} → ${result.version}. Код student/ и выбранный урок сохранены.\nРезервная копия: backups/updates/${result.backup}`);
    if(result.addedStudentFiles.length)console.log(`Добавлены заготовки: ${result.addedStudentFiles.join(', ')}`);
    if(result.needsInstall && !options.has('--no-install')) {
      console.log('Устанавливаются обновлённые зависимости…');
      const installed=spawnSync(process.platform==='win32' ? 'cmd.exe' : 'npm',process.platform==='win32' ? ['/d','/s','/c','npm ci'] : ['ci'],{cwd:root,stdio:'inherit'});
      if(installed.status!==0)throw new Error('Файлы обновлены, но зависимости не установились. Выполните npm ci или отмените обновление.');
    } else if(result.needsInstall)console.log('Изменились зависимости. Выполните npm ci перед запуском игры.');
    console.log('Перезапустите npm run dev и обновите страницу игры.');
  } finally {await lock.close();await rm(lockPath,{force:true});}
}
if(process.argv[1] && realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url)))main().catch(error=>{console.error(error.message);process.exitCode=1;});
