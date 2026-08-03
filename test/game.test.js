// Boots the real game files under Phaser HEADLESS and walks the player around.
//
//     npm test
//
// HEADLESS runs everything except rendering, so this covers movement, physics,
// collision, doors and the browse panel -- but nothing about how it looks.
require('./dom.js')
const fs = require('fs')
const vm = require('vm')
const path = require('path')

const Phaser = require('phaser/dist/phaser.js')
global.Phaser = Phaser
const ROOT = path.join(__dirname, '..')

for (const f of [
  'data/movies.js',
  'js/panel.js',
  'js/touch.js',
  'js/walk-scene.js',
  'scenes/island.js',
  'scenes/video-store.js'
]) {
  vm.runInThisContext(fs.readFileSync(`${ROOT}/${f}`, 'utf8'), { filename: f })
}

const FONT = 'monospace'
global.FONT = FONT

let failures = 0
const check = (ok, msg) => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${msg}`)
}

const game = new Phaser.Game({
  type: Phaser.HEADLESS,
  width: 1280,
  height: 720,
  audio: { noAudio: true },
  physics: { default: 'arcade' },
  scene: [Island, VideoStore]
})

let t = 0
const frame = () => {
  t += 16.667
  game.scene.update(t, 16.667)
}
const frames = (n) => {
  for (let i = 0; i < n; i++) frame()
}

// Drive input by forcing key states, since there's no real keyboard. Keys are
// stamped in the order given, so the last name passed reads as most recently
// pressed -- which is how heading() breaks ties.
let pressCounter = 0
const hold = (scene, ...names) => {
  for (const k of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHIFT']) {
    scene.keys[k].isDown = false
  }
  for (const k of names) {
    scene.keys[k].isDown = true
    scene.keys[k].timeDown = ++pressCounter // in argument order, so last = newest
  }
}
const active = () => game.scene.getScenes(true)[0]

// Assets load over HTTP from the dev server, so the loader needs real time to
// turn. Step the game while waiting for the first scene to finish preloading.
const waitForScene = (key) =>
  new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      const s = game.scene.getScene(key)
      if (s && s.sys.isActive() && s.player) return resolve(s)
      if (Date.now() - started > 20000) return reject(new Error(`${key} never started`))
      frame()
      setTimeout(tick, 10)
    }
    tick()
  })

game.events.once('ready', () =>
  setImmediate(async () => {
    game.loop.sleep() // no rAF under jsdom; we step deterministically instead
    await waitForScene('island')
    frames(2)

    let island = active()
    check(island.scene.key === 'island', `starts on the island (got ${island.scene.key})`)
    check(island.player.body.width === 28, 'player collides on its feet only')

    const zoom = island.cameras.main.zoom
    check(zoom === 720 / 576, `camera zoom fits 576px of world height (${zoom})`)
    check(
      island.cameras.main.getBounds().width === 3360,
      'camera is bounded to the island, so you cannot pan off it'
    )

    // --- walking -----------------------------------------------------------
    const from = { x: island.player.x, y: island.player.y }
    hold(island, 'D')
    frames(30)
    check(island.player.x > from.x + 50, `walks right (${from.x} -> ${island.player.x})`)
    check(island.player.anims.currentAnim.key === 'walk-right', 'plays the right-facing walk')
    hold(island)
    frames(2)

    // --- no diagonals ------------------------------------------------------
    hold(island, 'D', 'W') // W pressed last, so we should go up, not up-right
    frames(5)
    const v = island.player.body.velocity
    check(v.x === 0 && v.y === -180, `holding right+up walks straight up (${v.x}, ${v.y})`)
    check(island.facing === 'up', `and faces up (${island.facing})`)

    hold(island, 'W', 'D') // now D is the most recent press
    frames(5)
    check(
      island.player.body.velocity.x === 180 && island.player.body.velocity.y === 0,
      'pressing a new direction turns you instead of going diagonal'
    )
    check(
      Math.hypot(island.player.body.velocity.x, island.player.body.velocity.y) === 180,
      'never faster than walking speed'
    )
    hold(island)
    frames(2)

    // --- sprint ------------------------------------------------------------
    hold(island, 'D')
    frames(5)
    const walkX = island.player.body.velocity.x
    hold(island, 'D', 'SHIFT')
    frames(5)
    const runX = island.player.body.velocity.x
    check(walkX === 180 && runX === 324, `Shift sprints (${walkX} -> ${runX} px/s)`)
    check(island.player.anims.timeScale === 1.8, 'and the walk animation speeds up to match')
    hold(island, 'D')
    frames(5)
    check(
      island.player.body.velocity.x === 180 && island.player.anims.timeScale === 1,
      'letting go of Shift drops back to a walk'
    )

    // --- touch controls -----------------------------------------------------
    // A phone has no keyboard, so the d-pad has to drive movement on its own.
    hold(island)
    frames(2)
    const press = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }))

    press(document.querySelector('#pad [data-dir="up"]'), 'pointerdown')
    frames(5)
    check(island.player.body.velocity.y === -180, `the d-pad walks you up (${island.player.body.velocity.y})`)
    check(island.facing === 'up', 'and turns you to face that way')

    press(window, 'pointerup')
    frames(5)
    check(island.player.body.velocity.y === 0, 'lifting your finger stops you')

    // sprinting must not punch through a wall
    island.player.setPosition(35 * 48, 1015)
    frames(2)
    hold(island, 'A', 'SHIFT')
    frames(400)
    hold(island)
    check(
      Math.round(island.player.x) === 782,
      `sprinting into the cliff still stops at it (x = ${Math.round(island.player.x)})`
    )

    // --- terrain collision -------------------------------------------------
    // Row 21 is open road from col 16 to col 40, with a solid tile at col 15.
    // Walk the whole run west; the cliff at col 15 should be what stops us.
    island.player.setPosition(35 * 48, 1015)
    frames(2)
    hold(island, 'A')
    frames(400) // 6.6s at 180px/s = far more than the 900px of open road
    hold(island)
    const stopped = Math.round(island.player.x)
    check(stopped < 1000, `crossed the open road heading west (x = ${stopped})`)
    check(stopped > 770 && stopped < 800, `terrain stopped us at the col 15 cliff (x = ${stopped}, expected ~782)`)

    // --- the building's own walls ------------------------------------------
    // Everything below is measured off the door the scene actually built, so
    // dragging the building around in Tiled doesn't invalidate the test.
    const door = island.doors[0]
    check(door.to === 'video-store', `the island has a door to the shop (${door.to})`)

    // the front wall sits immediately left of the arch, same height
    island.player.setPosition(door.rect.x - 24, door.rect.bottom + 40)
    frames(2)
    const wallFrom = island.player.y
    hold(island, 'W')
    frames(120)
    hold(island)
    // compare the collision body, not the sprite: the body is the feet, 8px
    // below the sprite's centre
    const stoppedAt = island.player.body.top
    check(
      stoppedAt >= door.rect.bottom - 1 && island.player.y < wallFrom,
      `the house wall blocks you (feet reached ${Math.round(stoppedAt)}, ` +
        `wall bottom ${Math.round(door.rect.bottom)})`
    )
    check(active().scene.key === 'island', 'walking into the wall does not open a door')

    // --- through the door --------------------------------------------------
    island.player.setPosition(door.landing.x, door.landing.y)
    frames(2)
    check(active().scene.key === 'island', 'standing below the arch does not teleport you')
    hold(island, 'W')
    frames(60)
    hold(island)
    frames(4)

    await waitForScene('video-store')
    frames(2)
    const shop = active()
    check(shop.scene.key === 'video-store', `walking into the arch enters the shop (${shop.scene.key})`)

    // --- a door in any wall -------------------------------------------------
    // You must land clear of the door you came in by, whichever wall it's in,
    // or you bounce straight back out. Synthetic doors, one per wall.
    const W = shop.worldSize.width
    const H = shop.worldSize.height
    const inward = {
      top: shop.landingFor(new Phaser.Geom.Rectangle(480, 0, 48, 48)),
      left: shop.landingFor(new Phaser.Geom.Rectangle(0, 480, 48, 48)),
      right: shop.landingFor(new Phaser.Geom.Rectangle(W - 48, 480, 48, 48)),
      bottom: shop.landingFor(new Phaser.Geom.Rectangle(480, H - 48, 48, 48))
    }
    check(inward.top.y > 48, `a door in the top wall lands you below it (y ${inward.top.y})`)
    check(inward.left.x > 48, `a door in the left wall lands you right of it (x ${inward.left.x})`)
    check(inward.right.x < W - 48, `a door in the right wall lands you left of it (x ${inward.right.x})`)
    check(inward.bottom.y < H - 48, `a door in the bottom wall lands you above it (y ${inward.bottom.y})`)

    // --- browsing ----------------------------------------------------------
    // Everything in here is measured off what the scene actually built, so
    // redrawing the shop in Tiled doesn't invalidate the test.
    if (!shop.shelves.length) {
      console.log(
        '\nNo aisles on the map. In Tiled, add rectangles to the `objects` layer of\n' +
          'data/video-store.tmj with Class `shelf`. Nothing below can run without them.'
      )
      process.exit(1)
    }

    // The whole list, dealt out, nothing dropped and nothing shelved twice.
    const stock = shop.shelves.flatMap((s) => s.films)
    check(stock.length === MOVIES.length, `all ${MOVIES.length} films are on a shelf (${stock.length})`)
    check(new Set(stock).size === stock.length, 'no film is on two shelves at once')
    const sizes = shop.shelves.map((s) => s.films.length)
    check(
      Math.max(...sizes) - Math.min(...sizes) <= 1,
      `evenly across ${shop.shelves.length} shelves (${Math.min(...sizes)}-${Math.max(...sizes)} each)`
    )

    const aisle = shop.shelves[0]
    shop.player.setPosition(aisle.rect.centerX, aisle.rect.centerY)
    frames(2)
    check(shop.near === aisle, `standing at an aisle is detected (${shop.near && shop.near.label})`)

    press(document.querySelector('#pad .act'), 'pointerdown')
    const panel = document.querySelector('#panel')
    check(panel.style.display === 'block', 'SPACE opens the browse panel')
    check(
      (panel.innerHTML.match(/class="film"/g) || []).length === aisle.films.length,
      'the panel shows a card per film on that aisle'
    )

    // movement must be frozen while reading
    const frozen = { x: shop.player.x, y: shop.player.y }
    hold(shop, 'D')
    frames(30)
    check(shop.player.x === frozen.x, 'you cannot walk while the panel is open')
    hold(shop)
    press(document.querySelector('#pad .act'), 'pointerdown')
    check(panel.style.display === 'none', 'SPACE again closes it')

    // --- back out -----------------------------------------------------------
    // You land two tiles inside the door, so walking back at it is whichever
    // direction the door lies in — which wall it's cut into is up to Tiled.
    shop.player.setPosition(shop.spawn.x, shop.spawn.y)
    frames(2)
    const out = shop.doors[0].rect
    const dx = out.centerX - shop.spawn.x
    const dy = out.centerY - shop.spawn.y
    const back2door = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'D' : 'A') : dy > 0 ? 'S' : 'W'
    hold(shop, back2door)
    frames(90) // 270px at walking speed, against a landing two tiles out
    hold(shop)
    await waitForScene('island')
    frames(4)
    const back = active()
    check(back.scene.key === 'island', `the doormat takes you back outside (${back.scene.key})`)
    frames(20)
    check(active().scene.key === 'island', 'and you do not bounce straight back in')
    const exit = back.doors[0].landing
    check(
      Math.abs(back.player.x - exit.x) < 40 && Math.abs(back.player.y - exit.y) < 40,
      `you come out below the arch (${Math.round(back.player.x)}, ${Math.round(back.player.y)} ` +
        `vs ${Math.round(exit.x)}, ${Math.round(exit.y)})`
    )

    console.log(failures ? `\n${failures} FAILED` : '\nall good')
    process.exit(failures ? 1 : 0)
  })
)

setTimeout(() => {
  console.log('never became ready')
  process.exit(1)
}, 30000)
