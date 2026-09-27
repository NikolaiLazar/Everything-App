import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { startAlarmSound } from './sound'

interface Alarm {
  id: string
  time: string // HH:MM:SS aus Postgres
  label: string
  days: number[]
  enabled: boolean
}

type Ringing = { title: string; alarmId?: string }

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Anzeige ab Montag
const TIMER_PRESETS = [1, 3, 5, 10, 15, 30]
const SNOOZE_MINUTES = 5
const TIMER_KEY = 'clock-timer' // laufender Timer überlebt App-Wechsel und Reload

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function formatDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Timer läuft (Endzeitpunkt) oder ist pausiert (Restzeit). Endzeitpunkt statt Herunterzählen, damit gedrosselte Hintergrund-Tabs nicht nachgehen. */
type TimerState = { endsAt: number; duration: number } | { remaining: number; duration: number } | null

function loadTimer(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? (JSON.parse(raw) as TimerState) : null
  } catch {
    return null
  }
}

function saveTimer(state: TimerState) {
  try {
    if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state))
    else localStorage.removeItem(TIMER_KEY)
  } catch {
    // Speicher nicht verfügbar: Timer läuft trotzdem, nur ohne Wiederherstellung
  }
}

function notify(title: string) {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body: 'Uhr · Everything App' })
}

function requestNotifications() {
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
}

function daysLabel(days: number[]) {
  if (days.length === 0 || days.length === 7) return 'Täglich'
  const sorted = [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
  if (sorted.join() === '1,2,3,4,5') return 'Mo–Fr'
  if (sorted.join() === '6,0') return 'Wochenende'
  return sorted.map((d) => WEEKDAYS[d]).join(', ')
}

export default function ClockApp() {
  const now = useNow()
  const [tab, setTab] = useState<'clock' | 'timer' | 'alarm'>('clock')
  const [error, setError] = useState('')
  const [ringing, setRinging] = useState<Ringing | null>(null)

  const [timer, setTimerState] = useState<TimerState>(loadTimer)
  const [minutes, setMinutes] = useState(5)
  const [seconds, setSeconds] = useState(0)

  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [newTime, setNewTime] = useState('07:00')
  const [newLabel, setNewLabel] = useState('')
  const [newDays, setNewDays] = useState<number[]>([])
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null)
  // "alarmId@YYYY-MM-DD HH:MM": verhindert mehrfaches Auslösen innerhalb derselben Minute
  const firedRef = useRef(new Set<string>())

  function setTimer(state: TimerState) {
    setTimerState(state)
    saveTimer(state)
  }

  async function loadAlarms() {
    const { data, error } = await supabase.from('clock_alarms').select('id, time, label, days, enabled').order('time')
    if (error) return setError(error.message)
    setAlarms(data)
  }

  useEffect(() => {
    loadAlarms()
  }, [])

  // Ton läuft, solange etwas klingelt
  useEffect(() => {
    if (!ringing) return
    notify(ringing.title)
    return startAlarmSound()
  }, [ringing])

  // Einmal pro Sekunde prüfen: Timer abgelaufen, Schlummern vorbei, Wecker fällig
  const tick = Math.floor(now.getTime() / 1000)
  useEffect(() => {
    const t = Date.now()
    if (timer && 'endsAt' in timer && t >= timer.endsAt) {
      setTimer(null)
      setRinging({ title: '⏲️ Timer abgelaufen' })
      return
    }
    if (snoozeUntil && t >= snoozeUntil) {
      setSnoozeUntil(null)
      setRinging({ title: '⏰ Wecker (Schlummern vorbei)' })
      return
    }
    const d = new Date(t)
    const minuteKey = `${d.toLocaleDateString('sv')} ${hhmm(d)}`
    for (const a of alarms) {
      if (!a.enabled || a.time.slice(0, 5) !== hhmm(d)) continue
      if (a.days.length > 0 && !a.days.includes(d.getDay())) continue
      const key = `${a.id}@${minuteKey}`
      if (firedRef.current.has(key)) continue
      firedRef.current.add(key)
      setRinging({ title: `⏰ ${a.label || 'Wecker'} · ${a.time.slice(0, 5)}`, alarmId: a.id })
      break
    }
  }, [tick])

  function snooze() {
    setRinging(null)
    setSnoozeUntil(Date.now() + SNOOZE_MINUTES * 60_000)
  }

  function startTimer(durationMs: number) {
    if (durationMs <= 0) return
    requestNotifications()
    setTimer({ endsAt: Date.now() + durationMs, duration: durationMs })
  }

  function pauseTimer() {
    if (timer && 'endsAt' in timer) setTimer({ remaining: timer.endsAt - Date.now(), duration: timer.duration })
  }

  function resumeTimer() {
    if (timer && 'remaining' in timer) setTimer({ endsAt: Date.now() + timer.remaining, duration: timer.duration })
  }

  const timerRemaining = !timer
    ? minutes * 60_000 + seconds * 1000
    : 'endsAt' in timer
      ? timer.endsAt - now.getTime()
      : timer.remaining
  const timerProgress = timer ? 1 - Math.max(0, timerRemaining) / timer.duration : 0

  async function addAlarm(e: FormEvent) {
    e.preventDefault()
    if (!newTime) return
    requestNotifications()
    const { error } = await supabase.from('clock_alarms').insert({ time: newTime, label: newLabel.trim(), days: newDays })
    if (error) return setError(error.message)
    setNewLabel('')
    setNewDays([])
    loadAlarms()
  }

  async function toggleAlarm(a: Alarm) {
    const { error } = await supabase.from('clock_alarms').update({ enabled: !a.enabled }).eq('id', a.id)
    if (error) return setError(error.message)
    loadAlarms()
  }

  async function removeAlarm(id: string) {
    const { error } = await supabase.from('clock_alarms').delete().eq('id', id)
    if (error) return setError(error.message)
    loadAlarms()
  }

  function toggleNewDay(day: number) {
    setNewDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]))
  }

  return (
    <div className="clock">
      <h1>Uhr</h1>
      {error && <p role="alert">{error}</p>}

      <nav className="tabs">
        <button className={tab === 'clock' ? 'active' : ''} onClick={() => setTab('clock')}>
          🕒 Uhr
        </button>
        <button className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}>
          ⏲️ Timer{timer && 'endsAt' in timer ? ` · ${formatDuration(timerRemaining)}` : ''}
        </button>
        <button className={tab === 'alarm' ? 'active' : ''} onClick={() => setTab('alarm')}>
          ⏰ Wecker
        </button>
      </nav>

      {tab === 'clock' && (
        <section className="face">
          <div className="time">
            {hhmm(now)}
            <span className="sec">:{pad(now.getSeconds())}</span>
          </div>
          <div className="date">
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </section>
      )}

      {tab === 'timer' && (
        <section className="face">
          <div className="time">{formatDuration(timerRemaining)}</div>
          <div className="bar">
            <div className="fill" style={{ width: `${timerProgress * 100}%` }} />
          </div>
          {!timer ? (
            <>
              <div className="duration">
                <label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
                  />
                  Min
                </label>
                <label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={seconds}
                    onChange={(e) => setSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
                  />
                  Sek
                </label>
              </div>
              <div className="presets">
                {TIMER_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setMinutes(p)
                      setSeconds(0)
                    }}
                  >
                    {p} Min
                  </button>
                ))}
              </div>
              <div className="controls">
                <button className="primary" disabled={timerRemaining <= 0} onClick={() => startTimer(timerRemaining)}>
                  Start
                </button>
              </div>
            </>
          ) : (
            <div className="controls">
              {'endsAt' in timer ? (
                <button className="primary" onClick={pauseTimer}>
                  Pause
                </button>
              ) : (
                <button className="primary" onClick={resumeTimer}>
                  Weiter
                </button>
              )}
              <button onClick={() => setTimer(null)}>Zurücksetzen</button>
            </div>
          )}
        </section>
      )}

      {tab === 'alarm' && (
        <>
          <form className="alarm-form" onSubmit={addAlarm}>
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Bezeichnung (optional)" />
            <div className="days">
              {WEEKDAY_ORDER.map((d) => (
                <button type="button" key={d} className={newDays.includes(d) ? 'on' : ''} onClick={() => toggleNewDay(d)}>
                  {WEEKDAYS[d]}
                </button>
              ))}
            </div>
            <button type="submit">Wecker hinzufügen</button>
          </form>
          {snoozeUntil && (
            <p className="snooze">
              💤 Schlummern bis {hhmm(new Date(snoozeUntil))} <button onClick={() => setSnoozeUntil(null)}>Abbrechen</button>
            </p>
          )}
          <ul className="alarms">
            {alarms.map((a) => (
              <li key={a.id} className={a.enabled ? '' : 'off'}>
                <div>
                  <span className="alarm-time">{a.time.slice(0, 5)}</span>
                  <small>
                    {a.label && `${a.label} · `}
                    {daysLabel(a.days)}
                  </small>
                </div>
                <div className="right">
                  <label className="switch">
                    <input type="checkbox" checked={a.enabled} onChange={() => toggleAlarm(a)} />
                    {a.enabled ? 'An' : 'Aus'}
                  </label>
                  <button onClick={() => removeAlarm(a.id)}>✕</button>
                </div>
              </li>
            ))}
            {alarms.length === 0 && <li className="empty">Noch keine Wecker.</li>}
          </ul>
          <p className="hint">Wecker und Timer klingeln nur, solange diese App in einem offenen Tab läuft.</p>
        </>
      )}

      {ringing && (
        <div className="ringing" role="alertdialog" aria-label={ringing.title}>
          <div className="box">
            <div className="bell">🔔</div>
            <strong>{ringing.title}</strong>
            <div className="controls">
              <button className="primary" onClick={() => setRinging(null)}>
                Stopp
              </button>
              {ringing.alarmId && <button onClick={snooze}>Schlummern ({SNOOZE_MINUTES} Min)</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
