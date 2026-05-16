#!/usr/bin/env python3
"""
Make assets/mom.png and assets/daddy.png use RGBA with transparent studio background.

Heuristic: near-neutral, bright pixels (typical light gray / white backdrop) become
transparent; character pixels (higher saturation or darker) remain.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def rgba_remove_bright_neutral(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGBA"))
    rgb = a[..., :3].astype(np.int16)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    y = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

    # Light gray / white backdrop (tuned for 1728×2414 helper sheets)
    bg = (sat < 24) & (y > 152) & (y < 258)
    # Very bright whites
    bg |= (y > 242) & (sat < 45)

    a[..., 3] = np.where(bg, 0, a[..., 3])
    out = Image.fromarray(a, "RGBA")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def main() -> None:
    for fname in ("mom.png", "daddy.png"):
        path = ASSETS / fname
        if not path.exists():
            continue
        im = Image.open(path)
        out = rgba_remove_bright_neutral(im)
        out.save(path, optimize=True)
        print("updated", path.relative_to(ROOT), "size", out.size)


if __name__ == "__main__":
    main()
