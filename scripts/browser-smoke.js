import { chromium } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, mkdtemp, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = await readFile(resolve(sourceRoot,'student/config.js'),'utf8');
const originalRules = await readFile(resolve(sourceRoot,'student/rules.js'),'utf8');
const originalGuardian = await readFile(resolve(sourceRoot,'student/guardian.js'),'utf8');
const originalMonsters = await readFile(resolve(sourceRoot,'student/monsters.js'),'utf8');
const root = await mkdtemp(resolve(tmpdir(),'blockquest-browser-'));
const artifacts = resolve(sourceRoot,'test-results');
const configPath = resolve(root,'student/config.js');
const baseline = await readFile(resolve(sourceRoot,'scripts/templates/config.js'),'utf8');
const rulesPath = resolve(root,'student/rules.js');
const rulesBaseline = await readFile(resolve(sourceRoot,'scripts/templates/rules.js'),'utf8');
const guardianPath = resolve(root,'student/guardian.js');
const guardianBaseline = await readFile(resolve(sourceRoot,'scripts/templates/guardian.js'),'utf8');
const monstersPath = resolve(root,'student/monsters.js');
const monstersBaseline = await readFile(resolve(sourceRoot,'scripts/templates/monsters.js'),'utf8');
const shieldRule = 'export function crystalRule(crystals) {\n  if (crystals >= 3) {\n    return "shield";\n  }\n}\n';
const healRule = shieldRule.replace('>= 3','>= 5').replace('shield','heal');
const run = promisify(execFile);
let browser, server, preview;
let serverLog = '';
async function waitForServer(url, child) {
  for (let i=0;i<100;i++) {
    if (child.exitCode != null) throw new Error(`Сервер завершился: ${serverLog}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error(`Сервер не отвечает: ${url}`);
}
function serve(args) {
  const child=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),...args,'--host','127.0.0.1','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>{serverLog+=d;});child.stderr.on('data',d=>{serverLog+=d;});
  return child;
}
// Выполняется в браузере: маршрут использует обычную физику, без телепортаций.
async function finishExpedition({ stopAt, hurt = false, continueRun = false } = {}) {
  const {canStand,portal}=await import('/games/blockquest/src/world/island.js');
  const api=window.__blockquest;if(!continueRun)api.reset();const g=api.game,step=8;
  if(hurt)g.player.health=30;
  function walkTo(target){
    const queue=[{x:g.player.x,y:g.player.y,parent:-1}],seen=new Set([`${g.player.x},${g.player.y}`]);let found=-1;
    for(let i=0;i<queue.length;i++){
      const node=queue[i];if(Math.hypot(node.x-target.x,node.y-target.y)<12){found=i;break;}
      for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
        const x=node.x+dx,y=node.y+dy,key=`${x},${y}`;
        if(!seen.has(key)&&canStand(x,y)){seen.add(key);queue.push({x,y,parent:i});}
      }
    }
    if(found<0)throw new Error('Маршрут не найден');
    const path=[];for(let i=found;queue[i].parent>=0;i=queue[i].parent)path.push(queue[i]);
    for(const node of path.reverse()){
      if(g.status!=='playing')break;
      const pulse=g.monsters.some(m=>Math.hypot(m.x-g.player.x,m.y-g.player.y)<90);
      api.step({right:node.x>g.player.x+1,left:node.x<g.player.x-1,down:node.y>g.player.y+1,up:node.y<g.player.y-1,pulse},step/(g.config.playerSpeed*60));
    }
  }
  for(const crystal of g.crystals){if(crystal.taken)continue;if(g.collected>=(stopAt ?? g.config.crystalsToWin))break;walkTo(crystal);}
  if(stopAt){api.step({},1/60);return;}
  walkTo(portal);api.step({},1/60);
  if(g.status!=='won')throw new Error(`Не выиграно: ${g.status}, ${g.collected} кристаллов`);
}
// Выполняется в браузере: герой рядом с хранителем бьёт импульсом с обычным откатом.
function fightGuardian({ pulses = 99, collect = false } = {}) {
  const api=window.__blockquest,g=api.game;g.status='playing';
  for(const m of g.monsters)m.stun=1e6;
  for(let k=0;k<pulses&&!g.guardian.defeated;k++){
    g.player.x=g.guardian.x;g.player.y=g.guardian.y+45;g.player.invincible=99;
    api.step({pulse:true},1/60);for(let i=0;i<60;i++)api.step({},1/60);
  }
  if(collect&&g.secret){g.player.x=g.secret.x;g.player.y=g.secret.y;api.step({},1/60);}
}
try {
  for(const path of ['package.json','vite.config.js','index.html','games','public','student','scripts','teacher/lessons']) await cp(resolve(sourceRoot,path),resolve(root,path),{recursive:true});
  await symlink(resolve(sourceRoot,'node_modules'),resolve(root,'node_modules'),'dir');
  await writeFile(configPath,baseline);await writeFile(rulesPath,rulesBaseline);await writeFile(guardianPath,guardianBaseline);await writeFile(monstersPath,monstersBaseline);await mkdir(artifacts,{recursive:true});
  server=serve(['--port','4179']);await waitForServer('http://127.0.0.1:4179',server);
  browser=await chromium.launch({headless:true,...(process.env.BQ_CHROME_PATH?{executablePath:process.env.BQ_CHROME_PATH}:{channel:'chrome'})});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.setDefaultTimeout(10000);
  let expectedError=false;const errors=[];
  page.on('pageerror',e=>{if(!expectedError)errors.push(e.message);});
  page.on('console',m=>{if(m.type()==='error'&&!expectedError)errors.push(m.text());});
  await page.goto('http://127.0.0.1:4179/?test=1');
  assert.equal(await page.locator('.lesson-panel').isVisible(),false);
  await page.getByRole('button',{name:'Начать приключение',exact:true}).waitFor();
  await page.screenshot({path:resolve(artifacts,'intro.png')});
  await page.locator('#start-btn').click();
  await page.keyboard.down('d');await page.waitForFunction(()=>window.__blockquest.game.collected>=1);await page.keyboard.up('d');
  await page.getByRole('button',{name:'Стать разработчиком',exact:true}).click();
  assert.equal(await page.locator('.lesson-panel').isVisible(),true);
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'paused');
  assert.equal(await page.locator('#config-preview code').count(),1);
  assert.ok((await page.locator('#config-preview').textContent()).includes('export const'));
  assert.equal(await page.locator('#mission-complete').count(),0);
  for(let i=1;i<=3;i++){
    await page.getByRole('button',{name:`Подсказка ${i} из 3`,exact:true}).click();
    assert.equal(await page.locator('.mission-hints li').count(),i);
  }
  console.log('✓ Первый запуск: игра без панели → кристалл → приглашение → лаборатория; подсказки по одной');

  const speed6=baseline.replace('playerSpeed = 3','playerSpeed = 3 * 2');
  const before=await page.evaluate(()=>({score:window.__blockquest.game.score,x:window.__blockquest.game.player.x}));
  await writeFile(configPath,speed6);
  await page.waitForFunction(()=>window.__blockquest.game.config.playerSpeed===6);
  assert.deepEqual(await page.evaluate(()=>({score:window.__blockquest.game.score,x:window.__blockquest.game.player.x})),before);
  assert.equal(await page.locator('#mission-complete').count(),0);
  await page.locator('#resume-btn').click();await page.keyboard.down('d');
  await page.locator('#mission-complete').waitFor();await page.keyboard.up('d');
  await page.getByLabel('Проверил и могу объяснить').check();
  await page.locator('#next-mission').waitFor();
  assert.equal(await page.locator('#mission-count').textContent(),'1 / 3');
  await page.locator('#toggle-experiment').click();
  assert.equal(await page.locator('#config-preview code').count(),5);
  for(const speed of [15,50]){
    await writeFile(configPath,baseline.replace('playerSpeed = 3',`playerSpeed = ${speed}`));
    await page.waitForFunction(value=>window.__blockquest.game.config.playerSpeed===value,speed);
    assert.equal(await page.evaluate(()=>window.__blockquest.game.warnings.length),0);
  }
  await page.evaluate(()=>{const api=window.__blockquest;api.reset();for(let i=0;i<20;i++)api.step({right:true,pulse:true},.05);});
  assert.ok(await page.evaluate(()=>Number.isFinite(window.__blockquest.game.player.x)&&window.__blockquest.game.collected>0));
  console.log('✓ Эквивалент 3 * 2 принят; проверка требует движения и самооценки; 15 и 50 применяются без сброса мира');

  expectedError=true;
  await writeFile(configPath,`${baseline.replace('playerSpeed = 3','playerSpeed 3')}\n// invalid\n`);
  await page.locator('#config-error').waitFor({state:'visible'});
  assert.ok((await page.locator('#config-error').textContent()).includes('строка'));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'paused');
  const badStart=await browser.newPage();
  await badStart.goto('http://127.0.0.1:4179/?test=1');
  await badStart.locator('#config-error').waitFor({state:'visible'});
  await writeFile(configPath,speed6);
  await page.locator('#config-error').waitFor({state:'hidden'});
  // При ошибке первого импорта Vite восстанавливает загрузку через reload.
  await badStart.reload();await badStart.locator('#start-btn').waitFor();await badStart.close();
  expectedError=false;
  const invalidValues=baseline.replace('playerSpeed = 3','playerSpeed = NaN').replace('monsterSpeed = 2','monsterSpeed = Infinity').replace('crystalPoints = 10','crystalPoints = "много"').replace('crystalsToWin = 15','crystalsToWin = 999');
  await writeFile(configPath,invalidValues);
  await page.waitForFunction(()=>window.__blockquest.game.warnings.length===4);
  assert.ok((await page.locator('#config-warning').textContent()).includes('22 кристалла'));
  const {stdout}=await run(process.execPath,[resolve(root,'scripts/reset-lesson.js'),'--yes'],{cwd:root});
  assert.ok(stdout.includes('восстановлен'));await page.waitForFunction(()=>window.__blockquest.game.warnings.length===0);
  assert.equal(await readFile(configPath,'utf8'),baseline);
  console.log('✓ Понятная синтаксическая ошибка, ошибка при первом запуске, NaN/Infinity/строки, цель 999 и сброс CLI');

  await page.locator('#next-mission').click();
  assert.equal(await page.locator('#tab-normal').getAttribute('aria-selected'),'true');
  const normal=baseline.replace('monsterSpeed = 2','monsterSpeed = 0').replace('crystalsToWin = 15','crystalsToWin = 8');
  await writeFile(configPath,normal);await page.waitForFunction(()=>window.__blockquest.game.config.crystalsToWin===8);
  await writeFile(rulesPath,'export function crystalRule(crystals) { return "dragon"; }');
  await page.waitForFunction(()=>window.__blockquest.game.crystalRule(1)==='dragon');
  await page.evaluate(finishExpedition,{stopAt:1});
  await page.locator('#config-warning').waitFor();
  assert.ok((await page.locator('#config-warning').textContent()).includes('"shield"'));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'playing');

  expectedError=true;
  await writeFile(rulesPath,'export function crystalRule(crystals) { if (crystals >= 3 { return "shield"; } }');
  await page.locator('#config-error').waitFor({state:'visible'});
  assert.ok((await page.locator('#config-error').textContent()).includes('student/rules.js'));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'paused');
  await writeFile(configPath,speed6.replace('playerSpeed = 3 * 2','playerSpeed = 4'));
  await page.waitForFunction(()=>window.__blockquest.game.config.playerSpeed===4);
  assert.equal(await page.locator('#config-error').isVisible(),true,'Другая правка не скрывает ошибку rules.js');
  await writeFile(rulesPath,shieldRule);
  await page.locator('#config-error').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#config-preview').textContent.includes('>= 3'));
  expectedError=false;
  await writeFile(configPath,normal);await page.waitForFunction(()=>window.__blockquest.game.config.crystalsToWin===8);
  await page.evaluate(finishExpedition,{stopAt:3});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.shield),true);
  assert.equal(await page.locator('#mission-complete').count(),0,'Щит нужно проверить ударом');
  assert.ok((await page.locator('.mission-verification').textContent()).includes('Дай врагу коснуться'));
  await page.screenshot({path:resolve(artifacts,'student-shield.png'),fullPage:true});
  await page.evaluate(()=>{const api=window.__blockquest;api.game.status='paused';api.step({},0);});
  await page.locator('#resume-btn').click();
  const hp=await page.evaluate(()=>window.__blockquest.game.player.health);
  await page.evaluate(()=>{const api=window.__blockquest,g=api.game;g.monsters[0].stun=0;g.monsters[0].x=g.player.x;g.monsters[0].y=g.player.y;api.step({},1/60);});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.health),hp);
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.shield),false);
  await page.evaluate(()=>{for(const m of window.__blockquest.game.monsters)m.stun=1000;});
  await page.evaluate(finishExpedition,{stopAt:4,continueRun:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.shield),true);
  assert.equal(await page.evaluate(()=>window.__blockquest.game.reward.count),2);
  await page.evaluate(finishExpedition,{stopAt:5,continueRun:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.reward.count),2,'Надетый щит не складывается');
  await page.getByLabel('Проверил и могу объяснить').check();await page.locator('#next-mission').click();
  assert.equal(await page.locator('#mission-complete').count(),0,'Повтор обычного щита не выдаёт зачёт за другую способность');
  await writeFile(configPath,normal.replace('crystalPoints = 10','crystalPoints = 11'));
  await page.waitForFunction(()=>window.__blockquest.game.config.crystalPoints===11);
  if(await page.locator('#resume-btn').isVisible())await page.locator('#resume-btn').click();
  await page.evaluate(()=>{const api=window.__blockquest,g=api.game;g.player.invincible=0;g.monsters[0].stun=0;g.monsters[0].x=g.player.x;g.monsters[0].y=g.player.y;api.step({},1/60);for(const m of g.monsters)m.stun=1000;});
  await page.evaluate(finishExpedition,{continueRun:true});
  assert.equal(await page.locator('#mission-complete').count(),0,'После изменения чисел повторный щит не подменяет первое срабатывание');
  await writeFile(configPath,normal);await page.waitForFunction(()=>window.__blockquest.game.config.crystalPoints===10);

  const everyThird=shieldRule.replace('crystals >= 3','crystals % 3 === 0 && crystals > 0');
  await writeFile(rulesPath,everyThird);
  await page.waitForFunction(()=>window.__blockquest.game.crystalRule(4)===undefined && window.__blockquest.game.crystalRule(6)==='shield');
  await page.evaluate(finishExpedition,{stopAt:3});
  await page.evaluate(()=>{const api=window.__blockquest,g=api.game;g.player.invincible=0;g.monsters[0].stun=0;g.monsters[0].x=g.player.x;g.monsters[0].y=g.player.y;api.step({},1/60);for(const m of g.monsters)m.stun=1000;});
  await page.evaluate(finishExpedition,{stopAt:5,continueRun:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.shield),false);
  await page.evaluate(finishExpedition,{stopAt:6,continueRun:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.shield),true);
  assert.equal(await page.evaluate(()=>window.__blockquest.game.reward.at),6);
  assert.equal(await page.locator('#mission-complete').count(),0);


  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.locator('#copy-ai-prompt').click();
  const prompt=await page.evaluate(()=>navigator.clipboard.readText());
  assert.ok(prompt.includes('student/rules.js')&&prompt.includes('Сначала без кода')&&prompt.includes('Предложи две короткие идеи'));
  for(const [key,value] of Object.entries({idea:'Лечение после пяти: 30 → 70',suggestion:'Напарник предложил ранний щит; я выбрал лечение',test:'До пятого здоровья не прибавляется'})) {
    await page.locator(`[data-ai-note="${key}"]`).fill(value);
  }
  await writeFile(rulesPath,healRule);
  await page.waitForFunction(()=>window.__blockquest.game.crystalRule(5)==='heal');
  await page.waitForFunction(()=>document.querySelector('#config-preview').textContent.includes('"heal"'));
  assert.equal(await page.locator('[data-ai-note="idea"]').inputValue(),'Лечение после пяти: 30 → 70');
  await page.evaluate(finishExpedition,{stopAt:5,hurt:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.health),70);
  assert.equal(await page.evaluate(()=>window.__blockquest.game.reward.action),'heal');
  await page.evaluate(()=>{const api=window.__blockquest,g=api.game;g.player.invincible=0;g.monsters[0].stun=0;g.monsters[0].x=g.player.x;g.monsters[0].y=g.player.y;api.step({},1/60);for(const m of g.monsters)m.stun=1000;});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.health),50);
  await page.evaluate(finishExpedition,{stopAt:6,continueRun:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.player.health),90,'Лечение повторяется по тому же условию');
  await page.evaluate(finishExpedition,{hurt:true});
  await page.getByRole('heading',{name:'Твой остров. Твоя победа.',exact:true}).waitFor();
  await page.getByLabel('Проверил и могу объяснить').check();
  assert.equal(await page.locator('#mission-count').textContent(),'3 / 3');
  await page.screenshot({path:resolve(artifacts,'victory.png'),fullPage:true});
  await page.locator('#retry-btn').click();
  await page.evaluate(()=>{const api=window.__blockquest,g=api.game;g.player.health=20;g.monsters[0].stun=0;g.monsters[0].x=g.player.x;g.monsters[0].y=g.player.y;api.step({},1/60);});
  await page.getByRole('heading',{name:'Приключение не закончено',exact:true}).waitFor();
  await page.locator('#retry-btn').click();await page.keyboard.press('Escape');
  await page.locator('#resume-btn').click();
  await page.keyboard.down('d');await page.keyboard.down('Shift');
  await page.waitForFunction(()=>window.__blockquest.game.dashCooldown>0);
  await page.keyboard.up('d');await page.keyboard.up('Shift');await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.__blockquest.game.pulseCooldown>0);
  await page.locator('#sound-btn').click();assert.equal(await page.locator('#sound-btn').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'paused');
  console.log('✓ Правила: runtime/syntax-ошибки, HMR, повторный щит и каждый третий кристалл, повторное лечение +40, свой режим; запрос AI и журнал; поражение, перезапуск и пауза');

  await writeFile(configPath,baseline);
  await page.waitForFunction(()=>window.__blockquest.game.config.crystalsToWin===15);
  await writeFile(rulesPath,rulesBaseline);
  await page.waitForFunction(()=>window.__blockquest.game.crystalRule(22)===undefined);
  await page.evaluate(finishExpedition);
  assert.ok(await page.evaluate(()=>window.__blockquest.game.collected>=15));
  await page.reload();assert.equal(await page.locator('.lesson-panel').isVisible(),true);
  assert.equal(await page.locator('#mission-count').textContent(),'3 / 3');
  assert.equal(await page.locator('[data-ai-note="idea"]').inputValue(),'Лечение после пяти: 30 → 70');
  assert.equal(await page.getByRole('button',{name:'Начать приключение',exact:true}).count(),0);
  await page.locator('#help-btn').click();await page.locator('#replay-intro').click();
  await page.getByRole('button',{name:'Начать приключение',exact:true}).click();
  assert.equal(await page.locator('#mission-count').textContent(),'3 / 3');
  await page.locator('#open-lesson').click();assert.equal(await page.locator('#lesson-view').isVisible(),true);
  await page.getByRole('button',{name:'Вернуться к острову',exact:true}).click();
  await page.locator('#tab-easy').click();
  for(const [width,height] of [[1280,720],[1366,768],[640,768],[390,844]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Переполнение ${width}`);
    if(width>=1000)assert.ok(await page.locator('.controls').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),`Управление ниже экрана ${width}×${height}`);
    await page.screenshot({path:resolve(artifacts,`layout-${width}.png`)});
    await page.locator('#tab-challenge').click();
    await page.locator('#copy-ai-prompt').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Переполнение AI-карточки ${width}`);
    if(width<=640)await page.screenshot({path:resolve(artifacts,`ai-layout-${width}.png`)});
    await page.locator('#tab-easy').click();
  }
  await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>scrollTo(0,0));
  await page.locator('#fullscreen-btn').click();await page.waitForFunction(()=>!!document.fullscreenElement);
  await page.evaluate(()=>document.exitFullscreen());
  const fresh=await browser.newPage({viewport:{width:1280,height:720}});
  await fresh.goto('http://127.0.0.1:4179/?test=1');await fresh.locator('#skip-intro').click();
  assert.equal(await fresh.locator('.lesson-panel').isVisible(),true);await fresh.close();
  console.log('✓ Стандартный режим пройден; прогресс/подсказки сохранены; повтор и пропуск вступления; 1280×720, 1366×768, 640px, 390px и полный экран');

  await page.locator('[data-lesson="2"]').click();
  await page.waitForFunction(()=>window.__blockquest.game.guardian?.name==='Хранитель');
  assert.equal(await page.locator('#mission-count').textContent(),'0 / 3');
  assert.equal(await page.evaluate(()=>window.__blockquest.game.monsters[0].health),30,'В уроке 02 у слизней есть здоровье из monsters.js');
  assert.ok((await page.locator('#config-preview').textContent()).includes('guardianName'));
  assert.equal(await page.locator('#guardian-status').isVisible(),true);
  await writeFile(guardianPath,guardianBaseline.replace('"Хранитель"','"Огненный страж"').replace('guardianHealth = 60','guardianHealth = 80'));
  await page.waitForFunction(()=>window.__blockquest.game.guardian?.name==='Огненный страж'&&window.__blockquest.game.guardian.maxHealth===80);
  assert.equal(await page.locator('#mission-complete').count(),0,'Хранителя нужно проверить ударом');
  await page.evaluate(fightGuardian,{pulses:1});
  await page.locator('#mission-complete').waitFor();
  await writeFile(guardianPath,guardianBaseline.replace('"Хранитель"','"Огненный страж"').replace('guardianHealth = 60','guardianHealth = 80').replace('"stone"','"красный"').replace('"Кто посмел войти в моё логово?"','"Я " + guardianName + "!"'));
  await page.waitForFunction(()=>window.__blockquest.game.guardian?.says==='Я Огненный страж!'&&window.__blockquest.game.guardian.color==='red');
  assert.ok((await page.locator('.applied-values').textContent()).includes('guardianSays = "Я Огненный страж!"'));
  await page.evaluate(fightGuardian,{pulses:1});
  await page.locator('#mission-complete').waitFor();
  await page.getByLabel('Проверил и могу объяснить').check();await page.locator('#next-mission').click();
  const normalGuardian=guardianBaseline.replace('"Хранитель"','"Огненный страж"').replace('export const pulseDamage = 10;','const crystalPower = 5;\nexport const pulseDamage = crystalPower * 3;');
  await writeFile(guardianPath,normalGuardian);
  await page.waitForFunction(()=>window.__blockquest.game.guardianSettings?.pulseDamage===15);
  assert.ok((await page.locator('.applied-values').textContent()).includes('pulseDamage = 15'));
  await page.locator('#hit-prediction').fill('4');
  await page.evaluate(fightGuardian);
  await page.waitForFunction(()=>document.querySelector('.guardian-fight')?.textContent.includes('совпало'));
  assert.equal(await page.evaluate(()=>window.__blockquest.guardianEvidence.hits),4);
  await page.getByLabel('Проверил и могу объяснить').check();await page.locator('#next-mission').click();
  const challengeGuardian=normalGuardian.replace('export const guardianReward = 50;','let reward = guardianHealth;\nreward = reward * 2;\nexport const guardianReward = reward;');
  await writeFile(guardianPath,challengeGuardian);
  await page.waitForFunction(()=>window.__blockquest.game.guardianSettings?.guardianReward===120);
  const scoreBefore=await page.evaluate(()=>window.__blockquest.game.score);
  await page.evaluate(fightGuardian,{collect:true});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.score),scoreBefore+120);
  await page.getByLabel('Проверил и могу объяснить').check();
  assert.equal(await page.locator('#mission-count').textContent(),'3 / 3');
  await page.screenshot({path:resolve(artifacts,'guardian.png')});
  const rageGuardian=challengeGuardian.replace('export const rageDamage = 20;','export const rageDamage = guardianDamage * 2;').replace('  // Здесь появится правило ярости.','  if (health <= 20) {\n    return "rage";\n  }');
  await writeFile(guardianPath,rageGuardian);
  await page.waitForFunction(()=>{const g=window.__blockquest.game;return g.guardian&&!g.guardian.defeated&&g.guardianMood?.(10)==='rage';});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.guardian.rage),false);
  await page.evaluate(fightGuardian,{pulses:3});
  assert.equal(await page.evaluate(()=>window.__blockquest.game.guardian.rage),true);
  assert.equal(await page.evaluate(()=>window.__blockquest.guardianEvidence.rageAt),15);
  await page.waitForFunction(()=>document.querySelector('.bonus-card')?.textContent.includes('Ярость сработала при здоровье 15'));
  assert.ok((await page.locator('.bonus-card').textContent()).includes('20 → 40'));
  assert.ok((await page.locator('.applied-values').textContent()).includes('rageDamage = 40'));
  assert.ok((await page.locator('#guardian-status').textContent()).includes('ЯРОСТЬ'));
  await page.screenshot({path:resolve(artifacts,'guardian-rage.png')});
  await writeFile(guardianPath,rageGuardian.replace('    return "rage";','    return "angry";'));
  await page.waitForFunction(()=>window.__blockquest.game.guardianMood?.(10)==='angry');
  await page.evaluate(fightGuardian,{pulses:3});
  await page.locator('#config-warning').waitFor();
  assert.ok((await page.locator('#config-warning').textContent()).includes('только "rage"'));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.guardian.rage),false);
  console.log('✓ Урок 02: хранитель появляется, имя и здоровье, урон через const и прогноз 4 удара, награда через let и секретный кристалл; ярость при здоровье 15 и подсказка для неизвестной команды');

  expectedError=true;
  await writeFile(guardianPath,guardianBaseline.replace('export const pulseDamage = 10;','export const pulseDamage = crystalPowr * 3;'));
  await page.locator('#config-error').waitFor({state:'visible'});
  assert.ok((await page.locator('#config-error').textContent()).includes('строка 13'));
  assert.ok((await page.locator('#config-error').textContent()).includes('crystalPowr'));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'paused');
  await writeFile(guardianPath,guardianBaseline.replace('export const pulseDamage = 10;','const power = 5;\npower = 10;\nexport const pulseDamage = power;'));
  await page.waitForFunction(()=>document.querySelector('#config-error').textContent.includes('const нельзя изменить'));
  assert.ok((await page.locator('#config-error').textContent()).includes('строка 14'));
  await writeFile(guardianPath,guardianBaseline.replace('"Хранитель"','Огненный'));
  await page.waitForFunction(()=>document.querySelector('#config-error').textContent.includes('возьми его в кавычки'));
  await writeFile(guardianPath,guardianBaseline.replace('guardianDamage = 20;','guardianDamage = "2";'));
  await page.waitForFunction(()=>document.querySelector('#config-error').textContent.includes('Тип значения не подходит'));
  assert.ok((await page.locator('#config-error').textContent()).includes('строка 14'));
  assert.ok((await page.locator('#config-error').textContent()).includes('текст "2"'));
  assert.equal(await page.evaluate(()=>window.__blockquest.game.guardianSettings.guardianDamage),20,'Неверный тип не попадает в игру');
  assert.equal(await page.evaluate(()=>window.__blockquest.game.status),'paused');
  await writeFile(monstersPath,monstersBaseline.replace('monsterHealth = 30','monsterHealth = "10"'));
  await page.waitForFunction(()=>window.__blockquest.game.monsters[0].maxHealth===30);
  await writeFile(guardianPath,challengeGuardian);
  await page.waitForFunction(()=>document.querySelector('#config-error').textContent.includes('student/monsters.js'));
  assert.equal(await page.locator('#config-error').isVisible(),true,'Исправленный хранитель не скрывает ошибку monsters.js');
  await writeFile(monstersPath,monstersBaseline.replace('monsterHealth = 30','monsterHealth = 10'));
  await page.waitForFunction(()=>window.__blockquest.game.monsters[0].maxHealth===10);
  await writeFile(guardianPath,challengeGuardian);
  await page.locator('#config-error').waitFor({state:'hidden'});
  expectedError=false;
  const {stdout:guardianReset}=await run(process.execPath,[resolve(root,'scripts/reset-lesson.js'),'--yes','--exercise','guardian'],{cwd:root});
  assert.ok(guardianReset.includes('guardian'));
  assert.equal(await readFile(guardianPath,'utf8'),guardianBaseline);
  assert.equal(await readFile(rulesPath,'utf8'),rulesBaseline,'Сброс хранителя не трогает правило');
  await page.waitForFunction(()=>window.__blockquest.game.guardian?.name==='Хранитель');
  await page.reload();
  await page.waitForFunction(()=>window.__blockquest?.game.guardian?.name==='Хранитель');
  assert.equal(await page.locator('[data-lesson="2"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#mission-count').textContent(),'3 / 3');
  for(const [width,height] of [[640,768],[390,844]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Переполнение урока 02 ${width}`);
    await page.screenshot({path:resolve(artifacts,`guardian-${width}.png`)});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.locator('[data-lesson="1"]').click();
  assert.equal(await page.evaluate(()=>window.__blockquest.game.guardian),null);
  assert.equal(await page.locator('#mission-count').textContent(),'3 / 3');
  console.log('✓ Урок 02: ошибки неизвестного имени, изменения const, текста без кавычек и неверного типа (хранитель и monsters.js) со строкой; здоровье слизней; сброс хранителя; урок сохраняется после перезагрузки; 640px и 390px; возврат к уроку 01');

  await run(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'build'],{cwd:root});
  preview=serve(['preview','--port','4180']);await waitForServer('http://127.0.0.1:4180',preview);
  const production=await browser.newPage({viewport:{width:1280,height:720}});
  production.on('pageerror',e=>errors.push(e.message));production.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await production.goto('http://127.0.0.1:4180/?test=1');
  assert.equal(await production.evaluate(()=>typeof window.__blockquest),'undefined');
  await production.locator('#start-btn').click();await production.keyboard.down('d');
  await production.waitForFunction(()=>Number(document.querySelector('#score-value').textContent)>=10);
  await production.keyboard.up('d');await production.keyboard.press('Escape');await production.locator('#resume-btn').waitFor();
  assert.deepEqual(errors,[],'Неожиданные ошибки браузера');
  console.log('✓ Production: HTTP 200, управление, очки, пауза; тестового API нет; штатная консоль без ошибок');
  console.log(`Снимки интерфейса: ${artifacts}`);
} catch(error) { console.error(serverLog);throw error; }
finally {
  await browser?.close();server?.kill('SIGTERM');preview?.kill('SIGTERM');
  await rm(root,{recursive:true,force:true});
  assert.equal(await readFile(resolve(sourceRoot,'student/config.js'),'utf8'),original,'Исходный файл ученика должен остаться нетронутым');
  assert.equal(await readFile(resolve(sourceRoot,'student/rules.js'),'utf8'),originalRules,'Исходное правило ученика должно остаться нетронутым');
  assert.equal(await readFile(resolve(sourceRoot,'student/guardian.js'),'utf8'),originalGuardian,'Исходный хранитель ученика должен остаться нетронутым');
  assert.equal(await readFile(resolve(sourceRoot,'student/monsters.js'),'utf8'),originalMonsters,'Исходные слизни ученика должны остаться нетронутыми');
}
