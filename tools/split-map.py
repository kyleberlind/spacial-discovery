"""Regenerate img/island.png and img/video-store.png from the upstream map.

The tutorial ships one flat PNG with three houses painted into it. This pulls
them apart: each house is flood-filled out, the one you can walk into is saved
as its own transparent sprite, the other two are dropped, and every hole is
repainted with the backdrop behind it.

    git clone --depth 1 https://github.com/chriscourses/pokemon-style-game
    python3 tools/split-map.py "pokemon-style-game/img/Pellet Town.png"

Reads the pristine upstream map and never its own output, so it is safe to
re-run after changing any of the constants below.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else 'pokemon-style-game/img/Pellet Town.png'
IMG = Path(__file__).resolve().parent.parent / 'img'

GRASS = (116, 200, 87, 255)
OCEAN = (103, 230, 210, 255)
# The road's speckles. Flat enough to stop a flood, so the house standing on it
# doesn't leak out across the whole map.
ROAD = {(248, 201, 132, 255), (248, 212, 159, 255), (241, 177, 131, 255)}
# The dark rim every building is drawn with. It reads as scenery, so it has to
# be grown into the mask by hand or the house leaves a ghost outline behind.
OUTLINE = (79, 175, 123, 255)

HOUSES = {
    # name: (seed pixel inside it, window to stop the flood running away)
    'video-store': ((1950, 1150), (1700, 950, 2200, 1350)),
    'left-house': ((1250, 700), (1100, 500, 1430, 900)),
    # right edge clipped off the cliff so the fill can't crawl down it
    'plateau-house': ((2210, 500), (2100, 340, 2310, 700)),
}
KEEP = 'video-store'  # the only one saved as a sprite; the rest just go


def is_backdrop(c):
    r, g, b, _ = c
    return (g > r and g > b) or c in ROAD  # grass, trees, sea, or road


def flood(px, seed, window):
    x0, y0, x1, y1 = window
    seen, q = set(), deque([seed])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (x0 <= x < x1 and y0 <= y < y1):
            continue
        if is_backdrop(px[x, y]):
            continue
        seen.add((x, y))
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return seen


def with_outline(px, body):
    """Creep outwards over the building's rim. Bounded by colour, so it takes
    the outline without eating neighbouring trees and bushes, which share that
    colour but aren't connected to the house.
    """
    edge = body
    body = set(body)
    for _ in range(4):
        edge = {
            (nx, ny)
            for x, y in edge
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
            if px[nx, ny] == OUTLINE and (nx, ny) not in body
        }
        if not edge:
            break
        body |= edge
    return body


def plateau_backdrop(x, y):
    """The plateau house's roof pokes above the shoreline, so part of its hole
    is sea. The tileset never drew the cliff edge hidden behind the roof --
    interpolate it from the land either side: y=366 at x=2100 down to y=490 at
    x=2320.
    """
    return OCEAN if y < 366 + 0.564 * (x - 2100) else GRASS


def main():
    m = Image.open(SRC).convert('RGBA')
    px = m.load()

    masks = {n: with_outline(px, flood(px, s, w)) for n, (s, w) in HOUSES.items()}

    # carve the keeper out to its own sprite before the map underneath is edited
    keep = masks[KEEP]
    xs = [p[0] for p in keep]
    ys = [p[1] for p in keep]
    x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    sprite = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    sp = sprite.load()
    for x, y in keep:
        sp[x - x0, y - y0] = px[x, y]
    sprite.save(IMG / f'{KEEP}.png')
    # `at` in places/island.js has to match this, or the house won't line up
    # with the collision still baked into the Tiled grid.
    print(f'{KEEP}.png  {x1 - x0}x{y1 - y0}  at: {{ x: {x0}, y: {y0} }}')

    # Now erase every house from the map. Flat grass, except on the plateau
    # where part of the hole is sky. The road that ran up to the video store
    # gets grassed over too -- the sprite goes straight back on top of its own
    # hole, so none of this shows unless you move the house.
    total = 0
    for name, mask in masks.items():
        backdrop = plateau_backdrop if name == 'plateau-house' else lambda x, y: GRASS
        for x, y in mask:
            px[x, y] = backdrop(x, y)
        total += len(mask)

    m.save(IMG / 'island.png')
    print(f'island.png  {total} pixels repainted')


if __name__ == '__main__':
    main()
