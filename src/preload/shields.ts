import { ipcRenderer, webFrame } from 'electron'

// Runs in every frame of every web page before the page's own scripts.
// Scriptlets (uBlock Origin's page patches, e.g. the ones that strip YouTube's
// ads) only work if they run first, so they are fetched synchronously here and
// injected straight into the page's main world — not after the page loaded.
try {
  const scripts: unknown = ipcRenderer.sendSync('shields:scriptlets', window.location.href)
  if (Array.isArray(scripts) && scripts.length > 0) {
    // Each scriptlet gets its own function scope: several of them declare the
    // same top-level helpers (e.g. `class JSONPath`), which would clash if they
    // shared the page's global scope. One call keeps them in order.
    const bundle = scripts
      .filter((script): script is string => typeof script === 'string')
      .map((script) => `try { (function () {\n${script}\n})(); } catch (error) {}`)
      .join('\n')
    webFrame.executeJavaScript(bundle).catch(() => undefined)
  }
} catch {
  // Never let the blocker break a page.
}
