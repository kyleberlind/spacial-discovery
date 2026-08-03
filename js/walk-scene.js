// Everything shared by places you can walk around in.
//
// A scene extends this and implements two methods:
//
//   loadPlace()   queue up its own images
//   buildPlace()  build the world, and set:
//                   this.worldSize  { width, height } for the camera bounds
//                   this.spawn      { x, y } if you arrive without a door
//                   this.solids     things to collide with
//                   this.doors      [{ rect, to, landing }]
//                   this.shelves    [{ rect, label, films }], browsable
//
// A door's `landing` is where you stand when you arrive HERE through it, in
// this scene's own coordinates — so no scene needs to know another's layout.
// Walk into a door and it starts the target scene, which looks for its own
// door leading back the way you came and puts you on that door's landing.

const TILE = 48
const SPEED = 180 // px/sec — the old engine moved 3px per frame at 60fps
const SPRINT = 1.8 // hold Shift. 5.4px per frame, still nowhere near a 48px tile,
//                    so you can't clip through a wall by running at it
const VIEW_HEIGHT = 576 // world pixels kept visible vertically, whatever the window
const MAX_TEXTURE = 16384 // what a GPU will hold in one go. Anything bigger draws nothing

const rect = (x, y, w, h) => new Phaser.Geom.Rectangle(x, y, w, h)

// What draws in front of what. Spaced out so a place can slot however many
// layers it likes into a band without running into the next one.
const DEPTH = {
  ground: 0, // + the layer's position in the map
  building: 50,
  player: 100,
  overhead: 200 // + position again: roofs and treetops you walk behind
}

// Tiled stores custom properties as a list of {name, value}, and Phaser hands
// them over in whichever shape the map version used.
function layerFlag(definition, name) {
  const props = definition.properties
  if (!props) return false
  if (Array.isArray(props)) return props.some((p) => p.name === name && p.value)
  return Boolean(props[name])
}

const DIRECTIONS = [
  { name: 'up', keys: ['W', 'UP'], x: 0, y: -1 },
  { name: 'down', keys: ['S', 'DOWN'], x: 0, y: 1 },
  { name: 'left', keys: ['A', 'LEFT'], x: -1, y: 0 },
  { name: 'right', keys: ['D', 'RIGHT'], x: 1, y: 0 }
]

class WalkScene extends Phaser.Scene {
  init(data) {
    this.cameFrom = data && data.from
    this.doorArmed = false // the door you arrive on must not fire again
    this.near = null
    this.facing = 'down'
  }

  preload() {
    for (const dir of ['down', 'up', 'left', 'right']) {
      const file = './img/player' + dir[0].toUpperCase() + dir.slice(1) + '.png'
      this.load.spritesheet('player-' + dir, file, { frameWidth: 48, frameHeight: 68 })
    }
    this.loadPlace()
  }

  create() {
    this.solids = []
    this.doors = []
    this.shelves = []

    this.buildPlace()

    const back = this.doors.find((d) => d.to === this.cameFrom)
    const at = back ? back.landing : this.spawn
    this.player = this.physics.add.sprite(at.x, at.y, 'player-down').setDepth(DEPTH.player)
    // Only the feet collide. The sprite is 48x68 and mostly head — colliding on
    // all of it makes doorways impassable and walls feel a tile too close.
    this.player.body.setSize(28, 22).setOffset(10, 42)

    this.buildAnimations()
    for (const s of this.solids) this.physics.add.collider(this.player, s)

    this.cameras.main.setBounds(0, 0, this.worldSize.width, this.worldSize.height)
    this.cameras.main.startFollow(this.player, true)
    this.applyZoom()
    this.scale.on('resize', this.applyZoom, this)

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,F,P')
    this.input.keyboard.on('keydown-SPACE', this.onSpace, this)
    this.input.keyboard.on('keydown-F', () => this.scale.toggleFullscreen())
    this.input.keyboard.on('keydown-P', () => {
      const col = Math.floor(this.player.x / TILE)
      const row = Math.floor((this.player.y + 30) / TILE)
      // fps too: if walking feels slow, this says whether it's the frame rate
      console.log(
        `${this.scene.key}: col ${col}, row ${row}  (${this.player.x}, ${this.player.y})` +
          `  ${Math.round(this.game.loop.actualFps)}fps`
      )
    })

    this.events.once('shutdown', () => {
      this.scale.off('resize', this.applyZoom, this)
      showPrompt(null)
    })
  }

  applyZoom() {
    // Zoom so the same slice of world stays visible however big the window is,
    // instead of a big monitor just revealing more map.
    this.cameras.main.setZoom(this.scale.gameSize.height / VIEW_HEIGHT)
  }

  buildAnimations() {
    for (const dir of ['down', 'up', 'left', 'right']) {
      if (this.anims.exists('walk-' + dir)) continue
      this.anims.create({
        key: 'walk-' + dir,
        frames: this.anims.generateFrameNumbers('player-' + dir, { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      })
    }
  }

  // --- Tiled maps ---------------------------------------------------------
  // Call loadMap() from loadPlace() and buildMap() from buildPlace(). Between
  // them they handle tilesets, layers, depth and collision, so a scene made of
  // tiles only has to deal with its own objects.

  loadMap(key, file) {
    this.load.tilemapTiledJSON(key, file)

    // Whatever tilesets the map turns out to use, load their images. Queued as
    // soon as the map itself lands, which is still inside the loading phase, so
    // they're ready by the time buildPlace() runs. Means you can add a tileset
    // in Tiled without touching any code.
    //
    // Only the filename is used. Tiled records wherever the image happened to be
    // when you added it — often somewhere like ~/Downloads, which the browser
    // can't read — so the directory is ignored and img/ is where we look. Keep
    // tileset filenames unique.
    this.load.once('filecomplete-tilemapJSON-' + key, () => {
      for (const tileset of this.cache.tilemap.get(key).data.tilesets) {
        if (!tileset.image) continue // an external .tsx — reported in buildMap
        this.load.image(tileset.name, './img/' + tileset.image.split('/').pop())
      }
    })
  }

  // Builds every tile layer and sets this.worldSize. Add as many layers in
  // Tiled as you like — they all render, bottom-up in the order Tiled lists
  // them, so reordering there reorders them here. A layer draws over the player
  // if it's named foreground*, or if you tick a custom boolean property `above`
  // on it in Tiled (Layer > Layer Properties). A layer named `collision` is
  // never drawn and is solid wherever painted.
  //
  // Returns the map, for the objects on it.
  buildMap(key, file) {
    // Two different ways a tileset fails to arrive, with two different fixes.
    for (const tileset of this.cache.tilemap.get(key).data.tilesets) {
      if (!tileset.image) {
        throw new Error(
          `${file} keeps "${tileset.source}" in a separate file. Phaser only reads ` +
            'tilesets stored inside the map — in Tiled, select it in the Tilesets panel ' +
            'and click Embed Tileset, then save.'
        )
      }
      if (!this.textures.exists(tileset.name)) {
        const image = tileset.image.split('/').pop()
        throw new Error(
          `Tileset "${tileset.name}" needs img/${image}, which isn't there.\n` +
            `Copy it in:  cp "${tileset.image.replace(/^(\.\.\/)+/, '~/')}" img/\n` +
            '(the path Tiled recorded is a guess at where you got it — copy from ' +
            'wherever the file actually lives.)'
        )
      }
      if (tileset.imageheight > MAX_TEXTURE || tileset.imagewidth > MAX_TEXTURE) {
        throw new Error(
          `Tileset "${tileset.name}" is ${tileset.imagewidth}x${tileset.imageheight}, ` +
            `bigger than the ${MAX_TEXTURE}px a graphics card will take, so it would ` +
            'draw nothing at all. It\'s one of the "everything" sheets — use the ' +
            'per-theme files instead.'
        )
      }
      // A sheet whose width isn't a whole number of tiles was almost certainly
      // added at the wrong tile size. Every tile then draws a crop straddling
      // two, which reads as "my tileset looks like garbage".
      if (!tileset.margin && !tileset.spacing && tileset.imagewidth % tileset.tilewidth) {
        console.warn(
          `Tileset "${tileset.name}" is ${tileset.imagewidth}px wide, which isn't a whole ` +
            `number of ${tileset.tilewidth}px tiles. In Tiled it was probably added at the ` +
            'wrong tile size — most likely it is 32px art, and this map is 48px.'
        )
      }
    }

    const map = this.make.tilemap({ key })
    // Every layer can draw from every tileset, which is what Tiled assumes.
    const tilesets = map.tilesets.map((t) => map.addTilesetImage(t.name, t.name))

    this.worldSize = { width: map.widthInPixels, height: map.heightInPixels }

    map.layers.forEach((definition, i) => {
      // Phaser flattens Tiled's layer groups and names the result after the
      // path through them, so a `shelves` layer inside a `furniture` group
      // arrives as "furniture/shelves". Grouping is yours to organise with —
      // only the layer's own name decides how it's treated.
      const name = definition.name.split('/').pop()
      const layer = map.createLayer(definition.name, tilesets, 0, 0)

      if (name === 'collision') {
        layer.setVisible(false).setCollisionByExclusion([-1])
        this.solids.push(layer)
        return
      }

      const above = name.startsWith('foreground') || layerFlag(definition, 'above')
      layer.setDepth((above ? DEPTH.overhead : DEPTH.ground) + i)
    })

    return map
  }

  feet() {
    const b = this.player.body
    return rect(b.x, b.y, b.width, b.height)
  }

  // One axis at a time — no diagonals. Whichever direction was pressed most
  // recently wins, so tapping a new one while still holding the old turns you
  // rather than doing nothing until you let go.
  heading() {
    let chosen = null
    let pressedAt = -1
    for (const dir of DIRECTIONS) {
      for (const name of dir.keys) {
        const key = this.keys[name]
        if (key.isDown && key.timeDown >= pressedAt) {
          pressedAt = key.timeDown
          chosen = dir
        }
      }
    }
    return chosen
  }

  update() {
    const body = this.player.body

    if (panelIsOpen()) {
      body.setVelocity(0, 0)
      this.player.anims.stop()
      return
    }

    const heading = this.heading()
    if (heading) {
      const sprinting = this.keys.SHIFT.isDown
      const speed = sprinting ? SPEED * SPRINT : SPEED
      body.setVelocity(heading.x * speed, heading.y * speed)
      this.facing = heading.name
      this.player.anims.play('walk-' + heading.name, true)
      // step the legs faster too, or sprinting looks like moonwalking
      this.player.anims.timeScale = sprinting ? SPRINT : 1
    } else {
      body.setVelocity(0, 0)
      this.player.anims.stop()
      this.player.setTexture('player-' + this.facing, 0)
    }

    // A door only fires once you've stepped clear of it, so the one you just
    // came out of doesn't pull you straight back in.
    const feet = this.feet()
    const onDoor = this.doors.find((d) => Phaser.Geom.Rectangle.Overlaps(feet, d.rect))
    if (!onDoor) this.doorArmed = true
    else if (this.doorArmed) {
      this.scene.start(onDoor.to, { from: this.scene.key })
      return
    }

    this.near = this.shelves.find((s) =>
      Phaser.Geom.Rectangle.Overlaps(feet, rect(s.rect.x - 8, s.rect.y - 8, s.rect.width + 16, s.rect.height + 16))
    )
    showPrompt(this.near ? `SPACE to browse ${this.near.label}` : null)
  }

  onSpace() {
    if (panelIsOpen()) closePanel()
    else if (this.near) openPanel(this.near.label, this.near.films)
  }
}
