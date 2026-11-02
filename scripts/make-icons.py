"""Draw the home-screen icons. Sage field, the daily goal as a numeral."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "public"
SAGE = (25, 25, 25, 255)
INK = (247, 246, 243, 255)
FONT = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"


def draw(size: int, numeral_ratio: float) -> Image.Image:
    image = Image.new("RGBA", (size, size), SAGE)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, int(size * numeral_ratio))
    text = "10"
    box = draw.textbbox((0, 0), text, font=font)
    width = box[2] - box[0]
    height = box[3] - box[1]
    x = (size - width) / 2 - box[0]
    # Optical center sits a little above the mathematical middle.
    y = (size - height) / 2 - box[1] - size * 0.03
    draw.text((x, y), text, font=font, fill=INK)
    return image


def main() -> None:
    icons = ROOT / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    # "any" can sit larger. Maskable stays inside the center 80%.
    draw(192, 0.46).save(icons / "icon-192.png")
    draw(512, 0.46).save(icons / "icon-512.png")
    draw(192, 0.34).save(icons / "icon-maskable-192.png")
    draw(512, 0.34).save(icons / "icon-maskable-512.png")
    draw(180, 0.42).save(ROOT / "apple-touch-icon.png")
    draw(32, 0.5).save(ROOT / "favicon.png")


if __name__ == "__main__":
    main()
