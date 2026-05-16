#!/usr/bin/env python3
"""
Slice Hoon.png / Joon.png composite sheets into per-frame PNGs under assets/characters/.

Heuristic pipeline (matches MASTER_PLAN §3.1):
- Grid: top row 2 cells, bottom row 3 cells (integer split for 2390x1792 sheets).
- Top crop: detect FILE/text band via per-row luminance std, then find first stable
  "content" rows below it; start export at (content_start - 2) px (1-2px margin above body).
- Transparency: remove flat gray / checker-like background (low saturation mid-luminance).

Requires: Pillow, NumPy (project venv: python3 -m venv .venv && pip install Pillow numpy).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "characters"


def sheet_cells(w: int, h: int) -> list[tuple[int, int, int, int]]:
    """Return PIL crop boxes (l, t, r, b) exclusive right/bottom for 2+3 layout."""
    half_w_l = w // 2
    half_w_r = w - half_w_l
    row_h = h // 2
    # bottom row widths sum to w
    w0 = w // 3
    w1 = w // 3
    w2 = w - w0 - w1
    y0 = 0
    y1 = row_h
    y2 = h
    return [
        (0, y0, half_w_l, y1),
        (half_w_l, y0, half_w_l + half_w_r, y1),
        (0, y1, w0, y2),
        (w0, y1, w0 + w1, y2),
        (w0 + w1, y1, w0 + w1 + w2, y2),
    ]


def first_text_run_end(row_std: np.ndarray, thr: float = 45.0) -> int:
    """Last row index of the first contiguous high-variance band (label text)."""
    h = row_std.shape[0]
    i = 0
    while i < h and row_std[i] <= thr:
        i += 1
    if i >= h:
        return -1
    while i < h and row_std[i] > thr:
        i += 1
    return i - 1


def content_start_row(row_std: np.ndarray, text_end: int, quiet_thr: float = 3.0) -> int:
    """First row after label band where texture appears (3 consecutive mildly varying rows)."""
    h = len(row_std)
    start = max(0, text_end + 1)
    for j in range(start, h - 3):
        if row_std[j] > quiet_thr and row_std[j + 1] > quiet_thr and row_std[j + 2] > quiet_thr:
            return int(j)
    return start


def top_inset_for_cell(rgb: np.ndarray) -> int:
    """Rows to shave from the top of the cell image (>=0)."""
    rgb_f = rgb.astype(np.float32)
    y = 0.299 * rgb_f[..., 0] + 0.587 * rgb_f[..., 1] + 0.114 * rgb_f[..., 2]
    row_std = y.std(axis=1)
    te = first_text_run_end(row_std)
    if te < 0:
        return 0
    cs = content_start_row(row_std, te)
    margin = 2  # 1-2px above character start; use 2
    return max(0, cs - margin)


def apply_sprite_alpha(rgba: Image.Image) -> Image.Image:
    """Turn checker / flat matte backgrounds into transparency."""
    a = np.array(rgba.convert("RGBA"))
    rgb = a[..., :3].astype(np.int16)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    y = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)
    # Mid-gray flat regions (checker averages to mid gray with low sat)
    bg = (sat < 22) & (y > 68.0) & (y < 242.0)
    a[..., 3] = np.where(bg, 0, a[..., 3])
    return Image.fromarray(a, "RGBA")


def trim_and_save(img_rgba: Image.Image, path: Path) -> None:
    bbox = img_rgba.getbbox()
    if bbox is None:
        out = img_rgba
    else:
        out = img_rgba.crop(bbox)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, optimize=True)


def process_sheet(src_name: str, prefix: str) -> None:
    src = ASSETS / src_name
    if not src.exists():
        print(f"skip missing {src}", file=sys.stderr)
        return
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    boxes = sheet_cells(w, h)
    names = ["idle1", "idle2", "move1", "move2", "move3"]
    for box, name in zip(boxes, names):
        cell = im.crop(box)
        arr = np.array(cell.convert("RGB"))
        inset = 0
        # Legacy large source sheets included title bands.
        if h >= 900:
            inset = top_inset_for_cell(arr)
        cropped = cell.crop((0, inset, cell.size[0], cell.size[1]))
        rgba = cropped.convert("RGBA")
        if h >= 900:
            rgba = apply_sprite_alpha(rgba)
        out_path = OUT / f"{prefix}_{name}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        rgba.save(out_path, optimize=True)
        print("wrote", out_path.relative_to(ROOT), "inset", inset, "size", rgba.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    process_sheet("Hoon.png", "hoon")
    process_sheet("Hoon.jpeg", "hoon")
    process_sheet("Joon.png", "joon")
    process_sheet("Joon.jpeg", "joon")


if __name__ == "__main__":
    main()
