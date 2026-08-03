#!/usr/bin/env python3
"""Copy every tileset image the maps use into img/.

    npm run tilesets

Tiled records where an image was when you added it — usually somewhere like
~/Downloads — but the browser can only read files under this directory. So the
game looks for tilesets in img/ by filename, and this walks the maps and copies
in whatever isn't there yet. Run it after adding a tileset in Tiled.
"""

import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMG = ROOT / "img"

for tmj in sorted((ROOT / "data").glob("*.tmj")):
    for tileset in json.loads(tmj.read_text())["tilesets"]:
        image = tileset.get("image")
        if not image:
            # An external .tsx. Nothing to copy — in Tiled, select it in the
            # Tilesets panel and click Embed Tileset, then save.
            print(f"{tmj.name}: {tileset['name']} is a separate file — embed it in Tiled")
            continue

        target = IMG / pathlib.PurePath(image).name
        if target.exists():
            continue

        # The recorded path is relative to the map file, and is the only clue
        # to where the real image lives.
        source = (tmj.parent / image).expanduser()
        if not source.exists():
            print(f"{tmj.name}: {target.name} not found — Tiled says it was at {image}")
            continue

        shutil.copy2(source, target)
        print(f"copied {target.name}")
