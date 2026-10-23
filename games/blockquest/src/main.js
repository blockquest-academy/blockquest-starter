import * as studentConfig from '../../../student/config.js';
import * as studentRules from '../../../student/rules.js';
import initialRuleSource from '../../../student/rules.js?raw';
import * as studentGuardian from '../../../student/guardian.js';
import initialGuardianSource from '../../../student/guardian.js?raw';
import * as studentMonsters from '../../../student/monsters.js';
import initialMonstersSource from '../../../student/monsters.js?raw';
import currentLessonText from '../../../teacher/lessons/current.md?raw';
import { aiPrompt, aiActivity } from './ui/ai-activity.js';
import { createGame, startGame, togglePause, updateGame, applyConfig, applyRule, setGuardian, removeGuardian, setMonsters, removeMonsters } from './engine/game.js';
import { createRenderer } from './engine/renderer.js';
import { createAudio } from './ui/audio.js';
import { icon } from './ui/icons.js';
import { missions, evaluateMission } from './ui/missions.js';
import { createLearningState, nextHint, freshEvidence, migrateNumberLesson } from './ui/learning.js';
import { RECOMMENDED } from './engine/config.js';
import { GUARDIAN_RECOMMENDED, GUARDIAN_DEFAULTS, stripComments, validateGuardian, findLine } from './engine/guardian.js';
import { MONSTER_DEFAULTS, validateMonsters } from './engine/monsters.js';
import { guardianMissions, evaluateGuardianMission, freshGuardianEvidence, parseCurrentLesson, LESSONS, rageBonus } from './ui/guardian-missions.js';
import { lessonTwoDocument, guardianExperiments } from './ui/lesson-02.js';
import { showRuntimeError, showTypeError } from './ui/config-errors.js';
import './style.css';
import './ui/learning.css';

const app = document.querySelector('#app');
function readSaved(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
// Урок по умолчанию — из teacher/lessons/current.md. Новая ссылка преподавателя переключает урок один раз, дальше выбор ученика сохраняется.
function readCourse() {
  const current = parseCurrentLesson(currentLessonText);
  const saved = readSaved('blockquest.course.v1');
  return saved?.seenCurrent === current && LESSONS.includes(saved.lesson) ? { lesson: saved.lesson, seenCurrent: current } : { lesson: current, seenCurrent: current };
}
const learning = createLearningState(readSaved('blockquest.lesson1.v3') ?? migrateNumberLesson(readSaved('blockquest.lesson1.v2')), { easy: readSaved('blockquest.lesson1.v1')?.easy === true });
const learning2 = createLearningState(readSaved('blockquest.lesson2.v1'));
const course = readCourse();
let lessonId = course.lesson;
const lessonMissions = () => lessonId === 2 ? guardianMissions : missions;
const lessonLearning = () => lessonId === 2 ? learning2 : learning;
let level = lessonLearning().level;
let evidence = freshEvidence();
let guardianEvidence = freshGuardianEvidence();
let guardianModule = studentGuardian;
// Последние загруженные файлы урока 02; в игру они попадают, только если типы значений верные.
let guardianCandidate = studentGuardian;
let monstersModule = studentMonsters;
let monstersCandidate = studentMonsters;
let monstersSource = initialMonstersSource;
const typeErrorFiles = new Set();
let guardianSource = initialGuardianSource;
let missionSignature = '';
let configError = false;
const syntaxErrors = new Set();
let ruleSource = initialRuleSource;
let currentRule = studentRules.crystalRule;
let introReplay = false;
function newGame(config) {
  const next = createGame(config, currentRule); applyRule(next, currentRule);
  if (lessonId === 2) { setGuardian(next, guardianModule); setMonsters(next, monstersModule); }
  return next;
}
let game = newGame(studentConfig);
let currentView = 'game';
let previousStatus;
let lastHud = '';
let toastTimer;
let mutedHelp = false;
const audio = createAudio();
const lessonOneDoc = `<div class="lesson-document"><div class="eyebrow">УРОК 01 · 90 МИНУТ</div><h2>Hack the Game</h2><p class="lead">Поиграй → найди правило → измени → проверь → объясни. Сегодня ты создаёшь свои правила настоящей игры.</p><h3>Начни с одной строки</h3><p>Открой <code>student/config.js</code> в VS Code. Число справа от знака <code>=</code> — значение настройки. Служебные слова уже подготовлены.</p><pre><code><span class="code-purple">export const</span> playerSpeed = <span class="code-number">3</span>;</code></pre><p>Меняй по одному числу. Перед сохранением предскажи результат, после — вернись в браузер, нажми «Продолжить» и проверь. Скорость, награда и цель меняются в текущей попытке; изменение здоровья сразу даёт новый полный запас. Очки за уже собранные кристаллы сохраняются.</p><h3>Первое условие: добавь способность</h3><p>После опытов с числами открой <code>student/rules.js</code>. Готовая оболочка получает <code>crystals</code> — количество собранных кристаллов. Своё правило пиши внутри её скобок. <code>if</code> означает «если», <code>&gt;=</code> — «больше или равно».</p><p>Например, так можно вернуть готовую команду лечения:</p><pre><code>if (crystals &gt;= 7) {
  return "heal";
}</code></pre><p><code>return</code> передаёт игре выбранную команду. Кавычки обозначают её имя. <code>"shield"</code> даёт щит от одного удара; <code>"heal"</code> восстанавливает до 40 здоровья, не выше полного запаса. Правило проверяется при каждом подборе. Щит можно получать повторно, когда твоё условие верно, а прежний щит потерян; два щита не складываются. <code>crystals</code> по-прежнему означает общее число собранных кристаллов. Лечение тоже повторяется на каждом кристалле, для которого условие верно. После правки нажми ↻ и проверь момент срабатывания с начала.</p><h3>Собственная идея с AI</h3><p>В Challenge есть готовый запрос для AI в VS Code. Сначала обсуди идею без кода, выбери вариант и предскажи результат. Условие напечатай сам и проверь в игре. Можно работать с напарником без AI.</p><div class="lesson-missions">${Object.entries(missions).map(([key,m]) => `<article><span class="mission-tier">${m.label} · ${m.tag}</span><h3>${m.title}</h3><p>${m.story}</p><p>${m.goal}</p><p class="check-question">${m.check}</p><button class="text-button" data-go-mission="${key}">К заданию ${icon('arrow')}</button></article>`).join('')}</div><h3>А что, если?..</h3><p>Сравни скорость 6, 15 и 50. Что стало удобнее, а что труднее? Верни привычное число. Рекомендации в комментариях — удобный старт, а не запрет на эксперимент. На острове всего 22 кристалла, поэтому цель выше 22 недостижима.</p><h3>Если что-то пошло не так</h3><p>Прочитай подсказку об ошибке, верни последнее изменение и сохрани. Сброс обоих файлов: <code>npm run reset:lesson</code>, затем подтверждение «да». Предыдущая работа сохранится в <code>backups/</code>. Только правило: <code>npm run reset:lesson -- --exercise rules</code>. Кнопка ↻ начинает попытку с текущими настройками и способностью.</p><h3>Домашняя экспедиция · 15–20 минут</h3><p>Придумай имя своей способности, измени порог или команду в student/rules.js и сравни две версии. Запиши прогноз, результат и отзыв друга. Подготовь объяснение своего условия.</p><div class="lesson-bottom"><strong>Верное число — первый шаг.<br>Объясни, как оно изменило игру.</strong><button class="primary-button" data-view="game">Вернуться к острову ${icon('arrow')}</button></div></div>`;
let renderedDoc = 0;

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="BlockQuest Academy — главная">${icon('crystal', 'brand-mark')}<span>blockquest<span class="brand-sub">ACADEMY</span></span></a>
    <nav class="main-nav" aria-label="Разделы"><button class="nav-item active" data-view="game">${icon('compass')}Экспедиция</button><button class="nav-item" id="lab-nav">${icon('code')}Лаборатория<span class="nav-pill" id="lesson-pill">01</span></button></nav>
    <div class="topbar-end"><span class="local-badge"><i></i>Локальная лаборатория</span><button class="icon-button" id="help-btn" aria-label="Как играть">${icon('help')}</button><span class="avatar" aria-label="Исследователь">И</span></div>
  </header>
  <main>
    <div class="page-heading"><div><div class="eyebrow"><span>СЕЗОН 01</span><span class="slash">/</span> PLAY → MODIFY → CREATE</div><h1>Маленький остров.<br class="mobile-break"> Большие возможности<span class="accent">.</span></h1><p>Сначала исследуй мир. Потом измени его правила.</p></div><div class="lesson-stamp">${icon('code')}<div><span id="stamp-label">ТВОЯ ПЕРВАЯ МИССИЯ</span><strong id="stamp-title">Hack the Game</strong></div><span class="stamp-time">90 мин</span></div></div>
    <section id="game-view" class="workspace" aria-label="Экспедиция и задания">
      <div class="game-column">
        <section class="game-card" aria-label="BlockQuest: Кристальный остров">
          <div class="game-titlebar"><div class="game-title">${icon('crystal')}<strong>Кристальный остров</strong><span class="edition">BLOCKQUEST</span></div><div class="game-actions"><span id="game-state" class="state-tag">Готов к приключению</span><button class="icon-button" id="sound-btn" aria-label="Включить звук" aria-pressed="false">${icon('mute')}</button><button class="icon-button" id="pause-btn" aria-label="Пауза" disabled>${icon('pause')}</button><button class="icon-button" id="fullscreen-btn" aria-label="Развернуть игру">${icon('compass')}</button><button class="icon-button" id="restart-btn" aria-label="Начать экспедицию заново">${icon('reset')}</button></div></div>
          <div class="hud" aria-label="Показатели игры"><div class="health-stat"><span class="stat-label">${icon('heart')}ЗДОРОВЬЕ</span><div class="health-line"><div class="health-track"><span id="health-fill"></span></div><strong id="health-value">100<span>/100</span></strong></div></div><div class="hud-divider"></div><div class="crystal-stat"><span class="stat-label">${icon('crystal')}КРИСТАЛЛЫ</span><strong id="crystal-value">0 <span>/ 15</span></strong></div><div class="hud-divider"></div><div><span class="stat-label">${icon('flag')}ОЧКИ</span><strong id="score-value">0</strong></div><div class="hud-clock" id="timer">00:00</div></div>
          <div class="canvas-wrap"><canvas id="game" tabindex="0" role="img" aria-label="Кристальный остров. Движение WASD или стрелками, пробел — импульс, Shift — рывок. Пауза — Escape."></canvas><div class="map-label"><span class="map-coordinate">ОСТРОВ 01 / 30 × 20</span><span class="map-name">CRYSTAL ISLAND</span></div><div id="reward-status" class="reward-status" role="status" hidden></div><div id="guardian-status" class="guardian-status" role="status" hidden></div><div class="compass-rose" aria-hidden="true">N<span>↑</span></div><div class="game-overlay" id="game-overlay"></div><div class="objective" id="objective">${icon('crystal')}Собери кристаллы и вернись к порталу</div><div class="ability-status"><span id="pulse-status">Пробел · импульс</span><span id="dash-status">Shift · рывок</span></div></div>
          <div class="controls"><span><kbd>W</kbd><span class="key-stack"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span class="control-text">движение <small>или стрелки</small></span></span><span><kbd class="wide">Пробел</kbd> импульс</span><span><kbd>Shift</kbd> рывок</span><span class="pause-control"><kbd>Esc</kbd> пауза</span></div>
        </section>
        <div id="developer-invite" class="developer-invite" hidden><div><strong>Готов изменить правила этого мира?</strong><p>Ты уже исследователь. Попробуй стать разработчиком.</p></div><button id="become-developer" class="primary-button">Стать разработчиком ${icon('arrow')}</button></div><div class="feedback-strip"><span class="feedback-icon">${icon('bolt')}</span><p><strong>Это твой мир. Меняй его.</strong><span>Сохрани свой файл в <code>student/</code> — игра сразу применит правку.</span></p><span class="live-pill"><i></i>LIVE</span></div>
      </div>
      <aside class="lesson-panel">
        <div class="panel-heading"><span class="eyebrow">ЛАБОРАТОРИЯ КОДА</span><div class="lesson-switch" role="group" aria-label="Урок">${LESSONS.map(n => `<button data-lesson="${n}" aria-pressed="${n === lessonId}">Урок 0${n}</button>`).join('')}</div><button class="icon-button" id="lab-close" aria-label="Свернуть лабораторию">${icon('close')}</button></div>
        <p class="panel-intro">Открой <strong>student/config.js</strong> в VS Code. Начни с чисел, затем создай способность в <strong>student/rules.js</strong>.</p>
        <div class="mission-heading"><h3>Твой маршрут</h3><span id="mission-count">0 / 3</span></div>
        <div class="level-tabs" role="tablist" aria-label="Уровень задания">${Object.entries(missions).map(([key, mission]) => `<button role="tab" id="tab-${key}" aria-controls="mission-content" aria-selected="${key === level}" data-level="${key}">${mission.label}</button>`).join('')}</div>
        <div id="mission-content" role="tabpanel" aria-labelledby="tab-easy"></div>
        <div class="lesson-link"><button id="open-lesson">Открыть карточку урока ${icon('arrow')}</button></div>
      </aside>
    </section>
    <section id="lesson-view" class="lesson-view" hidden>
    </section>
    <footer><span class="footer-brand">BLOCKQUEST ACADEMY <span>·</span> Учимся создавать, играя.</span><span>Один остров. Твои правила. ${icon('crystal')}</span></footer>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <dialog id="help-dialog"><button class="dialog-close icon-button" data-close-dialog aria-label="Закрыть">${icon('close')}</button><div class="eyebrow">ПУТЕВОДИТЕЛЬ ИССЛЕДОВАТЕЛЯ</div><h2>Добро пожаловать на остров</h2><p>Собери нужное количество кристаллов и вернись к каменному порталу у лагеря.</p><ul class="help-list"><li>${icon('compass')}<span><strong>WASD / стрелки</strong> — исследуй остров. Вода и деревья непроходимы.</span></li><li>${icon('bolt')}<span><strong>Пробел</strong> — оттолкни и оглуши слизней и жуков рядом.</span></li><li>${icon('arrow')}<span><strong>Shift</strong> — короткий рывок. Во время рывка ты защищён.</span></li><li>${icon('heart')}<span>Слизни и жуки наносят <strong>20 урона</strong>; жуки быстрее преследуют героя. Следующий удар — не раньше чем через 1,2 секунды.</span></li></ul><p>Нажми <strong>Esc</strong>, чтобы сделать паузу. При переходе в редактор игра приостановится сама.</p><button class="text-button" id="replay-intro">Повторить знакомство с островом ${icon('arrow')}</button><button class="primary-button" data-close-dialog>Всё понятно ${icon('check')}</button></dialog>
`;

const canvas = document.querySelector('#game');
const render = createRenderer(canvas);
const keys = new Set();
const pendingActions = new Set();
function clearInput() { keys.clear(); pendingActions.clear(); }
const $ = (selector) => document.querySelector(selector);

function toast(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function saveProgress() {
  lessonLearning().level = level;
  try {
    localStorage.setItem('blockquest.lesson1.v3', JSON.stringify(learning));
    localStorage.setItem('blockquest.lesson2.v1', JSON.stringify(learning2));
    localStorage.setItem('blockquest.course.v1', JSON.stringify(course));
  }
  catch { toast('Браузер не разрешил сохранение. Прогресс доступен до закрытия страницы.'); }
}
function updatePhase() {
  previousStatus = undefined;
  const labOpen = learning.phase === 'lab' && !introReplay;
  $('.lesson-panel').hidden = !labOpen;
  $('.workspace').classList.toggle('play-only', !labOpen);
  $('.feedback-strip').hidden = !labOpen;
  $('.lesson-stamp').hidden = !labOpen;
  $('#lab-nav').hidden = learning.phase === 'intro';
  $('#lab-nav').classList.toggle('active', labOpen);
  $('#developer-invite').hidden = learning.phase !== 'play' || !learning.discovered || introReplay;
  $('.page-heading p').textContent = labOpen ? 'Одна правка. Один эксперимент. Твои правила.' : 'Собирай кристаллы, обходи слизней и быстрых жуков, найди древний портал.';
  renderLessonChrome();
}
function renderLessonChrome() {
  $('#lesson-pill').textContent = `0${lessonId}`;
  $('#stamp-label').textContent = lessonId === 2 ? 'МИССИЯ 02' : 'ТВОЯ ПЕРВАЯ МИССИЯ';
  $('#stamp-title').textContent = lessonId === 2 ? 'Хранитель кристаллов' : 'Hack the Game';
  document.querySelectorAll('[data-lesson]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.lesson) === lessonId)));
  if (renderedDoc !== lessonId) { renderedDoc = lessonId; $('#lesson-view').innerHTML = lessonId === 2 ? lessonTwoDocument(guardianMissions, icon) : lessonOneDoc; }
}
function switchLesson(next) {
  if (next === lessonId || !LESSONS.includes(next)) return;
  lessonLearning().level = level;
  lessonId = next; course.lesson = next; level = lessonLearning().level;
  if (lessonId === 2) { setGuardian(game, guardianModule); setMonsters(game, monstersModule); } else { removeGuardian(game); removeMonsters(game); }
  guardianEvidence = freshGuardianEvidence();
  checkLessonTypes();
  saveProgress(); missionSignature = ''; renderLessonChrome(); trackLearning(); updateUI();
  $('.lesson-panel').scrollTop = 0;
  toast(lessonId === 2 ? 'На острове появился Хранитель! Он ждёт в центре острова.' : 'Урок 01: числа и первое условие.');
}
function openLab() {
  introReplay = false;
  if (game.status === 'playing') togglePause(game);
  learning.phase = 'lab'; saveProgress(); clearInput(); updatePhase(); showView('game');
  missionSignature = ''; renderMission();
}
function renderMission() {
  const m = lessonMissions()[level];
  const state = evaluate(level);
  const saved = lessonLearning().progress[level];
  document.querySelectorAll('[data-level]').forEach(b => {
    b.setAttribute('aria-selected', b.dataset.level === level);
    b.setAttribute('tabindex', b.dataset.level === level ? '0' : '-1');
  });
  $('#mission-content').setAttribute('aria-labelledby', `tab-${level}`);
  const count = lessonLearning().hints[level];
  const isRules = m.file === 'rules.js';
  $('.panel-intro').innerHTML = m.file === 'guardian.js' ? 'Открой <strong>student/guardian.js</strong> в VS Code. Слева от = имя, справа значение.' : isRules ? 'Открой <strong>student/rules.js</strong> в VS Code. Своё условие пиши внутри готовой оболочки.' : 'Открой <strong>student/config.js</strong> в VS Code. Начни с одного числа.';
  const next = Object.keys(missions)[Object.keys(missions).indexOf(level) + 1];
  $('#mission-content').innerHTML = `
    <div class="mission-meta"><span class="mission-number">${m.label.toUpperCase()}</span><span>${m.tag}</span></div>
    <h3 class="mission-title">${m.title}</h3><p class="mission-story">${m.story}</p><p class="mission-goal">${m.goal}</p>
    <div class="file-tab">${icon('code')}<span>student/<strong>${m.file}</strong></span><span class="file-dot" title="Настройки загружены"></span></div>
    <div class="code-preview" aria-label="Применённый фрагмент student/${m.file}" id="config-preview"></div>
    <div class="config-footnote"><span class="status-dot"></span><span id="config-status">Применено в игре</span><button id="copy-path" aria-label="Скопировать путь student/${m.file}" title="Скопировать путь">${icon('code')}</button></div>
    <p id="parameter-purpose" class="parameter-purpose"></p>
    <div class="mission-hints">${count ? `<ol>${m.hints.slice(0,count).map(h=>`<li>${h}</li>`).join('')}</ol>` : ''}${count < 3 ? `<button class="text-button" id="next-hint">${icon('bolt')}Подсказка ${count+1} из 3</button>` : '<span class="hint-exhausted">Все подсказки открыты. Можно позвать преподавателя.</span>'}</div>
    <div class="mission-verification ${state.tested ? 'verified' : ''}" role="status">${icon(state.tested ? 'check' : 'code')}<span>${configError ? 'Сначала исправь ошибку в файле.' : state.tested ? m.success : state.configured ? m.testInstruction : m.waiting ?? (isRules ? 'Сохрани правило, нажми ↻ и проверь момент появления бонуса.' : 'Жду изменения в student/config.js')}</span></div>
    ${lessonId === 2 ? guardianFight() : ''}
    ${saved.done ? '<p class="mission-history">Этот маршрут уже пройден. Можно продолжать эксперименты.</p>' : ''}
    ${state.tested || saved.done ? `<div class="reflection"><p>${m.check}</p><label class="mission-complete"><input type="checkbox" id="mission-complete" ${saved.understood ? 'checked' : ''}/><span class="checkbox-art">${icon('check')}</span><span>Проверил и могу объяснить</span></label><small>Это твоя самооценка. Объясни результат преподавателю.</small></div>` : ''}
    ${next && saved.done ? `<button id="next-mission" data-next="${next}" class="primary-button">Следующий маршрут ${icon('arrow')}</button>` : ''}
    ${lessonId === 1 && level === 'challenge' ? aiActivity : ''}
    ${lessonId === 2 && level === 'challenge' ? rageCard() : ''}
    ${lessonId === 2 && level === 'easy' && (learning2.progress.easy.done || state.tested) ? `<section class="experiment-card"><button id="toggle-experiment" aria-expanded="${learning2.experimentOpen}">${icon('bolt')}А что, если?.. ${learning2.experimentOpen ? '−' : '+'}</button>${learning2.experimentOpen ? guardianExperiments : ''}</section>` : ''}
    ${lessonId === 1 && level === 'easy' && (learning.progress.easy.done || evaluateMission('easy',game.config,evidence,game.warnings).tested) ? `<section class="experiment-card"><button id="toggle-experiment" aria-expanded="${learning.experimentOpen}">${icon('bolt')}А что, если?.. ${learning.experimentOpen ? '−' : '+'}</button>${learning.experimentOpen ? '<p>Предскажи: что будет со скоростью 15? А 50? Измени число в VS Code, сравни управление и верни удобное значение.</p><p>Затем попробуй сделать слизней быстрее героя. Меняй одно число за раз. Все пять настроек показаны выше.</p>' : ''}</section>` : ''}
  `;
  $('#mission-count').textContent = `${Object.values(lessonLearning().progress).filter(p=>p.done).length} / 3`;
  $('#parameter-purpose').textContent = m.purpose;
  $('#mission-complete')?.addEventListener('change', e => {
    saved.understood = e.target.checked;
    if (!saved.understood) saved.done = false;
    saveProgress(); missionSignature = ''; trackLearning();
  });
  if (lessonId === 1 && level === 'challenge') {
    $('#ai-prompt-preview').textContent = aiPrompt;
    document.querySelectorAll('[data-ai-note]').forEach(input => { input.value = learning.aiNotes[input.dataset.aiNote]; });
  }
  renderConfig();
}
const hitsWord = n => n % 10 === 1 && n % 100 !== 11 ? 'удар' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'удара' : 'ударов';
// Прогноз ударов и ход боя: ученик сравнивает свой расчёт с результатом в игре.
function guardianFight() {
  const g = game.guardian; if (!g) return '';
  const e = guardianEvidence, predicted = learning2.prediction;
  const prediction = level === 'normal' ? `<label class="prediction"><span>Мой прогноз: сколько ударов нужно?</span><input id="hit-prediction" type="number" min="0" max="999" inputmode="numeric" value="${/^\d+$/.test(predicted) ? predicted : ''}" /></label>` : '';
  const result = e.secret ? `Секретный кристалл найден: +${e.reward} очков.`
    : e.defeated ? `${g.name} побеждён за ${e.hits} ${hitsWord(e.hits)}. Забери секретный кристалл.`
    : e.hits ? `Удары по хранителю: ${e.hits}. Здоровье ${g.health} из ${g.maxHealth}.` : '';
  const compare = level === 'normal' && e.defeated && predicted !== '' ? ` Прогноз: ${predicted} · факт: ${e.hits}${Number(predicted) === e.hits ? ' — совпало!' : ' — разберись, почему иначе.'}${game.guardianSettings.guardianRegen > 0 ? ' Хранитель лечился во время боя: удары считать сложнее.' : ''}` : '';
  const fight = document.createElement('p'); fight.textContent = result + compare;
  return prediction + (result ? `<p class="guardian-fight" role="status">${fight.innerHTML}</p>` : '');
}
function rageCard() {
  const rageAt = guardianEvidence.rageAt;
  const status = game.moodWarning ? 'Сначала исправь правило ярости: подсказка выше.'
    : rageAt !== null ? `Ярость сработала при здоровье ${rageAt}. Урон хранителя: ${game.guardianSettings.guardianDamage} → ${game.guardianSettings.rageDamage}. Объясни, почему ярость началась именно здесь.`
    : !game.guardianMood ? 'В student/guardian.js нет оболочки guardianMood. Её можно взять из заготовки урока 02.'
    : 'Жду правила ярости: напиши условие внутри guardianMood, сохрани и бей хранителя.';
  return `<section class="bonus-card"><div class="eyebrow">БОНУС · ЛОГИКА МОНСТРА</div><h4>Ярость хранителя</h4><p>${rageBonus.goal}</p>${rageBonus.hints.map((hint, i) => `<details><summary>Подсказка ${i + 1}</summary><p>${hint}</p></details>`).join('')}<div class="mission-verification ${rageAt !== null ? 'verified' : ''}" role="status">${icon(rageAt !== null ? 'check' : 'bolt')}<span>${status}</span></div></section>`;
}
function lessonWarnings() {
  if (configError) return ['syntax'];
  return lessonId === 2 ? [...game.guardianWarnings, ...game.monsterWarnings] : [...game.warnings, ...(game.ruleWarning ? [game.ruleWarning] : [])];
}
function evaluate(key) {
  return lessonId === 2
    ? evaluateGuardianMission(key, game.guardianSettings, guardianSource, guardianEvidence, lessonWarnings())
    : evaluateMission(key, game.config, evidence, lessonWarnings());
}
function trackLearning() {
  const progress = lessonLearning().progress;
  for (const key of Object.keys(lessonMissions())) {
    const state = evaluate(key);
    if (state.tested && progress[key].understood && !progress[key].done) {
      progress[key].done = true; saveProgress();
      if (key === level) toast(key !== 'challenge' ? 'Маршрут пройден. Теперь можно попробовать следующий.' : lessonId === 2 ? 'Маршрут пройден. Дай другу прочитать твой файл и предсказать бой.' : 'Маршрут пройден. Покажи свою способность и объясни правило.');
    }
  }
  const state = evaluate(level);
  const signature = JSON.stringify([lessonId,level,state,lessonLearning().hints,progress,lessonLearning().experimentOpen,game.ruleWarning,game.guardianWarnings,game.monsterWarnings,game.moodWarning,guardianEvidence,game.guardian?.health,game.guardian?.rage]);
  if (signature !== missionSignature) { missionSignature = signature; renderMission(); }
}
function renderGuardianSource() {
  const preview = $('#config-preview'); preview.replaceChildren();
  const pre = document.createElement('pre'); pre.className = 'rule-source';
  pre.textContent = stripComments(guardianSource).split('\n').map(line => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  preview.append(pre);
  if (!game.guardianSettings) return;
  // Игра показывает результат вычислений: crystalPower * 3 превращается в число урона.
  const applied = document.createElement('div'); applied.className = 'applied-values';
  const heading = document.createElement('strong'); heading.textContent = 'Игра получила';
  applied.append(heading, ...Object.entries({ ...game.guardianSettings, ...game.monsterSettings }).map(([key, value]) => {
    const row = document.createElement('code'); row.textContent = `${key} = ${typeof value === 'string' ? `"${value}"` : value}`; return row;
  }));
  preview.append(applied);
}
function renderConfig() {
  const file = lessonMissions()[level].file;
  const isRules = file === 'rules.js';
  const keys = learning.experimentOpen ? Object.keys(game.config) : ['playerSpeed'];
  if (file === 'guardian.js') renderGuardianSource();
  else if (isRules) {
    $('#config-preview').replaceChildren();
    const pre = document.createElement('pre'); pre.className = 'rule-source';
    pre.textContent = ruleSource.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n').trim();
    $('#config-preview').append(pre);
  } else {
    $('#config-preview').innerHTML = keys.map(name => `<div class="active-code"><span class="line-number">${Object.keys(game.config).indexOf(name)+1}</span><code><span class="code-purple">export const</span> <span class="config-name">${name}</span> <span class="code-operator">=</span> <span class="code-number">${game.config[name]}</span><span class="code-operator">;</span></code></div>`).join('');
  }
  // Ошибка бонуса ярости видна в лаборатории, но не отменяет зачёт основных маршрутов.
  const warnings = lessonId === 2 && game.moodWarning && !configError ? [...lessonWarnings(), game.moodWarning] : lessonWarnings();
  $('#config-status').textContent = configError ? 'Ошибка — показана последняя применённая версия' : warnings.length ? 'Проверь файл' : 'Применено в игре';
  $('#config-status').parentElement.classList.toggle('has-warning', !!warnings.length);
  $('#config-warning')?.remove();
  if (warnings.length && !configError) {
    const warning = document.createElement('div'); warning.id = 'config-warning'; warning.className = 'config-warning'; warning.setAttribute('role', 'alert');
    warning.textContent = warnings.join(' ');
    if (file === 'guardian.js') $('#config-preview').before(warning); else $('.config-footnote').after(warning);
  }
  $('#config-preview').title = file === 'guardian.js' ? Object.entries(GUARDIAN_RECOMMENDED).map(([key, value]) => `${key}: рекомендуем ${value}`).join(' · ') : isRules ? 'Твоё применённое правило. Редактируй в VS Code, затем нажми ↻.' : keys.map(key=>`${key}: рекомендуем ${RECOMMENDED[key]}`).join(' · ');
}

function resetGame(playing = true) {
  game = newGame(game.config); evidence = freshEvidence(); guardianEvidence = freshGuardianEvidence(); clearInput();
  if (playing && !configError && learning.phase !== 'intro' && !introReplay) startGame(game);
  previousStatus = undefined; lastHud = ''; updateUI();
  if (currentView === 'game') canvas.focus({ preventScroll: true });
}
function showView(view) {
  currentView = view;
  if (view !== 'game' && game.status === 'playing') togglePause(game);
  $('#game-view').hidden = view !== 'game'; $('#lesson-view').hidden = view !== 'lesson';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  clearInput(); updateUI();
}
function updateUI() {
  const signature = `${game.player.health}/${game.collected}/${game.score}/${Math.floor(game.time)}/${game.status}`;
  if (signature !== lastHud) {
    lastHud = signature;
    $('#health-fill').style.width = `${game.player.health / game.config.playerHealth * 100}%`;
    $('#health-fill').classList.toggle('low', game.player.health <= game.config.playerHealth * 0.3);
    $('#health-value').innerHTML = `${game.player.health}<span>/${game.config.playerHealth}</span>`;
    $('#crystal-value').innerHTML = `${game.collected} <span>/ ${game.config.crystalsToWin}</span>`;
    $('#score-value').textContent = game.score;
    $('#timer').textContent = `${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;
    const activePortal = game.collected >= game.config.crystalsToWin;
    $('#objective').innerHTML = activePortal ? `${icon('flag')}Портал открыт! Вернись в лагерь слева` : `${icon('crystal')}Ещё ${game.config.crystalsToWin - game.collected} кристаллов — и к порталу`;
    $('#objective').classList.toggle('portal-ready', activePortal);
  }
  const rewardStatus = $('#reward-status');
  rewardStatus.hidden = !game.reward.used;
  rewardStatus.classList.toggle('shield-active', game.player.shield);
  rewardStatus.textContent = game.player.shield ? '◇ Твой щит · 1 удар' : game.reward.action === 'shield' ? '◇ Щит потерян · ищи кристаллы' : '♡ Лечение применено';
  const guardianStatus = $('#guardian-status'), g = game.guardian;
  const guardianText = !g ? '' : game.secret?.taken ? `★ Секрет найден · +${game.guardianSettings.guardianReward} очков` : g.defeated ? `★ ${g.name} побеждён · забери секретный кристалл` : `♜ ${g.name} · ${g.health}/${g.maxHealth} · удары: ${g.hits}${g.rage ? ' · ЯРОСТЬ' : ''}`;
  guardianStatus.hidden = !g;
  if (guardianStatus.textContent !== guardianText) guardianStatus.textContent = guardianText;
  $('#pulse-status').textContent = game.pulseCooldown > 0 ? `Импульс · ${game.pulseCooldown.toFixed(1)} с` : 'Пробел · импульс';
  $('#dash-status').textContent = game.dashCooldown > 0 ? `Рывок · ${game.dashCooldown.toFixed(1)} с` : 'Shift · рывок';
  if (previousStatus === game.status) return;
  previousStatus = game.status;
  const statuses = { ready: 'Готов к приключению', playing: 'Экспедиция идёт', paused: 'На паузе', won: 'Остров исследован', lost: 'Попробуем ещё?' };
  $('#game-state').textContent = statuses[game.status];
  $('#game-state').classList.toggle('is-playing', game.status === 'playing');
  $('#pause-btn').disabled = !['playing', 'paused'].includes(game.status);
  $('#pause-btn').innerHTML = icon(game.status === 'paused' ? 'play' : 'pause');
  $('#pause-btn').setAttribute('aria-label', game.status === 'paused' ? 'Продолжить' : 'Пауза');
  const overlay = $('#game-overlay');
  overlay.hidden = game.status === 'playing';
  if (game.status === 'ready') overlay.innerHTML = `<div class="start-card"><div class="island-emblem">${icon('compass')}</div><span class="overlay-eyebrow">НОВАЯ ЭКСПЕДИЦИЯ</span><h2>Остров ждёт тебя</h2><p>Твои правила сохранены в student/.<br>Исследуй мир или загляни в лабораторию.</p><button class="primary-button" id="start-btn">Продолжить приключение ${icon('arrow')}</button></div>`;
  if (game.status === 'paused') overlay.innerHTML = `<div class="start-card"><div class="island-emblem">${icon('pause')}</div><span class="overlay-eyebrow">МОЖНО ВЫДОХНУТЬ</span><h2>Остров подождёт</h2><p>Загляни в код или вернись в экспедицию.</p><button class="primary-button" id="resume-btn">Продолжить ${icon('play')}</button></div>`;
  if (game.status === 'won' || game.status === 'lost') {
    const won = game.status === 'won';
    overlay.innerHTML = `<div class="start-card"><div class="island-emblem ${won ? '' : 'lost'}">${icon(won ? 'flag' : 'heart')}</div><span class="overlay-eyebrow">${won ? 'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА' : 'КАЖДАЯ ПОПЫТКА — ОПЫТ'}</span><h2>${won ? 'Твой остров. Твоя победа.' : 'Приключение не закончено'}</h2><p>${won ? `${game.collected} кристаллов · ${game.score} очков · ${$('#timer').textContent}<br>А что изменится, если поменять правила?` : 'Попробуй отталкивать слизней пробелом.<br>Или настрой здоровье в student/config.js.'}</p><button class="primary-button" id="retry-btn">${won ? 'Ещё одна экспедиция' : 'Попробовать снова'} ${icon('reset')}</button><button class="overlay-secondary" id="overlay-lesson">Заглянуть в первый урок ${icon('arrow')}</button></div>`;
  }
  if (learning.phase === 'intro' || introReplay) {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="start-card intro-card"><div class="island-emblem">${icon('compass')}</div><span class="overlay-eyebrow">BLOCKQUEST · ПЕРВАЯ ЭКСПЕДИЦИЯ</span><h2>Кристальный остров</h2><p>Ты на загадочном острове. Собирай кристаллы,<br>избегай слизней и заряди древний портал.</p><button class="primary-button" id="start-btn">Начать приключение ${icon('arrow')}</button><button class="overlay-secondary" id="skip-intro">Сразу в лабораторию ${icon('code')}</button><span class="overlay-note">WASD — движение · Пробел — импульс</span></div>`;
  }

}

app.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view) showView(b.dataset.view);
  if (b.dataset.lesson) switchLesson(Number(b.dataset.lesson));
  if (b.dataset.level) { $('.lesson-panel').scrollTop = 0; level = b.dataset.level; saveProgress(); missionSignature = ''; trackLearning(); }
  if (b.dataset.goMission) { level = b.dataset.goMission; openLab(); }
  if (['start-btn', 'resume-btn'].includes(b.id)) {
    if (configError) { toast('Сначала исправь ошибку в файле, указанном над игрой, и сохрани его.'); return; }
    introReplay = false; if (learning.phase === 'intro') { learning.phase = 'play'; saveProgress(); }
    startGame(game); previousStatus = undefined; updatePhase(); updateUI(); canvas.focus({preventScroll:true});
  }
  if (['restart-btn', 'retry-btn'].includes(b.id)) resetGame();
  if (b.id === 'pause-btn' && !configError && !introReplay) { togglePause(game); clearInput(); updateUI(); if (game.status === 'playing') canvas.focus({preventScroll:true}); }
  if (['open-lesson','overlay-lesson'].includes(b.id)) { if (learning.phase !== 'lab') openLab(); showView('lesson'); }
  if (['become-developer','lab-nav','skip-intro'].includes(b.id)) openLab();
  if (b.id === 'lab-close') { learning.phase = 'play'; saveProgress(); updatePhase(); }
  if (b.id === 'next-hint') { lessonLearning().hints[level] = nextHint(lessonLearning().hints[level]); saveProgress(); trackLearning(); $('#next-hint')?.focus(); }
  if (b.id === 'next-mission') { $('.lesson-panel').scrollTop = 0; level = b.dataset.next; saveProgress(); trackLearning(); $(`#tab-${level}`).focus(); }
  if (b.id === 'toggle-experiment') { lessonLearning().experimentOpen = !lessonLearning().experimentOpen; saveProgress(); trackLearning(); $('#toggle-experiment').focus(); }
  if (b.id === 'fullscreen-btn') {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('.game-card').requestFullscreen(); }
    catch { toast('Браузер не открыл полный экран. Попробуй увеличить окно игры.'); }
    if (game.status === 'playing') canvas.focus({preventScroll:true});
  }
  if (b.id === 'replay-intro') {
    mutedHelp = false; $('#help-dialog').close(); pauseOnLeave(); introReplay = true; previousStatus = undefined; showView('game'); updatePhase(); updateUI();
  }
  if (b.id === 'sound-btn') {
    const enabled = audio.toggle(); b.innerHTML = icon(enabled ? 'sound' : 'mute');
    b.setAttribute('aria-pressed', String(enabled)); b.setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
    if (enabled) audio.play('collect');
    if (game.status === 'playing') canvas.focus({preventScroll:true});
  }
  if (b.id === 'copy-path') {
    const path = `student/${missions[level].file}`;
    try { await navigator.clipboard.writeText(path); toast(`Путь скопирован: ${path}`); }
    catch { toast(`Открой в VS Code файл ${path}`); }
  }
  if (b.id === 'copy-ai-prompt') {
    try { await navigator.clipboard.writeText(aiPrompt); toast('Запрос скопирован. Вставь его в чат AI в VS Code.'); }
    catch { $('#ai-prompt-preview').closest('details').open = true; toast('Выдели и скопируй запрос из раскрытого блока.'); }
  }
  if (b.id === 'help-btn') {
    if (game.status === 'playing') { togglePause(game); mutedHelp = true; }
    clearInput(); updateUI(); $('#help-dialog').showModal();
  }
  if (b.hasAttribute('data-close-dialog')) $('#help-dialog').close();
});
app.addEventListener('input', e => {
  if (e.target.id === 'hit-prediction') { learning2.prediction = e.target.value.replace(/\D/g, '').slice(0, 6); saveProgress(); return; }
  if (!e.target.matches('[data-ai-note]')) return;
  learning.aiNotes[e.target.dataset.aiNote] = e.target.value.slice(0, 2000); saveProgress();
});
$('#help-dialog').addEventListener('close', () => {
  if (mutedHelp && !configError && !introReplay && game.status === 'paused' && currentView === 'game') startGame(game);
  mutedHelp = false; updateUI();
  if (game.status === 'playing') canvas.focus({preventScroll:true});
});
$('.lesson-panel').addEventListener('focusin', () => {
  if (game.status === 'playing') { togglePause(game); clearInput(); updateUI(); }
});
document.querySelector('.level-tabs').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const levels = Object.keys(missions); const index = levels.indexOf(level);
  level = levels[e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
  saveProgress(); trackLearning(); $(`#tab-${level}`).focus();
});

const movementCodes = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'];
window.addEventListener('keydown', e => {
  if (currentView !== 'game' || learning.phase === 'intro' || introReplay || configError || $('#help-dialog').open || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, button, summary')) return;
  if (movementCodes.includes(e.code)) {
    e.preventDefault(); keys.add(e.code);
    if (!e.repeat && ['Space','ShiftLeft','ShiftRight'].includes(e.code)) pendingActions.add(e.code);
  }
  if (e.code === 'Escape' && !e.repeat) { togglePause(game); clearInput(); updateUI(); }
});
window.addEventListener('keyup', e => keys.delete(e.code));
function pauseOnLeave() { clearInput(); if (game.status === 'playing') { togglePause(game); updateUI(); } }
window.addEventListener('blur', pauseOnLeave);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });
document.addEventListener('fullscreenchange', () => {
  $('#fullscreen-btn').setAttribute('aria-label', document.fullscreenElement ? 'Выйти из полного экрана' : 'Развернуть игру');
});

function step(input, dt) {
  const before = { x: game.player.x, y: game.player.y };
  updateGame(game, input, dt);
  evidence.distance += Math.hypot(game.player.x - before.x, game.player.y - before.y);
  for (const item of game.events.splice(0)) {
    const event = typeof item === 'string' ? item : item.type;
    audio.play(event);
    if (event === 'collect') {
      evidence.picked = true;
      if (!learning.discovered) { learning.discovered = true; saveProgress(); updatePhase(); }
    }
    if (event === 'shield' || event === 'heal') {
      // Первая проверка остаётся доказательством и после восстановления щита.
      if (item.reward.id === 1) evidence.reward ??= { ...item.reward };
      toast(`Твоё правило сработало! ${game.collected} кристаллов → ${event === 'shield' ? 'щит на один удар' : 'лечение до +40'}.`);
    }
    if (event === 'shield-break' && evidence.reward?.id === item.rewardId) evidence.reward.blocked = true;
    if (event === 'won') evidence.won = true;
    if (event === 'guardian-hit') guardianEvidence.hits = item.hits;
    if (event === 'guardian-defeated') {
      guardianEvidence.defeated = true; guardianEvidence.hits = item.hits;
      toast(`${game.guardian.name} побеждён за ${item.hits} ${hitsWord(item.hits)}! Забери секретный кристалл.`);
    }
    if (event === 'secret') { guardianEvidence.secret = true; guardianEvidence.reward = item.reward; toast(`Секретный кристалл: +${item.reward} очков.`); }
    if (event === 'guardian-rage') { guardianEvidence.rageAt ??= item.health; toast(`Ярость! ${game.guardian.name} злится при здоровье ${item.health}: твоё правило сработало.`); }
    if (event === 'portal') toast('Древний портал заряжен! Вернись в лагерь слева.');
  }
  trackLearning(); updateUI();
}
let lastTime = 0;
function frame(now) {
  const dt = lastTime ? (now - lastTime) / 1000 : 0; lastTime = now;
  step({
    left: keys.has('KeyA') || keys.has('ArrowLeft'), right: keys.has('KeyD') || keys.has('ArrowRight'),
    up: keys.has('KeyW') || keys.has('ArrowUp'), down: keys.has('KeyS') || keys.has('ArrowDown'),
    pulse: keys.has('Space') || pendingActions.has('Space'), dash: keys.has('ShiftLeft') || keys.has('ShiftRight') || pendingActions.has('ShiftLeft') || pendingActions.has('ShiftRight'),
  }, dt);
  pendingActions.clear(); render(game, now / 1000); requestAnimationFrame(frame);
}
updatePhase(); trackLearning(); updateUI(); requestAnimationFrame(frame);
document.documentElement.dataset.gameReady = 'true';
window.dispatchEvent(new Event('blockquest:config-applied'));
window.addEventListener('blockquest:config-error', event => { syntaxErrors.add(event.detail?.file || 'unknown'); configError = true; pauseOnLeave(); missionSignature = ''; trackLearning(); });
checkLessonTypes();
const literal = value => typeof value === 'string' ? `"${value}"` : String(value);
// Урок 02 про типы данных: неверный тип ломает игру, пока ученик не исправит строку.
// Возвращает файлы с ошибками типов; их значения в игру не попадают.
function checkLessonTypes() {
  const checks = lessonId === 2 ? [
    { file: 'student/guardian.js', errors: validateGuardian(guardianCandidate).errors, source: guardianSource, defaults: GUARDIAN_DEFAULTS },
    { file: 'student/monsters.js', errors: validateMonsters(monstersCandidate).errors, source: monstersSource, defaults: MONSTER_DEFAULTS },
  ].filter(check => check.errors.length) : [];
  for (const file of [...typeErrorFiles]) if (!checks.some(check => check.file === file)) { typeErrorFiles.delete(file); clearFileError(file); }
  checks.forEach(({ file, errors, source, defaults }, i) => {
    typeErrorFiles.add(file);
    const key = errors[0].key;
    if (i === 0) showTypeError(file, errors, findLine(source, key), `export const ${key} = ${literal(defaults[key])};`);
    else window.dispatchEvent(new CustomEvent('blockquest:config-error', { detail: { file } }));
  });
  return new Set(checks.map(check => check.file));
}
// Vite сообщает о неудачном обновлении только пустым модулем; повторный импорт показывает саму ошибку.
async function reportRuntimeError(file) {
  try { await import(/* @vite-ignore */ `/${file}?t=${Date.now()}`); }
  catch (error) { showRuntimeError(file, error); }
}
function clearFileError(file) {
  syntaxErrors.delete(file); syntaxErrors.delete('unknown'); configError = syntaxErrors.size > 0;
  if (!configError) window.dispatchEvent(new Event('blockquest:config-applied'));
}

if (import.meta.hot) {
  import.meta.hot.accept('../../../student/config.js', (next) => {
    if (!next) { reportRuntimeError('student/config.js'); return; }
    const wasError = configError; clearFileError('student/config.js');
    const before = { ...game.config };
    const changes = applyConfig(game, next);
    if (changes.length) {
      evidence = freshEvidence();
      if (['won','lost'].includes(game.status)) { game = newGame(next); guardianEvidence = freshGuardianEvidence(); }
      const labels = { playerSpeed: 'Скорость героя', playerHealth: 'Здоровье (полный запас)', monsterSpeed: 'Скорость врагов', crystalPoints: 'Очки за кристалл', crystalsToWin: 'Цель портала' };
      toast(changes.map(key=>`${labels[key]}: ${before[key]} → ${game.config[key]}`).join(' · '));
    } else if (wasError) toast('Ошибка исправлена. Можно продолжить игру.');
    if (game.warnings.length) toast('Проверь настройки: подсказка в лаборатории.');
    clearInput(); previousStatus = undefined; lastHud = ''; missionSignature = ''; renderConfig(); trackLearning(); updateUI();
    if (!configError) window.dispatchEvent(new Event('blockquest:config-applied'));
  });
  import.meta.hot.accept('../../../student/rules.js', next => {
    if (!next) { reportRuntimeError('student/rules.js'); return; }
    currentRule = next.crystalRule; applyRule(game, currentRule); evidence = freshEvidence();
    clearFileError('student/rules.js');
    pauseOnLeave();
    toast('Правило загружено. Нажми ↻ и проверь способность с начала.');
    missionSignature = ''; trackLearning(); renderConfig(); updateUI();
  });
  import.meta.hot.accept('../../../student/rules.js?raw', source => {
    if (source) ruleSource = source.default;
    missionSignature = ''; trackLearning(); renderConfig(); updateUI();
  });
  import.meta.hot.accept('../../../student/guardian.js', next => {
    if (!next) { reportRuntimeError('student/guardian.js'); return; }
    guardianCandidate = next; typeErrorFiles.delete('student/guardian.js'); clearFileError('student/guardian.js');
    if (!checkLessonTypes().has('student/guardian.js')) {
      guardianModule = next;
      if (lessonId === 2) {
        setGuardian(game, next); guardianEvidence = freshGuardianEvidence();
        const s = game.guardianSettings;
        toast(game.guardianWarnings.length ? 'Проверь student/guardian.js: подсказка в лаборатории.' : `Хранитель возродился: ${s.guardianName} · здоровье ${s.guardianHealth} · урон импульса ${s.pulseDamage}`);
      } else toast('Хранитель сохранён. Открой «Урок 02» в лаборатории, чтобы встретить его.');
    }
    clearInput(); missionSignature = ''; renderConfig(); trackLearning(); updateUI();
  });
  import.meta.hot.accept('../../../student/guardian.js?raw', source => {
    if (source) guardianSource = source.default;
    if (typeErrorFiles.has('student/guardian.js')) checkLessonTypes();
    missionSignature = ''; trackLearning(); renderConfig();
  });
  import.meta.hot.accept('../../../student/monsters.js', next => {
    if (!next) { reportRuntimeError('student/monsters.js'); return; }
    monstersCandidate = next; typeErrorFiles.delete('student/monsters.js'); clearFileError('student/monsters.js');
    if (!checkLessonTypes().has('student/monsters.js')) {
      monstersModule = next;
      if (lessonId === 2) {
        setMonsters(game, next);
        toast(game.monsterWarnings.length ? 'Проверь student/monsters.js: подсказка в лаборатории.' : `Слизни и жуки: здоровье ${game.monsterSettings.monsterHealth}`);
      } else toast('Слизни сохранены. Их здоровье работает в «Уроке 02».');
    }
    clearInput(); missionSignature = ''; renderConfig(); trackLearning(); updateUI();
  });
  import.meta.hot.accept('../../../student/monsters.js?raw', source => {
    if (source) monstersSource = source.default;
    if (typeErrorFiles.has('student/monsters.js')) checkLessonTypes();
  });
}

// Доступно только при явном ?test=1 в dev-сервере. В production API отсутствует.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  window.__blockquest = {
    get game() { return game; },
    reset: resetGame,
    step,
    get learning() { return learning; },
    get learning2() { return learning2; },
    get guardianEvidence() { return guardianEvidence; },
    switchLesson,
  };
}
