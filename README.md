# spacial-discovery

A walkable little world with a video store you can shop. Built on
[Phaser 3](https://phaser.io), art lifted from
[chriscourses/pokemon-style-game](https://github.com/chriscourses/pokemon-style-game).

    npm start          # serves on :8777 — file:// won't load the images
    npm install        # only needed for the tests
    npm test

**WASD / arrows** walk · **Shift** sprint · **SPACE** browse an aisle ·
**F** fullscreen · **P** log your tile

Movement is one axis at a time — no diagonals. The most recently pressed
direction wins, so tapping a new one while holding the old turns you.

To get inside: from the spawn point follow the dirt road right, then down, and
walk **up into the arched doorway** of the house at the bottom of the map. No
key press — you just step into it. Walk down onto the doormat to leave.

Phaser comes from a CDN, so there's no build step. Open `index.html` through the
server and that's the whole toolchain.

## Layout

| file | what |
|---|---|
| `main.js` | Phaser config — canvas, scaling, physics, the scene list |
| `js/walk-scene.js` | the base scene: player, camera, input, doors. **Read this first** |
| `scenes/island.js` | the overworld: terrain grid + `BUILDINGS` |
| `scenes/video-store.js` | the shop interior, drawn with rectangles — no art needed |
| `js/panel.js` | the browse panel, plain HTML over the canvas |
| `data/island-collisions.js` | 70×40 terrain grid, exported from Tiled |
| `data/movies.js` | one entry per aisle — the shop widens to fit |
| `test/game.test.js` | boots the real game headless and walks the player around |
| `tools/split-map.py` | regenerates the images from the upstream map |

## Two kinds of collision

Terrain is a **tile grid**, because terrain *is* a grid — cliffs, water, tree
lines, straight out of the Tiled export.

Buildings are **not**. Each one carries its own walls and its own doorway, in
its own coordinates:

```js
const BUILDINGS = [
  {
    name: 'video-store',            // also the scene its door leads to
    texture: 'video-store',
    at: { x: 1824, y: 992 },
    solid: [                        // all relative to `at`
      { x: 0,   y: 96,  w: 288, h: 160 },  // roof and upper walls
      { x: 0,   y: 256, w: 48,  h: 48 },   // front wall, left of the door
      { x: 144, y: 256, w: 52,  h: 48 }    // front wall, right of the door
    ],
    door: { x: 48, y: 256, w: 96, h: 48 },
    landing: { x: 1920, y: 1300 }   // where you stand when you come back out
  }
]
```

Every tile a building's sprite covers is dropped from the terrain grid
automatically, so the two never fight and the Tiled export stays untouched.
Move `at` and the walls, the doorway and the cleared tiles all move with it.

## Adding a building

1. Drop its PNG in `img/`.
2. Add an entry to `BUILDINGS` — walk to the doorway and press `P` to read off
   coordinates.
3. Copy `scenes/video-store.js` for the inside, keyed to the same `name`.
4. Add both to the `<script>` tags in `index.html` and the scene list in
   `main.js`.

Doors find each other by name. A door's `landing` is where you stand when you
arrive *there* through it, written in that scene's own coordinates — so neither
file needs to know the other's layout.

## Art

The tutorial ships one flat PNG with three houses painted into it.
`tools/split-map.py` pulls it apart:

    git clone --depth 1 https://github.com/chriscourses/pokemon-style-game
    python3 tools/split-map.py "pokemon-style-game/img/Pellet Town.png"

| image | |
|---|---|
| `img/island.png` | the island, bare — no buildings on it |
| `img/video-store.png` | the house alone, transparent background |
| `img/island-foreground.png` | treetops, drawn over you so you pass behind them |

It prints the `at:` line to paste into `BUILDINGS`. The other two houses are
dropped entirely; `DEMOLISHED` in `scenes/island.js` clears their collision.

## Tests

`npm test` boots the real scene files under Phaser's HEADLESS renderer inside
jsdom, then drives the player with synthetic input and deterministic frames.

HEADLESS runs everything **except rendering** — so the tests cover movement,
physics, collision, doors, scene transitions and the panel, and cover nothing
at all about how the game looks. Depth order, zoom and sprite placement still
need a human with a browser.

## Where next

Terrain still comes from a hand-edited Tiled array. The natural next step is
authoring maps in Tiled proper and exporting JSON — Tiled's tile collision
editor attaches shapes to tileset tiles, so collision would come from the
tileset instead of a parallel array. `buildTerrain()` already uses a real
tilemap layer, so swapping the data source is a small change.
