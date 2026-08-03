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
| `scenes/island.js` | the overworld: loads the map, places the buildings |
| `scenes/video-store.js` | the shop interior: reads its doors and aisles off the map |
| `js/panel.js` | the browse panel, plain HTML over the canvas |
| `data/island.tmj` | **the island itself — open this in [Tiled](https://www.mapeditor.org)** |
| `img/island-tileset.png` | the 410 tiles it's painted from |
| `data/video-store.tmj` | **the shop interior — open this in Tiled too** |
| `data/movies.js` | the IMDb Top 250, dealt out across the shop's shelves |
| `test/game.test.js` | boots the real game headless and walks the player around |
| `tools/collect-tilesets.py` | `npm run tilesets` — copies tileset art into `img/` |
| `tools/split-map.py` | pulls the buildings out of the upstream map art |
| `tools/migrate-to-tiled.py` | recovered the tileset and the Tiled map. One-shot |

## Building the island

Open `data/island.tmj` in [Tiled](https://www.mapeditor.org), paint, save,
refresh the browser. Four layers:

| layer | |
|---|---|
| `ground` | the island you walk on |
| `foreground` | treetops, drawn over the player so you can pass behind them |
| `collision` | paint a tile here and you can't walk on it. Hidden in game |
| `objects` | buildings — drag one and its walls and doorway follow |

Collision is its own layer rather than a property of each tile, because the same
grass tile is walkable in one place and a barrier in another — that's how the
original map fenced off its edges without drawing anything.

## Building the shop

`data/video-store.tmj`, same four layers, same rules. Its `objects` layer holds
two kinds of rectangle:

| Type | Name | |
|---|---|---|
| `door` | the scene it leads to (`island`) | you come out two tiles above it |
| `shelf` | anything (`shelf_0`, `shelf_1`, …) | stand next to it and SPACE browses its share of the Top 250 |

A shelf object only marks the region you can browse from — what you actually
bump into is whatever you painted on `collision`. So a counter you can walk
right up to is a shelf with nothing painted under it.

It ships with the geometry of the old hand-drawn room — walls, doorway, four
aisles — and nothing painted, so the floor is bare until you paint it.

### Adding a tileset

Add it in Tiled, tick **Embed Tileset**, save, then:

    npm run tilesets

Tiled remembers where the image was when you added it — usually `~/Downloads`,
which the browser can't read. That copies it into `img/`, where the game looks
for it by filename. Keep tileset filenames unique.

## Two kinds of collision

Terrain is a **tile grid**, because terrain *is* a grid — the `collision` layer
above.

Buildings are **not**. Each one carries its own walls and doorway, measured
relative to itself, so the map only has to say where it stands:

```js
const BUILDINGS = {
  'video-store': {                  // matches the object name in island.tmj,
    texture: 'video-store',         // and the scene the door leads to
    solid: [
      { x: 0,   y: 96,  w: 288, h: 160 },  // roof and upper walls
      { x: 0,   y: 256, w: 48,  h: 48 },   // front wall, left of the door
      { x: 144, y: 256, w: 52,  h: 48 }    // front wall, right of the door
    ],
    door:    { x: 48, y: 256, w: 96, h: 48 },
    landing: { x: 96, y: 308 }      // where you stand when you come back out
  }
}
```

Everything is an offset from the building, so dragging it around the `objects`
layer in Tiled moves the walls, the doorway and the landing spot with it.

## Adding a building

1. Drop its PNG in `img/`.
2. In Tiled, add a rectangle to the `objects` layer, name it, and set its Type
   to `building`. Put it where you want the house.
3. Add a matching entry to `BUILDINGS` in `scenes/island.js` with its walls and
   doorway, measured from the building's own top-left corner.
4. Copy `scenes/video-store.js` for the inside, keyed to the same name.
5. Add it to the `<script>` tags in `index.html` and the scene list in `main.js`.

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

The shop interior is still rectangles drawn in code. If interiors start
mattering it wants the same treatment as the island: a tileset, a `.tmj`, and
`WalkScene` learning to build a place from a map instead of each scene doing it
by hand.
