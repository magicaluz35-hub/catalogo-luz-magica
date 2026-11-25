// Casos borde — la segunda red, debajo de pruebas.mjs
// ---------------------------------------------------------------------------
// pruebas.mjs comprueba que el catálogo HACE lo que debe. Esto comprueba que
// no se rompe cuando pasa algo raro: un cliente escribiendo cosas extrañas,
// un enlace mal copiado, un carrito viejo, un teléfono diminuto.
//
// El orden es por lo que cuesta si falla: primero la comisión, que es plata
// de alguien; después el pedido, que es la venta; después lo demás.
//
//   node pruebas/pruebas-borde.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITIO = path.join(RAIZ, "_site");
const PUERTO = 8211;
const BASE = `http://127.0.0.1:${PUERTO}`;
const TIPOS = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };

const { chromium, devices } = (await import(process.env.PLAYWRIGHT_PATH || "playwright")).default;
const asesores = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/asesores.json"), "utf8"));
const productos = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/categorias.json"), "utf8")); // solo para contar
const negocio = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/negocio.json"), "utf8"));

const servidor = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (u.endsWith("/")) u += "index.html";
  const f = path.join(SITIO, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    const e = path.join(SITIO, "404.html");
    if (fs.existsSync(e)) { r.writeHead(404, { "Content-Type": "text/html" }); return r.end(fs.readFileSync(e)); }
    r.writeHead(404); return r.end("404");
  }
  r.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
  r.end(fs.readFileSync(f));
});
await new Promise((r) => servidor.listen(PUERTO, "127.0.0.1", r));

const res = [];
let area = "";
const grupo = (n) => { area = n; };
async function revisar(nombre, fn) {
  let r;
  try { r = await fn(); } catch (e) { r = "se cayó la prueba: " + String(e.message).slice(0, 110); }
  res.push({ area, nombre, ok: r === true, detalle: r === true ? "" : String(r) });
}

const nav = await chromium.launch();
const ctxNuevo = async (opts = {}) => {
  const c = await nav.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  await c.addInitScript(() => { try { sessionStorage.setItem("lm_intro", "1"); } catch (e) {} });
  return c;
};
const ir = (p, r) => p.goto(BASE + r, { waitUntil: "domcontentloaded" });
const waDe = (p) => p.evaluate(() => {
  const a = document.querySelector("[data-wa]") || document.querySelector('a[href*="wa.me"]');
  return a ? a.getAttribute("href") : null;
});
const textoWA = (href) => {
  // searchParams.get ya devuelve el texto decodificado. Decodificarlo otra
  // vez revienta en cuanto el cliente escribe un "%" en su nombre.
  try { return new URL(href, BASE).searchParams.get("text") || ""; }
  catch (e) { return ""; }
};
const activos = asesores.filter((a) => a.activo !== false);
const enRotacion = activos.filter((a) => a.enRotacion !== false);

// =========================================================================
grupo("Comisión");
// =========================================================================

await revisar("Un enlace con código inventado no asigna a nadie raro", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/?a=99");
  const quien = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
  await c.close();
  const codigos = asesores.map((a) => a.codigo);
  return codigos.includes(quien) ? true : `quedó asignado a "${quien}", que no es de nadie`;
});

await revisar("Un enlace con código de un asesor INACTIVO no se lo asigna", async () => {
  const inactivo = asesores.find((a) => a.activo === false);
  if (!inactivo) return true;
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, `/?a=${inactivo.codigo}`);
  const quien = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
  await c.close();
  return quien !== inactivo.codigo ? true : "le asignó un asesor que ya no está en el equipo";
});

await revisar("El código aguanta mayúsculas y espacios en el enlace", async () => {
  const a = enRotacion[0];
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, `/?a=%20${a.codigo}%20`);
  const quien = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
  await c.close();
  return quien === a.codigo ? true : `con espacios alrededor quedó "${quien}" en vez de ${a.codigo}`;
});

await revisar("Sin memoria del navegador (modo privado) igual hay asesor", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await p.addInitScript(() => {
    const romper = () => { throw new Error("bloqueado"); };
    try { Object.defineProperty(window, "localStorage", { get: romper }); } catch (e) {}
  });
  await ir(p, "/");
  const quien = await p.evaluate(() => document.querySelector("[data-asesor-nombre]")?.textContent.trim());
  const wa = await waDe(p);
  await c.close();
  if (!quien) return "no quedó ningún asesor a la vista";
  return wa && /wa\.me\/\d/.test(wa) ? true : "el botón de WhatsApp quedó sin destino";
});

await revisar("Pasados los 90 días, el cliente queda libre", async () => {
  const a = enRotacion[0];
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, `/?a=${a.codigo}`);
  // Se envejece la asignación a mano, como si hubieran pasado cuatro meses.
  await p.evaluate(() => {
    const v = JSON.parse(localStorage.getItem("lm_asesor"));
    v.desde = Date.now() - 120 * 24 * 60 * 60 * 1000;
    localStorage.setItem("lm_asesor", JSON.stringify(v));
  });
  await ir(p, "/catalogo/");
  const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem("lm_asesor") || "{}"));
  await c.close();
  return guardado.origen === "reparto" || Date.now() - guardado.desde < 1000
    ? true
    : "la asignación vencida siguió en pie";
});

await revisar("El código del asesor viaja en el mensaje", async () => {
  const a = enRotacion[0];
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, `/?a=${a.codigo}`);
  const t = textoWA(await waDe(p));
  await c.close();
  return t.includes(a.codigo) ? true : `el mensaje no lleva el código ${a.codigo}: "${t.slice(0, 70)}"`;
});

// =========================================================================
grupo("Pedido");
// =========================================================================

const llenar = async (p, datos) => {
  for (const [k, v] of Object.entries(datos)) {
    const campo = await p.$(`[name="${k}"]`);
    if (campo) { await campo.fill(""); await campo.fill(v); }
  }
};

await revisar("Texto raro del cliente no rompe el mensaje", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/catalogo/");
  await p.click(".tarjeta a");
  await p.waitForTimeout(300);
  const agregar = await p.$("[data-agregar]");
  if (agregar) { await agregar.click(); await p.waitForTimeout(250); }
  await ir(p, "/pedido/");
  const raro = 'Añá "Pérez" & <b>Jo</b> 50% #1 \n salto';
  await llenar(p, { nombre: raro, telefono: "3001234567", ciudad: "Medellín", barrio: "Aranjuez", direccion: "Calle 93 #51-20", piso: "3" });
  await p.waitForTimeout(350);
  const t = textoWA(await waDe(p));
  await c.close();
  if (!t) return "el mensaje quedó vacío";
  if (!t.includes("Añá")) return "se perdieron las tildes del nombre";
  if (!t.includes("50%")) return "se perdió el símbolo de porcentaje";
  // El mensaje de WhatsApp es texto plano: lo que el cliente escribió debe
  // llegar tal cual, NO escapado. Escaparlo haría que la asesora leyera
  // "&lt;b&gt;" en el chat.
  if (!t.includes("<b>Jo</b>")) return "el mensaje alteró lo que escribió el cliente";
  return true;
});

await revisar("Lo que escribe el cliente no se ejecuta en la página", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/pedido/");
  let saltoAlerta = false;
  p.on("dialog", async (d) => { saltoAlerta = true; await d.dismiss(); });
  await p.fill('[name="nombre"]', '<img src=x onerror=alert(1)>').catch(() => {});
  await p.waitForTimeout(600);
  const inyectado = await p.evaluate(() =>
    !!document.querySelector('[data-wa-previo] img, .formulario img[src="x"]'));
  await c.close();
  if (saltoAlerta) return "el texto del cliente se ejecutó como código";
  return inyectado ? "el texto del cliente entró como HTML en la página" : true;
});

await revisar("El formulario no deja mandar vacío", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  // Con el carrito vacío la página ni muestra el formulario —muestra "todavía
  // no has añadido nada"—, así que hay que llegar con un mueble adentro.
  await ir(p, "/producto/lm-012/");
  await p.click("[data-agregar]").catch(() => {});
  await p.waitForTimeout(300);
  await ir(p, "/pedido/");
  await p.waitForTimeout(400);
  // El formulario lleva novalidate y lo revisa el guion, así que la prueba
  // tiene que ser la del cliente: tocar el botón sin llenar nada.
  const antes = p.url();
  await p.click("[data-wa]").catch(() => {});
  await p.waitForTimeout(600);
  const salio = p.url() !== antes;
  const errores = await p.evaluate(() =>
    [...document.querySelectorAll("[id^=error-]")].filter((e) => e.textContent.trim()).length);
  await c.close();
  if (salio) return "se fue a WhatsApp con el formulario vacío";
  return errores > 0 ? true : "no salió, pero tampoco le dijo al cliente qué le falta";
});

await revisar("Un teléfono demasiado corto no pasa", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/pedido/");
  for (const [k, v] of Object.entries({ nombre: "Ana", telefono: "300", ciudad: "Medellín", barrio: "Aranjuez", direccion: "Calle 1", piso: "2" }))
    await p.fill(`[name="${k}"]`, v).catch(() => {});
  const antes = p.url();
  await p.click("[data-wa]").catch(() => {});
  await p.waitForTimeout(600);
  const salio = p.url() !== antes;
  await c.close();
  return salio ? "aceptó un teléfono de 3 dígitos" : true;
});

await revisar("Un carrito con un mueble que ya no existe no rompe la página", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/");
  await p.evaluate(() => localStorage.setItem("lm_pedido", JSON.stringify(
    [{ sku: "LM-999", nombre: "Mueble retirado", precio: 123456, cantidad: 2, foto: "/img/no-existe.webp" }])));
  await ir(p, "/pedido/");
  await p.waitForTimeout(400);
  const roto = await p.evaluate(() => document.body.innerText.length < 80);
  const sale = await p.evaluate(() => document.body.innerText.includes("Mueble retirado"));
  await c.close();
  if (roto) return "la página del pedido quedó en blanco";
  return sale ? true : "el renglón viejo desapareció sin avisarle al cliente";
});

await revisar("Un carrito corrupto en el navegador no deja la página en blanco", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/");
  await p.evaluate(() => localStorage.setItem("lm_pedido", "{esto no es json"));
  await ir(p, "/pedido/");
  await p.waitForTimeout(300);
  const largo = await p.evaluate(() => document.body.innerText.length);
  await c.close();
  return largo > 120 ? true : "la página quedó vacía con un carrito corrupto";
});

await revisar("El pedido sobrevive a cerrar y volver a abrir", async () => {
  const c = await ctxNuevo();
  const p = await c.newPage();
  await ir(p, "/catalogo/");
  await p.click(".tarjeta a"); await p.waitForTimeout(300);
  const b = await p.$("[data-agregar]"); if (b) { await b.click(); await p.waitForTimeout(250); }
  const antes = await p.evaluate(() => document.querySelector("[data-pedido-cuenta]")?.textContent.trim());
  await p.close();
  const p2 = await c.newPage();
  await ir(p2, "/");
  await p2.waitForTimeout(300);
  const despues = await p2.evaluate(() => document.querySelector("[data-pedido-cuenta]")?.textContent.trim());
  await c.close();
  return antes === despues ? true : `antes decía ${antes} y después ${despues}`;
});

// =========================================================================
grupo("Enlaces rotos");
// =========================================================================

await revisar("Un producto inventado cae en la página 404, no en un error", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  const r = await p.goto(BASE + "/producto/lm-inventado/", { waitUntil: "domcontentloaded" });
  const t = await p.evaluate(() => document.body.innerText);
  await c.close();
  if (!/cat[áa]logo/i.test(t)) return "la 404 no ofrece volver al catálogo";
  return /whatsapp/i.test(t) ? true : "la 404 no ofrece escribir por WhatsApp";
});

await revisar("Una línea inventada también cae parada", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await p.goto(BASE + "/categoria/inventada/", { waitUntil: "domcontentloaded" });
  const t = await p.evaluate(() => document.body.innerText);
  await c.close();
  return t.length > 150 ? true : "quedó una página vacía";
});

await revisar("El SKU en mayúsculas en la dirección no deja al cliente colgado", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  const r = await p.goto(BASE + "/producto/LM-012/", { waitUntil: "domcontentloaded" });
  const t = await p.evaluate(() => document.body.innerText);
  await c.close();
  // Puede ser la ficha o la 404, pero nunca un error del navegador.
  return /cat[áa]logo|LM-012/i.test(t) ? true : "no mostró ni la ficha ni la 404";
});

// =========================================================================
grupo("Pantalla pequeña");
// =========================================================================

await revisar("En un teléfono de 320 px nada se sale a lo ancho", async () => {
  const c = await ctxNuevo({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  const malas = [];
  for (const r of ["/", "/catalogo/", "/producto/lm-012/", "/pedido/", "/asesores/"]) {
    await ir(p, r);
    await p.waitForTimeout(250);
    const desborde = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (desborde > 2) malas.push(`${r} se sale ${desborde}px`);
  }
  await c.close();
  return malas.length ? malas.join("; ") : true;
});

await revisar("El botón flotante no tapa el precio ni el botón de pedir", async () => {
  const c = await ctxNuevo({ ...devices["iPhone 13"] });
  const p = await c.newPage();
  await ir(p, "/catalogo/");
  await p.waitForTimeout(400);
  const choca = await p.evaluate(() => {
    const f = document.querySelector(".wa-flotante");
    if (!f) return null;
    const r = f.getBoundingClientRect();
    const tapados = [];
    for (const e of document.querySelectorAll(".tarjeta__precio, .tarjeta h2")) {
      const b = e.getBoundingClientRect();
      if (b.bottom > 0 && b.top < innerHeight &&
          !(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom))
        tapados.push(e.textContent.trim().slice(0, 28));
    }
    return tapados;
  });
  await c.close();
  if (choca === null) return "no hay botón flotante";
  return choca.length ? `tapa: ${choca.join(" · ")}` : true;
});

// =========================================================================
grupo("Teclado");
// =========================================================================

await revisar("El visor de fotos se cierra con Escape", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/producto/lm-012/");
  await p.click(".ficha__principal");
  await p.waitForTimeout(400);
  const abierto = await p.evaluate(() => !!document.querySelector(".visor--abierto"));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  const cerrado = await p.evaluate(() => !document.querySelector(".visor--abierto"));
  await c.close();
  if (!abierto) return "el visor no abrió";
  return cerrado ? true : "no se cerró con Escape: el cliente queda atrapado";
});

await revisar("Se puede llegar al botón de pedir solo con Tab", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/producto/lm-012/");
  let llego = false;
  for (let i = 0; i < 45 && !llego; i++) {
    await p.keyboard.press("Tab");
    llego = await p.evaluate(() => !!document.activeElement?.closest("[data-wa], [data-agregar]"));
  }
  await c.close();
  return llego ? true : "no se alcanza el botón de pedir con el teclado";
});

// =========================================================================
grupo("Fotos");
// =========================================================================

await revisar("Ninguna foto del catálogo pesa más de 400 KB", async () => {
  const dir = path.join(RAIZ, "img");
  const pesadas = fs.readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && f.startsWith("p"))
    .map((f) => [f, fs.statSync(path.join(dir, f)).size / 1024])
    .filter(([, kb]) => kb > 400);
  return pesadas.length ? pesadas.slice(0, 4).map(([f, kb]) => `${f} ${kb.toFixed(0)} KB`).join("; ") : true;
});

await revisar("Una ficha completa no pasa de 2 MB", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  let bytes = 0;
  p.on("response", (r) => { const l = Number(r.headers()["content-length"] || 0); bytes += l; });
  await p.goto(BASE + "/producto/lm-012/", { waitUntil: "networkidle" });
  await c.close();
  const mb = bytes / 1024 / 1024;
  return mb <= 2 ? true : `pesa ${mb.toFixed(1)} MB, lento con datos móviles`;
});

// =========================================================================
grupo("Contenido");
// =========================================================================

await revisar("Ningún precio se muestra en cero o vacío", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/catalogo/");
  const malos = await p.evaluate(() =>
    [...document.querySelectorAll(".tarjeta__precio")]
      .map((e) => e.textContent.trim())
      .filter((t) => !/\d/.test(t) || /^\$\s*0$/.test(t)));
  await c.close();
  return malos.length ? `${malos.length} tarjetas con precio raro: ${malos.slice(0, 3).join(", ")}` : true;
});

await revisar("Todas las líneas del catálogo son alcanzables y tienen muebles", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  const malas = [];
  for (const cat of productos) {
    await ir(p, `/categoria/${cat.slug}/`);
    const n = await p.evaluate(() => document.querySelectorAll(".tarjeta").length);
    if (!n) malas.push(cat.slug);
  }
  await c.close();
  return malas.length ? `sin muebles: ${malas.join(", ")}` : true;
});

await revisar("El buscador encuentra con y sin tildes", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/catalogo/");
  const buscar = async (q) => {
    const campo = await p.$("[data-buscar], input[type=search]");
    if (!campo) return -1;
    await campo.fill(q); await p.waitForTimeout(350);
    return p.evaluate(() => [...document.querySelectorAll(".tarjeta")].filter((t) => t.offsetParent !== null).length);
  };
  const con = await buscar("Parí");
  const sin = await buscar("Pari");
  await c.close();
  if (con === -1) return "no se encontró el buscador";
  return con === sin ? true : `con tilde ${con} resultados, sin tilde ${sin}`;
});

await revisar("Ningún nombre de asesor se publica con corchetes", async () => {
  const c = await ctxNuevo(); const p = await c.newPage();
  await ir(p, "/asesores/");
  const relleno = await p.evaluate(() => (document.body.innerText.match(/\[NOMBRE[^\]]*\]/g) || []).length);
  await c.close();
  return relleno ? `${relleno} nombres de relleno a la vista del cliente` : true;
});

// =========================================================================
await nav.close();
servidor.close();

let actual = "";
for (const r of res) {
  if (r.area !== actual) { actual = r.area; console.log(`\n## ${actual}`); }
  console.log(`  ${r.ok ? "ok  " : "FALLA"}  ${r.nombre}${r.ok ? "" : "\n          → " + r.detalle}`);
}
const fallan = res.filter((r) => !r.ok).length;
console.log(`\nTOTAL: ${res.length} casos borde · ${res.length - fallan} pasan · ${fallan} fallan\n`);
process.exit(fallan ? 1 : 0);
