# Génère l'icône de l'app, les icônes Android et les visuels Play Store (police Nunito, couleurs de l'accueil).
# Usage, depuis la racine du dépôt : python3 docs/play-store/outils/generer-visuels.py <dossier de sortie>
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[3]
OUT = sys.argv[1]
FONT = str(ROOT / "packages/admin/app/fonts" / "Nunito_900Black.ttf")
BLUE_A, BLUE_B = (18, 88, 184), (46, 127, 224)   # dégradé de l'écran d'accueil
TEAL = (19, 162, 154)
LIGHT_TEAL = (95, 211, 203)

def gradient(w, h):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h)
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BLUE_A, BLUE_B))
    return img

def mark(size, color=(255, 255, 255), swoosh=LIGHT_TEAL, scale=1.0):
    """« D » blanc + virgule turquoise, centrés sur un calque transparent de `size` px."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(FONT, int(size * 0.62 * scale))
    box = d.textbbox((0, 0), "D", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (size - w) / 2 - box[0]
    y = (size - h) / 2 - box[1] - size * 0.06 * scale
    d.text((x, y), "D", font=font, fill=color)
    # virgule sous la lettre, comme sous « Learn » dans le logo
    cx, top = size / 2, (size + h) / 2 + size * 0.015 * scale
    sw, sh = size * 0.42 * scale, size * 0.075 * scale
    d.rounded_rectangle([cx - sw / 2, top, cx + sw / 2, top + sh], radius=sh / 2, fill=swoosh)
    return layer

# Icône principale (1024, opaque) et icône Play Store (512)
icon = gradient(1024, 1024).convert("RGBA")
icon.alpha_composite(mark(1024))
icon.convert("RGB").save(f"{OUT}/icon.png")
icon.convert("RGB").resize((512, 512), Image.LANCZOS).save(f"{OUT}/play-icon-512.png")
icon.convert("RGB").resize((48, 48), Image.LANCZOS).save(f"{OUT}/favicon.png")

# Icône adaptative Android : premier plan dans la zone sûre (66 %), fond dégradé, monochrome
mark(512, scale=0.66).save(f"{OUT}/android-icon-foreground.png")
gradient(512, 512).save(f"{OUT}/android-icon-background.png")
mono = mark(512, color=(255, 255, 255), swoosh=(255, 255, 255), scale=0.66)
mono.save(f"{OUT}/android-icon-monochrome.png")

# Bannière Play Store 1024 × 500 : logo, slogan, illustration de l'accueil
banner = gradient(1024, 500).convert("RGBA")
ill = Image.open(ROOT / "packages/app/assets/illustrations/welcome.png").convert("RGBA")
ih = 500
iw = round(ill.width * ih / ill.height)
ill = ill.resize((iw, ih), Image.LANCZOS).crop((130, 0, iw, ih))
iw = ill.width
# fondu à gauche de l'illustration
fade = Image.new("L", (iw, ih), 255)
fd = ImageDraw.Draw(fade)
for x in range(160):
    fd.line([(x, 0), (x, ih)], fill=round(255 * x / 160))
ill.putalpha(fade)
banner.alpha_composite(ill, (1024 - iw, 0))
d = ImageDraw.Draw(banner)
f_logo = ImageFont.truetype(FONT, 66)
f_tag = ImageFont.truetype(str(ROOT / "packages/admin/app/fonts" / "Nunito_700Bold.ttf"), 28)
x0, y0 = 56, 150
d.text((x0, y0), "Drive", font=f_logo, fill="white")
wd = d.textlength("Drive", font=f_logo)
d.text((x0 + wd, y0), "Learn", font=f_logo, fill=LIGHT_TEAL)
wl = d.textlength("Learn", font=f_logo)
d.rounded_rectangle([x0 + wd + wl * 0.15, y0 + 84, x0 + wd + wl * 0.85, y0 + 94], radius=6, fill=LIGHT_TEAL)
d.text((x0, y0 + 124), "Apprends à conduire", font=f_tag, fill="white")
d.text((x0, y0 + 160), "avec confiance", font=f_tag, fill="white")
banner.convert("RGB").save(f"{OUT}/feature-graphic-1024x500.png")
print("ok")
