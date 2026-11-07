export const forestExperiments = '<p>Сделай большой фонарь <code>glow(8)</code>: какой круг стал? Посчитай до сохранения: 8 × 20 + 10. Поставь <code>glow(0)</code> — фонарь погас, круга нет.</p><p>Древень гонится по всему лесу, убежать нельзя. Встань в круг света: он отходит и ждёт поодаль, из света его не достать. Шагни за круг — догоняет.</p><p>Бей Древня мечом (клавиша 1): здоровье уходит по 10, и ты видишь каждую фазу. Молотом (3) он из 140 падает в 102, 64 и 26 — «злой» проскакивает. Почему?</p><p>Поменяй в своей функции <code>&gt; 60</code> на <code>&gt;= 60</code>. Какая строка таблицы изменилась? Верни как было.</p>';

export function lessonFourDocument(missions, icon) {
  return `<div class="lesson-document"><div class="eyebrow">УРОК 04 · 90 МИНУТ</div><h2>Лес</h2><p class="lead">Ворота на восточном берегу открыты. За ними тёмный лес, три фонаря и Древень, который меняется по ходу боя. Сегодня твоя функция решает, в какой он фазе.</p>
<h3>Фонари: повтор функции</h3><p>В <code>student/forest.js</code> яркость трёх фонарей считается одной формулой, написанной три раза: <code>размер × 20 + 10</code>. Как и с оружием в уроке 03, напиши рецепт один раз и вызови его трижды:</p><pre><code><span class="code-purple">function</span> glow(size) {
  <span class="code-purple">return</span> size * <span class="code-number">20</span> + <span class="code-number">10</span>;
}
<span class="code-purple">export const</span> lanternSmall = glow(<span class="code-number">2</span>);</code></pre><p>Число над фонарём и круг света на земле — это ответ твоей функции. В круге Древень не нападает.</p>
<h3>Игра спрашивает: в какой ты фазе?</h3><p>Древень зовёт функцию <code>treantPhase(health)</code> при каждом ударе и передаёт своё здоровье. Ответ — одно из слов <code>"calm"</code>, <code>"angry"</code>, <code>"giant"</code>. Условия идут цепочкой сверху вниз, игра останавливается на первом верном:</p><pre><code><span class="code-purple">export function</span> treantPhase(health) {
  <span class="code-purple">if</span> (health &gt; <span class="code-number">60</span>) {
    <span class="code-purple">return</span> <span class="code-string">"calm"</span>;
  } <span class="code-purple">else if</span> (health &gt; <span class="code-number">30</span>) {
    <span class="code-purple">return</span> <span class="code-string">"angry"</span>;
  } <span class="code-purple">else</span> {
    <span class="code-purple">return</span> <span class="code-string">"giant"</span>;
  }
}</code></pre><p>Граница решает всё: при 61 Древень ещё спокоен, при 60 уже злой. <code>&gt;</code> значит «строго больше», <code>&gt;=</code> — «больше или равно». Предскажи фазу для 61, 60, 31 и 30, потом проверь в бою мечом: он отнимает по 10.</p>
<h3>Условие с именем</h3><p>Сравнение <code>health &lt;= 30</code> — это значение да/нет, как <code>true</code> и <code>false</code> в уроке 02. Его можно вернуть из своей функции и спросить в <code>if</code>:</p><pre><code><span class="code-purple">function</span> isDanger(health) {
  <span class="code-purple">return</span> health &lt;= <span class="code-number">30</span>;
}</code></pre><p>Внутри <code>treantPhase</code>: <code>if (isDanger(health)) { return "giant"; }</code>. Помощника вызываешь ты, поэтому <code>export</code> ему не нужен.</p>
<div class="lesson-missions">${Object.entries(missions).map(([key, m]) => `<article><span class="mission-tier">${m.label} · ${m.tag}</span><h3>${m.title}</h3><p>${m.story}</p><p>${m.goal}</p><p class="check-question">${m.check}</p><button class="text-button" data-go-mission="${key}">К заданию ${icon('arrow')}</button></article>`).join('')}</div>
<h3>А что, если?..</h3>${forestExperiments}
<h3>Если что-то пошло не так</h3><p>Лес не открылся — в лаборатории выбран «Урок 04»? Фонарь без числа и круга — яркость стала текстом или «ничего»: панель над игрой скажет, в какой строке. Древень всегда спокойный — функции <code>treantPhase</code> нет, нет <code>export</code> или она вернула не то слово: подсказка в карточке «Фазы Древня». Таблица с ✘ — сравни строку: 60 это «больше 60»? Вернуть заготовку леса: <code>npm run reset:lesson -- --exercise forest</code>, затем «да».</p>
<h3>Домашняя экспедиция · 15–20 минут</h3><p>Придумай своё существо с четырьмя фазами и напиши цепочку условий на бумаге. Напиши <code>treantSays(phase)</code>, если не успел. Долг кузнецу из урока 03 — молния — ждёт в панели BlockQuest.</p>
<div class="lesson-bottom"><strong>Игра спрашивает — твоя функция отвечает.<br>Граница решает фазу.</strong><button class="primary-button" data-view="game">Вернуться к острову ${icon('arrow')}</button></div></div>`;
}
