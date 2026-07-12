#!/usr/bin/env python3
"""Crop figures from 四年級數學題目卷.pdf for the exam-practice page.

The web UI renders every question stem separately, so committed PNGs never
repeat the stem. ``stem`` crops contain only the figure/table required by text
options. ``block`` crops also retain the printed graphical options because the
UI renders plain ①②③④ buttons for those questions. A few questions combine
tightly cropped, non-contiguous PDF fragments to keep an inline legend without
bringing the surrounding stem back into the image.

Usage (from repo root):
    uv run --directory desktop python ../scripts/crop_exam_images.py           # generate all
    uv run --directory desktop python ../scripts/crop_exam_images.py --list    # print approved rects
    uv run --directory desktop python ../scripts/crop_exam_images.py --only math-q25 math-q96
    uv run --directory desktop python ../scripts/crop_exam_images.py --locate "25."
    uv run --directory desktop python ../scripts/crop_exam_images.py --grid 1 2
or simply:  make exam-images

Output: public/exams/images/math-q{N}.png (committed). Coordinate grids default
to tmp/pdfs/exam-crop-grid/ and are temporary diagnostics only.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF

REPO_ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = REPO_ROOT / "public" / "exams" / "四年級數學題目卷.pdf"
OUTPUT_DIR = REPO_ROOT / "public" / "exams" / "images"
DEFAULT_GRID_DIR = REPO_ROOT / "tmp" / "pdfs" / "exam-crop-grid"

ZOOM = 3  # ≈216 DPI
OUTPUT_PADDING = 12  # pixels after rendering, keeps artwork away from UI borders
FRAGMENT_GAP = 9  # pixels between non-contiguous source fragments


@dataclass(frozen=True)
class Clip:
    """A manually approved PDF-point rectangle on a zero-based page."""

    page: int
    rect: tuple[float, float, float, float]


@dataclass(frozen=True)
class CropSpec:
    mode: str
    clips: tuple[Clip, ...]


def clip(page: int, x0: float, y0: float, x1: float, y1: float) -> Clip:
    return Clip(page=page, rect=(x0, y0, x1, y1))


# Every rectangle was visually approved against 25-point coordinate grids.
# Page indices are zero-based; rectangle values are PDF points.
CROP_SPECS: dict[int, CropSpec] = {
    # Graphical options remain inside the image (imageContainsOptions).
    9: CropSpec(
        "block", (clip(0, 143.1, 406.4, 159.7, 421.4), clip(0, 101, 425, 254, 440))
    ),
    15: CropSpec("block", (clip(0, 103, 628, 164, 664),)),
    25: CropSpec("block", (clip(0, 366, 501, 430, 565),)),
    32: CropSpec(
        "block",
        (
            clip(1, 147, 65.9, 162, 80.9),
            clip(1, 101, 84, 169, 130),
            clip(1, 100, 142, 202, 157),
        ),
    ),
    41: CropSpec(
        "block",
        (
            clip(1, 175.5, 713.2, 186, 724.2),
            clip(1, 100, 739.5, 184, 768),
            clip(1, 99, 770, 291, 806),
        ),
    ),
    58: CropSpec("block", (clip(2, 98, 174, 214, 251),)),
    # q69 starts at the bottom of the left column, but its diagram/options are
    # at the top of the right column.
    69: CropSpec("block", (clip(2, 365, 41, 483, 193),)),
    74: CropSpec(
        "block",
        (clip(2, 404.5, 564.5, 415.2, 575.2), clip(2, 366, 590.5, 457, 684)),
    ),
    80: CropSpec("block", (clip(3, 99, 210, 239, 263),)),
    94: CropSpec("block", (clip(3, 365, 290, 431, 354),)),
    96: CropSpec(
        "block", (clip(3, 367, 505, 434, 520), clip(3, 366, 519.5, 555, 563))
    ),
    # Text options are rendered by the UI; keep only the necessary art/table.
    17: CropSpec("stem", (clip(0, 100, 733.8, 171, 762),)),
    18: CropSpec("stem", (clip(0, 366, 107, 472, 142.5),)),
    21: CropSpec("stem", (clip(0, 366, 300, 477, 340),)),
    # All six labelled solids are necessary for the option semantics.
    27: CropSpec("stem", (clip(0, 366, 615.2, 440, 653.5),)),
    34: CropSpec("stem", (clip(1, 98, 208.5, 149, 247.5),)),
    35: CropSpec("stem", (clip(1, 101, 285.5, 233, 327),)),
    38: CropSpec("stem", (clip(1, 96, 513, 250, 570),)),
    39: CropSpec("stem", (clip(1, 101.5, 608.5, 141.4, 628.7),)),
    45: CropSpec("stem", (clip(1, 370.5, 243.2, 399, 257.5),)),
    55: CropSpec("stem", (clip(1, 367.8, 737.2, 416.6, 773.5),)),
    60: CropSpec("stem", (clip(2, 100, 316, 254, 368.5),)),
    70: CropSpec("stem", (clip(2, 371, 222.5, 486, 283),)),
    71: CropSpec("stem", (clip(2, 371, 322, 431, 371),)),
    73: CropSpec(
        "stem",
        (clip(2, 432, 445.7, 451.8, 465.5), clip(2, 364, 480, 470, 552)),
    ),
    88: CropSpec("stem", (clip(3, 102, 719, 133, 740.5),)),
    93: CropSpec("stem", (clip(3, 367.9, 207, 455.2, 236.7),)),
}


def render_crop(doc: fitz.Document, spec: CropSpec) -> fitz.Pixmap:
    """Render approved fragments and stack them on an opaque RGB canvas."""
    fragments: list[fitz.Pixmap] = []
    for source in spec.clips:
        if not 0 <= source.page < len(doc):
            raise ValueError(f"invalid page index: {source.page}")
        page = doc[source.page]
        rect = fitz.Rect(source.rect)
        if rect.is_empty or not page.rect.contains(rect):
            raise ValueError(f"invalid clip on page {source.page + 1}: {rect}")
        pix = page.get_pixmap(
            matrix=fitz.Matrix(ZOOM, ZOOM),
            colorspace=fitz.csRGB,
            clip=rect,
            alpha=False,
        )
        pix.set_origin(0, 0)
        fragments.append(pix)

    width = max(pix.width for pix in fragments) + OUTPUT_PADDING * 2
    height = (
        sum(pix.height for pix in fragments)
        + FRAGMENT_GAP * (len(fragments) - 1)
        + OUTPUT_PADDING * 2
    )
    canvas = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, width, height), False)
    canvas.clear_with(255)

    y = OUTPUT_PADDING
    for pix in fragments:
        x = (width - pix.width) // 2
        pix.set_origin(x, y)
        canvas.copy(pix, pix.irect)
        y += pix.height + FRAGMENT_GAP
    return canvas


def locate_terms(doc: fitz.Document, terms: list[str]) -> int:
    """Print one-based page numbers and PDF-point rectangles for search terms."""
    found_all = True
    for term in terms:
        matches: list[tuple[int, fitz.Rect]] = []
        for page_index, page in enumerate(doc):
            matches.extend((page_index, rect) for rect in page.search_for(term))
        if not matches:
            print(f'{term!r}: not found', file=sys.stderr)
            found_all = False
            continue
        for page_index, rect in matches:
            page = doc[page_index]
            midpoint = page.rect.width / 2
            column_x0, column_x1 = (
                (36.0, midpoint - 2) if rect.x0 < midpoint else (midpoint + 2, 560.0)
            )
            context_rect = fitz.Rect(
                column_x0,
                max(0, rect.y0 - 2),
                column_x1,
                min(page.rect.height, rect.y1 + 2),
            )
            context = " ".join(page.get_textbox(context_rect).split())
            print(
                f'{term!r}: page={page_index + 1} '
                f'rect=({rect.x0:.1f},{rect.y0:.1f},{rect.x1:.1f},{rect.y1:.1f}) '
                f'context="{context}"'
            )
    return 0 if found_all else 1


def render_grid_pages(
    doc: fitz.Document, page_numbers: list[int], output_dir: Path
) -> int:
    """Render temporary coordinate grids without touching the committed images."""
    invalid = [number for number in page_numbers if not 1 <= number <= len(doc)]
    if invalid:
        print(f"頁碼超出範圍: {invalid}", file=sys.stderr)
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)
    for page_number in page_numbers:
        source_index = page_number - 1
        source = doc[source_index]
        grid_doc = fitz.open()
        page = grid_doc.new_page(width=source.rect.width, height=source.rect.height)
        page.show_pdf_page(page.rect, doc, source_index)

        for x in range(0, int(page.rect.width) + 1, 25):
            page.draw_line(
                fitz.Point(x, 0),
                fitz.Point(x, page.rect.height),
                color=(1, 0, 0),
                width=0.25,
                stroke_opacity=0.35,
            )
            if x:
                page.insert_text(
                    fitz.Point(x + 1, 9),
                    str(x),
                    fontsize=5,
                    color=(0.8, 0, 0),
                    overlay=True,
                )
        for y in range(0, int(page.rect.height) + 1, 25):
            page.draw_line(
                fitz.Point(0, y),
                fitz.Point(page.rect.width, y),
                color=(1, 0, 0),
                width=0.25,
                stroke_opacity=0.35,
            )
            if y:
                page.insert_text(
                    fitz.Point(1, y - 1),
                    str(y),
                    fontsize=5,
                    color=(0.8, 0, 0),
                    overlay=True,
                )

        output_path = output_dir / f"math-page-{page_number}-grid.png"
        page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(output_path)
        grid_doc.close()
        try:
            display_path = output_path.relative_to(REPO_ROOT)
        except ValueError:
            display_path = output_path
        print(display_path)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        nargs="*",
        metavar="math-qN",
        help="只重裁指定圖片,如 math-q25",
    )
    parser.add_argument(
        "--list", action="store_true", help="只列出人工核定裁切範圍,不輸出圖片"
    )
    parser.add_argument(
        "--locate",
        nargs="+",
        metavar="TEXT",
        help='列出文字的頁碼與 PDF 點座標,例如 --locate "25."',
    )
    parser.add_argument(
        "--grid",
        nargs="*",
        type=int,
        metavar="PAGE",
        help="輸出帶 25 點座標格線的暫存頁;省略頁碼時輸出全部頁",
    )
    parser.add_argument(
        "--grid-dir",
        type=Path,
        default=DEFAULT_GRID_DIR,
        help="--grid 輸出目錄(預設 tmp/pdfs/exam-crop-grid)",
    )
    args = parser.parse_args()

    wanted = set(CROP_SPECS)
    if args.only:
        wanted = {int(re.sub(r"\D", "", name)) for name in args.only}
        unknown = wanted - set(CROP_SPECS)
        if unknown:
            print(f"未設定裁切模式的題號: {sorted(unknown)}", file=sys.stderr)
            return 1

    doc = fitz.open(PDF_PATH)
    if args.locate:
        return locate_terms(doc, args.locate)
    if args.grid is not None:
        page_numbers = args.grid or list(range(1, len(doc) + 1))
        output_dir = args.grid_dir
        if not output_dir.is_absolute():
            output_dir = REPO_ROOT / output_dir
        return render_grid_pages(doc, page_numbers, output_dir)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for number in sorted(wanted):
        spec = CROP_SPECS[number]
        if args.list:
            rects = " + ".join(
                f"p{source.page + 1}:({source.rect[0]:g},{source.rect[1]:g},"
                f"{source.rect[2]:g},{source.rect[3]:g})"
                for source in spec.clips
            )
            print(f"math-q{number}.png  mode={spec.mode}  {rects}")
            continue
        pix = render_crop(doc, spec)
        out_path = OUTPUT_DIR / f"math-q{number}.png"
        pix.save(out_path)
        print(
            f"math-q{number}.png  ({pix.width}x{pix.height}, "
            f"mode={spec.mode}, fragments={len(spec.clips)})"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
