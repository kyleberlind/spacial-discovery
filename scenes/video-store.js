// The video store — inside the house on the island.
//
// No art: the room is drawn with rectangles and its size comes from the data.
// One entry in data/movies.js === one aisle, and the room widens to fit.

const SHOP_ROWS = 12
const SHOP_COLS = 3 + MOVIES.length * 5
const SHOP_DOOR_COL = Math.floor(SHOP_COLS / 2)

const AISLE_TOP = 3
const AISLE_ROWS = 7
const AISLE_COLS = 2

class VideoStore extends WalkScene {
  constructor() {
    super('video-store')
  }

  loadPlace() {}

  buildPlace() {
    this.worldSize = { width: SHOP_COLS * TILE, height: SHOP_ROWS * TILE }
    this.spawn = { x: SHOP_DOOR_COL * TILE + 24, y: (SHOP_ROWS - 3) * TILE }

    this.cameras.main.setBackgroundColor('#23262e')

    for (let x = 1; x < SHOP_COLS - 1; x++) {
      for (let y = 1; y < SHOP_ROWS - 1; y++) {
        const shade = (x + y) % 2 ? 0x3b3f4a : 0x434855
        this.add.rectangle(x * TILE, y * TILE, TILE, TILE, shade).setOrigin(0, 0)
      }
    }

    const walls = this.physics.add.staticGroup()
    for (let x = 0; x < SHOP_COLS; x++) {
      for (let y = 0; y < SHOP_ROWS; y++) {
        const isWall = x === 0 || y === 0 || x === SHOP_COLS - 1 || y === SHOP_ROWS - 1
        if (!isWall || (x === SHOP_DOOR_COL && y === SHOP_ROWS - 1)) continue
        this.add.rectangle(x * TILE, y * TILE, TILE, TILE, 0x23262e).setOrigin(0, 0)
        const zone = this.add.zone(x * TILE, y * TILE, TILE, TILE).setOrigin(0, 0)
        walls.add(zone)
        zone.body.updateFromGameObject()
      }
    }

    // the doormat, and the way back out
    this.add
      .rectangle(SHOP_DOOR_COL * TILE, (SHOP_ROWS - 1) * TILE, TILE, TILE, 0x8a5a3b)
      .setOrigin(0, 0)
    this.doors.push({
      rect: rect(SHOP_DOOR_COL * TILE, (SHOP_ROWS - 1) * TILE, TILE, TILE),
      to: 'island',
      landing: { x: SHOP_DOOR_COL * TILE + 24, y: (SHOP_ROWS - 3) * TILE }
    })

    const aisles = this.physics.add.staticGroup()
    MOVIES.forEach((entry, i) => {
      const x = (3 + i * 5) * TILE
      const y = AISLE_TOP * TILE
      const w = AISLE_COLS * TILE
      const h = AISLE_ROWS * TILE

      this.add.rectangle(x, y, w, h, 0x6b4a2f).setOrigin(0, 0)
      this.add.rectangle(x + 6, y + 6, w - 12, h - 12, 0x2c1d12).setOrigin(0, 0)

      // one spine per title
      const perRow = 5
      const sw = (w - 20) / perRow
      entry.titles.forEach((title, n) => {
        const hue = (title.length * 47 + n * 63) % 360
        const colour = Phaser.Display.Color.HSVToRGB(hue / 360, 0.55, 0.75).color
        this.add
          .rectangle(x + 10 + (n % perRow) * sw, y + 14 + Math.floor(n / perRow) * 36, sw - 3, 26, colour)
          .setOrigin(0, 0)
      })

      this.add.text(x, y - 16, entry.genre, { fontFamily: FONT, fontSize: '10px', color: '#f4d35e' })

      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0)
      aisles.add(zone)
      zone.body.updateFromGameObject()

      // an aisle is a wall you can also read
      this.shelves.push({ rect: rect(x, y, w, h), genre: entry.genre, titles: entry.titles })
    })

    this.solids.push(walls, aisles)

    this.add.text(TILE + 8, TILE + 10, 'VIDEO', {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#f4d35e'
    })
  }
}
