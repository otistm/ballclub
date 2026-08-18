"""Knock out black backgrounds and write 256px badge PNGs."""
from collections import deque
from pathlib import Path

from PIL import Image

SRC = Path(r"C:\Users\p0psi\.cursor\projects\c-Users-p0psi-Desktop-Playto-Ballclub\assets")
DST = Path(r"C:\Users\p0psi\Desktop\Playto\Ballclub\apps\client\public\badges")
SIZE = 256
# Leave a ring of team color around the art.
FILL = 0.72
BG = 28

KEYS = {
    "alpha-wolves": "wolf",
    "charging-bulls": "bull",
    "classic-baseball": "ball",
    "comet-fireball": "comet",
    "fire-dragons": "dragon",
    "fitted-cap": "cap",
    "gold-allstars": "star",
    "grizzly-bears": "bear",
    "heavy-bombers": "bomb",
    "mariners-anchor": "anchor",
    "navigators-compass": "compass",
    "ocean-sharks": "shark",
    "outlaw-skulls": "skull",
    "royal-kings": "crown",
    "soaring-eagles": "eagle",
    "thunder-bolts": "bolt",
    "victory-champions": "trophy",
    "volcano-erupt": "volcano",
    "vortex-spin": "vortex",
    "wild-panthers": "panther",
}


def is_bg(p):
    return max(p[0], p[1], p[2]) <= BG and p[3] > 8


def knockout(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = bytearray(w * h)
    q = deque()

    def push(x, y):
        i = y * w + x
        if seen[i]:
            return
        if not is_bg(px[x, y]):
            return
        seen[i] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        if x:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)

    # Soften the fringe so cut edges are not a hard black halo.
    fade = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            m = max(r, g, b)
            edge = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    edge = True
                    break
            if edge and m < 90:
                fade.append((x, y, int(255 * m / 90)))
    for x, y, a in fade:
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, a)
    return im


def fit(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cropped = im.crop(bbox)
    cw, ch = cropped.size
    side = int(max(cw, ch) / FILL)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    return canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def key_for(name: str) -> str:
    for slug, key in KEYS.items():
        if slug in name:
            return key
    raise SystemExit("unmapped file: " + name)


def main():
    DST.mkdir(parents=True, exist_ok=True)
    files = list(SRC.glob("*.png"))
    if len(files) != 20:
        raise SystemExit(f"expected 20 pngs, got {len(files)}")
    for src in files:
        key = key_for(src.name)
        out = DST / f"{key}.png"
        im = fit(knockout(Image.open(src)))
        im.save(out, "PNG", optimize=True)
        print(f"{key:10} {out.stat().st_size // 1024}kb")


if __name__ == "__main__":
    main()
