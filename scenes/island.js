// The island — the overworld.
//
//   img/island.png             the ground, bare: no buildings painted into it
//   img/island-foreground.png  treetops, drawn over you so you pass behind them
//   data/island-collisions.js  terrain collision (cliffs, water, tree lines)
//
// Terrain collision is a tile grid because terrain *is* a grid. Buildings are
// not: each one below carries its own walls and its own doorway, in its own
// coordinates, so moving a building moves everything about it.

const ISLAND_COLS = 70 // island.png is 3360x1920 === 70x40 tiles
const ISLAND_ROWS = 40
const SOLID = 1025 // what the Tiled export marks impassable tiles with

// Footprints of the two houses painted out of the art by tools/split-map.py.
// Their collision has to go with them. Only the footprint — the bushes that
// flanked them are still drawn, and still block.
const DEMOLISHED = [
  { cols: [24, 27], rows: [12, 17] }, // the one that stood by the trees
  { cols: [43, 48], rows: [7, 13] } // the one up on the plateau
]

const BUILDINGS = [
  {
    name: 'video-store', // also the key of the scene its door leads to
    texture: 'video-store',
    at: { x: 1824, y: 992 }, // printed by tools/split-map.py
    // All relative to `at`. The sprite is 288x304: roof down to y=256, then the
    // front wall with the arch cut out of it.
    solid: [
      { x: 0, y: 96, w: 288, h: 160 }, // roof and upper walls
      { x: 0, y: 256, w: 48, h: 48 }, // front wall, left of the door
      { x: 144, y: 256, w: 52, h: 48 } // front wall, right of the door
    ],
    door: { x: 48, y: 256, w: 96, h: 48 },
    landing: { x: 1920, y: 1300 } // out on the street, below the arch
  }
]

class Island extends WalkScene {
  constructor() {
    super('island')
  }

  loadPlace() {
    this.load.image('island', './img/island.png')
    this.load.image('island-foreground', './img/island-foreground.png')
    for (const b of BUILDINGS) this.load.image(b.texture, `./img/${b.texture}.png`)
  }

  buildPlace() {
    this.worldSize = { width: ISLAND_COLS * TILE, height: ISLAND_ROWS * TILE }
    this.spawn = { x: 1224, y: 946 }

    this.add.image(0, 0, 'island').setOrigin(0, 0).setDepth(0)

    // Every tile a building stands on comes out of the terrain grid, because
    // the building brings its own walls and its own doorway. Derived from where
    // the sprite actually sits, so moving a building moves this with it.
    const covered = BUILDINGS.map((b) => {
      const art = this.textures.get(b.texture).getSourceImage()
      return {
        cols: [Math.floor(b.at.x / TILE), Math.floor((b.at.x + art.width - 1) / TILE)],
        rows: [Math.floor(b.at.y / TILE), Math.floor((b.at.y + art.height - 1) / TILE)]
      }
    })
    this.solids.push(this.buildTerrain(covered.concat(DEMOLISHED)))

    for (const b of BUILDINGS) {
      this.add.image(b.at.x, b.at.y, b.texture).setOrigin(0, 0).setDepth(1)

      const walls = this.physics.add.staticGroup()
      for (const s of b.solid) {
        const zone = this.add.zone(b.at.x + s.x, b.at.y + s.y, s.w, s.h).setOrigin(0, 0)
        walls.add(zone)
        zone.body.updateFromGameObject()
      }
      this.solids.push(walls)

      this.doors.push({
        rect: rect(b.at.x + b.door.x, b.at.y + b.door.y, b.door.w, b.door.h),
        to: b.name,
        landing: b.landing
      })
    }

    this.add.image(0, 0, 'island-foreground').setOrigin(0, 0).setDepth(10)
  }

  buildTerrain(clear) {
    const isClear = (col, row) =>
      clear.some(
        (r) => col >= r.cols[0] && col <= r.cols[1] && row >= r.rows[0] && row <= r.rows[1]
      )

    // A tilemap layer rather than a heap of rectangles: it's what a real Tiled
    // export would give us, so swapping one in later is a small change.
    // The layer needs a tileset to exist but never draws one — collision is all
    // we want from it, the ground is already painted into island.png.
    if (!this.textures.exists('blank-tile')) this.textures.createCanvas('blank-tile', TILE, TILE)

    const grid = []
    for (let row = 0; row < ISLAND_ROWS; row++) {
      const line = []
      for (let col = 0; col < ISLAND_COLS; col++) {
        const solid = islandCollisions[row * ISLAND_COLS + col] === SOLID && !isClear(col, row)
        line.push(solid ? 0 : -1)
      }
      grid.push(line)
    }

    const map = this.make.tilemap({ data: grid, tileWidth: TILE, tileHeight: TILE })
    const layer = map.createLayer(0, map.addTilesetImage('blank-tile'), 0, 0)
    layer.setCollision(0)
    return layer
  }
}
