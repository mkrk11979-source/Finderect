import type { Transaction, TransactionType } from './types'

const expenseRules: Array<[RegExp, string]> = [
  [/(кофе|кофейня|капучино|латте|чай|кафе|ресторан|обед|ужин|доставка еды|бургер|пицц|суши)/i, 'Кафе и напитки'],
  [/(шайб|клюшк|мяч|коньк|ракетк|гантел|спорт|тренировк|фитнес|спортзал)/i, 'Спорт и инвентарь'],
  [/(подар|цвет|букет|сувенир)/i, 'Подарки'],
  [/(продукт|магазин|молоко|хлеб|сыр|мясо|овощ|фрукт|супермаркет)/i, 'Продукты'],
  [/(такси|метро|автобус|бензин|топлив|проезд)/i, 'Транспорт'],
  [/(аптек|лекарств|врач|больниц)/i, 'Здоровье'],
  [/(коммунал|электричеств|интернет|телефон|связь)/i, 'Дом и связь'],
]

function extractAmount(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, ' ')
  const patterns = [
    /(?:за|на сумму|сумма|получил|получила|вернул|вернула|взял|взяла|потратил|потратила|купил|купила)\s*([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(?:₽|руб(?:лей|ля|ль)?|р\b)?/i,
    /([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(?:₽|руб(?:лей|ля|ль)?|р\b)/i,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      const value = Number(match[1].replace(/\s/g, '').replace(',', '.'))
      if (Number.isFinite(value) && value > 0) return Math.round(value * 100) / 100
    }
  }
  return null
}

export function parseTransaction(text: string, categories: string[]): Omit<Transaction, 'id' | 'createdAt'> & { warning?: string; newCategory?: string } {
  const clean = text.trim()
  const amount = extractAmount(clean)
  const borrowed = /(взял|взяла|занял|заняла)\s+(?:в\s+долг|долг)?|в долг у/i.test(clean)
  const repaid = /(вернул|вернула|отдал|отдала)\s+(?:долг|долга)|погасил|погасила/i.test(clean)
  const income = /(получил зарплат|получила зарплат|зарплат|преми|заработал|заработала|пришло|поступил|поступила|вернули долг|вернул долг мне)/i.test(clean)

  let type: TransactionType = 'expense'
  if (borrowed) type = 'debt_borrowed'
  else if (repaid) type = 'debt_repaid'
  else if (income) type = 'income'

  let category = type === 'income' ? 'Доходы' : type.startsWith('debt_') ? 'Долги' : 'Прочее'
  if (type === 'expense') {
    for (const [pattern, name] of expenseRules) {
      if (pattern.test(clean)) {
        category = categories.find(c => c.toLowerCase() === name.toLowerCase()) ?? name
        break
      }
    }
  }

  const description = clean
    .replace(/(?:за|на сумму)\s*[0-9][0-9\s]*(?:[.,][0-9]{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?|р\b)?/i, '')
    .replace(/[0-9][0-9\s]*(?:[.,][0-9]{1,2})?\s*(?:₽|руб(?:лей|ля|ль)?|р\b)/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim()

  return {
    type,
    amount: amount ?? 0,
    description: description || clean,
    date: new Date().toISOString().slice(0, 10),
    category,
    ...(!amount ? { warning: 'Не удалось уверенно определить сумму. Проверь её перед сохранением.' } : {}),
    ...(!categories.includes(category) && !['Доходы', 'Долги', 'Прочее'].includes(category) ? { newCategory: category } : {}),
  }
}
