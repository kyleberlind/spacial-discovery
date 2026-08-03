"""One-shot: turn the flat island art into a tileset and a Tiled map.

The tutorial shipped a single 3360x1920 PNG with no tileset, so there was no way
to edit the island except by painting pixels. This slices it back into 48px
tiles, throws away the duplicates, and writes a map you can open in Tiled.

    python3 tools/migrate-to-tiled.py

Produces:
    img/island-tileset.png   every distinct tile, packed into a grid
    data/island.tmj          the map — ground, foreground, collision, objects

RUN THIS ONCE. Afterwards data/island.tmj is the source of truth and the PNGs
are only the source of the *tileset*. Re-running rebuilds the ground and
foreground layers from the PNGs, which would throw away anything you have since
painted in Tiled.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILE = 48
COLUMNS = 20  # how wide to pack the tileset image

# A tile painted on the collision layer means "solid". It only ever shows in
# Tiled — the layer is hidden in game — so it just needs to be easy to see.
MARKER = (255, 0, 80, 110)

# Buildings become objects you can drag. Their walls and doorway stay in
# scenes/island.js, defined relative to the building, so they follow it.
BUILDINGS = [{'name': 'video-store', 'w': 288, 'h': 304, 'x': 1824, 'y': 992}]


def tiles_of(image):
    """Cut an image into rows of 48px tiles."""
    cols, rows = image.width // TILE, image.height // TILE
    return [
        [image.crop((c * TILE, r * TILE, (c + 1) * TILE, (r + 1) * TILE)) for c in range(cols)]
        for r in range(rows)
    ]


def is_blank(tile):
    return all(px[3] == 0 for px in tile.getdata())


def build(layers):
    """Dedupe every tile across every layer. Returns the tile images and, per
    layer, a grid of global tile ids (0 meaning empty, as Tiled expects).
    """
    order, index = [], {}
    grids = []
    for rows in layers:
        grid = []
        for row in rows:
            line = []
            for tile in row:
                if is_blank(tile):
                    line.append(0)
                    continue
                key = tile.tobytes()
                if key not in index:
                    index[key] = len(order)
                    order.append(tile)
                line.append(index[key] + 1)  # gids are 1-based
            grid.append(line)
        grids.append(grid)
    return order, grids


def pack(tiles):
    rows = -(-len(tiles) // COLUMNS)
    sheet = Image.new('RGBA', (COLUMNS * TILE, rows * TILE), (0, 0, 0, 0))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % COLUMNS) * TILE, (i // COLUMNS) * TILE))
    return sheet


def tile_layer(name, grid, layer_id):
    return {
        'data': [gid for row in grid for gid in row],
        'height': len(grid),
        'id': layer_id,
        'name': name,
        'opacity': 1,
        'type': 'tilelayer',
        'visible': True,
        'width': len(grid[0]),
        'x': 0,
        'y': 0
    }


def collision_source(cols, rows):
    """Where the solid tiles come from.

    On the first run that's the old character map, minus the tiles buildings
    stand on — those carry their own walls now, so the terrain must not block
    there too, and the demolished houses left outlines behind as well.

    Once data/island.tmj exists it wins, so re-running to rebuild the tileset
    keeps whatever you have painted in Tiled.
    """
    existing = ROOT / 'data/island.tmj'
    if existing.exists():
        layers = json.loads(existing.read_text())['layers']
        painted = next(l for l in layers if l['name'] == 'collision')['data']
        return lambda c, r: painted[r * cols + c] != 0

    text = (ROOT / 'data/island-collisions.js').read_text().split('`')[1].strip().split('\n')
    ignore = [((38, 43), (20, 26)), ((24, 27), (12, 17)), ((43, 48), (7, 13))]

    def blocked(c, r):
        if any(c0 <= c <= c1 and r0 <= r <= r1 for (c0, c1), (r0, r1) in ignore):
            return False
        return text[r][c] == '#'

    return blocked


def main():
    ground_img = Image.open(ROOT / 'img/island.png').convert('RGBA')
    fore_img = Image.open(ROOT / 'img/island-foreground.png').convert('RGBA')

    cols = ground_img.width // TILE
    rows = ground_img.height // TILE

    blocked = collision_source(cols, rows)

    tiles, (ground, fore) = build([tiles_of(ground_img), tiles_of(fore_img)])

    marker = Image.new('RGBA', (TILE, TILE), MARKER)
    tiles.append(marker)
    marker_gid = len(tiles)

    collision = [[marker_gid if blocked(c, r) else 0 for c in range(cols)] for r in range(rows)]

    sheet = pack(tiles)
    sheet.save(ROOT / 'img/island-tileset.png')

    tmj = {
        'compressionlevel': -1,
        'height': rows,
        'infinite': False,
        'layers': [
            tile_layer('ground', ground, 1),
            tile_layer('foreground', fore, 2),
            # Visible so you can see and paint it in Tiled; scenes/island.js
            # hides it in game regardless.
            tile_layer('collision', collision, 3),
            {
                'draworder': 'topdown',
                'id': 4,
                'name': 'objects',
                'objects': [
                    {
                        'id': i + 1,
                        'name': b['name'],
                        'type': 'building',
                        'rotation': 0,
                        'visible': True,
                        'x': b['x'],
                        'y': b['y'],
                        'width': b['w'],
                        'height': b['h'],
                        'properties': []
                    }
                    for i, b in enumerate(BUILDINGS)
                ],
                'opacity': 1,
                'type': 'objectgroup',
                'visible': True,
                'x': 0,
                'y': 0
            }
        ],
        'nextlayerid': 5,
        'nextobjectid': len(BUILDINGS) + 1,
        'orientation': 'orthogonal',
        'renderorder': 'right-down',
        'tiledversion': '1.10.2',
        'tileheight': TILE,
        'tilesets': [
            {
                'columns': COLUMNS,
                'firstgid': 1,
                'image': '../img/island-tileset.png',
                'imageheight': sheet.height,
                'imagewidth': sheet.width,
                'margin': 0,
                'name': 'island',
                'spacing': 0,
                'tilecount': len(tiles),
                'tileheight': TILE,
                'tilewidth': TILE
            }
        ],
        'tilewidth': TILE,
        'type': 'map',
        'version': '1.10',
        'width': cols
    }
    (ROOT / 'data/island.tmj').write_text(json.dumps(tmj, indent=1))

    solid = sum(row.count(marker_gid) for row in collision)
    print(f'img/island-tileset.png  {len(tiles)} tiles, {sheet.width}x{sheet.height}')
    print(f'data/island.tmj         {cols}x{rows}, {solid} solid tiles')

    # Prove the split was lossless: rebuild both images from the tileset and
    # compare against the originals pixel for pixel.
    for name, grid, original in (('ground', ground, ground_img), ('foreground', fore, fore_img)):
        rebuilt = Image.new('RGBA', original.size, (0, 0, 0, 0))
        for r, line in enumerate(grid):
            for c, gid in enumerate(line):
                if gid:
                    rebuilt.paste(tiles[gid - 1], (c * TILE, r * TILE))
        same = list(rebuilt.getdata()) == list(original.getdata())
        print(f'  {name} rebuilds to an exact copy of the PNG: {same}')
        if not same:
            raise SystemExit(f'{name} layer does not round-trip — refusing to continue')


if __name__ == '__main__':
    main()
