import { useEffect, useRef } from 'react'

interface OrbitRunnerProps {
  /** The game pauses while its tab or page isn't visible. */
  active: boolean
}

type Phase = 'ready' | 'playing' | 'paused' | 'over'

interface Rock {
  x: number
  y: number
  r: number
  speed: number
  angle: number
  spin: number
  /** Radius multipliers of the polygon's vertices, for a lumpy outline. */
  shape: number[]
}

interface Star {
  x: number
  y: number
  speed: number
  phase: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

const BEST_KEY = 'jupiter.orbit.best'
const SHIP_RADIUS = 11
const MAX_DT = 1 / 30

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // Private mode or storage disabled: the best score just isn't kept.
  }
}

/** Short synthesized blips, so the game needs no audio files. */
function createSound(): { play: (kind: 'star' | 'crash' | 'start') => void; close: () => void } {
  let context: AudioContext | null = null
  return {
    play(kind) {
      try {
        context ??= new AudioContext()
        const now = context.currentTime
        const gain = context.createGain()
        gain.connect(context.destination)
        if (kind === 'crash') {
          const length = context.sampleRate * 0.5
          const buffer = context.createBuffer(1, length, context.sampleRate)
          const data = buffer.getChannelData(0)
          for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
          const noise = context.createBufferSource()
          noise.buffer = buffer
          gain.gain.value = 0.25
          noise.connect(gain)
          noise.start(now)
          return
        }
        const oscillator = context.createOscillator()
        oscillator.type = kind === 'star' ? 'triangle' : 'sine'
        const [from, to] = kind === 'star' ? [880, 1760] : [220, 660]
        oscillator.frequency.setValueAtTime(from, now)
        oscillator.frequency.exponentialRampToValueAtTime(to, now + 0.12)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
        oscillator.connect(gain)
        oscillator.start(now)
        oscillator.stop(now + 0.2)
      } catch {
        // No audio device: play silently.
      }
    },
    close() {
      void context?.close().catch(() => {})
    }
  }
}

/** The static backdrop (space, far stars and Jupiter), drawn once per size. */
function drawBackdrop(width: number, height: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const g = canvas.getContext('2d')!
  g.scale(scale, scale)

  const space = g.createRadialGradient(
    width * 0.3,
    height * 0.2,
    0,
    width * 0.5,
    height * 0.5,
    width
  )
  space.addColorStop(0, '#2a1f63')
  space.addColorStop(0.5, '#140f38')
  space.addColorStop(1, '#07051a')
  g.fillStyle = space
  g.fillRect(0, 0, width, height)

  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.5})`
    g.fillRect(Math.random() * width, Math.random() * height, 1, 1)
  }

  // Jupiter rising from the bottom-right corner.
  const r = Math.max(width, height) * 0.42
  const cx = width * 0.88
  const cy = height + r * 0.45
  const glow = g.createRadialGradient(cx, cy, r, cx, cy, r * 1.15)
  glow.addColorStop(0, 'rgba(168,85,247,0.35)')
  glow.addColorStop(1, 'rgba(168,85,247,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, width, height)
  g.save()
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.clip()
  const bands = g.createLinearGradient(0, cy - r, 0, cy + r)
  const colors = ['#f4dcb8', '#e2b183', '#f6e3c6', '#c77b45', '#eecb9f', '#f8e7cf', '#b8683a']
  colors.forEach((color, index) => bands.addColorStop(index / (colors.length - 1), color))
  g.fillStyle = bands
  g.fillRect(cx - r, cy - r, r * 2, r * 2)
  g.fillStyle = 'rgba(200,80,47,0.85)'
  g.beginPath()
  g.ellipse(cx - r * 0.35, cy - r * 0.62, r * 0.13, r * 0.06, 0, 0, Math.PI * 2)
  g.fill()
  const shade = g.createRadialGradient(cx - r * 0.4, cy - r * 0.5, r * 0.1, cx, cy, r)
  shade.addColorStop(0, 'rgba(255,255,255,0.18)')
  shade.addColorStop(0.6, 'rgba(10,6,30,0.15)')
  shade.addColorStop(1, 'rgba(10,6,30,0.8)')
  g.fillStyle = shade
  g.fillRect(cx - r, cy - r, r * 2, r * 2)
  g.restore()

  return canvas
}

/** Jupiter's own offline game: steer a ship through an asteroid field and grab stars. */
function OrbitRunner({ active }: OrbitRunnerProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
    if (active) canvasRef.current?.focus()
  }, [active])

  useEffect(() => {
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const sound = createSound()
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#a855f7'

    let width = 0
    let height = 0
    let scale = 1
    let backdrop: HTMLCanvasElement | null = null
    let phase: Phase = 'ready'
    let best = readBest()
    let score = 0
    let elapsed = 0
    let shake = 0
    let spawnRock = 0
    let spawnStar = 2
    const ship = { x: 0, y: 0, vx: 0, vy: 0 }
    let rocks: Rock[] = []
    let stars: Star[] = []
    let particles: Particle[] = []
    const dust = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      depth: 0.3 + Math.random() * 0.7
    }))
    const keys = new Set<string>()
    let pointerY: number | null = null
    let frame = 0
    let last = performance.now()

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      scale = window.devicePixelRatio || 1
      canvas.width = width * scale
      canvas.height = height * scale
      backdrop = drawBackdrop(width, height, scale)
      if (phase === 'ready') {
        ship.x = width * 0.18
        ship.y = height / 2
      }
    }

    const start = (): void => {
      phase = 'playing'
      score = 0
      elapsed = 0
      spawnRock = 0.6
      spawnStar = 2
      rocks = []
      stars = []
      particles = []
      ship.x = width * 0.18
      ship.y = height / 2
      ship.vx = 0
      ship.vy = 0
      sound.play('start')
    }

    const crash = (): void => {
      phase = 'over'
      shake = 0.45
      sound.play('crash')
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 60 + Math.random() * 260
        particles.push({
          x: ship.x,
          y: ship.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.6 + Math.random() * 0.6,
          color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? accent : '#f59e0b'
        })
      }
      const final = Math.floor(score)
      if (final > best) {
        best = final
        saveBest(best)
      }
    }

    const update = (dt: number): void => {
      for (const particle of particles) {
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.vx *= 0.96
        particle.vy *= 0.96
        particle.life -= dt
      }
      particles = particles.filter((particle) => particle.life > 0)
      shake = Math.max(0, shake - dt)

      const speedFactor = phase === 'playing' ? 1 + elapsed / 35 : 0.35
      for (const speck of dust) {
        speck.x -= dt * 0.05 * speck.depth * speedFactor * 3
        if (speck.x < 0) {
          speck.x += 1
          speck.y = Math.random()
        }
      }
      if (phase !== 'playing') return

      elapsed += dt
      score += dt * 10 * speedFactor

      // Ship: arrows / WASD accelerate, or follow the pointer while it's held down.
      const accel = 1900
      const up = keys.has('ArrowUp') || keys.has('KeyW')
      const down = keys.has('ArrowDown') || keys.has('KeyS')
      const left = keys.has('ArrowLeft') || keys.has('KeyA')
      const right = keys.has('ArrowRight') || keys.has('KeyD')
      if (pointerY !== null)
        ship.vy += Math.max(-1, Math.min(1, (pointerY - ship.y) / 60)) * accel * dt
      if (up) ship.vy -= accel * dt
      if (down) ship.vy += accel * dt
      if (left) ship.vx -= accel * dt
      if (right) ship.vx += accel * dt
      ship.vx *= 0.9
      ship.vy *= 0.9
      ship.x = Math.max(24, Math.min(width * 0.6, ship.x + ship.vx * dt))
      ship.y = Math.max(16, Math.min(height - 16, ship.y + ship.vy * dt))

      spawnRock -= dt
      if (spawnRock <= 0) {
        spawnRock = Math.max(0.18, 0.9 - elapsed / 60) * (0.5 + Math.random())
        const r = 10 + Math.random() * 26
        rocks.push({
          x: width + r,
          y: Math.random() * height,
          r,
          speed: (140 + Math.random() * 160) * speedFactor,
          angle: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 3,
          shape: Array.from({ length: 9 }, () => 0.75 + Math.random() * 0.35)
        })
      }
      spawnStar -= dt
      if (spawnStar <= 0) {
        spawnStar = 1.5 + Math.random() * 2.5
        stars.push({
          x: width + 20,
          y: 30 + Math.random() * (height - 60),
          speed: 180 * speedFactor,
          phase: 0
        })
      }

      for (const rock of rocks) {
        rock.x -= rock.speed * dt
        rock.angle += rock.spin * dt
        if (Math.hypot(rock.x - ship.x, rock.y - ship.y) < rock.r * 0.85 + SHIP_RADIUS) {
          crash()
          return
        }
      }
      rocks = rocks.filter((rock) => rock.x > -rock.r * 2)

      for (const star of stars) {
        star.x -= star.speed * dt
        star.phase += dt * 6
        if (Math.hypot(star.x - ship.x, star.y - ship.y) < 22) {
          star.x = -100
          score += 50
          sound.play('star')
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2
            particles.push({
              x: ship.x,
              y: ship.y,
              vx: Math.cos(angle) * 140,
              vy: Math.sin(angle) * 140,
              life: 0.4,
              color: '#fde68a'
            })
          }
        }
      }
      stars = stars.filter((star) => star.x > -40)

      // Engine trail.
      if (Math.random() < 0.8) {
        particles.push({
          x: ship.x - 14,
          y: ship.y + (Math.random() - 0.5) * 5,
          vx: -120 - Math.random() * 80,
          vy: (Math.random() - 0.5) * 30,
          life: 0.25 + Math.random() * 0.2,
          color: accent
        })
      }
    }

    const drawShip = (): void => {
      context.save()
      context.translate(ship.x, ship.y)
      context.rotate(Math.max(-0.4, Math.min(0.4, ship.vy / 900)))
      context.shadowColor = accent
      context.shadowBlur = 16
      context.fillStyle = '#f5f3ff'
      context.beginPath()
      context.moveTo(16, 0)
      context.lineTo(-10, -10)
      context.lineTo(-5, 0)
      context.lineTo(-10, 10)
      context.closePath()
      context.fill()
      context.shadowBlur = 0
      context.fillStyle = accent
      context.beginPath()
      context.arc(3, 0, 3.5, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    const drawText = (text: string, y: number, size: number, alpha = 1): void => {
      context.globalAlpha = alpha
      context.font = `700 ${size}px system-ui, sans-serif`
      context.textAlign = 'center'
      context.fillStyle = '#ffffff'
      context.fillText(text, width / 2, y)
      context.globalAlpha = 1
    }

    const draw = (): void => {
      context.setTransform(scale, 0, 0, scale, 0, 0)
      if (shake > 0)
        context.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake)
      if (backdrop) context.drawImage(backdrop, 0, 0, width, height)

      for (const speck of dust) {
        context.fillStyle = `rgba(255,255,255,${0.25 + speck.depth * 0.5})`
        context.fillRect(speck.x * width, speck.y * height, speck.depth * 2.2, speck.depth * 2.2)
      }

      for (const star of stars) {
        const size = 9 + Math.sin(star.phase) * 2
        context.save()
        context.translate(star.x, star.y)
        context.rotate(star.phase / 4)
        context.shadowColor = '#fde68a'
        context.shadowBlur = 14
        context.fillStyle = '#fde68a'
        context.beginPath()
        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? size : size * 0.45
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
          context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        }
        context.closePath()
        context.fill()
        context.restore()
      }

      for (const rock of rocks) {
        context.save()
        context.translate(rock.x, rock.y)
        context.rotate(rock.angle)
        context.fillStyle = '#6b5b7b'
        context.strokeStyle = '#a597b8'
        context.lineWidth = 2
        context.beginPath()
        rock.shape.forEach((k, i) => {
          const angle = (i / rock.shape.length) * Math.PI * 2
          context.lineTo(Math.cos(angle) * rock.r * k, Math.sin(angle) * rock.r * k)
        })
        context.closePath()
        context.fill()
        context.stroke()
        context.fillStyle = 'rgba(0,0,0,0.25)'
        context.beginPath()
        context.arc(rock.r * 0.25, -rock.r * 0.2, rock.r * 0.22, 0, Math.PI * 2)
        context.fill()
        context.restore()
      }

      for (const particle of particles) {
        context.globalAlpha = Math.min(1, particle.life * 2)
        context.fillStyle = particle.color
        context.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3)
      }
      context.globalAlpha = 1

      if (phase !== 'over') drawShip()

      context.font = '600 15px system-ui, sans-serif'
      context.textAlign = 'left'
      context.fillStyle = 'rgba(255,255,255,0.9)'
      context.fillText(`${Math.floor(score)}`, 16, 28)
      context.textAlign = 'right'
      context.fillStyle = 'rgba(255,255,255,0.6)'
      context.fillText(`Récord ${best}`, width - 16, 28)

      if (phase === 'ready') {
        drawText('Órbita', height / 2 - 30, 40)
        drawText('Esquiva los asteroides y atrapa las estrellas', height / 2 + 6, 16, 0.8)
        drawText(
          'Espacio o clic para empezar · Flechas o WASD para moverte',
          height / 2 + 34,
          14,
          0.6
        )
      } else if (phase === 'paused') {
        drawText('Pausa', height / 2 - 6, 34)
        drawText('Espacio para seguir', height / 2 + 24, 14, 0.7)
      } else if (phase === 'over') {
        drawText('¡Choque!', height / 2 - 30, 38)
        drawText(`Puntos: ${Math.floor(score)}`, height / 2 + 6, 18, 0.9)
        drawText('Espacio o clic para volver a intentarlo', height / 2 + 34, 14, 0.6)
      }
    }

    const loop = (now: number): void => {
      const dt = Math.min(MAX_DT, (now - last) / 1000)
      last = now
      if (!activeRef.current && phase === 'playing') phase = 'paused'
      if (phase !== 'paused') update(dt)
      draw()
      frame = requestAnimationFrame(loop)
    }

    const primary = (): void => {
      if (phase === 'playing') return
      if (phase === 'paused') phase = 'playing'
      else start()
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        if (phase === 'playing' && event.code === 'Space') phase = 'paused'
        else primary()
        return
      }
      if (event.code === 'Escape' && phase === 'playing') phase = 'paused'
      if (event.code.startsWith('Arrow')) event.preventDefault()
      keys.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      keys.delete(event.code)
    }
    const onBlur = (): void => {
      keys.clear()
      if (phase === 'playing') phase = 'paused'
    }
    const localY = (event: PointerEvent): number =>
      event.clientY - canvas.getBoundingClientRect().top
    const onPointerDown = (event: PointerEvent): void => {
      canvas.focus()
      if (phase !== 'playing') primary()
      pointerY = localY(event)
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (pointerY !== null) pointerY = localY(event)
    }
    const onPointerUp = (): void => {
      pointerY = null
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    canvas.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('blur', onBlur)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.focus()
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      sound.close()
    }
  }, [])

  return <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Juego Órbita" />
}

export default OrbitRunner
