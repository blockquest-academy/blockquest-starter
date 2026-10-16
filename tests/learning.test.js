import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningState, nextHint, freshEvidence, migrateNumberLesson } from '../games/blockquest/src/ui/learning.js';
import { evaluateMission } from '../games/blockquest/src/ui/missions.js';
import { DEFAULT_CONFIG } from '../games/blockquest/src/engine/config.js';

test('новый ученик начинает с игры, без выполненных миссий и открытых подсказок',()=>{
  const state=createLearningState();assert.equal(state.phase,'intro');assert.equal(state.level,'easy');
  assert.equal(state.hints.easy,0);assert.equal(state.progress.easy.done,false);
});
test('сохраняются этап, маршрут, подсказки и отдельно понимание и завершение',()=>{
  const state=createLearningState({phase:'lab',level:'normal',hints:{easy:2},progress:{easy:{done:true,understood:true}}});
  assert.deepEqual(createLearningState(JSON.parse(JSON.stringify(state))),state);
});
test('старая галочка переносится только как самооценка, повреждённый storage не ломает урок',()=>{
  const state=createLearningState(null,{easy:true});assert.equal(state.progress.easy.understood,true);assert.equal(state.progress.easy.done,false);
  assert.equal(createLearningState({phase:'bad',level:'bad',hints:{easy:1e9}}).phase,'intro');
  assert.equal(createLearningState({hints:{easy:1e9}}).hints.easy,3);
  for(const raw of [42,'bad',[],null])assert.equal(createLearningState(raw).level,'easy');
});
test('подсказки открываются по одной, максимум три',()=>{
  let count=0;for(const expected of [1,2,3,3]){count=nextHint(count);assert.equal(count,expected);}
});
test('Easy: одного правильного значения недостаточно без проверки движения',()=>{
  const evidence=freshEvidence(),config={...DEFAULT_CONFIG,playerSpeed:3*2};
  assert.deepEqual(evaluateMission('easy',config,evidence),{configured:true,tested:false});
  evidence.distance=24;assert.equal(evaluateMission('easy',config,evidence).tested,true);
  assert.equal(evaluateMission('easy',{...config,playerSpeed:15},evidence).tested,false);
  assert.equal(evaluateMission('easy',config,evidence,['ошибка']).tested,false);
});
test('Normal: щит на третьем кристалле, проверка ударом и только с начала попытки',()=>{
  const evidence=freshEvidence();
  assert.equal(evaluateMission('normal',DEFAULT_CONFIG,evidence).configured,false);
  evidence.reward={action:'shield',at:3,fromStart:true,blocked:false};
  assert.deepEqual(evaluateMission('normal',DEFAULT_CONFIG,evidence),{configured:true,tested:false});
  evidence.reward.blocked=true;assert.equal(evaluateMission('normal',DEFAULT_CONFIG,evidence).tested,true);
  for(const change of [{at:2},{action:'heal'},{fromStart:false}]) {
    assert.equal(evaluateMission('normal',DEFAULT_CONFIG,{...evidence,reward:{...evidence.reward,...change}}).tested,false);
  }
});
test('Challenge: другая способность и победа в той же попытке',()=>{
  const evidence=freshEvidence();evidence.won=true;
  assert.equal(evaluateMission('challenge',DEFAULT_CONFIG,evidence).tested,false);
  evidence.reward={action:'shield',at:3,fromStart:true};
  assert.equal(evaluateMission('challenge',DEFAULT_CONFIG,evidence).tested,false);
  evidence.reward.at=5;assert.equal(evaluateMission('challenge',DEFAULT_CONFIG,evidence).tested,true);
  evidence.reward={action:'heal',at:3,fromStart:true};
  assert.equal(evaluateMission('challenge',DEFAULT_CONFIG,evidence).tested,true);
  evidence.won=false;assert.equal(evaluateMission('challenge',DEFAULT_CONFIG,evidence).tested,false);
  evidence.won=true;evidence.reward.fromStart=false;
  assert.equal(evaluateMission('challenge',DEFAULT_CONFIG,evidence).tested,false);
});
test('смена программы сохраняет первый маршрут, новые миссии не получают старые зачёты',()=>{
  const old={phase:'lab',level:'challenge',discovered:true,progress:{easy:{done:true,understood:true},normal:{done:true,understood:true},challenge:{done:true,understood:true}}};
  const state=createLearningState(migrateNumberLesson(old));
  assert.equal(state.phase,'lab');assert.equal(state.progress.easy.done,true);
  assert.equal(state.progress.normal.done,false);assert.equal(state.progress.challenge.understood,false);
  assert.equal(state.level,'easy');
});
test('журнал AI сохраняет только текстовые записи ограниченной длины',()=>{
  const state=createLearningState({aiNotes:{idea:'мой щит',suggestion:42,test:'x'.repeat(3000)}});
  assert.equal(state.aiNotes.idea,'мой щит');assert.equal(state.aiNotes.suggestion,'');
  assert.equal(state.aiNotes.test.length,2000);
  assert.deepEqual(createLearningState(JSON.parse(JSON.stringify(state))),state);
});
