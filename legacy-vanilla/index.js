// The engine: camera, input, movement, collision, and moving between places.
// Everywhere you can actually walk lives in places/ — see js/place.js.

const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

// The canvas fills the window, but the world is zoomed so you always see the
// same amount of it vertically — otherwise a big monitor just reveals more map
// and the sprites turn into ants.
const VIEW_HEIGHT = 576
let zoom = 1

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  zoom = canvas.height / VIEW_HEIGHT
  c.imageSmoothingEnabled = false // resetting width/height clears context state
}
resize()
window.addEventListener('resize', resize)

const SPEED = 3

// Everything lives in world coordinates; the camera does the scrolling.
const camera = { x: 0, y: 0 }

const player = new Sprite({
  position: { ...PLACES.island.spawn },
  image: image('./img/playerDown.png'),
  frames: { max: 4, hold: 10 },
  sprites: {
    up: image('./img/playerUp.png'),
    down: image('./img/playerDown.png'),
    left: image('./img/playerLeft.png'),
    right: image('./img/playerRight.png')
  }
})

const MOVES = {
  w: { x: 0, y: -SPEED, sprite: 'up' },
  s: { x: 0, y: SPEED, sprite: 'down' },
  a: { x: -SPEED, y: 0, sprite: 'left' },
  d: { x: SPEED, y: 0, sprite: 'right' }
}

const keys = { w: false, a: false, s: false, d: false }
let lastKey = ''
let place = PLACES.island
let doorArmed = true // stops the door you just came out of from sucking you back in
let panelOpen = false

const panel = document.querySelector('#panel')

function enter(door) {
  const dest = PLACES[door.to]
  // Land on the far side of the door leading back the way we came, so neither
  // place has to know the other's coordinates.
  const back = dest.doors.find((d) => d.to === place.name)
  place = dest
  player.position = { ...(back ? back.landing : dest.spawn) }
  doorArmed = false
  closePanel()
}

function openPanel(shelf) {
  panel.innerHTML =
    `<h2>${shelf.genre}</h2><ul>` +
    shelf.titles.map((t) => `<li>${t}</li>`).join('') +
    '</ul><small>SPACE to close</small>'
  panel.style.display = 'block'
  panelOpen = true
}

function closePanel() {
  panel.style.display = 'none'
  panelOpen = false
}

function blocked(pos) {
  const box = hitbox(pos)
  return place.boundaries.some((b) => overlaps(box, b))
}

function animate() {
  requestAnimationFrame(animate)

  const move = !panelOpen && keys[lastKey] ? MOVES[lastKey] : null
  if (move) {
    player.image = player.sprites[move.sprite]
    player.animate = true
    const next = { x: player.position.x + move.x, y: player.position.y + move.y }
    // Slide along walls instead of sticking: retry each axis on its own.
    if (!blocked(next)) player.position = next
    else if (!blocked({ ...player.position, x: next.x })) player.position.x = next.x
    else if (!blocked({ ...player.position, y: next.y })) player.position.y = next.y
  } else {
    player.animate = false
  }

  const box = hitbox(player.position)
  const inDoor = place.doors.find((d) => overlaps(box, d))
  if (!inDoor) doorArmed = true
  else if (doorArmed) return enter(inDoor)

  player.near = place.shelves.find((s) => overlaps(box, inflate(s, 6)))

  camera.x = player.position.x + 24 - canvas.width / zoom / 2
  camera.y = player.position.y + 34 - canvas.height / zoom / 2

  c.fillStyle = '#000'
  c.fillRect(0, 0, canvas.width, canvas.height)

  c.save()
  c.scale(zoom, zoom)
  c.translate(-Math.round(camera.x), -Math.round(camera.y))
  place.draw()
  player.draw()
  place.drawOver?.()
  c.restore()

  if (player.near && !panelOpen) {
    c.fillStyle = '#fff'
    c.font = `${Math.round(12 * zoom)}px "Press Start 2P", monospace`
    c.textAlign = 'center'
    c.fillText(`SPACE to browse ${player.near.genre}`, canvas.width / 2, canvas.height - 32 * zoom)
    c.textAlign = 'left'
  }
}
animate()

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (k === ' ' || e.code === 'Space') {
    e.preventDefault()
    if (panelOpen) closePanel()
    else if (player.near) openPanel(player.near)
    return
  }
  if (k === 'f') {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
    return
  }
  if (k === 'p') {
    const col = Math.floor((player.position.x + 24) / TILE)
    const row = Math.floor((player.position.y + 48) / TILE)
    console.log(`${place.name}: tile col ${col}, row ${row}`)
    return
  }
  if (k in keys) {
    keys[k] = true
    lastKey = k
  }
})

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k in keys) {
    keys[k] = false
    if (lastKey === k) lastKey = Object.keys(keys).find((other) => keys[other]) ?? ''
  }
})
