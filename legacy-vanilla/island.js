// The island — the overworld you walk around.
//
//   art        img/island.png, bare: every building is a separate sprite
//              img/island-foreground.png, drawn over you for depth
//   collision  data/island-collisions.js
//
// Both PNGs are generated from the upstream tutorial map by tools/split-map.py.

;(() => {
  const COLS = 70 // island.png is 3360x1920 === 70x40 tiles
  const SOLID = 1025

  // A building is its picture, where it stands, and the door in its front wall.
  // The door leads to the place registered under the same name — so a house is
  // one entry here, one PNG, and one file in places/.
  //
  // ponytail: `at` is in map pixels, not tiles, because that's where the art
  // was lifted from and the houses aren't tile-aligned vertically.
  const BUILDINGS = [
    {
      name: 'video-store',
      image: image('./img/video-store.png'),
      at: { x: 1824, y: 992 },
      door: { cols: [39, 40], row: 26 }
    }
  ]

  // Footprints of the two houses dropped from the art entirely. Only the
  // footprint — the bushes that flanked them are still there and still block.
  const ERASED = [{ cols: [24, 27], rows: [12, 17] }]

  const background = new Sprite({ position: { x: 0, y: 0 }, image: image('./img/island.png') })
  const foreground = new Sprite({
    position: { x: 0, y: 0 },
    image: image('./img/island-foreground.png')
  })

  const sprites = BUILDINGS.map((b) => new Sprite({ position: { ...b.at }, image: b.image }))

  const isDoorway = (col, row) =>
    BUILDINGS.some((b) => b.door.row === row && b.door.cols.includes(col))
  const isErased = (col, row) =>
    ERASED.some((r) => col >= r.cols[0] && col <= r.cols[1] && row >= r.rows[0] && row <= r.rows[1])

  // Buildings still take their collision from the Tiled grid, which was baked
  // when they were painted into the map. Moving a building's `at` moves the
  // picture but not the walls — you'd have to redo the grid to match.
  const boundaries = []
  islandCollisions.forEach((symbol, i) => {
    if (symbol !== SOLID) return
    const col = i % COLS
    const row = Math.floor(i / COLS)
    if (isDoorway(col, row) || isErased(col, row)) return
    boundaries.push(new Boundary({ position: { x: col * TILE, y: row * TILE } }))
  })

  const doors = BUILDINGS.map(({ name, door }) => ({
    position: { x: door.cols[0] * TILE, y: door.row * TILE },
    width: door.cols.length * TILE,
    height: TILE,
    to: name,
    // out on the street below the doorway, centred on it
    landing: {
      x: (door.cols[0] + door.cols.length / 2) * TILE - 24,
      y: (door.row + 1) * TILE + 10
    }
  }))

  PLACES.island = {
    name: 'island',
    spawn: { x: 25 * TILE, y: 19 * TILE },
    boundaries,
    doors,
    shelves: [],
    draw() {
      background.draw()
      for (const s of sprites) s.draw()
    },
    drawOver() {
      foreground.draw()
    }
  }
})()
