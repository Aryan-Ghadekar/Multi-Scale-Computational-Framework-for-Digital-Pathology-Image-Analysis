import os
from PIL import Image
import openslide

Image.MAX_IMAGE_PIXELS = None  # IMPORTANT for WSI-scale TIFFs

def convert_tif_to_png(
    tif_path: str,
    output_dir: str = "static/previews",
    max_size: int = 2048
) -> str:
    os.makedirs(output_dir, exist_ok=True)

    png_name = os.path.splitext(os.path.basename(tif_path))[0] + ".png"
    png_path = os.path.join(output_dir, png_name)

    try:
        slide = openslide.OpenSlide(tif_path)
        level = slide.level_count - 1
        width, height = slide.level_dimensions[level]

        image = slide.read_region(
            (0, 0),
            level,
            (width, height)
        ).convert("RGB")

        slide.close()

        image.thumbnail((max_size, max_size))
        image.save(png_path, "PNG", optimize=True)

        print("✅ PNG created using OpenSlide")

    except Exception as e:
        print("⚠️ Falling back to Pillow:", e)

        with Image.open(tif_path) as img:
            img = img.convert("RGB")
            img.thumbnail((max_size, max_size))
            img.save(png_path, "PNG", optimize=True)

    # ✅ RETURN URL, NOT FILE PATH
    return f"/static/previews/{png_name}"
