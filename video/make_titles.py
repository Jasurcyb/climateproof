# Intro/outro title cards 1280x720 for the demo video.
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
BG = (13, 31, 23)
FG = (238, 246, 240)
ACCENT = (52, 199, 123)
MUTED = (148, 168, 155)

def font(size, bold=False):
    for name in (["calibrib", "segoeuib", "arialbd"] if bold else ["calibri", "segoeui", "arial"]):
        try:
            return ImageFont.truetype(f"C:/Windows/Fonts/{name}.ttf", size)
        except OSError:
            continue
    return ImageFont.load_default()

def center(draw, text, y, f, fill):
    w = draw.textlength(text, font=f)
    draw.text(((W - w) / 2, y), text, font=f, fill=fill)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
# subtle grid lines
for x in range(0, W, 64):
    d.line([(x, 0), (x, H)], fill=(20, 43, 31), width=1)
for y in range(0, H, 64):
    d.line([(0, y), (W, y)], fill=(20, 43, 31), width=1)
d.rectangle([0, 0, 14, H], fill=ACCENT)

center(d, "IEEE CLIMATECHAIN GLOBAL HACKATHON 2026", 200, font(26, True), MUTED)
center(d, "ClimateProof", 260, font(96, True), FG)
center(d, "Climate data you can prove.", 400, font(40), ACCENT)
center(d, "Track 4 - Climate Data & Environmental Monitoring", 490, font(28), MUTED)
center(d, "Jasur Maxkamov", 560, font(26, True), FG)
img.save(r"C:\Users\REPUBLIC OF GAMERS\Desktop\Новая папка\climateproof\video\intro.png")

img2 = Image.new("RGB", (W, H), BG)
d2 = ImageDraw.Draw(img2)
for x in range(0, W, 64):
    d2.line([(x, 0), (x, H)], fill=(20, 43, 31), width=1)
for y in range(0, H, 64):
    d2.line([(0, y), (W, y)], fill=(20, 43, 31), width=1)
d2.rectangle([0, 0, 14, H], fill=ACCENT)
center(d2, "Detection by AI.", 220, font(44, True), FG)
center(d2, "Integrity by cryptography.", 280, font(44, True), FG)
center(d2, "Judgement by humans.", 340, font(44, True), ACCENT)
center(d2, "Real ECDSA signatures - SHA-256 hash chain - Merkle proofs - on-device ML", 440, font(24), MUTED)
center(d2, "Data: NOAA GML Mauna Loa CO2 (public domain)", 490, font(22), MUTED)
center(d2, "Thank you", 570, font(34, True), FG)
img2.save(r"C:\Users\REPUBLIC OF GAMERS\Desktop\Новая папка\climateproof\video\outro.png")
print("cards ok")
