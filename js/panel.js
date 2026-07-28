// The browse panel is a plain HTML div sitting over the canvas — text in the
// DOM beats text drawn into WebGL for something you actually want to read.

function panelEl() {
  return document.querySelector('#panel')
}

function panelIsOpen() {
  return panelEl().style.display === 'block'
}

function openPanel(genre, titles) {
  panelEl().innerHTML =
    `<h2>${genre}</h2><ul>` +
    titles.map((t) => `<li>${t}</li>`).join('') +
    '</ul><small>SPACE to close</small>'
  panelEl().style.display = 'block'
}

function closePanel() {
  panelEl().style.display = 'none'
}

function showPrompt(text) {
  const el = document.querySelector('#prompt')
  el.textContent = text || ''
  el.style.display = text ? 'block' : 'none'
}
