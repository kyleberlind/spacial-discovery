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
//                   this.shelves    [{ rect, genre, titles }], browsable
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

const rect = (x, y, w, h) => new Phaser.Geom.Rectangle(x, y, w, h)

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
    this.player = this.physics.add.sprite(at.x, at.y, 'player-down').setDepth(5)
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
      console.log(`${this.scene.key}: col ${col}, row ${row}  (${this.player.x}, ${this.player.y})`)
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
    showPrompt(this.near ? `SPACE to browse ${this.near.genre}` : null)
  }

  onSpace() {
    if (panelIsOpen()) closePanel()
    else if (this.near) openPanel(this.near.genre, this.near.titles)
  }
}
