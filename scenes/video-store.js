// The video store — inside the house on the island.
//
//   data/video-store.tmj   the room. Open it in Tiled and paint it.
//
// Same deal as the island: `ground` and `foreground` layers draw, `collision`
// is what you can't walk through, and the `objects` layer says what things are.
// Two kinds of object matter in here:
//
//   type `door`   name it after the scene it leads to ("island")
//   type `shelf`  name it whatever you like — shelf_0, shelf_1 — and standing
//                 next to it offers to browse its share of the Top 250
//
// Nothing decides what's on a shelf: data/movies.js is dealt out across all of
// them, so adding a shelf in Tiled just means everything holds slightly less.
//
// Painting the shelf furniture is the collision layer's job — an object of type
// shelf only marks the region, so a counter you can walk up to is a shelf object
// with nothing painted under it.

class VideoStore extends WalkScene {
  constructor() {
    super('video-store')
  }

  loadPlace() {
    this.loadMap('shop-map', './data/video-store.tmj')
  }

  buildPlace() {
    const map = this.buildMap('shop-map', 'video-store.tmj')
    this.cameras.main.setBackgroundColor('#23262e')

    for (const object of map.getObjectLayer('objects').objects) {
      // Tiled anchors a tile object — one you stamped from a tileset — by its
      // bottom-left corner, but a plain rectangle by its top-left. Either way
      // of marking a shelf should cover the same patch of floor.
      const top = object.gid ? object.y - object.height : object.y
      const box = rect(object.x, top, object.width, object.height)

      if (object.type === 'door') {
        this.doors.push({ rect: box, to: object.name, landing: this.landingFor(box) })
        continue
      }

      if (object.type === 'shelf') {
        // shelf_12 reads as SHELF 12 on the label above the aisle.
        const label = object.name.replace(/_/g, ' ').toUpperCase()
        this.shelves.push({ rect: box, label, films: [] })
      }
    }

    this.stockShelves()

    // No spawn of its own: you only ever get here through the door, and the
    // door's landing is where you end up. Kept so the scene still works if it's
    // started directly.
    this.spawn = this.doors[0].landing
  }

  // Deal the whole Top 250 out across the shelves, one title at a time round
  // the room, so every shelf gets within one of the same number.
  //
  // Seeded off nothing but the shop itself, so the shuffle comes out identical
  // every time: walk out and back in, or reload, and Alien is still where you
  // left it. Re-order the shelves in Tiled and the stock stays put too — the
  // deal follows the shelf names, not the order the map happens to list them.
  stockShelves() {
    if (!this.shelves.length) return
    console.log(this.shelves)
    this.shelves.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    

    const deck = new Phaser.Math.RandomDataGenerator(['video-store']).shuffle(MOVIES.slice())
    deck.forEach((film, i) => this.shelves[i % this.shelves.length].films.push(film))
  }

  // Where you stand when you come in through this door: two tiles inward from
  // whichever wall it's cut into. Two, because a door only re-arms once you've
  // stepped clear of it — land on top of one and you bounce straight back out.
  //
  // A door is in a wall, so it's flush with an edge of the map; the edge it's
  // touching is the one you walk away from. Anything not against an edge is
  // treated as a doorway in the bottom wall, which is where they usually are.
  landingFor(box) {
    const step = TILE * 2
    if (box.y <= 0) return { x: box.centerX, y: box.bottom + step }
    if (box.x <= 0) return { x: box.right + step, y: box.centerY }
    if (box.right >= this.worldSize.width) return { x: box.x - step, y: box.centerY }
    return { x: box.centerX, y: box.y - step }
  }
}
