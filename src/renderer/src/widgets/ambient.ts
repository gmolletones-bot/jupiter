// Ambient sounds synthesized with the Web Audio API: no audio files needed,
// so nothing to download or license. One shared engine for the whole window,
// so sounds keep playing while you switch tabs.

export const SOUNDS = [
  { id: 'rain', name: 'Lluvia', icon: '🌧️' },
  { id: 'fire', name: 'Chimenea', icon: '🔥' },
  { id: 'waves', name: 'Olas', icon: '🌊' },
  { id: 'wind', name: 'Viento', icon: '🍃' },
  { id: 'white', name: 'Ruido blanco', icon: '📻' },
  { id: 'brown', name: 'Ruido marrón', icon: '🟤' }
] as const

export type SoundId = (typeof SOUNDS)[number]['id']

interface Channel {
  gain: GainNode
  stop: () => void
}

let context: AudioContext | undefined
const channels = new Map<SoundId, Channel>()
const buffers = new Map<string, AudioBuffer>()

function audio(): AudioContext {
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

/** A few seconds of looping noise: white, pink (softer highs) or brown (deep). */
function noise(kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const cached = buffers.get(kind)
  if (cached) return cached
  const ctx = audio()
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  const pink = [0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (kind === 'white') {
      data[i] = white * 0.5
    } else if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      // Paul Kellet's pink noise filter.
      pink[0] = 0.99886 * pink[0] + white * 0.0555179
      pink[1] = 0.99332 * pink[1] + white * 0.0750759
      pink[2] = 0.969 * pink[2] + white * 0.153852
      pink[3] = 0.8665 * pink[3] + white * 0.3104856
      pink[4] = 0.55 * pink[4] + white * 0.5329522
      pink[5] = -0.7616 * pink[5] - white * 0.016898
      data[i] = (pink.reduce((sum, value) => sum + value, 0) + white * 0.5362) * 0.11
      pink[6] = white * 0.115926
    }
  }
  buffers.set(kind, buffer)
  return buffer
}

function loop(kind: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const source = audio().createBufferSource()
  source.buffer = noise(kind)
  source.loop = true
  source.start()
  return source
}

function filter(type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const node = audio().createBiquadFilter()
  node.type = type
  node.frequency.value = frequency
  node.Q.value = q
  return node
}

/** Slow oscillator that modulates `target` by ±`depth`. */
function lfo(rate: number, depth: number, target: AudioParam): OscillatorNode {
  const ctx = audio()
  const oscillator = ctx.createOscillator()
  const amount = ctx.createGain()
  oscillator.frequency.value = rate
  amount.gain.value = depth
  oscillator.connect(amount).connect(target)
  oscillator.start()
  return oscillator
}

function build(id: SoundId, output: GainNode): () => void {
  const ctx = audio()
  const nodes: AudioScheduledSourceNode[] = []

  switch (id) {
    case 'white': {
      const source = loop('white')
      source.connect(filter('lowpass', 9000)).connect(output)
      nodes.push(source)
      break
    }
    case 'brown': {
      const source = loop('brown')
      source.connect(output)
      nodes.push(source)
      break
    }
    case 'rain': {
      const source = loop('pink')
      source.connect(filter('highpass', 400)).connect(filter('lowpass', 7000)).connect(output)
      nodes.push(source)
      break
    }
    case 'waves': {
      const swell = ctx.createGain()
      swell.gain.value = 0.55
      const source = loop('brown')
      source.connect(filter('lowpass', 1100)).connect(swell).connect(output)
      nodes.push(source, lfo(0.09, 0.45, swell.gain))
      break
    }
    case 'wind': {
      const band = filter('bandpass', 450, 0.9)
      const source = loop('pink')
      source.connect(band).connect(output)
      nodes.push(source, lfo(0.06, 280, band.frequency))
      break
    }
    case 'fire': {
      const rumble = loop('brown')
      const rumbleGain = ctx.createGain()
      rumbleGain.gain.value = 0.5
      rumble.connect(filter('lowpass', 350)).connect(rumbleGain).connect(output)
      nodes.push(rumble)
      // Random short noise bursts sound like crackling wood.
      const crackles = filter('highpass', 1800)
      crackles.connect(output)
      const timer = setInterval(() => {
        if (Math.random() > 0.35) return
        const pop = ctx.createBufferSource()
        const envelope = ctx.createGain()
        const now = ctx.currentTime
        pop.buffer = noise('white')
        envelope.gain.setValueAtTime(0.6 + Math.random() * 0.8, now)
        envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.02 + Math.random() * 0.05)
        pop.connect(envelope).connect(crackles)
        pop.start(now, Math.random() * 3, 0.08)
      }, 70)
      return () => {
        clearInterval(timer)
        nodes.forEach((node) => node.stop())
        crackles.disconnect()
      }
    }
  }
  return () => nodes.forEach((node) => node.stop())
}

export function startSound(id: SoundId, volume: number): void {
  if (channels.has(id)) return
  const ctx = audio()
  const gain = ctx.createGain()
  gain.gain.value = volume
  gain.connect(ctx.destination)
  const stopNodes = build(id, gain)
  channels.set(id, {
    gain,
    stop: () => {
      stopNodes()
      gain.disconnect()
    }
  })
}

export function stopSound(id: SoundId): void {
  channels.get(id)?.stop()
  channels.delete(id)
}

export function setSoundVolume(id: SoundId, volume: number): void {
  const channel = channels.get(id)
  if (channel) channel.gain.gain.setTargetAtTime(volume, audio().currentTime, 0.05)
}

/** Three soft ascending notes, used when a focus/break period ends. */
export function playChime(): void {
  const ctx = audio()
  ;[523.25, 659.25, 783.99].forEach((frequency, index) => {
    const start = ctx.currentTime + index * 0.18
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    oscillator.connect(envelope).connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 1)
  })
}
