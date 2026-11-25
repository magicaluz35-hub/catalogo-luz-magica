// Prepara las fotos antes de publicar.
// ---------------------------------------------------------------------------
// El panel guarda la foto tal como sale del teléfono: 3 o 4 MB, a veces más.
// Con cinco fotos, una ficha pesaría veinte megas y no cargaría con datos
// móviles, que es como entra casi todo el mundo al catálogo.
//
// Pedirle al dueño que las reduzca no era razonable: la cámara del celular
// no ofrece la proporción exacta y bajar el peso a mano es un trabajo que
// nadie sostiene. Así que lo hace el catálogo, solo, en cada publicación.
//
// Qué le hace a una foto pesada:
//   · la deja en 1500 px de ancho como máximo. Medido: la foto grande de la
//     ficha pide 1214 px en un portátil retina, así que sobra,
//   · la vuelve a comprimir,
//   · la guarda ENCIMA de la original, con el mismo nombre y el mismo
//     formato. Así la ficha que la nombra sigue encontrándola.
//
// Lo que NO hace:
//   · no recorta. El recorte a 3:4 lo hace el navegador al mostrarla; dejarlo
//     grabado aquí sería irreversible,
//   · no toca las fotos de la portada ni los logos. Esas tienen tamaños
//     elegidos a propósito —el letrero de la portada mide 2576 px de ancho
//     porque tiene que cubrir una pantalla grande— y encogerlas las dañaría.
//
// Si algo falla con una foto, se deja la original y se avisa. Nunca frena la
// publicación: una foto pesada hace lenta la página, no la rompe.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CARPETA = path.join(RAIZ, "img");
const ANCHO_MAX = 1500;
const PESO_MAX_KB = 400;

// Las que nunca se tocan: las de la portada y la marca, que el dueño elige
// desde el panel, más los iconos. Se leen del archivo para que si mañana
// cambia la foto de portada, la nueva quede protegida sola.
function protegidas() {
  const fijas = new Set(["favicon.ico", "whatsapp.svg"]);
  try {
    const n = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/negocio.json"), "utf8"));
    for (const k of ["fotoPrincipal", "fotoPrincipalAncha", "logo", "logoLetrero"])
      if (n[k]) fijas.add(path.basename(n[k]));
  } catch (e) { /* si no se puede leer, se protegen solo las fijas */ }
  try {
    const cats = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/categorias.json"), "utf8"));
    for (const c of cats) if (c.foto) fijas.add(path.basename(c.foto));
  } catch (e) { /* igual */ }
  return fijas;
}

export async function prepararFotos() {
  const hechas = [], fallidas = [];
  if (!fs.existsSync(CARPETA)) return { hechas, fallidas };

  const nunca = protegidas();
  const archivos = fs.readdirSync(CARPETA).filter(
    (f) => /\.(jpe?g|png|webp)$/i.test(f) && !nunca.has(f) && !f.startsWith("icono")
  );

  for (const nombre of archivos) {
    const ruta = path.join(CARPETA, nombre);
    const kb = fs.statSync(ruta).size / 1024;
    let meta;
    try { meta = await sharp(ruta).metadata(); }
    catch (e) { fallidas.push(`${nombre}: no se pudo leer`); continue; }

    // Ya está lista: ni pesada ni más ancha de lo que se muestra.
    if (kb <= PESO_MAX_KB && (meta.width || 0) <= ANCHO_MAX) continue;

    try {
      const ext = path.extname(nombre).toLowerCase();
      let img = sharp(ruta).rotate();                 // respeta la orientación del teléfono
      if ((meta.width || 0) > ANCHO_MAX) img = img.resize({ width: ANCHO_MAX, withoutEnlargement: true });
      if (ext === ".png") img = img.png({ quality: 82, compressionLevel: 9 });
      else if (ext === ".webp") img = img.webp({ quality: 82 });
      else img = img.jpeg({ quality: 82, mozjpeg: true });

      const buf = await img.toBuffer();
      // Si el resultado no mejora, se deja la original tal cual.
      if (buf.length >= fs.statSync(ruta).size) continue;
      fs.writeFileSync(ruta, buf);
      hechas.push(`${nombre}: ${kb.toFixed(0)} KB → ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      fallidas.push(`${nombre}: ${String(e.message).slice(0, 70)}`);
    }
  }
  return { hechas, fallidas };
}

export function informarFotos({ hechas, fallidas }) {
  if (hechas.length) {
    console.log(`\n[Fotos] Se aligeraron ${hechas.length}:`);
    for (const h of hechas.slice(0, 10)) console.log("   · " + h);
    if (hechas.length > 10) console.log(`   · …y ${hechas.length - 10} más.`);
  }
  if (fallidas.length) {
    console.log(`\n[Fotos] ${fallidas.length} no se pudieron preparar. Se publican como están:`);
    for (const f of fallidas) console.log("   · " + f);
  }
}

if (process.argv[1] && process.argv[1].endsWith("preparar-fotos.mjs")) {
  const r = await prepararFotos();
  informarFotos(r);
  if (!r.hechas.length && !r.fallidas.length) console.log("\n[Fotos] Todas estaban listas. Nada que hacer.\n");
}
