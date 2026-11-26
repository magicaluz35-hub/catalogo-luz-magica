// Revisión de los datos antes de publicar.
// ---------------------------------------------------------------------------
// Esto corre SOLO, en cada construcción del sitio, cada vez que el dueño
// guarda algo en el panel. No hace falta que nadie lo ejecute.
//
// Por qué existe: probando el panel se encontró que varios errores no se
// notan. Un precio vacío publica el mueble a "$ 0". Un WhatsApp escrito con
// signo más deja TODOS los botones del sitio sin funcionar. Una categoría
// mal escrita esconde el mueble de su línea. En los tres casos la página se
// ve perfecta y nadie se entera hasta que lo encuentra un cliente.
//
// Qué hace: si encuentra algo imposible, la construcción FALLA. Eso suena
// mal pero es lo que protege al negocio: Cloudflare deja publicada la
// versión anterior, que estaba bien, y el dueño ve en su panel que el
// despliegue no pasó. Es mejor que publicar un tocador a cero pesos.
//
// La diferencia entre las dos listas:
//   ERRORES → cosas que le cuestan plata o clientes al negocio. Frenan.
//   AVISOS  → cosas feas pero que el sitio sabe manejar. Solo se anotan.
//
// Para correrla a mano:  node pruebas/revisar-datos.mjs
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const leer = (r) => JSON.parse(fs.readFileSync(path.join(RAIZ, r), "utf8"));
const existe = (web) => fs.existsSync(path.join(RAIZ, web.replace(/^\//, "")));
const soloNumeros = (s) => /^[0-9]{10,15}$/.test(String(s || ""));

export function revisarDatos() {
  const errores = [];
  const avisos = [];

  const negocio = leer("src/_data/negocio.json");
  const asesores = leer("src/_data/asesores.json");
  const categorias = leer("src/_data/categorias.json");
  const dirProd = path.join(RAIZ, "contenido/productos");
  const productos = fs.readdirSync(dirProd).filter((f) => f.endsWith(".json"))
    .map((f) => ({ archivo: f, ...JSON.parse(fs.readFileSync(path.join(dirProd, f), "utf8")) }));

  const slugs = new Set(categorias.map((c) => c.slug));
  const LUCES = ["ninguna", "led", "ojos"];

  // ---- Productos ----
  const vistos = new Map();
  for (const p of productos) {
    const d = `Productos → ${p.sku || p.archivo}`;

    if (!(Number(p.precio) > 0))
      errores.push(`${d}: el precio está vacío o en cero. Se publicaría a "$ 0" y alguien puede pedirlo a ese precio.`);

    if (!p.categoria || !slugs.has(p.categoria))
      errores.push(`${d}: la línea "${p.categoria}" no existe. El mueble desaparece de su línea del catálogo y nadie lo encuentra navegando.`);

    if (p.sku && vistos.has(p.sku))
      errores.push(`${d}: el código está repetido (también en ${vistos.get(p.sku)}). Quien abra el enlace cae en el mueble equivocado.`);
    if (p.sku) vistos.set(p.sku, p.archivo);

    const desde = Number(p.plazoDesde), hasta = Number(p.plazoHasta);
    if (desde > 0 && hasta > 0 && desde > hasta)
      errores.push(`${d}: los días de entrega están al revés (desde ${desde}, hasta ${hasta}). La ficha diría "de ${desde} a ${hasta} días".`);

    if (p.iluminacion && !LUCES.includes(p.iluminacion))
      errores.push(`${d}: la iluminación "${p.iluminacion}" no es ninguna de las tres (sin luz, luz LED, ojos de buey). El mueble no sale en ningún filtro.`);

    for (const f of p.fotos || [])
      if (!existe(f)) errores.push(`${d}: la foto ${f} no está. Saldría el ícono de imagen rota.`);

    if (!(p.fotos || []).length) avisos.push(`${d}: sin fotos. Sale el marco gris.`);
    if (!p.descripcion) avisos.push(`${d}: sin descripción. Sale un texto general.`);
  }

  // ---- Negocio ----
  if (!soloNumeros(negocio.telefonoWhatsapp))
    errores.push(`Datos del negocio: el WhatsApp principal es "${negocio.telefonoWhatsapp}". Tiene que ser solo números con indicativo, sin + ni espacios (573242117323). Así como está, NINGÚN botón de WhatsApp del sitio funciona.`);

  if (!/^https:\/\/[^\s/]+/.test(String(negocio.dominio || "")))
    errores.push(`Datos del negocio: la dirección del sitio es "${negocio.dominio}". Tiene que empezar por https:// o las vistas previas de WhatsApp dejan de mostrar la foto.`);

  const nd = Number(negocio.plazoDesde), nh = Number(negocio.plazoHasta);
  if (!(nd > 0) || !(nh > 0))
    errores.push("Datos del negocio: falta el plazo normal del taller (desde / hasta). Sin él las fichas no dicen cuánto se demora.");
  else if (nd > nh)
    errores.push(`Datos del negocio: el plazo del taller está al revés (desde ${nd}, hasta ${nh}).`);

  for (const [campo, etiqueta] of [["fotoPrincipal", "la foto principal"], ["fotoPrincipalAncha", "la foto para computador"], ["logoLetrero", "el logo de la presentación"], ["logo", "el logo"]]) {
    const v = negocio[campo];
    if (v && !existe(v)) errores.push(`Datos del negocio: ${etiqueta} (${v}) no está. Quedaría una imagen rota.`);
  }

  if (!(negocio.horario || []).length)
    avisos.push("Datos del negocio: sin horario. El letrero de Abierto / Cerrado no puede calcularse.");

  // ---- Asesores ----
  const codigos = new Map();
  const activos = asesores.filter((a) => a.activo !== false);
  for (const a of asesores) {
    const d = `Asesores → ${a.nombre || a.codigo}`;
    if (a.codigo && codigos.has(a.codigo))
      errores.push(`${d}: el código ${a.codigo} está repetido (también en ${codigos.get(a.codigo)}). Dos personas se pelearían los mismos clientes.`);
    if (a.codigo) codigos.set(a.codigo, a.nombre || a.codigo);

    if (a.activo !== false && !soloNumeros(a.whatsapp))
      errores.push(`${d}: está activo pero su WhatsApp ("${a.whatsapp || "vacío"}") no sirve. Tiene que ser solo números con indicativo. Los clientes que le asignen no van a poder escribirle.`);

  }
  // La línea principal es el respaldo de todo el reparto: si queda desmarcada,
  // un visitante sin enlace puede terminar sin nadie a quién escribirle.
  const casa = asesores.find((a) => String(a.codigo).trim() === "00");
  if (!casa)
    errores.push("Asesores: no está la línea principal (código 00). Es el respaldo de todo el reparto: sin ella, un cliente que entre sin enlace puede quedarse sin a quién escribirle.");
  else if (casa.activo === false)
    errores.push("Asesores: la línea principal (código 00) está desmarcada como Activo. Es el respaldo del reparto y tiene que estar siempre encendida.");

  // Agrupados: trece líneas iguales taparían los avisos que sí son distintos.
  const relleno = asesores.filter((a) => String(a.nombre || "").startsWith("["));
  if (relleno.length)
    avisos.push(`Asesores: ${relleno.length} todavía tienen nombre de relleno (${relleno.map((a) => a.codigo).join(", ")}). Salen publicados así en la barra de arriba y en el directorio.`);
  if (!activos.length)
    avisos.push("Asesores: no hay ninguno activo. Todos los pedidos van a la línea principal.");

  // ---- Categorías ----
  const vistosSlug = new Set();
  for (const c of categorias) {
    if (vistosSlug.has(c.slug))
      errores.push(`Líneas del catálogo → ${c.nombre}: el identificador "${c.slug}" está repetido.`);
    vistosSlug.add(c.slug);
    if (c.foto && !existe(c.foto))
      errores.push(`Líneas del catálogo → ${c.nombre}: la foto ${c.foto} no está.`);
    const cuantos = productos.filter((p) => p.categoria === c.slug).length;
    if (!cuantos) avisos.push(`Líneas del catálogo → ${c.nombre}: no tiene ningún mueble.`);
  }

  return { errores, avisos };
}

// Mensaje pensado para que lo lea el dueño en el registro de Cloudflare,
// no un programador: cada línea dice qué pasó y qué perdería el negocio.
export function informar({ errores, avisos }) {
  if (avisos.length) {
    console.log(`\n[Revisión de datos] ${avisos.length} aviso${avisos.length === 1 ? "" : "s"} (el sitio se publica igual):`);
    for (const a of avisos.slice(0, 12)) console.log("   · " + a);
    if (avisos.length > 12) console.log(`   · …y ${avisos.length - 12} más.`);
  }
  if (errores.length) {
    console.log(`\n[Revisión de datos] NO SE PUBLICÓ. Hay ${errores.length} error${errores.length === 1 ? "" : "es"} que hay que corregir en el panel:\n`);
    for (const e of errores) console.log("   ✗ " + e);
    console.log("\n   El catálogo que ya estaba publicado sigue en línea y no le pasó nada.");
    console.log("   Corrige esto en el panel y guarda otra vez.\n");
  }
  return errores.length;
}

// Corrida a mano
if (process.argv[1] && process.argv[1].endsWith("revisar-datos.mjs")) {
  const r = revisarDatos();
  const n = informar(r);
  if (!n) console.log(`\n[Revisión de datos] Todo bien. ${r.avisos.length} aviso${r.avisos.length === 1 ? "" : "s"}, ningún error.\n`);
  process.exit(n ? 1 : 0);
}
