// The island — the overworld.
//
//   data/island.tmj         the map itself. Open it in Tiled to build the
//                           island: ground, foreground, collision, objects
//   img/island-tileset.png  the tiles it's painted from
//
// Both were recovered from the original flat artwork by tools/migrate-to-tiled.py.
//
// Terrain collision is the `collision` layer — paint a tile there and you can't
// walk on it. It's hidden in game. It's a separate layer rather than a property
// of each tile because the same grass tile is walkable in one place and a
// barrier in another, which is how the original map fenced off its edges.

// What a building *is*: its picture, its walls, its doorway. Every measurement
// is relative to the building, so where it stands is the map's business — drag
// it around the `objects` layer in Tiled and the walls follow.
const BUILDINGS = {
  'video-store': {
    texture: 'video-store',
    // The sprite is 288x304: roof down to y=256, then the front wall with the
    // arch cut out of it.
    solid: [
      { x: 0, y: 96, w: 288, h: 160 }, // roof and upper walls
      { x: 0, y: 256, w: 48, h: 48 }, // front wall, left of the door
      { x: 144, y: 256, w: 52, h: 48 } // front wall, right of the door
    ],
    door: { x: 48, y: 256, w: 96, h: 48 },
    landing: { x: 96, y: 308 } // out on the street, just below the arch
  }
}

class Island extends WalkScene {
  constructor() {
    super('island')
  }

  loadPlace() {
    this.loadMap('island-map', './data/island.tmj')

    for (const { texture } of Object.values(BUILDINGS)) {
      this.load.image(texture, `./img/${texture}.png`)
    }
  }

  buildPlace() {
    const map = this.buildMap('island-map', 'island.tmj')
    this.spawn = { x: 1224, y: 946 }

    for (const object of map.getObjectLayer('objects').objects) {
      if (object.type !== 'building') continue
      const spec = BUILDINGS[object.name]
      if (!spec) {
        throw new Error(
          `island.tmj places a building called "${object.name}", but there's no ` +
            'entry for it in BUILDINGS in scenes/island.js'
        )
      }
      this.placeBuilding(object, spec)
    }
  }

  placeBuilding(at, spec) {
    this.add.image(at.x, at.y, spec.texture).setOrigin(0, 0).setDepth(DEPTH.building)

    const walls = this.physics.add.staticGroup()
    for (const s of spec.solid) {
      const zone = this.add.zone(at.x + s.x, at.y + s.y, s.w, s.h).setOrigin(0, 0)
      walls.add(zone)
      zone.body.updateFromGameObject()
    }
    this.solids.push(walls)

    this.doors.push({
      rect: rect(at.x + spec.door.x, at.y + spec.door.y, spec.door.w, spec.door.h),
      to: at.name, // the scene registered under the same name
      landing: { x: at.x + spec.landing.x, y: at.y + spec.landing.y }
    })
  }
}
