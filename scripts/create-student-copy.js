import { access, mkdir, readFile, rm, mkdtemp, rename } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { studentFiles, writeStudentProject } from './lib/distribution.js';

export async function createStudentCopy(root, name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/.test(name || '')) throw new Error('Имя: 1–40 латинских букв, цифр, - или _. Например student-a.');
  const agentInstructions = await readFile(resolve(root, 'AGENTS.md'), 'utf8');
  if (!agentInstructions.trim()) throw new Error('Заполните инструкции AI в AGENTS.md перед созданием ученической копии.');
  const parent = resolve(root, 'workspaces');
  const destination = resolve(parent, name);
  try { await access(destination); throw new Error(`Папка ${destination} уже существует. Работа ученика не перезаписана.`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, '.preparing-'));
  try {
    const files = await studentFiles(root);
    const config = files['academy.config.json'] ? JSON.parse(files['academy.config.json'].toString()) : {};
    await writeStudentProject(staging, files, config);
    await rename(staging, destination);
    return destination;
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
}

async function main() {
  const name = process.argv[process.argv.indexOf('--name') + 1];
  if (!process.argv.includes('--name')) throw new Error('Укажите имя: npm run student:copy -- --name student-a');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const destination = await createStudentCopy(root, name);
  console.log(`Готово: ${destination}\nОткройте эту папку в VS Code. Запустите npm ci, затем npm run dev. Решения преподавателя не скопированы.`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
