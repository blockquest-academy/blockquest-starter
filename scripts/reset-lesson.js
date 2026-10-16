import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';

export async function resetLesson(root, { confirmed = false, exercise = 'all' } = {}) {
  if (!confirmed) throw new Error('Сброс требует подтверждения.');
  if (!['all', 'config', 'rules'].includes(exercise)) throw new Error('Задание: --exercise config, rules или all.');
  const names = exercise === 'all' ? ['config', 'rules'] : [exercise];
  // Сначала читаем ВСЕ исходники и шаблоны: ошибка подготовки не затрагивает работу.
  const files = await Promise.all(names.map(async name => ({
    name, target: resolve(root, `student/${name}.js`),
    original: await readFile(resolve(root, `student/${name}.js`)),
    baseline: await readFile(resolve(root, `scripts/templates/${name}.js`)),
  })));
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const backup = resolve(root, 'backups', `lesson-01-${stamp}-${randomUUID().slice(0, 8)}`);
  await mkdir(backup, { recursive: true });
  for (const file of files) await writeFile(resolve(backup, `${file.name}.js`), file.original, { flag: 'wx' });
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
    for (const file of replaced) await writeFile(file.target, file.original);
    throw error;
  }
  return backup;
}

async function main() {
  let confirmed = process.argv.includes('--yes');
  const index = process.argv.indexOf('--exercise');
  const exercise = index < 0 ? 'all' : process.argv[index + 1];
  if (!['all', 'config', 'rules'].includes(exercise)) throw new Error('Задание: --exercise config, rules или all.');
  if (!confirmed && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`Вернуть начальные файлы (${exercise}) урока 01? Предыдущая работа будет сохранена в backups/. Введите «да»: `);
    rl.close(); confirmed = ['да', 'yes'].includes(answer.trim().toLowerCase());
  }
  if (!confirmed) { console.log('Сброс отменён. Для явного подтверждения: npm run reset:lesson -- --yes'); return; }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const backup = await resetLesson(root, { confirmed, exercise });
  console.log(`Урок 01 восстановлен. Предыдущая работа: ${backup}`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
