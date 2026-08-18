#!/usr/bin/env python3
"""Verify that no Cloud Cottage outfit covers Cinnamoroll's eyes or mouth.

``logic/outfitLayout.test.ts`` guards the geometry (which edge is pinned, does
the box stay on the canvas) but it cannot see pixels, so it cannot tell an arch
of flowers resting on her head from one draped over her face. This script
closes that gap: it reads the shipped table out of ``ui/cottageAssets.ts``,
composites each layer with exactly the maths ``outfitBox`` uses, and reports the
share of each eye and of her mouth that ends up covered.

Every head piece must report 0.0%. If one does not, adjust its
``centerXPercent`` / ``widthPercent`` / ``anchorYPercent`` and re-run.

Usage (from repo root):
    uv run --directory desktop python ../scripts/preview_cottage_outfits.py
    uv run --directory desktop python ../scripts/preview_cottage_outfits.py --sheet tmp/outfits.png

Requires Pillow and numpy, which the desktop subproject already provides.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
ART = REPO / "src/assets/games/cloud-cottage"
ASSETS_TS = REPO / "src/components/LittleGames/cloud-cottage/ui/cottageAssets.ts"

# Landmarks in pixels on the 1254x1254 character canvas. These are the same
# measurements recorded as percentages in ui/spriteMetrics.ts, found by
# connected-component labelling of the dark pixels in the face.
EYES = {"left eye": (447, 445, 497, 513), "right eye": (723, 490, 775, 558)}
MOUTH = {"mouth": (520, 470, 640, 560)}

ENTRY = re.compile(
    r'"(?P<id>[a-z-]+)":\s*\{(?P<body>[^}]*?)\}',
    re.DOTALL,
)


def parse_outfit_visuals() -> dict[str, dict]:
    """Pull the OUTFIT_VISUALS table out of the TypeScript source."""
    source = ASSETS_TS.read_text(encoding="utf-8")
    start = source.index("export const OUTFIT_VISUALS")
    table = source[start : source.index("\n};", start)]

    out: dict[str, dict] = {}
    for match in ENTRY.finditer(table):
        body = match.group("body")

        def number(field: str, default: float | None = None) -> float:
            found = re.search(rf"{field}:\s*(-?[\d.]+)", body)
            if found:
                return float(found.group(1))
            if default is None:
                raise SystemExit(f"{match.group('id')} is missing {field}")
            return default

        anchor = re.search(r'anchor:\s*"(bottom|top)"', body)
        slot = re.search(r'slot:\s*"(head|neck)"', body)
        if not anchor or not slot:
            raise SystemExit(f"{match.group('id')} is missing anchor/slot")

        out[match.group("id")] = {
            "slot": slot.group(1),
            "center_x": number("centerXPercent"),
            "width": number("widthPercent"),
            "anchor": anchor.group(1),
            "anchor_y": number("anchorYPercent"),
            "rotate": number("rotateDegrees", 0.0),
        }
    return out


def place(outfit_id: str, spec: dict, size: int) -> tuple[Image.Image, tuple[int, int], float, float]:
    """Resolve a layer to a positioned image, mirroring outfitBox()."""
    art = Image.open(ART / f"outfits/{outfit_id}.webp").convert("RGBA")
    width, height = art.size
    box_w = spec["width"] / 100 * size
    box_h = box_w * (height / width)
    left = (spec["center_x"] / 100 * size) - box_w / 2
    top = (spec["anchor_y"] / 100 * size) - (box_h if spec["anchor"] == "bottom" else 0)

    layer = art.resize((max(1, round(box_w)), max(1, round(box_h))), Image.LANCZOS)
    if spec["rotate"]:
        layer = layer.rotate(-spec["rotate"], resample=Image.BICUBIC, expand=True)
    offset = (
        round(left - (layer.width - box_w) / 2),
        round(top - (layer.height - box_h) / 2),
    )
    return layer, offset, top / size * 100, (top + box_h) / size * 100


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet", type=Path, help="also write a contact sheet here")
    args = parser.parse_args()

    pet = Image.open(ART / "cinnamoroll.webp").convert("RGBA")
    size = pet.size[0]
    visuals = parse_outfit_visuals()
    regions = {**EYES, **MOUTH}

    tiles: list[tuple[str, Image.Image]] = []
    failures: list[str] = []

    for outfit_id, spec in sorted(visuals.items()):
        layer, offset, box_top, box_bottom = place(outfit_id, spec, size)

        mask = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        mask.alpha_composite(layer, offset)
        alpha = np.array(mask)[..., 3]

        covered = {
            name: float((alpha[y0:y1, x0:x1] > 40).mean() * 100)
            for name, (x0, y0, x1, y1) in regions.items()
        }
        worst = max(covered.values())
        status = "ok  " if worst == 0 else "FAIL"
        if worst > 0 and spec["slot"] == "head":
            failures.append(outfit_id)

        report = "  ".join(f"{name} {pct:5.1f}%" for name, pct in covered.items())
        print(
            f"{status} {outfit_id:16s} {spec['slot']:4s} "
            f"box y {box_top:5.1f}->{box_bottom:5.1f}%   {report}"
        )

        if args.sheet:
            tile = Image.new("RGBA", (size, size), (255, 255, 255, 255))
            tile.alpha_composite(pet)
            tile.alpha_composite(layer, offset)
            draw = ImageDraw.Draw(tile)
            for x0, y0, x1, y1 in regions.values():
                draw.rectangle([x0, y0, x1, y1], outline=(220, 0, 0, 255), width=3)
            tiles.append((outfit_id, tile))

    if args.sheet:
        cols, tile_px = 5, 320
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tile_px, rows * (tile_px + 20)), (255, 255, 255))
        draw = ImageDraw.Draw(sheet)
        for index, (name, tile) in enumerate(tiles):
            x, y = (index % cols) * tile_px, (index // cols) * (tile_px + 20)
            sheet.paste(tile.convert("RGB").resize((tile_px, tile_px)), (x, y))
            draw.text((x + 6, y + tile_px + 4), name, fill=(0, 0, 0))
        args.sheet.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(args.sheet)
        print(f"\ncontact sheet: {args.sheet}")

    if failures:
        print(f"\n{len(failures)} head piece(s) cover her face: {', '.join(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
