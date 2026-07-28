// The video store — inside the house at the bottom of the island.
//
// No art: the room is drawn with rectangles, and its size comes from the data.
// One entry in data/movies.js === one aisle, and the room widens to fit.

;(() => {
  const ROWS = 12
  const COLS = 3 + MOVIES.length * 5
  const DOOR_COL = Math.floor(COLS / 2)

  const AISLE_TOP = 3
  const AISLE_ROWS = 7
  const AISLE_COLS = 2

  const boundaries = []
  const shelves = []

  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      const isWall = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1
      const isDoor = x === DOOR_COL && y === ROWS - 1
      if (isWall && !isDoor) boundaries.push(new Boundary({ position: { x: x * TILE, y: y * TILE } }))
    }
  }

  MOVIES.forEach((entry, i) => {
    const shelf = {
      position: { x: (3 + i * 5) * TILE, y: AISLE_TOP * TILE },
      width: AISLE_COLS * TILE,
      height: AISLE_ROWS * TILE,
      ...entry
    }
    shelves.push(shelf)
    boundaries.push(shelf) // an aisle is a wall you can also read
  })

  function drawShelf({ position, width, height, genre, titles }) {
    c.fillStyle = '#6b4a2f'
    c.fillRect(position.x, position.y, width, height)
    c.fillStyle = '#2c1d12'
    c.fillRect(position.x + 6, position.y + 6, width - 12, height - 12)

    // one spine per title
    titles.forEach((title, i) => {
      const perRow = 5
      const sw = (width - 20) / perRow
      const sh = 26
      const x = position.x + 10 + (i % perRow) * sw
      const y = position.y + 14 + Math.floor(i / perRow) * (sh + 10)
      c.fillStyle = `hsl(${(title.length * 47 + i * 63) % 360} 55% 55%)`
      c.fillRect(x, y, sw - 3, sh)
    })

    c.fillStyle = '#f4d35e'
    c.font = '10px "Press Start 2P", monospace'
    c.fillText(genre, position.x, position.y - 10)
  }

  PLACES['video-store'] = {
    name: 'video-store',
    spawn: { x: DOOR_COL * TILE, y: (ROWS - 3) * TILE },
    boundaries,
    shelves,
    doors: [
      {
        position: { x: DOOR_COL * TILE, y: (ROWS - 1) * TILE },
        width: TILE,
        height: TILE,
        to: 'island',
        landing: { x: DOOR_COL * TILE, y: (ROWS - 3) * TILE } // just inside the mat
      }
    ],
    draw() {
      for (let x = 1; x < COLS - 1; x++) {
        for (let y = 1; y < ROWS - 1; y++) {
          c.fillStyle = (x + y) % 2 ? '#3b3f4a' : '#434855'
          c.fillRect(x * TILE, y * TILE, TILE, TILE)
        }
      }

      c.fillStyle = '#23262e'
      for (const b of boundaries) {
        if (b.genre) continue // aisles draw themselves
        c.fillRect(b.position.x, b.position.y, b.width, b.height)
      }

      c.fillStyle = '#8a5a3b'
      c.fillRect(DOOR_COL * TILE, (ROWS - 1) * TILE, TILE, TILE)

      for (const shelf of shelves) drawShelf(shelf)

      c.fillStyle = '#f4d35e'
      c.font = '14px "Press Start 2P", monospace'
      c.fillText('VIDEO', TILE + 8, TILE + 30)
    }
  }
})()
