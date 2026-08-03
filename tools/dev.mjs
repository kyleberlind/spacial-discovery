// The dev server.
//
//     npm start
//
// Serves the project on :8777, and watches data/island.tmj so that adding a
// tileset in Tiled copies its image into img/ by itself. Save in Tiled, refresh
// the browser, done.
import { createServer } from 'http'
import { existsSync, readFileSync, statSync, watch } from 'fs'
import { dirname, extname, join, normalize, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = process.env.PORT || 8777
const MAP = join(ROOT, 'data/island.tmj')

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.tmj': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css'
}

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const path = join(ROOT, normalize(url === '/' ? '/index.html' : url))

  // don't serve anything above the project directory
  if (!path.startsWith(ROOT) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    return res.end('not found: ' + url)
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(path)] || 'application/octet-stream',
    // the whole point is seeing your edits, so never let the browser cache
    'cache-control': 'no-store'
  })
  res.end(readFileSync(path))
}).listen(PORT, () => {
  console.log(`\n  http://localhost:${PORT}\n`)
  console.log('  watching data/island.tmj — save in Tiled and tilesets copy themselves')
})

// Tiled writes the file more than once per save, so wait for it to settle.
let pending
watch(MAP, () => {
  clearTimeout(pending)
  pending = setTimeout(sync, 250)
})

async function sync() {
  const before = Date.now()
  const { syncTilesets } = await import('./sync-tilesets.mjs?t=' + before)
  const copied = syncTilesets({ quiet: true })
  if (copied.length) console.log(`  copied ${copied.join(', ')} into img/ — refresh the browser`)
}
