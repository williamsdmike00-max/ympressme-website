"""
One-shot script: crop the 6 ChatGPT-generated YMPRESSME product photos
from Downloads to 16:10 aspect ratio and save into assets/ with the
target filenames the homepage already references.

Pillow does the lifting. Center-crop with a slight top-bias for
portrait-orientation sources (preserves brand neon when present).

Run once, then delete or commit (this script is non-essential).
"""

from pathlib import Path
from PIL import Image

DOWNLOADS = Path("C:/Users/willi/Downloads")
ASSETS = Path("C:/Users/willi/Downloads/Ympressme/Ympressme website/assets")

# Source filename -> target filename (verified by visual inspection)
MAPPING = {
    "ChatGPT Image Apr 28, 2026, 08_25_16 AM.png": "product-uniforms.png",
    "ChatGPT Image Apr 28, 2026, 08_25_20 AM.png": "product-bulk.png",
    "ChatGPT Image Apr 28, 2026, 08_25_30 AM.png": "product-gang-sheet.png",
    "ChatGPT Image Apr 28, 2026, 08_25_34 AM.png": "product-dtf-skulls.png",
    "ChatGPT Image Apr 28, 2026, 08_25_38 AM.png": "product-tee-legend.png",
    "ChatGPT Image Apr 28, 2026, 08_26_05 AM.png": "product-event.png",
}

TARGET_W = 1200
TARGET_RATIO = 16 / 10  # = 1.6
TARGET_H = int(TARGET_W / TARGET_RATIO)  # 750


def smart_crop_to_16_10(img: Image.Image) -> Image.Image:
    """Crop image to 16:10. For portrait/tall sources, keep slightly
    above center (top-bias of ~10%) so brand neon at top has a chance
    to survive. For landscape sources, center crop horizontally."""
    w, h = img.size
    cur_ratio = w / h

    if cur_ratio > TARGET_RATIO:
        # Wider than target: crop sides equally
        new_w = int(h * TARGET_RATIO)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    else:
        # Taller than target: crop top + bottom; bias slightly toward top
        new_h = int(w / TARGET_RATIO)
        # Bias: 40% of the trim from top, 60% from bottom (preserves brand neon)
        total_trim = h - new_h
        top = int(total_trim * 0.40)
        return img.crop((0, top, w, top + new_h))


def main() -> None:
    for src_name, target_name in MAPPING.items():
        src_path = DOWNLOADS / src_name
        target_path = ASSETS / target_name

        if not src_path.exists():
            print(f"MISSING: {src_path}")
            continue

        with Image.open(src_path) as img:
            img = img.convert("RGB")  # drop alpha if any
            cropped = smart_crop_to_16_10(img)
            resized = cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)
            resized.save(target_path, "PNG", optimize=True)
            old_size = src_path.stat().st_size
            new_size = target_path.stat().st_size
            print(
                f"OK  {target_name:30s}  {img.size} -> {resized.size}  "
                f"({old_size:,} -> {new_size:,} bytes)"
            )


if __name__ == "__main__":
    main()
