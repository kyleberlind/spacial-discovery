// Shared vocabulary for the files in places/.
//
// A place is somewhere you can walk around — the island, the inside of a shop.
// Each one lives in its own file, wraps itself in an IIFE so its internals stay
// private, and registers itself here:
//
//   PLACES[name] = {
//     name,               matches the key; doors point at each other by it
//     spawn,              {x, y} you start at, if you didn't arrive by door
//     boundaries: [rect], anything solid
//     doors: [rect + {to, landing}]
//     shelves: [rect + {genre, titles}]   things SPACE can browse
//     draw(),             the place, behind the player
//     drawOver()          optional, drawn in front of the player
//   }
//
// A door's `landing` is where you stand when you arrive *here* through it, in
// this place's own coordinates — so neither file needs to know the other's
// layout. Walk into a door and the engine looks for the door leading back the
// way you came and drops you on its landing.

const TILE = 48
const PLACES = {}

function image(src) {
  const img = new Image()
  img.src = src
  return img
}
