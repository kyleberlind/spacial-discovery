// Enough of a browser for Phaser to require() and boot under Node.
// Phaser has no headless story of its own, so this is the scaffolding.
const path = require('path')
const { JSDOM } = require('jsdom')

// file:// so the test loads img/ straight off disk -- no dev server needed.
const dom = new JSDOM(
  '<!doctype html><html><body>' +
    '<div id="game"></div><div id="panel"></div><div id="prompt"></div>' +
    '</body></html>',
  {
    pretendToBeVisual: true,
    resources: 'usable',
    url: 'file://' + path.join(__dirname, '..') + '/index.html'
  }
)

global.window = dom.window
global.document = dom.window.document
global.self = dom.window
// Phaser pokes at DOM globals at require() time, so copy everything across
// before it's loaded rather than guessing which ones it needs.
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (!(k in global) && !k.startsWith('_')) {
    try { global[k] = dom.window[k] } catch {}
  }
}
global.navigator = dom.window.navigator
global.requestAnimationFrame = dom.window.requestAnimationFrame
global.cancelAnimationFrame = dom.window.cancelAnimationFrame

// jsdom has no URL.createObjectURL, and Node's rejects a jsdom Blob. Phaser
// loads every image through one, so hand it a data: URI instead.
const { implSymbol } = require('jsdom/lib/jsdom/living/generated/utils')
global.URL.createObjectURL = (blob) => {
  const buf = blob[implSymbol]._buffer
  return `data:${blob.type || 'application/octet-stream'};base64,${buf.toString('base64')}`
}
global.URL.revokeObjectURL = () => {}
dom.window.URL.createObjectURL = global.URL.createObjectURL
dom.window.URL.revokeObjectURL = global.URL.revokeObjectURL

// jsdom throws on these; Phaser calls them during boot and fullscreen.
dom.window.focus = () => {}
dom.window.blur = () => {}
global.focus = dom.window.focus
global.blur = dom.window.blur

module.exports = dom
