import { useEffect, useRef, useState } from 'react'
import { ASTEROID_SIZE, HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_Y, WIDTH, createGameState, step, type GameState } from './game'

interface Props {
  onGameOver: (score: number) => void
}

export default function GameCanvas({ onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createGameState())
  const inputRef = useRef({ left: false, right: false, fire: false })
  const onGameOverRef = useRef(onGameOver)
  onGameOverRef.current = onGameOver
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = true
      if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault()
      if (e.key === ' ') inputRef.current.fire = true
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current.left = false
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current.right = false
      if (e.key === ' ') inputRef.current.fire = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let raf = 0
    let last = performance.now()
    let stopped = false

    function loop(now: number) {
      if (stopped) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const state = stateRef.current
      step(state, dt, inputRef.current)
      draw(ctx!, state)

      setHud((prev) =>
        prev.score === state.score && prev.lives === state.lives && prev.level === state.level
          ? prev
          : { score: state.score, lives: state.lives, level: state.level },
      )

      if (state.gameOver) {
        stopped = true
        onGameOverRef.current(state.score)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div className="game">
      <div className="hud">
        <span>Punkte: {hud.score}</span>
        <span>Leben: {'❤️'.repeat(Math.max(hud.lives, 0))}</span>
        <span>Welle {hud.level}</span>
      </div>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      <div className="touch-controls">
        <button
          onPointerDown={() => (inputRef.current.left = true)}
          onPointerUp={() => (inputRef.current.left = false)}
          onPointerLeave={() => (inputRef.current.left = false)}
          aria-label="Links"
        >
          ◀
        </button>
        <button
          onPointerDown={() => (inputRef.current.fire = true)}
          onPointerUp={() => (inputRef.current.fire = false)}
          onPointerLeave={() => (inputRef.current.fire = false)}
          aria-label="Feuer"
        >
          🔥
        </button>
        <button
          onPointerDown={() => (inputRef.current.right = true)}
          onPointerUp={() => (inputRef.current.right = false)}
          onPointerLeave={() => (inputRef.current.right = false)}
          aria-label="Rechts"
        >
          ▶
        </button>
      </div>
    </div>
  )
}

function draw(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = '#05050f'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Statischer Sternenhintergrund (Pseudo-Zufall per Index, damit er nicht flackert)
  ctx.fillStyle = '#ffffff33'
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 97) % WIDTH, (i * 53) % HEIGHT, 2, 2)
  }

  // Spieler (kleines Raumschiff als Dreieck)
  ctx.fillStyle = '#6ae36a'
  ctx.beginPath()
  ctx.moveTo(state.playerX + PLAYER_WIDTH / 2, PLAYER_Y)
  ctx.lineTo(state.playerX, PLAYER_Y + PLAYER_HEIGHT)
  ctx.lineTo(state.playerX + PLAYER_WIDTH, PLAYER_Y + PLAYER_HEIGHT)
  ctx.closePath()
  ctx.fill()

  // Asteroiden
  ctx.fillStyle = '#c99a6b'
  for (const a of state.asteroids) {
    if (!a.alive) continue
    ctx.beginPath()
    ctx.arc(a.x + ASTEROID_SIZE / 2, a.y + ASTEROID_SIZE / 2, ASTEROID_SIZE / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Schüsse
  ctx.fillStyle = '#ffe066'
  for (const b of state.playerBullets) ctx.fillRect(b.x, b.y, 4, 10)
  ctx.fillStyle = '#ff6b6b'
  for (const b of state.enemyBullets) ctx.fillRect(b.x, b.y, 4, 10)
}
