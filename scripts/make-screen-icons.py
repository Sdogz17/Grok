"""Draw the Screen home-screen icons. Same field as Health, a duration instead of a score."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "screen" / "public"
FIELD = (25, 25, 25, 255)
INK = (221, 237, 234, 255)
FONT = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"


def draw(size: int, numeral_ratio: float) -> Image.Image:
    image = Image.new("RGBA", (size, size), FIELD)
    drawing = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, int(size * numeral_ratio))
    text = "2h"
    box = drawing.textbbox((0, 0), text, font=font)
    width = box[2] - box[0]
    height = box[3] - box[1]
    x = (size - width) / 2 - box[0]
    y = (size - height) / 2 - box[1] - size * 0.03
    drawing.text((x, y), text, font=font, fill=INK)
    return image


def main() -> None:
    icons = ROOT / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    draw(192, 0.42).save(icons / "icon-192.png")
    draw(512, 0.42).save(icons / "icon-512.png")
    draw(192, 0.30).save(icons / "icon-maskable-192.png")
    draw(512, 0.30).save(icons / "icon-maskable-512.png")
    draw(180, 0.38).save(ROOT / "apple-touch-icon.png")
    draw(32, 0.46).save(ROOT / "favicon.png")


if __name__ == "__main__":
    main()
