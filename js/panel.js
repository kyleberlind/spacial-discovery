// The browse panel is a plain HTML div sitting over the canvas — text in the
// DOM beats text drawn into WebGL for something you actually want to read, and
// covers come free with <img>.

function panelEl() {
  return document.querySelector('#panel')
}

function panelIsOpen() {
  return panelEl().style.display === 'block'
}

// Film data comes off IMDb, so it arrives with whatever punctuation it likes,
// and all of it lands in innerHTML below. Nothing reaches there unescaped.
function escapeHTML(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

function filmCard(film) {
  // IMDb drops and re-IDs its artwork, so some films have no cover to point at
  // and others will rot later. A missing one gets a box of the same size with
  // the title in it, so the grid doesn't lurch — and `alt` means a URL that
  // dies tomorrow degrades into that same box on its own.
  const art = film.poster
    ? `<img class="art" src="${escapeHTML(film.poster)}" alt="${escapeHTML(film.title)}" loading="lazy">`
    : `<span class="art none">${escapeHTML(film.title)}</span>`

  return (
    '<li class="film">' +
    `<a href="${escapeHTML(film.imdb)}" target="_blank" rel="noreferrer">` +
    art +
    `<b>${escapeHTML(film.title)}</b></a>` +
    `<span>${film.year} · ★ ${film.rating}</span>` +
    `<span>${escapeHTML(film.genre.join(', '))}</span>` +
    `<span>dir. ${escapeHTML(film.director)}</span>` +
    `<span>${escapeHTML(film.cast.join(', '))}</span>` +
    '</li>'
  )
}

function openPanel(label, films) {
  panelEl().innerHTML =
    `<h2>${escapeHTML(label)}<em>${films.length} films</em></h2>` +
    `<ul>${films.map(filmCard).join('')}</ul>` +
    '<small>SPACE to close · click a cover for IMDb</small>'
  panelEl().style.display = 'block'
  panelEl().scrollTop = 0
}

function closePanel() {
  panelEl().style.display = 'none'
}

function showPrompt(text) {
  const el = document.querySelector('#prompt')
  el.textContent = text || ''
  el.style.display = text ? 'block' : 'none'
}
