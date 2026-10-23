// УРОК 02 · Хранитель кристаллов. Ты создаёшь хранителя — и сам его побеждаешь.
// Слева от = имя, справа значение. Текст — в кавычках, число — без кавычек, да/нет — true или false.
// export — игра видит это имя. Сохрани файл: хранитель возродится с новыми свойствами.

// Кто он
export const guardianName = "Хранитель";                      // Имя над головой (текст)
export const guardianColor = "stone";                         // Цвет: "stone", "red", "blue", "green", "gold", "purple"
export const guardianSays = "Кто посмел войти в моё логово?"; // Фраза, когда герой рядом (текст)
export const guardianSize = 1;                                // Размер: 1 — обычный, 2 — вдвое больше

// Бой
export const guardianHealth = 60;                             // Здоровье хранителя (число)
export const pulseDamage = 10;                                // Урон твоего импульса (пробел)
export const guardianDamage = 20;                             // Урон хранителя, когда он касается героя
export const guardianStunnable = true;                        // Оглушает ли его импульс: true — да, false — нет
export const guardianRegen = 0;                               // Лечение хранителя: сколько здоровья в секунду

// Награда
export const guardianReward = 50;                             // Очки за секретный кристалл

// БОНУС · Ярость хранителя. health — сколько здоровья у хранителя осталось.
// Команда: return "rage"; — хранитель злится: бегает быстрее и бьёт с силой rageDamage.
// Правило проверяется, когда меняется здоровье. Оболочка готова: пиши условие внутри скобок.
export const rageDamage = 20;                                 // Урон хранителя в ярости
export function guardianMood(health) {
  // Здесь появится правило ярости.
}
