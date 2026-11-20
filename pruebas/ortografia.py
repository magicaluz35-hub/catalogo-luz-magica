# Revisa la ortografía de todo el texto que ve el visitante: nombres y
# descripciones de los 115 productos, datos del negocio, plantillas y los
# mensajes del JavaScript.
#
#   pip install spylls
#   python3 pruebas/ortografia.py
#
# Marca solo palabras que el diccionario no conoce. Las propias del negocio
# (enchape, WPC, Carvalo, Solterón...) están en la lista PROPIAS de abajo:
# si agregas un producto con una palabra nueva legítima, añádela ahí.

import json, re, pathlib
from collections import defaultdict
from spylls.hunspell import Dictionary

d = Dictionary.from_files(str(pathlib.Path(__file__).parent / 'dicc' / 'es_ES'))
R = pathlib.Path(__file__).resolve().parent.parent
textos = []

for f in sorted((R/"contenido/productos").glob("*.json")):
    o = json.loads(f.read_text())
    for k in ("nombre", "descripcion", "plazo"):
        if o.get(k): textos.append((f"{o['sku']} · {k}", o[k]))

for arch in ["categorias", "negocio", "asesores", "grupos"]:
    o = json.loads((R/f"src/_data/{arch}.json").read_text())
    # Campos técnicos: el visitante nunca los lee, y van sin tildes a propósito
    OCULTOS = {"slug","grupo","icono","enlace","hex","foto","fotos","logo","dominio",
               "codigo","whatsapp","telefonoWhatsapp","latitud","longitud","sku","categoria","orden"}
    def rec(x, ruta, clave=None):
        if isinstance(x, str):
            if clave in OCULTOS: return
            if len(x) > 2 and not x.startswith(("http","/img","#","57")) and not re.fullmatch(r"[\d:\s.-]+", x):
                textos.append((f"{arch} · {ruta}", x))
        elif isinstance(x, dict):
            for k, v in x.items(): rec(v, f"{ruta}.{k}" if ruta else k, k)
        elif isinstance(x, list):
            for i, v in enumerate(x): rec(v, f"{ruta}[{i}]", clave)
    rec(o, "")

for f in sorted((R/"src").rglob("*.njk")):
    t = f.read_text()
    for pat in [r"\{#.*?#\}", r"\{\{.*?\}\}", r"\{%.*?%\}", r"<svg.*?</svg>", r"^---.*?^---"]:
        t = re.sub(pat, " ", t, flags=re.S|re.M)
    t = re.sub(r"<[^>]+>", "\n", t)
    for l in t.split("\n"):
        l = l.strip()
        if len(l) > 3 and re.search(r"[a-záéíóúñ]{3}", l): textos.append((f.name, l))

# Solo las cadenas del JS que el visitante llega a leer
js = re.sub(r"//.*", " ", (R/"src/assets/catalogo.js").read_text())
for m in re.finditer(r'"((?:[^"\\]|\\.){8,})"', js):
    s = m.group(1)
    if re.search(r"[áéíóúñ¡¿]", s) or re.search(r"\b(el|la|los|las|de|que|para|con|tu|te|no|un|una)\b", s):
        if not re.search(r"[<>{}\[\]]|data-|\.js|\bvar\b", s): textos.append(("catalogo.js", s))

PROPIAS = {"magica","mágica","wpc","led","leds","rh","sku","whatsapp","aranjuez","carvalo","solterón",
 "kitty","imperia","hello","mdf","clóset","clósets","tiktok","instagram","facebook","nochero","nocheros",
 "enchape","enchapes","tapizado","tapizada","veteado","veteada","modular","modulares","puff","puffs",
 "hollywood","diámetro","corredizo","corredizos","corrediza","corredizas","zapatero","zapateros",
 "showroom","app","online","sena","esquinero","matizado","melamina","lacado","bombillo","bombillos",
 "repisa","repisas","taburete","taburetes","banqueta","banquetas","boho","nórdico","nordico","mini",
 # Nombres de línea en inglés que usa la marca
 "pink","luxury","premium","harmony",
 # Telas y acabados del oficio
 "antifluido","antirasguño","combos","retroiluminado","gamuza","peluche","fronda",
 # Imperativos con pronombre pegado: correctos, el diccionario no los arma
 "imprímelo","guárdalo","verifícalo","visítanos","escríbenos","cuéntanos","úsalo"}

sosp = defaultdict(list)
for origen, t in textos:
    for p in re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}", t):
        b = p.lower()
        if b in PROPIAS or (p.isupper() and len(p) <= 4): continue
        if not d.lookup(b) and not d.lookup(p):
            sosp[b].append((origen, t.strip()[:95]))

print(f"{len(textos)} fragmentos revisados · {len(sosp)} palabras marcadas\n")
for p in sorted(sosp, key=lambda x: (-len(sosp[x]), x)):
    sug = list(d.suggest(p))[:2]
    print(f"{p:20} ×{len(sosp[p]):<3} → {', '.join(sug) if sug else '(sin sugerencia)'}")
    for o, t in sosp[p][:2]: print(f"{'':22}   {o}: {t}")
