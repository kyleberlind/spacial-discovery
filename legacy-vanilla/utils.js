// Axis-aligned overlap. Both args need { position: {x, y}, width, height }.
function overlaps(a, b) {
  return (
    a.position.x + a.width > b.position.x &&
    a.position.x < b.position.x + b.width &&
    a.position.y + a.height > b.position.y &&
    a.position.y < b.position.y + b.height
  )
}

// The player sprite is 48x68, but only the feet should collide — otherwise
// their head bumps walls a tile early and doorways feel impassable.
function hitbox({ x, y }) {
  return { position: { x: x + 10, y: y + 42 }, width: 28, height: 22 }
}

function inflate(rect, by) {
  return {
    position: { x: rect.position.x - by, y: rect.position.y - by },
    width: rect.width + by * 2,
    height: rect.height + by * 2
  }
}

// ponytail: self-check instead of a test framework. `node js/utils.js`
if (typeof module !== 'undefined' && require.main === module) {
  const r = (x, y, w, h) => ({ position: { x, y }, width: w, height: h })
  console.assert(overlaps(r(0, 0, 10, 10), r(5, 5, 10, 10)), 'overlapping')
  console.assert(!overlaps(r(0, 0, 10, 10), r(10, 0, 10, 10)), 'touching edges is not overlap')
  console.assert(!overlaps(r(0, 0, 10, 10), r(0, 20, 10, 10)), 'disjoint')
  console.assert(overlaps(inflate(r(0, 0, 10, 10), 5), r(12, 0, 2, 2)), 'inflate reaches')
  const h = hitbox({ x: 0, y: 0 })
  console.assert(h.position.y + h.height === 64 && h.height < 68, 'hitbox sits at the feet')
  console.log('utils ok')
}
