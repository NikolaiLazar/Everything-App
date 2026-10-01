// Reine Spiel-Logik für "Asteroiden Ballern" (Space-Invaders-Klon): Zustand, Update-Schritt
// und Kollisionen, ganz ohne Canvas-/DOM-Zugriff – das Zeichnen übernimmt GameCanvas.tsx.
// step() mutiert den übergebenen State direkt statt ihn zu kopieren: der State läuft über
// einen Ref in GameCanvas (nicht über React-State), daher gibt es bei bis zu 60 Aufrufen pro
// Sekunde keinen Grund für Immutable-Updates – das wäre nur unnötiger Allocation-Druck.

export const WIDTH = 480
export const HEIGHT = 600
export const PLAYER_WIDTH = 36
export const PLAYER_HEIGHT = 16
export const PLAYER_Y = HEIGHT - 36
export const ASTEROID_SIZE = 26
const ASTEROID_COLS = 8
const ASTEROID_ROWS = 4
const ASTEROID_GAP_X = 14
const ASTEROID_GAP_Y = 22

const PLAYER_SPEED = 260 // px/s
const BULLET_SPEED = 420
const ENEMY_BULLET_SPEED = 180
const FIRE_COOLDOWN = 0.35
const BULLET_W = 4
const BULLET_H = 10

export interface Bullet {
  x: number
  y: number
  vy: number
}

export interface Asteroid {
  x: number
  y: number
  alive: boolean
}

export interface GameState {
  playerX: number
  playerBullets: Bullet[]
  enemyBullets: Bullet[]
  asteroids: Asteroid[]
  direction: 1 | -1
  moveTimer: number
  moveInterval: number
  dropAmount: number
  fireCooldown: number
  level: number
  score: number
  lives: number
  gameOver: boolean
}

export interface Input {
  left: boolean
  right: boolean
  fire: boolean
}

function buildWave(level: number) {
  const asteroids: Asteroid[] = []
  const totalW = ASTEROID_COLS * (ASTEROID_SIZE + ASTEROID_GAP_X) - ASTEROID_GAP_X
  const startX = (WIDTH - totalW) / 2
  for (let row = 0; row < ASTEROID_ROWS; row++) {
    for (let col = 0; col < ASTEROID_COLS; col++) {
      asteroids.push({
        x: startX + col * (ASTEROID_SIZE + ASTEROID_GAP_X),
        y: 48 + row * (ASTEROID_SIZE + ASTEROID_GAP_Y),
        alive: true,
      })
    }
  }
  return {
    asteroids,
    direction: 1 as const,
    moveTimer: 0,
    // Jede Welle bewegt sich etwas schneller; ab Level ~10 greift die Untergrenze.
    moveInterval: Math.max(0.15, 0.85 - level * 0.07),
    dropAmount: 16,
  }
}

export function createGameState(level = 1, score = 0, lives = 3): GameState {
  return {
    playerX: WIDTH / 2 - PLAYER_WIDTH / 2,
    playerBullets: [],
    enemyBullets: [],
    fireCooldown: 0,
    level,
    score,
    lives,
    gameOver: false,
    ...buildWave(level),
  }
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

export function step(state: GameState, dt: number, input: Input): void {
  if (state.gameOver) return

  // Spieler bewegen
  if (input.left) state.playerX -= PLAYER_SPEED * dt
  if (input.right) state.playerX += PLAYER_SPEED * dt
  state.playerX = Math.max(0, Math.min(WIDTH - PLAYER_WIDTH, state.playerX))

  // Spieler-Schuss
  state.fireCooldown = Math.max(0, state.fireCooldown - dt)
  if (input.fire && state.fireCooldown <= 0) {
    state.playerBullets.push({ x: state.playerX + PLAYER_WIDTH / 2 - BULLET_W / 2, y: PLAYER_Y - 8, vy: -BULLET_SPEED })
    state.fireCooldown = FIRE_COOLDOWN
  }
  for (const b of state.playerBullets) b.y += b.vy * dt
  state.playerBullets = state.playerBullets.filter((b) => b.y > -20)

  // Asteroiden-Formation bewegen (wie bei Space Invaders: als Block, mit Richtungswechsel + Absenken am Rand)
  state.moveTimer += dt
  if (state.moveTimer >= state.moveInterval) {
    state.moveTimer = 0
    const alive = state.asteroids.filter((a) => a.alive)
    const minX = alive.length ? Math.min(...alive.map((a) => a.x)) : 0
    const maxX = alive.length ? Math.max(...alive.map((a) => a.x + ASTEROID_SIZE)) : WIDTH
    let dropNow = false
    if (state.direction === 1 && maxX >= WIDTH - 4) {
      state.direction = -1
      dropNow = true
    } else if (state.direction === -1 && minX <= 4) {
      state.direction = 1
      dropNow = true
    }
    for (const a of state.asteroids) {
      if (!a.alive) continue
      if (dropNow) a.y += state.dropAmount
      else a.x += state.direction * 10
    }
  }

  // Gegner-Schüsse bewegen + gelegentlich neue abfeuern
  for (const b of state.enemyBullets) b.y += b.vy * dt
  state.enemyBullets = state.enemyBullets.filter((b) => b.y < HEIGHT + 20)

  const aliveAsteroids = state.asteroids.filter((a) => a.alive)
  if (aliveAsteroids.length > 0 && Math.random() < dt * (0.4 + state.level * 0.08)) {
    const shooter = aliveAsteroids[Math.floor(Math.random() * aliveAsteroids.length)]
    state.enemyBullets.push({ x: shooter.x + ASTEROID_SIZE / 2 - BULLET_W / 2, y: shooter.y + ASTEROID_SIZE, vy: ENEMY_BULLET_SPEED })
  }

  // Kollisionen: Spieler-Schuss vs. Asteroid
  for (const bullet of state.playerBullets) {
    if (bullet.y < -500) continue
    for (const asteroid of state.asteroids) {
      if (!asteroid.alive) continue
      if (rectsOverlap(bullet.x, bullet.y, BULLET_W, BULLET_H, asteroid.x, asteroid.y, ASTEROID_SIZE, ASTEROID_SIZE)) {
        asteroid.alive = false
        bullet.y = -9999 // zum Entfernen markieren
        state.score += 10 + state.level * 2
      }
    }
  }
  state.playerBullets = state.playerBullets.filter((b) => b.y > -1000)

  // Kollisionen: Gegner-Schuss vs. Spieler
  state.enemyBullets = state.enemyBullets.filter((b) => {
    if (rectsOverlap(b.x, b.y, BULLET_W, BULLET_H, state.playerX, PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
      state.lives -= 1
      return false
    }
    return true
  })

  // Invasion: ein Asteroid hat die Spielerzeile erreicht
  const invaded = state.asteroids.some((a) => a.alive && a.y + ASTEROID_SIZE >= PLAYER_Y)
  if (state.lives <= 0 || invaded) {
    state.gameOver = true
    return
  }

  // Welle geschafft -> nächstes, schwereres Level
  if (!state.asteroids.some((a) => a.alive)) {
    state.level += 1
    Object.assign(state, buildWave(state.level))
  }
}
