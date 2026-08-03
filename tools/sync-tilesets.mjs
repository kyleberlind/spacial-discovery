// Copy any tileset image the map needs into img/.
//
//     npm run tilesets
//
// `npm start` does this for you whenever you save in Tiled — this is the manual
// version, for when the server isn't running.
//
// Tiled records wherever an image was when you added it, usually somewhere
// outside the project that the browser can't read. The game loads tilesets by
// filename out of img/, so this finds the ones that aren't there yet.
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { basename, dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IMG = join(ROOT, 'img')
const MAP = join(ROOT, 'data/island.tmj')

// Where to go looking when the path in the map doesn't pan out.
const SEARCH = [join(process.env.HOME, 'Downloads'), join(process.env.HOME, 'Desktop')]

function findFile(name, dir, depth = 3) {
  if (depth < 0 || !existsSync(dir)) return null
  const dirs = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isFile() && entry === name) return full
    if (stat.isDirectory()) dirs.push(full)
  }
  for (const sub of dirs) {
    const hit = findFile(name, sub, depth - 1)
    if (hit) return hit
  }
  return null
}

export function syncTilesets({ quiet = false } = {}) {
  const say = (...args) => !quiet && console.log(...args)
  const copied = []
  let missing = 0

  let tilesets
  try {
    ;({ tilesets } = JSON.parse(readFileSync(MAP, 'utf8')))
  } catch {
    return copied // Tiled writes in stages; we'll be called again when it settles
  }

  for (const tileset of tilesets) {
    if (!tileset.image) {
      say(
        `  ${tileset.name || tileset.source}: kept in a separate file — in Tiled, ` +
          'select it and click Embed Tileset'
      )
      missing++
      continue
    }

    const file = basename(tileset.image)
    if (existsSync(join(IMG, file))) continue

    // the path the map recorded, then a search of the usual download spots
    const recorded = resolve(dirname(MAP), tileset.image)
    const source = existsSync(recorded)
      ? recorded
      : SEARCH.map((d) => findFile(file, d)).find(Boolean)

    if (!source) {
      say(`  ${file}: can't find it anywhere. Copy it into img/ yourself.`)
      missing++
      continue
    }

    copyFileSync(source, join(IMG, file))
    say(`  copied ${file}`)
    copied.push(file)
  }

  if (!copied.length && !missing) say('  nothing to do — every tileset is already in img/')
  return copied
}

// run directly rather than imported
if (process.argv[1] && process.argv[1].endsWith('sync-tilesets.mjs')) {
  syncTilesets()
}
