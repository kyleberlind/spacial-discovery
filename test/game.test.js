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
  'data/island-collisions.js',
  'data/movies.js',
  'js/panel.js',
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
    // straight at the front wall, left of the door
    island.player.setPosition(1850, 1330)
    frames(2)
    hold(island, 'W')
    frames(120)
    hold(island)
    const wallY = island.player.y
    check(wallY > 1280, `the house wall blocks you (stopped at y = ${Math.round(wallY)})`)
    check(active().scene.key === 'island', 'walking into the wall does not open a door')

    // --- through the door --------------------------------------------------
    island.player.setPosition(1920, 1330)
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

    // --- browsing ----------------------------------------------------------
    check(shop.shelves.length === MOVIES.length, `one aisle per genre (${shop.shelves.length})`)
    hold(shop, 'A')
    frames(60)
    hold(shop)
    frames(2)
    check(!!shop.near, `standing beside an aisle is detected (${shop.near && shop.near.genre})`)

    shop.onSpace()
    const panel = document.querySelector('#panel')
    check(panel.style.display === 'block', 'SPACE opens the browse panel')
    check(
      (panel.innerHTML.match(/<li>/g) || []).length === shop.near.titles.length,
      'the panel lists every title on that aisle'
    )

    // movement must be frozen while reading
    const frozen = { x: shop.player.x, y: shop.player.y }
    hold(shop, 'D')
    frames(30)
    check(shop.player.x === frozen.x, 'you cannot walk while the panel is open')
    hold(shop)
    shop.onSpace()
    check(panel.style.display === 'none', 'SPACE again closes it')

    // --- aisles are solid ---------------------------------------------------
    const aisle = shop.shelves[1].rect
    shop.player.setPosition(aisle.x + aisle.width / 2, aisle.y - 60)
    frames(2)
    hold(shop, 'S')
    frames(90)
    hold(shop)
    check(shop.player.body.bottom <= aisle.y + 2, 'you cannot walk through an aisle')

    // --- back out -----------------------------------------------------------
    shop.player.setPosition(shop.spawn.x, shop.spawn.y)
    frames(2)
    hold(shop, 'S')
    frames(90)
    hold(shop)
    await waitForScene('island')
    frames(4)
    const back = active()
    check(back.scene.key === 'island', `the doormat takes you back outside (${back.scene.key})`)
    frames(20)
    check(active().scene.key === 'island', 'and you do not bounce straight back in')
    check(
      Math.abs(back.player.x - 1920) < 40 && back.player.y > 1280,
      `you come out below the arch (${Math.round(back.player.x)}, ${Math.round(back.player.y)})`
    )

    console.log(failures ? `\n${failures} FAILED` : '\nall good')
    process.exit(failures ? 1 : 0)
  })
)

setTimeout(() => {
  console.log('never became ready')
  process.exit(1)
}, 30000)
