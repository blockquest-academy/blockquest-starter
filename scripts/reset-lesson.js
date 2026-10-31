import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';

const EXERCISES = ['all', 'config', 'rules', 'guardian', 'monsters', 'forge'];
const exerciseError = 'Задание: --exercise config, rules, guardian, monsters, forge или all.';
// Файлы уроков 02 и 03 появляются в проекте позже урока 01; имя резервной копии — по уроку.
const LATER_LESSONS = { guardian: 'lesson-02', monsters: 'lesson-02', forge: 'lesson-03' };
const LESSON_02 = Object.keys(LATER_LESSONS);
async function optionalFile(path) {
  try { return await readFile(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function resetLesson(root, { confirmed = false, exercise = 'all' } = {}) {
  if (!confirmed) throw new Error('Сброс требует подтверждения.');
  if (!EXERCISES.includes(exercise)) throw new Error(exerciseError);
  // Файлы уроков 02 и 03 входят в полный сброс, только если их шаблоны уже есть в проекте.
  const lesson02 = [];
  for (const name of LESSON_02) if (await optionalFile(resolve(root, `scripts/templates/${name}.js`))) lesson02.push(name);
  const names = exercise === 'all' ? ['config', 'rules', ...lesson02] : [exercise];
  // Сначала читаем ВСЕ исходники и шаблоны: ошибка подготовки не затрагивает работу.
  const files = await Promise.all(names.map(async name => ({
    name, target: resolve(root, `student/${name}.js`),
    original: LESSON_02.includes(name) ? await optionalFile(resolve(root, `student/${name}.js`)) : await readFile(resolve(root, `student/${name}.js`)),
    baseline: await readFile(resolve(root, `scripts/templates/${name}.js`)),
  })));
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const backup = resolve(root, 'backups', `${LATER_LESSONS[exercise] ?? 'lesson-01'}-${stamp}-${randomUUID().slice(0, 8)}`);
  await mkdir(backup, { recursive: true });
  for (const file of files) if (file.original) await writeFile(resolve(backup, `${file.name}.js`), file.original, { flag: 'wx' });
  const replaced = [];
  try {
    for (const file of files) {
      const temp = `${file.target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, file.baseline, { flag: 'wx' });
        await rename(temp, file.target); replaced.push(file);
      } finally { await rm(temp, { force: true }); }
    }
  } catch (error) {
    // При сбое второго файла восстанавливаем уже заменённые; резервные копии остаются.
    for (const file of replaced) await (file.original ? writeFile(file.target, file.original) : rm(file.target, { force: true }));
    throw error;
  }
  return backup;
}

async function main() {
  let confirmed = process.argv.includes('--yes');
  const index = process.argv.indexOf('--exercise');
  const exercise = index < 0 ? 'all' : process.argv[index + 1];
  if (!EXERCISES.includes(exercise)) throw new Error(exerciseError);
  if (!confirmed && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`Вернуть начальные файлы (${exercise})? Предыдущая работа будет сохранена в backups/. Введите «да»: `);
    rl.close(); confirmed = ['да', 'yes'].includes(answer.trim().toLowerCase());
  }
  if (!confirmed) { console.log('Сброс отменён. Для явного подтверждения: npm run reset:lesson -- --yes'); return; }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const backup = await resetLesson(root, { confirmed, exercise });
  console.log(`Начальные файлы восстановлены (${exercise}). Предыдущая работа: ${backup}`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
