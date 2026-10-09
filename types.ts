export type TransactionType = 'expense' | 'income' | 'debt_borrowed' | 'debt_repaid'

export type Transaction = {
  id: string
  type: TransactionType
  amount: number
  description: string
  date: string
  category: string
  createdAt: string
}

export type AppData = {
  startingBalance: number | null
  transactions: Transaction[]
  categories: string[]
}
