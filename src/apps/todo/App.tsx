import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { DIFFICULTIES, computeStreak, levelInfo } from './gamification'

interface Item {
  id: string
  title: string
  points: number
  done: boolean
  completed_at: string | null
  due_date: string | null
}

const todayKey = () => new Date().toLocaleDateString('sv') // YYYY-MM-DD in lokaler Zeit

/** Beschriftung und Zustand des Fälligkeitsdatums; YYYY-MM-DD-Strings lassen sich direkt vergleichen. */
function dueInfo(due: string): { label: string; state: 'overdue' | 'today' | 'soon' | 'later' } {
  const [y, m, d] = due.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const formatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const today = todayKey()
  if (due < today) return { label: `Überfällig · ${formatted}`, state: 'overdue' }
  if (due === today) return { label: 'Heute', state: 'today' }
  if (due === tomorrow.toLocaleDateString('sv')) return { label: 'Morgen', state: 'soon' }
  return { label: formatted, state: 'later' }
}

interface Reward {
  id: string
  title: string
  cost: number
}

interface Redemption {
  id: string
  title: string
  cost: number
  redeemed_at: string
}

export default function TodoApp() {
  const [items, setItems] = useState<Item[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [tab, setTab] = useState<'quests' | 'rewards'>('quests')
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0].key)
  const [dueDate, setDueDate] = useState('')
  const [rewardTitle, setRewardTitle] = useState('')
  const [rewardCost, setRewardCost] = useState(50)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2200)
  }

  async function load() {
    const [itemsRes, rewardsRes, redemptionsRes] = await Promise.all([
      supabase.from('todo_items').select('id, title, points, done, completed_at, due_date').order('created_at', { ascending: false }),
      supabase.from('todo_rewards').select('id, title, cost').order('cost'),
      supabase.from('todo_redemptions').select('id, title, cost, redeemed_at').order('redeemed_at', { ascending: false }),
    ])
    if (itemsRes.error) return setError(itemsRes.error.message)
    if (rewardsRes.error) return setError(rewardsRes.error.message)
    if (redemptionsRes.error) return setError(redemptionsRes.error.message)
    setItems(itemsRes.data)
    setRewards(rewardsRes.data)
    setRedemptions(redemptionsRes.data)
  }

  useEffect(() => {
    load()
  }, [])

  const earned = useMemo(() => items.filter((i) => i.done).reduce((sum, i) => sum + i.points, 0), [items])
  const spent = useMemo(() => redemptions.reduce((sum, r) => sum + r.cost, 0), [redemptions])
  const balance = earned - spent
  const level = useMemo(() => levelInfo(earned), [earned])
  const streak = useMemo(() => computeStreak(items.filter((i) => i.done).map((i) => i.completed_at)), [items])
  // Offene Quests nach Fälligkeit sortieren; ohne Datum ans Ende (sort ist stabil, sonst bleibt die Erstellreihenfolge)
  const open = items
    .filter((i) => !i.done)
    .sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'))
  const done = items.filter((i) => i.done)

  async function addItem(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const points = DIFFICULTIES.find((d) => d.key === difficulty)!.points
    const { error } = await supabase.from('todo_items').insert({ title, points, due_date: dueDate || null })
    if (error) return setError(error.message)
    setTitle('')
    setDueDate('')
    load()
  }

  async function toggle(item: Item) {
    const done = !item.done
    const { error } = await supabase
      .from('todo_items')
      .update({ done, completed_at: done ? new Date().toISOString() : null })
      .eq('id', item.id)
    if (error) return setError(error.message)
    if (done) flash(`+${item.points} Punkte! 🎉`)
    load()
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from('todo_items').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  async function addReward(e: FormEvent) {
    e.preventDefault()
    if (!rewardTitle.trim() || rewardCost <= 0) return
    const { error } = await supabase.from('todo_rewards').insert({ title: rewardTitle, cost: rewardCost })
    if (error) return setError(error.message)
    setRewardTitle('')
    setRewardCost(50)
    load()
  }

  async function removeReward(id: string) {
    const { error } = await supabase.from('todo_rewards').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  async function redeem(reward: Reward) {
    if (balance < reward.cost) return
    const { error } = await supabase
      .from('todo_redemptions')
      .insert({ reward_id: reward.id, title: reward.title, cost: reward.cost })
    if (error) return setError(error.message)
    flash(`🎁 Eingelöst: ${reward.title}`)
    load()
  }

  return (
    <div className="todo">
      <h1>Quests</h1>
      {error && <p role="alert">{error}</p>}

      <div className="stats">
        <div className="stat level">
          <span className="badge">Lvl {level.level}</span>
          <div className="bar">
            <div className="fill" style={{ width: `${(level.into / level.need) * 100}%` }} />
          </div>
          <small>{level.into} / {level.need} XP</small>
        </div>
        <div className="stat">
          <span className="big">🪙 {balance}</span>
          <small>Punkte verfügbar</small>
        </div>
        <div className="stat">
          <span className="big">🔥 {streak}</span>
          <small>Tage in Folge</small>
        </div>
      </div>

      <nav className="tabs">
        <button className={tab === 'quests' ? 'active' : ''} onClick={() => setTab('quests')}>
          Quests
        </button>
        <button className={tab === 'rewards' ? 'active' : ''} onClick={() => setTab('rewards')}>
          Belohnungen
        </button>
      </nav>

      {tab === 'quests' && (
        <>
          <form onSubmit={addItem}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neue Quest…" />
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFICULTIES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.emoji} {d.label} · {d.points} P.
                </option>
              ))}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} title="Fällig am (optional)" />
            <button type="submit">Hinzufügen</button>
          </form>
          <ul className="quests">
            {open.map((i) => (
              <li key={i.id}>
                <label>
                  <input type="checkbox" checked={false} onChange={() => toggle(i)} />
                  <span>{i.title}</span>
                </label>
                <div className="right">
                  {i.due_date && (() => {
                    const due = dueInfo(i.due_date)
                    return <span className={`due ${due.state}`}>📅 {due.label}</span>
                  })()}
                  <span className="points">+{i.points}</span>
                  <button onClick={() => removeItem(i.id)}>✕</button>
                </div>
              </li>
            ))}
            {open.length === 0 && <li className="empty">Keine offenen Quests. Zeit für Nachschub! ✨</li>}
          </ul>
          {done.length > 0 && (
            <details>
              <summary>Erledigt ({done.length})</summary>
              <ul className="quests done">
                {done.map((i) => (
                  <li key={i.id}>
                    <label>
                      <input type="checkbox" checked={true} onChange={() => toggle(i)} />
                      <span>{i.title}</span>
                    </label>
                    <div className="right">
                      <span className="points">+{i.points}</span>
                      <button onClick={() => removeItem(i.id)}>✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {tab === 'rewards' && (
        <>
          <form onSubmit={addReward}>
            <input value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} placeholder="Neue Belohnung…" />
            <input
              type="number"
              min={1}
              value={rewardCost}
              onChange={(e) => setRewardCost(Number(e.target.value))}
              placeholder="Kosten"
            />
            <button type="submit">Hinzufügen</button>
          </form>
          <ul className="rewards">
            {rewards.map((r) => (
              <li key={r.id}>
                <span>{r.title}</span>
                <div className="right">
                  <span className="points">🪙 {r.cost}</span>
                  <button disabled={balance < r.cost} onClick={() => redeem(r)}>
                    Einlösen
                  </button>
                  <button onClick={() => removeReward(r.id)}>✕</button>
                </div>
              </li>
            ))}
            {rewards.length === 0 && <li className="empty">Noch keine Belohnungen. Leg dir welche an!</li>}
          </ul>
          {redemptions.length > 0 && (
            <details>
              <summary>Verlauf ({redemptions.length})</summary>
              <ul className="history">
                {redemptions.map((r) => (
                  <li key={r.id}>
                    <span>{r.title}</span>
                    <span className="points">-{r.cost}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
