// Titelmelodie per Web Audio API, damit keine Audiodatei ausgeliefert werden muss (gleicher
// Ansatz wie clock/sound.ts). Browser erlauben Ton erst nach einer Nutzerinteraktion auf der
// Seite; das ist beim Öffnen der App über das Menü gegeben. Die Melodie ist eine eigene,
// kleine Arcade-artige Komposition (keine Übernahme einer bestehenden Spielmusik).

let ctx: AudioContext | null = null

type Note = [freq: number, beats: number]

const MELODY: Note[] = [
  [392, 1], [392, 1], [392, 1], [311, 1.5], [466, 0.5],
  [392, 1], [311, 1.5], [466, 0.5], [392, 2],
  [587, 1], [587, 1], [587, 1], [622, 1.5], [466, 0.5],
  [370, 1], [311, 1.5], [466, 0.5], [392, 2],
]

const BPM = 150
const BEAT = 60 / BPM

function playNote(freq: number, startAt: number, dur: number, audio: AudioContext) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  const end = startAt + dur
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.15, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain).connect(audio.destination)
  osc.start(startAt)
  osc.stop(end + 0.02)
}

/** Spielt die Titelmelodie in Dauerschleife, bis die zurückgegebene Stopp-Funktion aufgerufen wird. */
export function startTitleMusic(): () => void {
  ctx ??= new AudioContext()
  const audio = ctx
  void audio.resume()
  let stopped = false
  let timeoutId = 0

  function scheduleLoop() {
    if (stopped) return
    const start = audio.currentTime + 0.05
    let t = start
    for (const [freq, beats] of MELODY) {
      playNote(freq, t, beats * BEAT * 0.9, audio)
      t += beats * BEAT
    }
    timeoutId = window.setTimeout(scheduleLoop, (t - start) * 1000)
  }
  scheduleLoop()

  return () => {
    stopped = true
    window.clearTimeout(timeoutId)
  }
}
