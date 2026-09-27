// Alarmton per Web Audio API, damit keine Audiodatei ausgeliefert werden muss.
// Browser erlauben Ton erst nach einer Nutzerinteraktion auf der Seite; das ist beim Öffnen der App gegeben.

let ctx: AudioContext | null = null

function beep(at: number, audio: AudioContext) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'square'
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.2, at + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
  osc.connect(gain).connect(audio.destination)
  osc.start(at)
  osc.stop(at + 0.2)
}

/** Spielt wiederholt ein Piep-Muster, bis die zurückgegebene Stopp-Funktion aufgerufen wird. */
export function startAlarmSound(): () => void {
  ctx ??= new AudioContext()
  const audio = ctx
  void audio.resume()
  const pattern = () => {
    const t = audio.currentTime
    for (let i = 0; i < 4; i++) beep(t + i * 0.25, audio)
  }
  pattern()
  const id = window.setInterval(pattern, 1500)
  return () => window.clearInterval(id)
}
