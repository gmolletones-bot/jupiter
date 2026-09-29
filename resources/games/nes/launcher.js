// Runs one of the bundled homebrew ROMs with jsnes (Apache-2.0), inside its own
// frame so the emulator's keyboard handling can't reach the browser's UI.
/* global jsnes */
;(async () => {
  const rom = new URLSearchParams(location.search).get('rom') || ''
  const screen = document.getElementById('screen')
  if (!/^[a-z0-9-]+\.nes$/.test(rom)) return

  const bytes = new Uint8Array(await (await fetch(`roms/${rom}`)).arrayBuffer())
  let data = ''
  for (let i = 0; i < bytes.length; i++) data += String.fromCharCode(bytes[i])

  const player = new jsnes.Browser({ container: screen, romData: data })
  addEventListener('resize', () => player.fitInParent())

  // The page hosting the frame pauses the game while it isn't visible.
  let paused = false
  addEventListener('message', (event) => {
    if (event.data === 'pause' && !paused) {
      paused = true
      player.stop()
    } else if (event.data === 'resume' && paused) {
      paused = false
      player.start()
    }
  })
  addEventListener('pointerdown', () => window.focus())
  window.focus()
})()
