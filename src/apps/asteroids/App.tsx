import { useCallback, useEffect, useState } from 'react'
import GameCanvas from './GameCanvas'
import { startTitleMusic } from './music'

const HIGH_SCORE_KEY = 'asteroids-highscore' // nur lokal im Browser, kein Supabase-Table nötig

function loadHighScore(): number {
  const raw = Number(localStorage.getItem(HIGH_SCORE_KEY))
  return Number.isFinite(raw) ? raw : 0
}

function TitleScreen({
  onStart,
  highScore,
  muted,
  onToggleMute,
}: {
  onStart: () => void
  highScore: number
  muted: boolean
  onToggleMute: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') onStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStart])

  return (
    <div className="title-screen">
      <button className="mute" onClick={onToggleMute} aria-label={muted ? 'Ton an' : 'Ton aus'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <h1>
        Asteroiden
        <br />
        Ballern
      </h1>
      <p className="hint">Leertaste oder Tippen zum Start</p>
      {highScore > 0 && <p className="highscore">Highscore: {highScore}</p>}
      <button className="start" onClick={onStart}>
        Start
      </button>
      <p className="controls-hint">Pfeiltasten/A-D bewegen · Leertaste schießt</p>
    </div>
  )
}

export default function AsteroidsApp() {
  const [phase, setPhase] = useState<'title' | 'playing' | 'gameover'>('title')
  const [lastScore, setLastScore] = useState(0)
  const [highScore, setHighScore] = useState(loadHighScore)
  const [muted, setMuted] = useState(false)
  const [runId, setRunId] = useState(0) // erzwingt per key einen frischen GameCanvas-Mount bei Neustart

  useEffect(() => {
    if (phase !== 'title' || muted) return
    return startTitleMusic()
  }, [phase, muted])

  const handleGameOver = useCallback((score: number) => {
    setLastScore(score)
    setHighScore((prev) => {
      if (score > prev) {
        localStorage.setItem(HIGH_SCORE_KEY, String(score))
        return score
      }
      return prev
    })
    setPhase('gameover')
  }, [])

  function start() {
    setRunId((id) => id + 1)
    setPhase('playing')
  }

  return (
    <div className="asteroids">
      {phase === 'title' && (
        <TitleScreen onStart={start} highScore={highScore} muted={muted} onToggleMute={() => setMuted((m) => !m)} />
      )}
      {phase === 'playing' && <GameCanvas key={runId} onGameOver={handleGameOver} />}
      {phase === 'gameover' && (
        <div className="game-over">
          <h1>Game Over</h1>
          <p className="score">Punkte: {lastScore}</p>
          {lastScore > 0 && lastScore === highScore && <p className="new-record">🎉 Neuer Highscore!</p>}
          <div className="actions">
            <button onClick={start}>Nochmal spielen</button>
            <button onClick={() => setPhase('title')}>Zum Titelbildschirm</button>
          </div>
        </div>
      )}
    </div>
  )
}
