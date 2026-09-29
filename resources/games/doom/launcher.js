// Boots Chocolate Doom (cloudflare/doom-wasm, GPL-2.0) with Freedoom's IWAD
// (BSD-3). The engine and the WAD are downloaded by Jupiter on first use and
// served next to this page under engine/.
/* exported Module */
/* global FS, addRunDependency, removeRunDependency, callMain */
const canvas = document.getElementById('canvas')

const load = (name) =>
  fetch(name).then((response) => {
    if (!response.ok) throw new Error(`${name}: ${response.status}`)
    return response.arrayBuffer()
  })

// eslint-disable-next-line @typescript-eslint/no-unused-vars
var Module = {
  canvas,
  noInitialRun: true,
  locateFile: (path) => `engine/${path}`,
  preRun: [
    () => {
      addRunDependency('files')
      Promise.all([load('engine/freedoom1.wad'), load('default.cfg')])
        .then(([wad, config]) => {
          FS.writeFile('/freedoom1.wad', new Uint8Array(wad))
          FS.writeFile('/default.cfg', new Uint8Array(config))
          removeRunDependency('files')
        })
        .catch((error) => parent.postMessage({ type: 'doom-error', message: String(error) }, '*'))
    }
  ],
  onRuntimeInitialized: () => {
    callMain(['-iwad', 'freedoom1.wad', '-window', '-nogui', '-nomusic', '-config', 'default.cfg'])
    canvas.focus()
  },
  print: () => {},
  printErr: () => {}
}

addEventListener('pointerdown', () => canvas.focus())
