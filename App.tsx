import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, CircleHelp, CreditCard,
  Edit3, ImagePlus, Plus, ReceiptText, Settings2, Trash2, Wallet, X
} from 'lucide-react'
import { parseTransaction } from './recognition'
import type { AppData, Transaction, TransactionType } from './types'

const STORAGE_KEY = 'tiho.mvp.v1'
const DEFAULT_CATEGORIES = ['Кафе и напитки', 'Спорт и инвентарь', 'Подарки', 'Продукты', 'Транспорт', 'Здоровье', 'Дом и связь', 'Прочее', 'Доходы', 'Долги']
const emptyData: AppData = { startingBalance: null, transactions: [], categories: DEFAULT_CATEGORIES }

function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return emptyData
    const parsed = JSON.parse(saved) as AppData
    return {
      startingBalance: typeof parsed.startingBalance === 'number' ? parsed.startingBalance : null,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      categories: Array.isArray(parsed.categories) ? [...new Set([...DEFAULT_CATEGORIES, ...parsed.categories])] : DEFAULT_CATEGORIES,
    }
  } catch {
    return emptyData
  }
}
const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value)
const dateLabel = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}
const monthKey = (value: string) => value.slice(0, 7)
const typeLabel: Record<TransactionType, string> = {
  expense: 'Расход', income: 'Доход', debt_borrowed: 'Взял в долг', debt_repaid: 'Вернул долг'
}
const signedAmount = (t: Transaction) => t.type === 'expense' || t.type === 'debt_repaid' ? -t.amount : t.amount

export default function App() {
  const [data, setData] = useState<AppData>(loadData)
  const [screen, setScreen] = useState<'home' | 'settings'>('home')
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<Partial<Transaction> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [startingBalanceInput, setStartingBalanceInput] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const currentMonth = new Date().toISOString().slice(0, 7)
  const balance = useMemo(() => (data.startingBalance ?? 0) + data.transactions.reduce((sum, t) => sum + signedAmount(t), 0), [data])
  const spent = useMemo(() => data.transactions.filter(t => t.type === 'expense' && monthKey(t.date) === currentMonth).reduce((sum, t) => sum + t.amount, 0), [data.transactions, currentMonth])
  const sorted = useMemo(() => [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [data.transactions])

  function beginAdd() {
    setText('')
    setDraft(null)
    setEditingId(null)
    setManualMode(false)
    setShowForm(true)
  }
  function recognize() {
    if (!text.trim()) return
    const parsed = parseTransaction(text, data.categories)
    setDraft(parsed)
    setManualMode(false)
  }
  function beginManual() {
    setEditingId(null)
    setDraft({ type: 'expense', amount: 0, description: '', date: new Date().toISOString().slice(0, 10), category: 'Прочее' })
    setManualMode(true)
  }
  function beginEdit(t: Transaction) {
    setEditingId(t.id)
    setDraft({ ...t })
    setManualMode(true)
    setShowForm(true)
  }
  function saveDraft() {
    if (!draft || !draft.amount || Number(draft.amount) <= 0 || !draft.description?.trim() || !draft.date || !draft.category) {
      setNotice('Проверь сумму, описание, дату и категорию.')
      return
    }
    const category = String(draft.category).trim()
    const transaction: Transaction = {
      id: editingId ?? crypto.randomUUID(),
      type: (draft.type ?? 'expense') as TransactionType,
      amount: Number(draft.amount),
      description: String(draft.description).trim(),
      date: String(draft.date),
      category,
      createdAt: editingId ? (data.transactions.find(t => t.id === editingId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
    }
    setData(prev => ({
      ...prev,
      categories: prev.categories.includes(category) ? prev.categories : [...prev.categories, category],
      transactions: editingId ? prev.transactions.map(t => t.id === editingId ? transaction : t) : [transaction, ...prev.transactions],
    }))
    setShowForm(false)
    setDraft(null)
    setEditingId(null)
    setNotice(editingId ? 'Операция обновлена.' : 'Операция сохранена.')
  }
  function saveStartingBalance() {
    const value = Number(startingBalanceInput.replace(',', '.'))
    if (!startingBalanceInput.trim() || !Number.isFinite(value) || value < 0) {
      setNotice('Введи корректный баланс — 0 или больше.')
      return
    }
    setData(prev => ({ ...prev, startingBalance: value }))
    setScreen('home')
    setNotice('Начальный баланс сохранён.')
  }
  function confirmDelete() {
    if (!deleteId) return
    setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== deleteId) }))
    setDeleteId(null)
    setNotice('Операция удалена.')
  }
  function updateDraft(field: keyof Transaction, value: string) {
    setDraft(prev => ({ ...prev, [field]: field === 'amount' ? Number(value) : value }))
  }

  if (data.startingBalance === null && screen !== 'settings') {
    return <main className="onboarding"><div className="brand">тихо<span>.</span></div><p className="eyebrow">НАЧНЁМ С ПРОСТОГО</p><h1>Сколько у тебя<br />сейчас на счету?</h1><p className="muted">Укажи текущую сумму. Это начальный баланс, а не доход.</p><div className="balance-input"><span>₽</span><input inputMode="decimal" placeholder="0" value={startingBalanceInput} onChange={e => setStartingBalanceInput(e.target.value)} /></div><button className="primary full" onClick={saveStartingBalance}>Продолжить <ArrowUpRight size={18}/></button><button className="quiet full" onClick={() => { setStartingBalanceInput('0'); setData(prev => ({ ...prev, startingBalance: 0 })) }}>Начать с нуля</button><p className="tiny muted">Данные пока хранятся только в этом браузере на устройстве.</p></main>
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><div className="brand">тихо<span>.</span></div><div className="tagline">Деньги — без лишнего шума.</div></div>
        <button className="icon-button" aria-label="Настройки" onClick={() => { setStartingBalanceInput(String(data.startingBalance ?? 0)); setScreen(screen === 'settings' ? 'home' : 'settings') }}><Settings2 size={20}/></button>
      </header>

      {screen === 'settings' ? (
        <section className="panel settings">
          <button className="back-link" onClick={() => setScreen('home')}><ChevronLeft size={17}/> Назад</button>
          <p className="eyebrow">НАСТРОЙКИ</p><h1>Начальный баланс</h1>
          <p className="muted">Эта сумма не считается доходом. Текущий баланс пересчитается с учётом всех операций.</p>
          <label className="field-label">Сумма в рублях</label>
          <input className="text-input" inputMode="decimal" value={startingBalanceInput} onChange={e => setStartingBalanceInput(e.target.value)} placeholder="0" />
          <button className="primary full" onClick={saveStartingBalance}>Сохранить баланс</button>
          <div className="notice-card"><CircleHelp size={18}/><span>В этой версии данные сохраняются на устройстве. Не очищай данные браузера, если хочешь их сохранить.</span></div>
          <button className="danger full" onClick={() => { if (confirm('Удалить все операции и сбросить приложение? Это действие нельзя отменить.')) { localStorage.removeItem(STORAGE_KEY); setData(emptyData); setScreen('home') } }}>Сбросить все данные</button>
        </section>
      ) : (
        <>
          <section className="summary-grid">
            <div className="balance-card">
              <div className="card-label"><Wallet size={16}/> На счету</div>
              <div className="balance-number">{money(balance)}</div>
              <div className="balance-foot"><span className="status-dot"/> Баланс с учётом операций</div>
            </div>
            <div className="spent-card">
              <div className="card-label"><ArrowUpRight size={16}/> Потрачено</div>
              <div className="spent-number">{money(spent)}</div>
              <div className="muted small">За этот месяц</div>
            </div>
          </section>

          <section className="section-heading"><div><p className="eyebrow">ТВОИ ДЕНЬГИ</p><h2>Последние операции</h2></div><span className="count">{data.transactions.length}</span></section>
          {sorted.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><ReceiptText size={24}/></div><h3>Здесь пока тихо</h3><p className="muted">Добавь первую операцию — вручную или обычным текстом.</p><button className="primary" onClick={beginAdd}><Plus size={18}/> Добавить операцию</button></div>
          ) : (
            <section className="transaction-list">
              {sorted.slice(0, 30).map(t => (
                <article className="transaction-row" key={t.id}>
                  <div className={`transaction-icon ${signedAmount(t) < 0 ? 'expense' : 'income'}`}>{signedAmount(t) < 0 ? <ArrowUpRight size={19}/> : <ArrowDownLeft size={19}/>}</div>
                  <button className="transaction-main" onClick={() => beginEdit(t)}>
                    <span className="transaction-title">{t.description}</span><span className="transaction-meta">{t.category} · {dateLabel(t.date)}</span>
                  </button>
                  <div className="transaction-right"><strong className={signedAmount(t) < 0 ? 'amount-negative' : 'amount-positive'}>{signedAmount(t) > 0 ? '+' : '−'}{money(t.amount)}</strong><button className="mini-edit" aria-label="Редактировать" onClick={() => beginEdit(t)}><Edit3 size={14}/></button></div>
                </article>
              ))}
            </section>
          )}
          <button className="primary add-button" onClick={beginAdd}><Plus size={19}/> Добавить операцию</button>
          <div className="bottom-note"><CreditCard size={15}/> MVP · рубли · локальное хранение</div>
        </>
      )}

      {showForm && (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header"><div><p className="eyebrow">{editingId ? 'ИЗМЕНЕНИЕ' : 'НОВАЯ ОПЕРАЦИЯ'}</p><h2 id="modal-title">{editingId ? 'Изменить операцию' : 'Добавить операцию'}</h2></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Закрыть"><X size={20}/></button></div>
            {!draft && !editingId ? (
              <>
                <label className="field-label">Опиши операцию обычными словами</label>
                <textarea className="text-area" value={text} onChange={e => setText(e.target.value)} placeholder="Например: купил хоккейную шайбу за 250 рублей" rows={3}/>
                <button className="primary full" onClick={recognize}>Распознать операцию</button>
                <div className="or-line"><span>или</span></div>
                <button className="secondary full" onClick={beginManual}><Plus size={17}/> Заполнить вручную</button>
                <p className="tiny muted">Распознавание в этой версии работает по простым правилам, это ещё не AI.</p>
              </>
            ) : draft && (
              <>
                {!manualMode && <div className="preview-banner"><Check size={17}/><span>Проверь данные перед сохранением. Ничего не записано автоматически.</span></div>}
                {draft.warning && <div className="warning-banner">{draft.warning}</div>}
                <label className="field-label">Тип операции</label>
                <select className="text-input" value={String(draft.type ?? 'expense')} onChange={e => updateDraft('type', e.target.value)}>
                  <option value="expense">Расход</option><option value="income">Доход</option><option value="debt_borrowed">Взял в долг</option><option value="debt_repaid">Вернул долг</option>
                </select>
                <label className="field-label">Сумма, ₽</label><input className="text-input" inputMode="decimal" value={String(draft.amount ?? '')} onChange={e => updateDraft('amount', e.target.value)} placeholder="0"/>
                <label className="field-label">Описание</label><input className="text-input" value={String(draft.description ?? '')} onChange={e => updateDraft('description', e.target.value)} placeholder="Что произошло"/>
                <label className="field-label">Дата</label><input className="text-input" type="date" value={String(draft.date ?? '')} onChange={e => updateDraft('date', e.target.value)}/>
                <label className="field-label">Категория</label><input className="text-input" list="category-list" value={String(draft.category ?? '')} onChange={e => updateDraft('category', e.target.value)} placeholder="Например, Спорт и инвентарь"/><datalist id="category-list">{data.categories.map(c => <option key={c} value={c}/>)}</datalist>
                {editingId && <button className="danger full" onClick={() => setDeleteId(editingId)}><Trash2 size={17}/> Удалить операцию</button>}
                <div className="modal-actions"><button className="secondary" onClick={() => { setDraft(null); setEditingId(null); setManualMode(false) }}>Назад</button><button className="primary" onClick={saveDraft}><Check size={17}/> Сохранить</button></div>
              </>
            )}
          </section>
        </div>
      )}

      {deleteId && <div className="modal-backdrop"><section className="confirm-modal"><div className="confirm-icon"><Trash2 size={23}/></div><h2>Удалить операцию?</h2><p className="muted">Баланс и сумма расходов пересчитаются. Вернуть удалённую операцию будет нельзя.</p><div className="modal-actions"><button className="secondary" onClick={() => setDeleteId(null)}>Отмена</button><button className="danger" onClick={confirmDelete}>Удалить</button></div></section></div>}
      {notice && <button className="toast" onClick={() => setNotice('')}><Check size={16}/>{notice}<X size={15}/></button>}
      <div className="safe-bottom"/>
    </main>
  )
}
