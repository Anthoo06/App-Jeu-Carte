"""Coins de fleurs de La Donne, dessinés en SVG, style illustration (contour foncé, aplats, reflets, ombres).
Chaque fleur : un coin en L (bas-gauche) dans une boîte 100 × 130 ; le coin haut-droite est le même tourné de 180°."""
import sys, json, math, random

OUT = sys.argv[1]  # ex. : python3 tools/dessine-fleurs.py www/flowers (puis supprimer manifest.json)
INK = '#2B2420'
SW = 0.9

def f(x): return f'{x:.2f}'.rstrip('0').rstrip('.')
def pt(cx, cy, r, a): return cx + r * math.cos(a), cy + r * math.sin(a)

class Doc:
    def __init__(self, seed):
        self.parts, self.defs, self.rnd, self.gid = [], [], random.Random(seed), 0
    def add(self, s): self.parts.append(s)
    def grad(self, c1, c2, cx=.35, cy=.3):
        self.gid += 1
        gid = f'g{self.gid}'
        self.defs.append(f"<radialGradient id='{gid}' cx='{cx}' cy='{cy}' r='.85'><stop offset='0' stop-color='{c1}'/><stop offset='1' stop-color='{c2}'/></radialGradient>")
        return f'url(#{gid})'
    def svg(self, rotate=False):
        body = ''.join(self.parts)
        if rotate: body = f"<g transform='rotate(180 50 65)'>{body}</g>"
        return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 130'><defs>{''.join(self.defs)}</defs>"
                f"<g stroke='{INK}' stroke-width='{SW}' stroke-linejoin='round' stroke-linecap='round'>{body}</g></svg>")

# ---------- éléments communs ----------
def stem(d, path, w=2.2, c='#4E7A3A', hi='#7FAE5C', ink=1.4):
    d.add(f"<path d='{path}' fill='none' stroke='{INK}' stroke-width='{w + ink}'/>")
    d.add(f"<path d='{path}' fill='none' stroke='{c}' stroke-width='{w}'/>")
    d.add(f"<path d='{path}' fill='none' stroke='{hi}' stroke-width='{w * .35}' stroke-opacity='.8'/>")

def leaf(d, x, y, ang, L=12, W=5, c1='#8CBF63', c2='#3F6E30'):
    g = d.grad(c1, c2, .3, .3)
    p = f'M0 0C{f(W)} {f(-L*.25)} {f(W*.9)} {f(-L*.8)} 0 {f(-L)}C{f(-W*.9)} {f(-L*.8)} {f(-W)} {f(-L*.25)} 0 0Z'
    d.add(f"<g transform='translate({f(x)} {f(y)}) rotate({f(ang)})'><path d='{p}' fill='{g}'/>"
          f"<path d='M0 -1 Q{f(W*.15)} {f(-L*.5)} 0 {f(-L*.9)}' fill='none' stroke-width='.6' stroke='#2E4F24'/></g>")

def leaves_along(d, pts, every=2, L=11, W=4.5):
    for i, (x, y, a) in enumerate(pts):
        if i % every == 0:
            side = 1 if i % (2 * every) == 0 else -1
            leaf(d, x, y, a + side * (55 + d.rnd.uniform(-10, 10)), L * d.rnd.uniform(.85, 1.15), W)

def L_path():
    # tige en L : du haut du bord gauche vers le coin, puis le long du bas
    return 'M7 8C4 40 6 80 9 110Q12 122 26 122C50 122 72 121 94 118'

def L_points(n=14):
    # points (x, y, angle de la tige en degrés) le long de la tige en L
    pts = []
    for i in range(n):
        t = i / (n - 1)
        if t < .6:
            u = t / .6; pts.append((7 - 2 * math.sin(u * 3) + u * 2, 8 + u * 100, 180))
        else:
            u = (t - .6) / .4; pts.append((20 + u * 72, 121 - u * 3, 270))
    return pts

# ---------- fleurs ----------
def rose(d, x, y, r, base='#B3192B', light='#E04B57', dark='#7A0F1C'):
    g = d.grad(light, base); gd = d.grad(base, dark)
    for k in range(5):
        a = k * 2 * math.pi / 5 + .3
        px, py = pt(x, y, r * .45, a)
        d.add(f"<circle cx='{f(px)}' cy='{f(py)}' r='{f(r*.55)}' fill='{gd}'/>")
    for k in range(4):
        a = k * 2 * math.pi / 4 + .9
        px, py = pt(x, y, r * .25, a)
        d.add(f"<circle cx='{f(px)}' cy='{f(py)}' r='{f(r*.42)}' fill='{g}'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.34)}' fill='{base}'/>")
    s = r * .3
    d.add(f"<path d='M{f(x-s*.2)} {f(y)}a{f(s*.4)} {f(s*.4)} 0 1 1 {f(s*.6)} {f(s*.3)}a{f(s*.7)} {f(s*.7)} 0 1 1 {f(-s*1.3)} {f(-s*.5)}' fill='none' stroke-width='.8'/>")
    d.add(f"<path d='M{f(x-r*.5)} {f(y-r*.2)}q{f(r*.2)} {f(-r*.35)} {f(r*.55)} {f(-r*.4)}' fill='none' stroke='#fff' stroke-opacity='.45' stroke-width='1'/>")

def rosebud(d, x, y, r, ang):
    g = d.grad('#E04B57', '#8E1322')
    d.add(f"<g transform='translate({f(x)} {f(y)}) rotate({f(ang)})'><path d='M0 {f(-r)}C{f(r*.9)} {f(-r*.6)} {f(r*.7)} {f(r*.5)} 0 {f(r*.6)}C{f(-r*.7)} {f(r*.5)} {f(-r*.9)} {f(-r*.6)} 0 {f(-r)}Z' fill='{g}'/>"
          f"<path d='M{f(-r*.6)} {f(r*.3)}Q0 {f(-r*.1)} {f(r*.6)} {f(r*.3)}L{f(r*.2)} {f(r*.9)}L{f(-r*.2)} {f(r*.9)}Z' fill='#4E7A3A'/></g>")

def floret4(d, x, y, r, c1, c2, rot):
    g = d.grad(c1, c2)
    pts = []
    for k in range(4):
        a = rot + k * math.pi / 2
        px, py = pt(x, y, r * .55, a)
        d.add(f"<ellipse cx='{f(px)}' cy='{f(py)}' rx='{f(r*.45)}' ry='{f(r*.38)}' transform='rotate({f(math.degrees(a))} {f(px)} {f(py)})' fill='{g}' stroke-width='.5'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.18)}' fill='#F4F1FF' stroke-width='.4'/>")

def hydrangea(d, x, y, R, shades=(('#9AA8FF', '#4E5BD6'), ('#B9A2FF', '#6A4CCF'), ('#8FC2FF', '#3F6FCC'))):
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(R)}' fill='{d.grad('#7F86E8', '#3A3F9E')}'/>")
    cells = []
    for i in range(int(R * R * .5)):
        a = d.rnd.uniform(0, 2 * math.pi); rr = R * math.sqrt(d.rnd.uniform(0, 1)) * .85
        cells.append(pt(x, y, rr, a))
    cells.sort(key=lambda p: p[1])
    for px, py in cells:
        c1, c2 = d.rnd.choice(shades)
        floret4(d, px, py, R * .32, c1, c2, d.rnd.uniform(0, 1.5))

def ivy(d, x, y, s, ang):
    g = d.grad('#86B85A', '#2F5A26')
    p = ('M0 0C-3 -2 -9 -2 -10 -6C-8 -7 -6 -8 -7 -11C-4 -11 -3 -13 -2 -16C0 -15 1 -15 2 -16C3 -13 4 -11 7 -11'
         'C6 -8 8 -7 10 -6C9 -2 3 -2 0 0Z')
    d.add(f"<g transform='translate({f(x)} {f(y)}) rotate({f(ang)}) scale({f(s)})'><path d='{p}' fill='{g}'/>"
          f"<path d='M0 0L0 -13M0 -3L-7 -8M0 -3L7 -8' fill='none' stroke='#DDEBC0' stroke-width='.5'/></g>")

def lily(d, x, y, n, ang, s=1):
    # tige arquée avec clochettes blanches pendantes
    d.add(f"<g transform='translate({f(x)} {f(y)}) rotate({f(ang)}) scale({f(s)})'>")
    stem(d, 'M0 0Q6 -14 2 -30', .45 / s, '#5B8C40', '#9CC874', .5 / s)
    for k in range(n):
        t = (k + 1) / (n + 1)
        bx, by = 6 * t * (1 - t) * 4 * .6 + 2 * t, -30 * t
        hx = bx + 4.5
        d.add(f"<path d='M{f(bx)} {f(by)}L{f(hx)} {f(by+1)}' fill='none' stroke-width='.5'/>")
        d.add(f"<path d='M{f(hx-2.6)} {f(by+1.5)}C{f(hx-2.6)} {f(by-1.5)} {f(hx+2.6)} {f(by-1.5)} {f(hx+2.6)} {f(by+1.5)}"
              f"l-.8 1.3-.9-.9-.9 .9-.9-.9-.9 .9-.8-1.3Z' fill='{d.grad('#FFFFFF', '#D9E3D0')}' stroke-width='.6'/>")
    d.add('</g>')

def nasturtium(d, x, y, r, c1='#FFC23D', c2='#E8701C'):
    g = d.grad(c1, c2, .5, .5)
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        d.add(f"<path d='M0 0C{f(-r*.55)} {f(-r*.35)} {f(-r*.6)} {f(-r*1.05)} 0 {f(-r*1.05)}C{f(r*.6)} {f(-r*1.05)} {f(r*.55)} {f(-r*.35)} 0 0Z' "
              f"transform='translate({f(x)} {f(y)}) rotate({f(math.degrees(a)+90)})' fill='{g}'/>")
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2
        ex, ey = pt(x, y, r * .55, a)
        d.add(f"<path d='M{f(x)} {f(y)}L{f(ex)} {f(ey)}' fill='none' stroke='#A2321A' stroke-width='.6'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.16)}' fill='#7A2A12' stroke-width='.4'/>")

def padleaf(d, x, y, r):
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r)}' fill='{d.grad('#9FCB6E', '#4C7F36')}'/>")
    for k in range(9):
        ex, ey = pt(x, y, r * .85, k * 2 * math.pi / 9)
        d.add(f"<path d='M{f(x)} {f(y)}L{f(ex)} {f(ey)}' fill='none' stroke='#E8F3D2' stroke-width='.45'/>")

def lavender(d, x, y, L, ang):
    d.add(f"<g transform='translate({f(x)} {f(y)}) rotate({f(ang)})'>")
    stem(d, f'M0 0Q{f(L*.04)} {f(-L*.5)} 0 {f(-L)}', .55, '#6E8A55', '#A5C08A', .45)
    n = int(L * .22)
    for k in range(n):
        t = k / n
        yy = -L * .45 - t * L * .55 - (1 - t) * 1.5 * (k % 2)
        w = 2.0 * (1 - t * .55)
        for side in (-1, 1):
            c = d.rnd.choice(['#9C7BD6', '#7B57C2', '#B597E8'])
            d.add(f"<ellipse cx='{f(side*w*.55)}' cy='{f(yy)}' rx='{f(w*.55)}' ry='{f(w*.75)}' fill='{c}' stroke-width='.45' transform='rotate({f(side*25)} {f(side*w*.55)} {f(yy)})'/>")
    d.add('</g>')

def forgetmenot(d, x, y, r):
    g = d.grad('#9FDDFF', '#2E8FD0')
    for k in range(5):
        px, py = pt(x, y, r * .55, k * 2 * math.pi / 5 + .2)
        d.add(f"<circle cx='{f(px)}' cy='{f(py)}' r='{f(r*.48)}' fill='{g}' stroke-width='.55'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.28)}' fill='#FFF7D6' stroke-width='.45'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.12)}' fill='#F2B705' stroke='none'/>")

def peony(d, x, y, r):
    layers = [(1.0, 9, '#F7A9CC', '#C2306E'), (.75, 8, '#FBC4DC', '#D9487F'), (.5, 7, '#FFD7E8', '#E3639A')]
    for scale, n, c1, c2 in layers:
        g = d.grad(c1, c2, .5, .2)
        for k in range(n):
            a = k * 2 * math.pi / n + scale * 2
            px, py = pt(x, y, r * scale * .45, a)
            rx, ry = r * scale * .42, r * scale * .32
            d.add(f"<path d='M{f(px-rx)} {f(py)}Q{f(px-rx*.6)} {f(py-ry*1.3)} {f(px)} {f(py-ry)}Q{f(px+rx*.6)} {f(py-ry*1.3)} {f(px+rx)} {f(py)}"
                  f"Q{f(px)} {f(py+ry*1.2)} {f(px-rx)} {f(py)}Z' transform='rotate({f(math.degrees(a)+90)} {f(px)} {f(py)})' fill='{g}'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.18)}' fill='#F8D46A' stroke-width='.5'/>")

def sunflower(d, x, y, r):
    for layer, (n, c1, c2, off) in enumerate([(16, '#FFC93C', '#E08A00', 0), (16, '#FFE07A', '#F0A500', math.pi / 16)]):
        g = d.grad(c1, c2, .5, .8)
        ln = r * (1 if layer == 0 else .85)
        for k in range(n):
            a = k * 2 * math.pi / n + off
            d.add(f"<path d='M0 {f(-r*.35)}Q{f(r*.12)} {f(-(r*.35+ln*.4))} 0 {f(-(r*.35+ln*.65))}Q{f(-r*.12)} {f(-(r*.35+ln*.4))} 0 {f(-r*.35)}Z' "
                  f"transform='translate({f(x)} {f(y)}) rotate({f(math.degrees(a))})' fill='{g}' stroke-width='.55'/>")
    d.add(f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(r*.4)}' fill='{d.grad('#8A5A2B', '#3E2410')}'/>")
    for k in range(22):
        a = k * 2.4; rr = r * .34 * math.sqrt(k / 22)
        px, py = pt(x, y, rr, a)
        d.add(f"<circle cx='{f(px)}' cy='{f(py)}' r='{f(r*.035)}' fill='#C9924C' stroke='none'/>")

# ---------- compositions en L ----------
def compose(k):
    d = Doc(k * 7 + 3)
    P = L_points(18)
    if k == 0:   # roses
        stem(d, L_path(), 2.2, '#4E6B34', '#86A35A')
        leaves_along(d, P, 1, 15, 6.5)
        rosebud(d, 7, 9, 5, 0); rosebud(d, 93, 116, 5, 90); rosebud(d, 12, 40, 4.5, -20)
        rose(d, 9, 58, 10); rose(d, 66, 119, 10); rose(d, 40, 121, 13); rose(d, 10, 86, 13); rose(d, 18, 112, 20)
    elif k == 1:  # hortensias
        stem(d, L_path(), 2, '#4E7A3A', '#7FAE5C')
        leaves_along(d, P, 1, 17, 8)
        hydrangea(d, 9, 20, 9); hydrangea(d, 76, 116, 10); hydrangea(d, 11, 56, 13); hydrangea(d, 46, 116, 14); hydrangea(d, 18, 102, 21)
    elif k == 2:  # lierre et muguet
        stem(d, L_path(), 1.6, '#4E7A3A', '#7FAE5C')
        for i, (x, y, a) in enumerate(P):
            ivy(d, x + (4 if i % 2 else -2), y + (0 if i % 2 else 3), 1.0 + .35 * ((i * 7) % 3) / 2, a + (65 if i % 2 else -65))
        for x, y, a, n, s in [(14, 96, 8, 7, 1.9), (36, 116, 62, 7, 1.7), (10, 52, 14, 6, 1.5), (66, 118, 75, 5, 1.4), (8, 24, 8, 5, 1.2)]:
            lily(d, x, y, n, a, s)
    elif k == 3:  # capucines
        stem(d, L_path(), 2, '#5E8C3A', '#93C066')
        for x, y, r in [(26, 92, 13), (44, 108, 11), (12, 66, 11), (74, 110, 9), (10, 34, 9), (30, 122, 9)]: padleaf(d, x, y, r)
        nasturtium(d, 9, 14, 8, '#FFE16B', '#F2A20C'); nasturtium(d, 88, 118, 8, '#FF9A4D', '#C8410E')
        nasturtium(d, 10, 50, 11, '#FF9A4D', '#C8410E'); nasturtium(d, 60, 120, 11, '#FFE16B', '#F2A20C')
        nasturtium(d, 12, 82, 12, '#FFC23D', '#E8701C'); nasturtium(d, 18, 113, 17)
    elif k == 4:  # lavande
        for i in range(9):
            lavender(d, 9 + i * 1.2, 124, 58 + d.rnd.uniform(0, 50), -10 + i * 3.2)
        for i in range(8):
            lavender(d, 7, 123 - i * 1.2, 50 + d.rnd.uniform(0, 40), 100 - i * 4.5)
        for i in range(5): leaf(d, 10 + i, 120, -20 + i * 28, 24, 2.6, '#9DB58A', '#55704A')
    elif k == 5:  # myosotis
        stem(d, L_path(), 1.5, '#5B8C40', '#9CC874')
        leaves_along(d, P, 2, 13, 5)
        for i, (x, y, a) in enumerate(P):
            for j in range(3):
                forgetmenot(d, x + d.rnd.uniform(-7, 7), y + d.rnd.uniform(-7, 5), d.rnd.uniform(3.8, 5.6))
        for j in range(12): forgetmenot(d, 16 + d.rnd.uniform(-11, 11), 110 + d.rnd.uniform(-11, 10), d.rnd.uniform(5, 7))
    elif k == 6:  # pivoines
        stem(d, L_path(), 2.2, '#4E7A3A', '#7FAE5C')
        leaves_along(d, P, 1, 16, 7)
        peony(d, 9, 16, 8); peony(d, 82, 117, 9); peony(d, 11, 50, 13); peony(d, 50, 119, 14); peony(d, 19, 104, 22)
    elif k == 7:  # tournesols
        stem(d, L_path(), 2.4, '#577A2E', '#8DB24F')
        leaves_along(d, P, 1, 17, 8)
        sunflower(d, 9, 14, 8); sunflower(d, 84, 116, 9); sunflower(d, 11, 50, 12); sunflower(d, 52, 117, 13); sunflower(d, 19, 103, 20)
    return d

man = {}
for k in range(8):
    for key, rot in (('bl', False), ('tr', True)):
        open(f'{OUT}/f{k}-{key}.svg', 'w').write(compose(k).svg(rot))
        man[f'f{k}-{key}'] = {'w': 230, 'h': 300, 'cell': [364, 360]}
json.dump(man, open(f'{OUT}/manifest.json', 'w'))
print('ok')
