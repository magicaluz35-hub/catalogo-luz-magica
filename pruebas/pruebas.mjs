// Batería de pruebas funcionales del catálogo Luz Mágica.
// Se corre con:  npm run probar     (antes hay que haber hecho  npm run build)
// Levanta un servidor propio sobre _site y recorre el sitio como un visitante.
// Playwright se instala aparte:  npm i -D playwright && npx playwright install chromium
const pw = (await import(process.env.PLAYWRIGHT_PATH || "playwright")).default;
const { chromium, devices } = pw;
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = path.join(RAIZ, "_site");
if (!fs.existsSync(SITIO)) {
  console.error("No existe la carpeta _site. Corre primero:  npm run build");
  process.exit(1);
}

// Servidor mínimo para no depender de nada instalado aparte.
const TIPOS = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split("?")[0]);
  let archivo = path.join(SITIO, ruta);
  if (ruta.endsWith("/")) archivo = path.join(archivo, "index.html");
  if (!archivo.startsWith(SITIO) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
    const err = path.join(SITIO, "404.html");
    res.writeHead(404, { "Content-Type": "text/html" });
    return res.end(fs.existsSync(err) ? fs.readFileSync(err) : "404");
  }
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
  res.end(fs.readFileSync(archivo));
});
await new Promise((r) => servidor.listen(8099, "127.0.0.1", r));

const BASE = "http://127.0.0.1:8099";

const res = [];
const ok = (area, n, d = "") => res.push({ area, n, estado: "OK", d });
const falla = (area, n, d) => res.push({ area, n, estado: "FALLA", d });
const revisar = async (area, n, fn) => {
  try { const r = await fn(); if (r === true || r === undefined) ok(area, n); else falla(area, n, String(r)); }
  catch (e) { falla(area, n, "error: " + e.message.split("\n")[0].slice(0, 160)); }
};

// Los productos viven en una carpeta, un archivo por mueble, y el sitio los
// ordena por el campo "orden". Aquí se lee igual para comparar contra lo que
// sale publicado.
const productos = fs.readdirSync(path.join(RAIZ, "contenido/productos"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(RAIZ, "contenido/productos", f))))
  .sort((a, b) => (a.orden ?? Infinity) - (b.orden ?? Infinity) || String(a.sku).localeCompare(String(b.sku)));
const asesores = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/asesores.json")));
const categorias = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/categorias.json")));
const negocio = JSON.parse(fs.readFileSync(path.join(RAIZ, "src/_data/negocio.json")));

const nav = async (p, ruta) => p.goto(BASE + ruta, { waitUntil: "networkidle" });

// Captura el destino del botón de WhatsApp sin salir de la página.
const interceptarWA = async (p) => p.evaluate(() => {
  window.__wa = null;
  // { once: true } es clave: sin eso cada llamada deja otro oyente puesto y
  // el de la prueba anterior cancela el clic de la siguiente.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href*="wa.me"]');
    if (a) { window.__wa = { href: a.href, bloqueado: e.defaultPrevented }; e.preventDefault(); }
  }, { once: true });
});
const leerWA = (p) => p.evaluate(() => window.__wa);

const navegador = await chromium.launch();
const ctxEsc = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const ctxCel = await navegador.newContext({ ...devices["iPhone 13"] });

// La presentación de marca tapa el sitio los primeros tres segundos. Si se
// dejara puesta, cada prueba de aquí abajo tendría que esperarla o chocaría
// contra el telón. Se le deja marcado al navegador que ya la vio, que es
// exactamente lo que pasa con un visitante de verdad en su segunda página.
// La presentación tiene su propio bloque de pruebas más abajo, con un
// navegador sin estrenar.
const saltarIntro = (c) => c.addInitScript(() => {
  try { sessionStorage.setItem("lm_intro", "1"); } catch (e) { /* nada */ }
});
await saltarIntro(ctxEsc);
await saltarIntro(ctxCel);

// ---------- 1. Todas las páginas cargan y nada está roto ----------
{
  const p = await ctxEsc.newPage();
  const malas = [], rotos = new Set();
  let contando = true;
  p.on("response", (r) => { if (contando && r.status() >= 400) rotos.add(r.status() + " " + new URL(r.url()).pathname); });
  const rutas = ["/", "/catalogo/", "/asesores/", "/pedido/", "/no-existe-esta-pagina/"]
    .concat(categorias.map((c) => `/categoria/${c.slug}/`))
    .concat(productos.slice(0, 12).map((x) => `/producto/${x.sku.toLowerCase()}/`));
  for (const r of rutas) {
    contando = r !== "/no-existe-esta-pagina/";
    const resp = await p.goto(BASE + r, { waitUntil: "domcontentloaded" });
    const esperado = r === "/no-existe-esta-pagina/" ? 404 : 200;
    if (resp.status() !== esperado) malas.push(`${r} dio ${resp.status()}`);
  }
  contando = true;
  malas.length ? falla("Páginas", `Cargan las ${rutas.length} rutas probadas`, malas.join("; "))
               : ok("Páginas", `Cargan las ${rutas.length} rutas probadas`, "incluye la página de error");
  await nav(p, "/"); await nav(p, "/catalogo/"); await nav(p, "/producto/" + productos[0].sku.toLowerCase() + "/");
  rotos.size ? falla("Páginas", "Ninguna imagen ni archivo roto", [...rotos].slice(0, 6).join("; "))
             : ok("Páginas", "Ninguna imagen ni archivo roto");

  // Enlaces internos rotos
  await revisar("Páginas", "Ningún enlace interno apunta a una página inexistente", async () => {
    const vistos = new Set(); const malos = [];
    for (const r of ["/", "/catalogo/", "/asesores/", "/pedido/"]) {
      await nav(p, r);
      const hrefs = await p.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")));
      for (const h of hrefs) {
        const limpio = h.split("#")[0].split("?")[0];
        if (!limpio || vistos.has(limpio)) continue;
        vistos.add(limpio);
        const resp = await p.request.get(BASE + limpio);
        if (resp.status() >= 400) malos.push(`${limpio} (${resp.status()})`);
      }
    }
    return malos.length ? malos.join("; ") : true;
  });

  // Fotos declaradas que no existen en el repositorio
  await revisar("Páginas", "Todas las fotos de los 115 productos existen", async () => {
    const faltan = [];
    for (const pr of productos) for (const f of pr.fotos || []) {
      if (!fs.existsSync(path.join(RAIZ, f))) faltan.push(`${pr.sku}: ${f}`);
    }
    return faltan.length ? `${faltan.length} faltan -> ${faltan.slice(0, 4).join(", ")}` : true;
  });
  await p.close();
}

// ---------- 2. Atribución de asesores ----------
{
  for (const [etq, ctx] of [["escritorio", ctxEsc], ["celular", ctxCel]]) {
    const p = await ctx.newPage();
    await revisar("Asesores", `Entrar con ?a=03 asigna al asesor 03 (${etq})`, async () => {
      await p.context().clearCookies();
      await nav(p, "/?a=03");
      await p.evaluate(() => localStorage.clear());
      await nav(p, "/?a=03");
      const c = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
      return c === "03" ? true : `muestra "${c}"`;
    });
    await p.close();
  }
  const p = await ctxEsc.newPage();
  await nav(p, "/"); await p.evaluate(() => localStorage.clear());

  await revisar("Asesores", "La comisión queda con el PRIMERO que mandó su enlace", async () => {
    await nav(p, "/?a=03");
    await nav(p, "/?a=07");                       // otro asesor manda su enlace después
    const c = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
    return c === "03" ? true : `el segundo enlace se robó la asignación: quedó ${c}`;
  });

  await revisar("Asesores", "Navegar sin ?a conserva al asesor ya asignado", async () => {
    await nav(p, "/catalogo/");
    const c = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
    return c === "03" ? true : `se perdió: quedó ${c}`;
  });

  await revisar("Asesores", "Pasados los 90 días un enlace nuevo sí puede reasignar", async () => {
    await p.evaluate(() => {
      const g = JSON.parse(localStorage.getItem("lm_asesor"));
      g.desde = Date.now() - 91 * 24 * 3600 * 1000;
      localStorage.setItem("lm_asesor", JSON.stringify(g));
    });
    await nav(p, "/?a=07");
    const c = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
    return c === "07" ? true : `siguió en ${c}`;
  });

  await revisar("Asesores", "Sin enlace de nadie, atiende una línea de la casa", async () => {
    await p.evaluate(() => localStorage.clear());
    await nav(p, "/");
    const c = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
    return c && c.length === 2 ? true : `no asignó nadie (${c})`;
  });

  await revisar("Asesores", "Un código inventado (?a=99) no deja al cliente sin asesor", async () => {
    await p.evaluate(() => localStorage.clear());
    await nav(p, "/?a=99");
    const c = await p.evaluate(() => document.querySelector("[data-asesor-codigo]")?.textContent.trim());
    return c && c.length === 2 ? true : `quedó sin asesor (${c})`;
  });

  await revisar("Asesores", "La página de asesores lista los 14 números autorizados", async () => {
    await nav(p, "/asesores/");
    const n = await p.evaluate(() => document.querySelectorAll('a[href*="wa.me"]').length);
    const activos = asesores.filter((a) => a.activo !== false).length;
    return n >= activos ? true : `muestra ${n} de ${activos}`;
  });

  await revisar("Asesores", "El verificador reconoce un número autorizado y rechaza uno ajeno", async () => {
    await nav(p, "/asesores/");
    const caja = await p.$("[data-verificador] input");
    if (!caja) return "no encontré el campo del verificador";
    const real = asesores.find((a) => a.activo !== false && a.codigo !== "00").whatsapp;
    await caja.fill(real.slice(-10));
    await caja.press("Enter");
    await p.waitForTimeout(300);
    const bueno = await p.evaluate(() => document.querySelector("[data-verificador-resultado]")?.textContent || "");
    await caja.fill("3001112233");
    await caja.press("Enter");
    await p.waitForTimeout(300);
    const malo = await p.evaluate(() => document.querySelector("[data-verificador-resultado]")?.textContent || "");
    if (!/autorizad/i.test(bueno)) return `con un número real dijo: "${bueno.trim().slice(0, 60)}"`;
    if (!/no/i.test(malo)) return `con un número falso dijo: "${malo.trim().slice(0, 60)}"`;
    return true;
  });
  await p.close();
}

// ---------- 3. Botones de WhatsApp ----------
{
  const p = await ctxEsc.newPage();
  const a03 = asesores.find((a) => a.codigo === "03");

  await revisar("WhatsApp", "El botón de la ficha escribe al asesor asignado", async () => {
    await nav(p, "/"); await p.evaluate(() => localStorage.clear());
    await nav(p, `/producto/${productos[0].sku.toLowerCase()}/?a=03`);
    await interceptarWA(p);
    await p.click("[data-wa-ficha]");
    const w = await leerWA(p);
    if (!w) return "el botón no abrió ningún enlace de WhatsApp";
    return w.href.includes(a03.whatsapp) ? true : `fue a otro número: ${w.href.slice(0, 70)}`;
  });

  await revisar("WhatsApp", "El mensaje termina en la referencia del asesor (Ref A-03)", async () => {
    const w = await leerWA(p);
    const txt = decodeURIComponent(new URL(w.href).searchParams.get("text") || "");
    return /Ref A-03\s*$/.test(txt.trim()) ? true : `termina en: "${txt.trim().slice(-40)}"`;
  });

  await revisar("WhatsApp", "El mensaje lleva nombre, SKU, precio y enlace", async () => {
    const w = await leerWA(p);
    const txt = decodeURIComponent(new URL(w.href).searchParams.get("text") || "");
    const falt = [];
    if (!txt.includes(productos[0].nombre)) falt.push("nombre");
    if (!txt.toUpperCase().includes(productos[0].sku)) falt.push("SKU");
    if (!/\$/.test(txt)) falt.push("precio");
    if (!txt.includes("/producto/")) falt.push("enlace al producto");
    return falt.length ? "le falta: " + falt.join(", ") : true;
  });

  // Color y enchape salieron de la página a propósito: con varios de ellos
  // cambia el precio, y la ficha los ofrecía todos al precio de la ficha. Si
  // alguien los devuelve sin resolver antes el precio, estas dos avisan.
  await revisar("WhatsApp", "El mensaje no promete opciones que la página no cobró", async () => {
    const w = await leerWA(p);
    const txt = decodeURIComponent(new URL(w.href).searchParams.get("text") || "");
    const malas = ["Color:", "Enchape:"].filter((k) => new RegExp(k, "i").test(txt));
    return malas.length ? `el mensaje manda ${malas.join(" y ")} elegido en la página` : true;
  });

  await revisar("Ficha", "No se eligen color ni enchape, y se dice por qué", async () => {
    await nav(p, "/producto/lm-012/");
    const restos = await p.evaluate(() =>
      document.querySelectorAll(".muestra, [name='color'], [name='enchape']").length);
    if (restos) return `quedaron ${restos} restos de los selectores`;
    const aviso = await p.evaluate(() => document.querySelector(".opciones__aviso")?.textContent.trim() || "");
    return /asesora/i.test(aviso) ? true : `el aviso no explica quién lo resuelve: "${aviso}"`;
  });

  await revisar("WhatsApp", "En la ficha no hay botón flotante duplicado", async () => {
    const n = await p.evaluate(() => document.querySelectorAll(".wa-flotante").length);
    return n === 0 ? true : "aparece el mismo botón dos veces en la misma pantalla";
  });

  await revisar("WhatsApp", "El botón flotante del catálogo escribe al mismo asesor", async () => {
    await nav(p, "/catalogo/");
    await interceptarWA(p);
    await p.click(".wa-flotante");
    const w = await leerWA(p);
    return w && w.href.includes(a03.whatsapp) ? true : `fue a: ${w ? w.href.slice(0, 70) : "ningún lado"}`;
  });

  await revisar("WhatsApp", "El botón de la galería (inicio) escribe al asesor, no a la línea de la casa", async () => {
    await nav(p, "/?a=03");
    await interceptarWA(p);
    await p.click(".galeria__botones .boton--whatsapp");
    const w = await leerWA(p);
    return w && w.href.includes(a03.whatsapp) ? true : `fue a: ${w ? w.href.slice(0, 70) : "ningún lado"}`;
  });

  await revisar("WhatsApp", "El aviso de fraude SÍ va a la línea principal", async () => {
    await nav(p, "/asesores/?a=03");
    const href = await p.evaluate(() => document.querySelector(".alerta a[href*='wa.me']")?.href || "");
    const principal = asesores.find((a) => a.codigo === "00").whatsapp;
    return href.includes(principal) ? true : `va a ${href.slice(0, 70)} (debería ir a la línea principal)`;
  });

  await revisar("WhatsApp", "No queda ningún enlace de llamada (tel:) en el sitio", async () => {
    const conTel = [];
    for (const r of ["/", "/catalogo/", "/asesores/", "/pedido/", `/producto/${productos[0].sku.toLowerCase()}/`]) {
      await nav(p, r);
      const n = await p.evaluate(() => document.querySelectorAll('a[href^="tel:"]').length);
      if (n) conTel.push(`${r} (${n})`);
    }
    return conTel.length ? conTel.join("; ") : true;
  });
  await p.close();
}

// ---------- 4. Pedido y formulario obligatorio ----------
{
  const p = await ctxCel.newPage();
  await nav(p, "/"); await p.evaluate(() => localStorage.clear());
  await nav(p, "/?a=03");

  await revisar("Pedido", "Añadir un producto sube el contador del carrito", async () => {
    await nav(p, `/producto/${productos[0].sku.toLowerCase()}/`);
    await p.click("[data-agregar]");
    await p.waitForTimeout(300);
    const n = await p.evaluate(() => document.querySelector("[data-pedido-contador]")?.textContent.trim());
    return n === "1" ? true : `el contador dice "${n}"`;
  });

  await revisar("Pedido", "El pedido sobrevive al navegar a otra página", async () => {
    await nav(p, "/catalogo/");
    const n = await p.evaluate(() => document.querySelector("[data-pedido-contador]")?.textContent.trim());
    return n === "1" ? true : `se perdió (contador "${n}")`;
  });

  await revisar("Pedido", "El botón + sube la cantidad y recalcula el total", async () => {
    await nav(p, "/pedido/");
    const t0 = await p.evaluate(() => document.querySelector("[data-pedido-total]")?.textContent);
    await p.click("[data-mas]");
    await p.waitForTimeout(300);
    const t1 = await p.evaluate(() => document.querySelector("[data-pedido-total]")?.textContent);
    return t0 !== t1 ? true : `el total no cambió (${t0})`;
  });

  await revisar("Pedido", "El botón − baja la cantidad", async () => {
    const t0 = await p.evaluate(() => document.querySelector("[data-pedido-total]")?.textContent);
    await p.click("[data-menos]");
    await p.waitForTimeout(300);
    const t1 = await p.evaluate(() => document.querySelector("[data-pedido-total]")?.textContent);
    return t0 !== t1 ? true : `el total no cambió (${t0})`;
  });

  await revisar("Pedido", "La cantidad nunca baja de 1 ni se vuelve negativa", async () => {
    for (let i = 0; i < 4; i++) { await p.click("[data-menos]").catch(() => {}); await p.waitForTimeout(150); }
    const texto = await p.evaluate(() => document.body.innerText);
    return /-\s*\d/.test(texto.match(/\$\s*-/) || "") ? "aparecieron cantidades negativas" : true;
  });

  await revisar("Pedido", "Quitar el último producto deja el mensaje de pedido vacío", async () => {
    await nav(p, `/producto/${productos[0].sku.toLowerCase()}/`);
    await p.click("[data-agregar]");
    await nav(p, "/pedido/");
    const q = await p.$("[data-quitar]");
    if (q) { await q.click(); await p.waitForTimeout(400); }
    const vacio = await p.evaluate(() => {
      const v = document.querySelector("[data-pedido-vacio]");
      return v ? !v.hidden && v.offsetParent !== null : false;
    });
    return vacio ? true : "no apareció el aviso de pedido vacío";
  });

  await revisar("Pedido", "El botón principal de la ficha es Añadir al pedido, no WhatsApp", async () => {
    await nav(p, `/producto/${productos[0].sku.toLowerCase()}/`);
    const d = await p.evaluate(() => {
      const ped = document.querySelector("[data-agregar]");
      const wa = document.querySelector("[data-wa-ficha]");
      if (!ped || !wa) return null;
      const a = ped.getBoundingClientRect(), b = wa.getBoundingClientRect();
      return { pedidoArriba: a.top < b.top, pedidoMasAncho: a.width > b.width,
               pedidoRelleno: getComputedStyle(ped).backgroundColor,
               waRelleno: getComputedStyle(wa).backgroundColor };
    });
    if (!d) return "falta alguno de los dos botones";
    if (!d.pedidoArriba) return "WhatsApp sigue apareciendo primero";
    if (!d.pedidoMasAncho) return "los dos tienen el mismo peso visual";
    return true;
  });

  await revisar("Pedido", "No hay botón flotante de WhatsApp en la página del pedido", async () => {
    await nav(p, "/pedido/");
    const n = await p.evaluate(() => document.querySelectorAll(".wa-flotante").length);
    return n === 0 ? true : "sigue estando, y se salta el formulario";
  });

  // Formulario obligatorio
  await revisar("Pedido", "Con el formulario vacío NO deja enviar", async () => {
    await nav(p, `/producto/${productos[0].sku.toLowerCase()}/`);
    await p.click("[data-agregar]");
    await nav(p, "/pedido/");
    await interceptarWA(p);
    await p.click("[data-wa-pedido]");
    await p.waitForTimeout(400);
    const w = await leerWA(p);
    const err = await p.evaluate(() => {
      const e = document.querySelector("[data-resumen-error]");
      return e && !e.hidden ? e.textContent.trim() : null;
    });
    if (w && !w.bloqueado) return "¡se fue a WhatsApp sin los datos del cliente!";
    return err ? true : "lo bloqueó pero no avisó por qué";
  });

  const campos = [["nombre", "Ana María Restrepo"], ["telefono", "3001234567"], ["ciudad", "Medellín"],
                  ["barrio", "Laureles"], ["direccion", "Calle 44 # 70-21"], ["piso", "3"]];
  for (const [campo] of campos) {
    await revisar("Pedido", `Falta solo "${campo}" y tampoco deja enviar`, async () => {
      for (const [c, v] of campos) await p.fill("#" + c, c === campo ? "" : v).catch(() => {});
      await interceptarWA(p);
      await p.click("[data-wa-pedido]");
      await p.waitForTimeout(300);
      const w = await leerWA(p);
      return (!w || w.bloqueado) ? true : "dejó enviar sin ese dato";
    });
  }

  await revisar("Pedido", "Rechaza un teléfono demasiado corto", async () => {
    for (const [c, v] of campos) await p.fill("#" + c, v).catch(() => {});
    await p.fill("#telefono", "300");
    await interceptarWA(p);
    await p.click("[data-wa-pedido]");
    await p.waitForTimeout(300);
    const w = await leerWA(p);
    return (!w || w.bloqueado) ? true : "aceptó un número de 3 dígitos";
  });

  await revisar("Pedido", "Con todo lleno SÍ envía", async () => {
    for (const [c, v] of campos) await p.fill("#" + c, v).catch(() => {});
    await interceptarWA(p);
    await p.click("[data-wa-pedido]");
    await p.waitForTimeout(400);
    const w = await leerWA(p);
    return w && !w.bloqueado ? true : "siguió bloqueado aunque estaba todo lleno";
  });

  await revisar("Pedido", "El mensaje lleva los datos del cliente y el total", async () => {
    const w = await leerWA(p);
    const txt = decodeURIComponent(new URL(w.href).searchParams.get("text") || "");
    const falt = [];
    for (const [c, v] of campos) if (!txt.includes(v.split(" ")[0])) falt.push(c);
    if (!/Total productos/i.test(txt)) falt.push("total");
    if (!/Ref A-\d\d/.test(txt)) falt.push("referencia del asesor");
    return falt.length ? "le falta: " + falt.join(", ") : true;
  });

  await revisar("Pedido", "Los datos del cliente no se guardan en ningún servidor", async () => {
    const peticiones = [];
    p.on("request", (r) => { if (r.method() === "POST") peticiones.push(r.url()); });
    await p.click("[data-wa-pedido]").catch(() => {});
    await p.waitForTimeout(300);
    return peticiones.length === 0 ? true : "se enviaron datos a: " + peticiones.join(", ");
  });
  await p.close();
}

// ---------- 5. Catálogo: filtros, orden, búsqueda, barra de líneas ----------
{
  const p = await ctxEsc.newPage();
  const cuenta = () => p.evaluate(() => [...document.querySelectorAll(".tarjeta")].filter((t) => t.offsetParent !== null).length);

  await revisar("Catálogo", "El catálogo muestra los 115 productos", async () => {
    await nav(p, "/catalogo/");
    const n = await cuenta();
    return n === productos.length ? true : `muestra ${n} de ${productos.length}`;
  });

  // Los ojos de buey son luz. Antes había un solo filtro, "Con LED / Sin
  // LED", y los 15 muebles de ojos de buey caían en "Sin LED": quedaban
  // escondidos justo para el cliente que buscaba un espejo iluminado.
  await revisar("Catálogo", "Cada tipo de luz muestra exactamente sus muebles", async () => {
    const esperado = (v) => productos.filter((x) =>
      v === "ninguna" ? (x.iluminacion || "ninguna") === "ninguna"
                      : x.iluminacion === v || x.iluminacion === "ambas").length;
    const malos = [];
    for (const v of ["led", "ojos", "ninguna"]) {
      await nav(p, "/catalogo/");
      await p.click(`[data-filtro="luz"][data-valor="${v}"]`);
      await p.waitForTimeout(250);
      const n = await cuenta(), e = esperado(v);
      if (n !== e) malos.push(`${v}: muestra ${n} y debería mostrar ${e}`);
    }
    // Se devuelve la página sin filtros: las pruebas de abajo siguen en esta
    // misma pestaña y contarían sobre la lista filtrada.
    await nav(p, "/catalogo/");
    return malos.length ? malos.join("; ") : true;
  });

  // Un valor escrito a mano que el filtro no conozca deja al mueble fuera de
  // las cuatro listas: no sale en ninguna y nadie se entera.
  await revisar("Catálogo", "Ningún mueble tiene un tipo de luz desconocido", async () => {
    const validos = ["led", "ojos", "ambas", "ninguna"];
    const raros = productos
      .filter((x) => x.iluminacion != null && !validos.includes(x.iluminacion))
      .map((x) => `${x.sku}: "${x.iluminacion}"`);
    return raros.length ? raros.join("; ") : true;
  });

  await revisar("Catálogo", "El filtro de precio reduce la lista y Limpiar la devuelve", async () => {
    const todos = await cuenta();
    await p.click("text=Hasta $500.000");
    await p.waitForTimeout(300);
    const pocos = await cuenta();
    await p.click("[data-limpiar]");
    await p.waitForTimeout(300);
    const otra = await cuenta();
    if (pocos >= todos) return "el filtro no redujo nada";
    if (otra !== todos) return `al limpiar quedaron ${otra} en vez de ${todos}`;
    return true;
  });

  await revisar("Catálogo", "Los filtros no esconden productos que sí cumplen", async () => {
    await nav(p, "/catalogo/");
    await p.click("text=Hasta $500.000");
    await p.waitForTimeout(300);
    const precios = await p.evaluate(() => [...document.querySelectorAll(".tarjeta")]
      .filter((t) => t.offsetParent !== null)
      .map((t) => Number((t.innerText.match(/\$\s*([\d.]+)/) || [0, "0"])[1].replace(/\./g, ""))));
    const esperados = productos.filter((x) => x.precio <= 500000).length;
    const malos = precios.filter((v) => v > 500000).length;
    if (malos) return `${malos} productos por encima de $500.000 siguen visibles`;
    return precios.length === esperados ? true : `muestra ${precios.length}, deberían ser ${esperados}`;
  });

  await revisar("Catálogo", "El orden por precio funciona de verdad", async () => {
    await nav(p, "/catalogo/");
    const boton = await p.$("[data-orden='menor']");
    if (!boton) return "no encontré el botón de menor precio";
    await boton.click();
    await p.waitForTimeout(400);
    const precios = await p.evaluate(() => [...document.querySelectorAll(".tarjeta")]
      .filter((t) => t.offsetParent !== null).slice(0, 20)
      .map((t) => Number((t.innerText.match(/\$\s*([\d.]+)/) || [0, "0"])[1].replace(/\./g, ""))));
    for (let i = 1; i < precios.length; i++) if (precios[i] < precios[i - 1]) return `quedó desordenado en la posición ${i}`;
    return true;
  });

  await revisar("Catálogo", "La búsqueda encuentra un producto por su nombre", async () => {
    const palabra = productos.find((x) => /espejo/i.test(x.nombre)) ? "espejo" : productos[0].nombre.split(" ")[0];
    await nav(p, `/catalogo/?q=${encodeURIComponent(palabra)}`);
    await p.waitForTimeout(400);
    const n = await cuenta();
    return n > 0 && n < productos.length ? true : `con "${palabra}" muestra ${n}`;
  });

  await revisar("Catálogo", "La búsqueda encuentra por SKU", async () => {
    await nav(p, `/catalogo/?q=${productos[5].sku}`);
    await p.waitForTimeout(400);
    const n = await cuenta();
    return n >= 1 && n <= 3 ? true : `con ${productos[5].sku} muestra ${n}`;
  });

  await revisar("Catálogo", "Una búsqueda sin resultados avisa en vez de quedar en blanco", async () => {
    await nav(p, "/catalogo/?q=zzzzqqqq");
    await p.waitForTimeout(400);
    const aviso = await p.evaluate(() => {
      const v = document.querySelector("[data-vacio]");
      return v ? (!v.hidden && v.offsetParent !== null) : false;
    });
    return aviso ? true : "no aparece ningún mensaje";
  });

  await revisar("Catálogo", "La barra de líneas aparece ya puesta, sin deslizarse sola", async () => {
    await p.goto(BASE + "/categoria/sillas-puffs/", { waitUntil: "domcontentloaded" });
    const v = await p.evaluate(() => new Promise((r) => {
      const pista = document.querySelector("[data-carrusel-pista]"); const vals = []; const t0 = performance.now();
      (function tic() { vals.push(Math.round(pista.scrollLeft)); performance.now() - t0 < 700 ? requestAnimationFrame(tic) : r(vals); })();
    }));
    return new Set(v).size <= 3 ? true : `se desliza (${new Set(v).size} posiciones)`;
  });

  await revisar("Catálogo", "Cada categoría muestra solo los suyos y la cuenta coincide", async () => {
    const malos = [];
    for (const c of categorias) {
      await nav(p, `/categoria/${c.slug}/`);
      const n = await cuenta();
      const esperados = productos.filter((x) => x.categoria === c.slug).length;
      if (n !== esperados) malos.push(`${c.nombre}: ${n} en vez de ${esperados}`);
    }
    return malos.length ? malos.join("; ") : true;
  });

  await revisar("Catálogo", "Las migas de pan llevan la categoría correcta", async () => {
    const malos = [];
    for (const sku of ["LM-121", "LM-105", "LM-009"]) {
      const pr = productos.find((x) => x.sku === sku); if (!pr) continue;
      await nav(p, `/producto/${sku.toLowerCase()}/`);
      const migas = await p.evaluate(() => document.querySelector(".migas")?.innerText.replace(/\s+/g, " ") || "");
      const cat = categorias.find((c) => c.slug === pr.categoria);
      if (!migas.includes(cat.nombre)) malos.push(`${sku} dice "${migas.slice(0, 50)}" y es ${cat.nombre}`);
    }
    return malos.length ? malos.join("; ") : true;
  });
  await p.close();
}

// ---------- 6. Ficha de producto: galería, compartir, relacionados ----------
{
  const p = await ctxEsc.newPage();
  const conVarias = productos.find((x) => (x.fotos || []).length > 2);

  // La lupa amplía y SIGUE al cursor. Mirar solo que crezca no bastaría: si
  // el origen no se moviera, se ampliaría siempre el mismo punto y la lupa
  // no serviría para revisar una manija o el veteado.
  await revisar("Ficha", "La lupa amplía la foto y sigue al cursor", async () => {
    await nav(p, "/producto/lm-012/");
    const caja = await p.$(".ficha__principal");
    const r = await caja.boundingBox();
    const mirar = () => p.evaluate(() => {
      const i = document.querySelector(".ficha__principal img"), c = getComputedStyle(i);
      return { t: c.transform, o: c.transformOrigin };
    });
    if ((await mirar()).t !== "none") return "la foto ya estaba ampliada sin pasar el mouse";

    await p.mouse.move(r.x + r.width * 0.25, r.y + r.height * 0.25);
    await p.waitForTimeout(320);
    const a = await mirar();
    if (a.t === "none") return "no amplió al pasar el mouse";

    await p.mouse.move(r.x + r.width * 0.78, r.y + r.height * 0.78);
    await p.waitForTimeout(320);
    const b = await mirar();
    if (b.o === a.o) return `el punto ampliado no se movió con el cursor (${a.o})`;

    await p.mouse.move(r.x - 80, r.y - 80);
    await p.waitForTimeout(320);
    return (await mirar()).t === "none" ? true : "quedó ampliada después de sacar el mouse";
  });

  await revisar("Ficha", "La foto grande abre el visor a pantalla completa", async () => {
    await nav(p, `/producto/${conVarias.sku.toLowerCase()}/`);
    await p.click("[data-galeria-abrir]");
    await p.waitForTimeout(400);
    const abierto = await p.evaluate(() => {
      const v = document.querySelector(".visor");
      if (!v || v.hidden) return false;
      const cs = getComputedStyle(v);
      return cs.display !== "none" && cs.visibility !== "hidden";
    });
    return abierto ? true : "no se abrió";
  });

  await revisar("Ficha", "El visor pasa a la foto siguiente", async () => {
    const a = await p.evaluate(() => document.querySelector("[data-visor-img]")?.src);
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(350);
    const b = await p.evaluate(() => document.querySelector("[data-visor-img]")?.src);
    return a !== b ? true : "la foto no cambió";
  });

  await revisar("Ficha", "El visor muestra en qué foto va (1 / N)", async () => {
    const t = await p.evaluate(() => document.querySelector("[data-visor-num]")?.textContent.trim());
    return /\d+\s*\/\s*\d+/.test(t || "") ? true : `dice "${t}"`;
  });

  await revisar("Ficha", "La tecla Escape cierra el visor", async () => {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
    const cerrado = await p.evaluate(() => {
      const v = document.querySelector(".visor");
      return !v || v.hidden || getComputedStyle(v).display === "none";
    });
    return cerrado ? true : "quedó abierto";
  });

  await revisar("Ficha", "Las miniaturas cambian la foto principal", async () => {
    await nav(p, `/producto/${conVarias.sku.toLowerCase()}/`);
    const a = await p.evaluate(() => document.querySelector("[data-galeria-principal]")?.src);
    await p.click("[data-galeria-ir='1']");
    await p.waitForTimeout(350);
    const b = await p.evaluate(() => document.querySelector("[data-galeria-principal]")?.src);
    return a !== b ? true : "la principal no cambió";
  });

  await revisar("Ficha", "Sin JavaScript las miniaturas siguen siendo enlaces a la foto", async () => {
    const href = await p.evaluate(() => document.querySelector("[data-galeria-ir]")?.getAttribute("href"));
    return href && href.includes("/img/") ? true : `la miniatura no apunta a una foto (${href})`;
  });

  await revisar("Ficha", "Compartir copia un enlace con el código del asesor", async () => {
    await nav(p, `/producto/${conVarias.sku.toLowerCase()}/?a=05`);
    await p.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await p.click("[data-compartir]").catch(() => {});
    await p.waitForTimeout(500);
    const txt = await p.evaluate(() => navigator.clipboard.readText().catch(() => "")).catch(() => "");
    if (!txt) return "no pude leer el portapapeles en la prueba (revisar a mano)";
    return /\?a=\d\d/.test(txt) ? true : `copió "${txt.slice(0, 70)}" sin el código`;
  });

  await revisar("Ficha", "Los relacionados son de la misma categoría y no se repite el mismo producto", async () => {
    await nav(p, `/producto/${conVarias.sku.toLowerCase()}/`);
    const skus = await p.evaluate(() => [...document.querySelectorAll(".seccion:last-of-type .tarjeta a[href*='/producto/']")]
      .map((a) => a.getAttribute("href").split("/").filter(Boolean).pop().toUpperCase()));
    if (skus.includes(conVarias.sku)) return "se muestra a sí mismo";
    const otros = skus.map((s) => productos.find((x) => x.sku === s)).filter(Boolean);
    const ajenos = otros.filter((x) => x.categoria !== conVarias.categoria);
    return ajenos.length ? `${ajenos.length} son de otra categoría` : true;
  });

  // 21 de los 115 muebles tardan más de 15 días. La tarjeta es la misma para
  // todos, así que cualquier cifra ahí es una promesa que el taller no puede
  // cumplir en uno de cada cinco.
  await revisar("Plazos", "Ninguna tarjeta promete un número de días", async () => {
    await nav(p, "/catalogo/");
    const malas = await p.evaluate(() =>
      [...document.querySelectorAll(".tarjeta__plazo")]
        .map((e) => e.textContent.trim())
        .filter((t) => /\d/.test(t))
        .slice(0, 3));
    return malas.length ? `dicen "${malas.join('", "')}"` : true;
  });

  await revisar("Plazos", "El catálogo avisa que el plazo cambia según el mueble", async () => {
    const t = await p.evaluate(() => document.querySelector(".listado__plazo")?.textContent.trim() || "");
    if (!t) return "no hay nota de plazo en el catálogo";
    return /\d+\s*(y|a|–|-)\s*\d+/.test(t) ? true : `la nota no da un rango: "${t}"`;
  });

  // Lo que de verdad protege al cliente: que el mueble lento diga su plazo
  // y no el general. La frase la arma el sitio a partir de dos números, así
  // que aquí se arma igual y se compara.
  const frase = (d, h) =>
    d && h ? `Fabricación bajo pedido: entrega de ${d} a ${h} días hábiles.`
    : h ? `Fabricación bajo pedido: entrega hasta ${h} días hábiles.`
    : d ? `Fabricación bajo pedido: entrega desde ${d} días hábiles.` : "";

  await revisar("Plazos", "El mueble con plazo propio muestra el suyo en la ficha", async () => {
    const lentos = productos.filter((x) => x.plazoDesde || x.plazoHasta);
    if (!lentos.length) return "ningún producto tiene plazo propio: la prueba ya no mide nada";
    const malos = [];
    for (const m of lentos.slice(0, 6)) {
      await nav(p, `/producto/${m.sku.toLowerCase()}/`);
      const t = await p.evaluate(() => document.querySelector(".aviso-plazo")?.textContent.trim() || "");
      const esperado = frase(m.plazoDesde, m.plazoHasta);
      if (t.replace(/\s+/g, " ") !== esperado) malos.push(`${m.sku}: dice "${t}" y debería decir "${esperado}"`);
    }
    return malos.length ? malos.join("; ") : true;
  });

  await revisar("Plazos", "El mueble normal muestra el plazo del taller", async () => {
    const normal = productos.find((x) => !x.plazoDesde && !x.plazoHasta);
    if (!normal) return "todos los productos tienen plazo propio: la prueba ya no mide nada";
    await nav(p, `/producto/${normal.sku.toLowerCase()}/`);
    const t = await p.evaluate(() => document.querySelector(".aviso-plazo")?.textContent.trim() || "");
    const esperado = frase(negocio.plazoDesde, negocio.plazoHasta);
    return t.replace(/\s+/g, " ") === esperado ? true : `dice "${t}" y debería decir "${esperado}"`;
  });

  // La razón de calcular el tope en vez de escribirlo: si alguien carga un
  // mueble más lento, la nota y la portada tienen que corregirse solas.
  await revisar("Plazos", "La nota y la portada llegan hasta el mueble más lento", async () => {
    const tope = Math.max(negocio.plazoHasta || 0, ...productos.map((x) => x.plazoHasta || 0));
    await nav(p, "/catalogo/");
    const nota = await p.evaluate(() => document.querySelector(".listado__plazo")?.textContent.trim() || "");
    if (!nota.includes(String(tope))) return `el mueble más lento es de ${tope} días y la nota dice "${nota}"`;
    await nav(p, "/");
    const cifra = await p.evaluate(() =>
      [...document.querySelectorAll(".cifras div")].find((d) => /Días/.test(d.textContent))?.querySelector("dt")?.textContent.trim() || "");
    return cifra.includes(String(tope)) ? true : `la portada dice "${cifra}" y el tope es ${tope}`;
  });

  await revisar("Ficha", "Todos los precios salen formateados en pesos", async () => {
    const malos = [];
    for (const sku of productos.slice(0, 15).map((x) => x.sku)) {
      await nav(p, `/producto/${sku.toLowerCase()}/`);
      const t = await p.evaluate(() => document.querySelector(".ficha__precio")?.textContent.trim());
      if (!/^\$\s?[\d.]+$/.test(t || "")) malos.push(`${sku}: "${t}"`);
    }
    return malos.length ? malos.join("; ") : true;
  });
  await p.close();
}

// ---------- 7. Lo que ven WhatsApp y Google al compartir ----------
{
  const p = await ctxEsc.newPage();
  await revisar("Compartir", "Cada página tiene título propio y descripción", async () => {
    const malos = [];
    for (const r of ["/", "/catalogo/", "/asesores/", `/producto/${productos[0].sku.toLowerCase()}/`]) {
      await nav(p, r);
      const d = await p.evaluate(() => ({
        t: document.title,
        desc: document.querySelector('meta[name="description"]')?.content || "",
      }));
      if (!d.t || d.t.length < 10) malos.push(`${r}: título "${d.t}"`);
      if (!d.desc) malos.push(`${r}: sin descripción`);
    }
    return malos.length ? malos.join("; ") : true;
  });

  await revisar("Compartir", "La vista previa de WhatsApp apunta a una imagen que existe", async () => {
    const malos = [];
    for (const r of ["/", `/producto/${productos[0].sku.toLowerCase()}/`]) {
      await nav(p, r);
      const og = await p.evaluate(() => document.querySelector('meta[property="og:image"]')?.content || "");
      if (!og) { malos.push(`${r}: sin og:image`); continue; }
      const ruta = og.replace(/^https?:\/\/[^/]+/, "");
      const resp = await p.request.get(BASE + ruta);
      if (resp.status() >= 400) malos.push(`${r}: ${ruta} da ${resp.status()}`);
    }
    return malos.length ? malos.join("; ") : true;
  });
  await p.close();
}

// ---------- 8. Celular ----------
{
  const p = await ctxCel.newPage();
  await revisar("Celular", "Ninguna página se desborda a lo ancho", async () => {
    const malas = [];
    for (const r of ["/", "/catalogo/", "/asesores/", "/pedido/", `/producto/${productos[0].sku.toLowerCase()}/`, `/categoria/${categorias[0].slug}/`]) {
      await nav(p, r);
      const d = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (d > 1) malas.push(`${r} (+${d}px)`);
    }
    return malas.length ? malas.join("; ") : true;
  });

  await revisar("Celular", "Todo lo que se toca mide al menos 44px", async () => {
    const malos = [];
    for (const r of ["/", "/catalogo/", "/pedido/"]) {
      await nav(p, r);
      // Solo lo que se ve como botón. Un enlace dentro de un párrafo es texto,
      // y agrandarlo obligaría a separar las líneas de forma antinatural.
      const chicos = await p.evaluate(() => [...document.querySelectorAll(".boton, button, select, .ficha, .pie__red, .icono")]
        .filter((e) => e.offsetParent !== null)
        .map((e) => {
          // Si el elemento extiende su área de toque con un ::after, esa es la
          // que cuenta: el dedo la alcanza aunque el texto se vea más bajito.
          const extra = parseFloat(getComputedStyle(e, "::after").height) || 0;
          return { t: (e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 24),
                   h: Math.round(Math.max(e.getBoundingClientRect().height, extra)) };
        })
        .filter((x) => x.h > 0 && x.h < 44 && x.t).slice(0, 5));
      if (chicos.length) malos.push(`${r}: ${chicos.map((c) => `"${c.t}" ${c.h}px`).join(", ")}`);
    }
    return malos.length ? malos.join(" | ") : true;
  });

  await revisar("Celular", "El botón flotante se esconde al llegar al final", async () => {
    await nav(p, "/");
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(700);
    const v = await p.evaluate(() => getComputedStyle(document.querySelector(".wa-flotante")).visibility);
    return v === "hidden" ? true : `sigue visible (${v})`;
  });

  await revisar("Celular", "La página termina justo donde termina el pie", async () => {
    const sobra = await p.evaluate(() => Math.round(document.documentElement.scrollHeight -
      (document.querySelector(".pie").getBoundingClientRect().bottom + window.scrollY)));
    return Math.abs(sobra) <= 2 ? true : `sobran ${sobra}px`;
  });

  // La lupa del escritorio no debe armarse en el teléfono: no hay cursor que
  // seguir, y el toque ya abre el visor, que ahí sirve mucho más.
  await revisar("Celular", "La foto no lleva la lupa de escritorio", async () => {
    await nav(p, "/producto/lm-012/");
    const puesta = await p.evaluate(() =>
      document.querySelector(".ficha__principal")?.classList.contains("ficha__principal--lupa"));
    return puesta ? "la lupa de escritorio quedó puesta en el teléfono" : true;
  });

  await revisar("Celular", "El buscador se abre desde la lupa", async () => {
    await nav(p, "/catalogo/");
    const b = await p.$("[data-abrir-busqueda]");
    if (!b) return "no hay botón de lupa";
    await b.click();
    await p.waitForTimeout(350);
    const vis = await p.evaluate(() => { const f = document.querySelector("#buscador"); return f && f.offsetParent !== null; });
    return vis ? true : "no se abrió";
  });

  await revisar("Celular", "El teclado del teléfono sale numérico donde corresponde", async () => {
    await nav(p, "/pedido/");
    const d = await p.evaluate(() => {
      const t = document.querySelector("#telefono");
      return t ? { type: t.type, mode: t.getAttribute("inputmode") } : null;
    });
    if (!d) return "no encontré el campo";
    return (d.type === "tel" || d.mode === "tel" || d.mode === "numeric") ? true
      : `el campo de WhatsApp abre teclado de letras (type=${d.type})`;
  });
  await p.close();
}

// ---------- 9. Accesibilidad básica ----------
{
  const p = await ctxEsc.newPage();
  await revisar("Accesibilidad", "Las fotos de producto tienen texto alternativo", async () => {
    await nav(p, "/catalogo/");
    const sin = await p.evaluate(() => [...document.querySelectorAll(".tarjeta img")].filter((i) => !i.alt && i.alt !== "").length);
    return sin === 0 ? true : `${sin} fotos sin describir`;
  });
  await revisar("Accesibilidad", "Los botones que son solo íconos dicen qué hacen", async () => {
    const malos = [];
    for (const r of ["/", "/pedido/"]) {
      await nav(p, r);
      const n = await p.evaluate(() => [...document.querySelectorAll("a, button")]
        .filter((e) => e.offsetParent !== null && !e.innerText.trim() && !e.getAttribute("aria-label") && !e.title).length);
      if (n) malos.push(`${r}: ${n}`);
    }
    return malos.length ? malos.join("; ") : true;
  });
  await revisar("Accesibilidad", "Cada página tiene un solo título principal (h1)", async () => {
    const malos = [];
    for (const r of ["/", "/catalogo/", "/asesores/", "/pedido/", `/producto/${productos[0].sku.toLowerCase()}/`]) {
      await nav(p, r);
      const n = await p.evaluate(() => document.querySelectorAll("h1").length);
      if (n !== 1) malos.push(`${r}: ${n}`);
    }
    return malos.length ? malos.join("; ") : true;
  });
  await revisar("Accesibilidad", "El idioma de la página está declarado como español", async () => {
    await nav(p, "/");
    const l = await p.evaluate(() => document.documentElement.lang);
    return /^es/.test(l || "") ? true : `dice "${l}"`;
  });
  await p.close();
}

// ---------- 10. Sin JavaScript ----------
{
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await revisar("Sin JavaScript", "El catálogo se sigue pudiendo ver y navegar", async () => {
    await p.goto(BASE + "/catalogo/", { waitUntil: "domcontentloaded" });
    const n = await p.evaluate(() => document.querySelectorAll(".tarjeta").length);
    return n > 50 ? true : `solo se ven ${n} productos`;
  });
  await revisar("Sin JavaScript", "Las fichas de producto se abren", async () => {
    await p.goto(BASE + `/producto/${productos[0].sku.toLowerCase()}/`, { waitUntil: "domcontentloaded" });
    const t = await p.evaluate(() => document.querySelector("h1")?.textContent.trim());
    return t === productos[0].nombre ? true : `muestra "${t}"`;
  });
  await ctx.close();
}

// ---------- 11. Presentación de marca ----------
// Tapa el sitio entero los primeros tres segundos, así que lo que de verdad
// hay que probar no es que se vea bonita: es que SIEMPRE se quite.
{
  const AREA = "Presentación de marca";
  const DURA = 3340;   // --espera (2660) + --telon (680)

  // Navegador sin estrenar: es la primera vez que este visitante entra.
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await nav(p, "/");

  // ¿Hay algo del tamaño de la pantalla tapando el centro de la página?
  const tapando = (pag) => pag.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return !!(el && el.closest("[data-intro]"));
  });

  await revisar(AREA, "Aparece al entrar por primera vez", async () => {
    const hay = await p.evaluate(() =>
      document.documentElement.classList.contains("con-intro") && !!document.querySelector("[data-intro]"));
    return hay ? true : "no apareció";
  });

  await revisar(AREA, "Ocupa toda la pantalla y tapa la página", async () => {
    if (!(await tapando(p))) return "no está tapando el centro";
    const m = await p.evaluate(() => {
      const r = document.querySelector("[data-intro]").getBoundingClientRect();
      return { ancho: Math.round(r.width), alto: Math.round(r.height), vw: innerWidth, vh: innerHeight };
    });
    return (m.ancho === m.vw && m.alto === m.vh) ? true : `mide ${m.ancho}×${m.alto} y la pantalla es ${m.vw}×${m.vh}`;
  });

  await revisar(AREA, "Se quita sola y deja la página usable", async () => {
    await p.waitForTimeout(DURA + 400);
    if (await tapando(p)) return "a los 3,7 segundos todavía tapa la página";
    const queda = await p.evaluate(() => !!document.querySelector("[data-intro]"));
    if (queda) return "el telón se quitó pero el elemento quedó en la página";
    // Prueba de verdad: que se pueda tocar algo.
    await p.click('.cabecera a[href="/catalogo/"]');
    return p.url().endsWith("/catalogo/") ? true : `el clic no llevó a ninguna parte (${p.url()})`;
  });

  await revisar(AREA, "No vuelve a aparecer al cambiar de sección", async () => {
    const vistas = [];
    for (const r of ["/", "/pedido/", "/catalogo/"]) {
      await nav(p, r);
      if (await p.evaluate(() => document.documentElement.classList.contains("con-intro"))) vistas.push(r);
    }
    return vistas.length ? `volvió a salir en ${vistas.join(", ")}` : true;
  });

  // Se recuerda por PESTAÑA a propósito: una pestaña nueva en el inicio es
  // una entrada nueva, y es además la manera de volver a verla sin tocar
  // nada. Lo que no debe repetirse es mientras se recorre el catálogo, y eso
  // lo cubre la prueba de arriba.
  await revisar(AREA, "Vuelve a aparecer en una pestaña nueva del inicio", async () => {
    const otra = await ctx.newPage();
    await nav(otra, "/");
    const sale = await otra.evaluate(() => document.documentElement.classList.contains("con-intro"));
    await otra.close();
    return sale ? true : "no salió en una pestaña nueva del inicio";
  });

  // Pero una pestaña nueva de un MUEBLE sigue sin telón: ahí es donde cae el
  // enlace del asesor y donde estorba.
  await revisar(AREA, "Una pestaña nueva de un mueble sigue sin presentación", async () => {
    const otra = await ctx.newPage();
    await nav(otra, "/producto/lm-012/");
    const sale = await otra.evaluate(() => document.documentElement.classList.contains("con-intro"));
    await otra.close();
    return sale ? "salió en una pestaña nueva de un mueble" : true;
  });
  await ctx.close();

  // Un enlace de asesor cae casi siempre en un tocador puntual: ahí el
  // cliente viene a ver ESE mueble y el telón estorba.
  await revisar(AREA, "Solo aparece en el inicio, no en un producto", async () => {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await c.newPage();
    await nav(pg, "/producto/lm-012/");
    const sale = await pg.evaluate(() => document.documentElement.classList.contains("con-intro"));
    await c.close();
    return sale ? "salió al entrar directo a un producto" : true;
  });

  await revisar(AREA, "Se puede saltar tocando la pantalla", async () => {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await c.newPage();
    await nav(pg, "/");
    await pg.waitForTimeout(700);
    await pg.mouse.click(640, 450);
    await pg.waitForTimeout(500);          // muy antes de los 3,3 segundos
    const sigue = await pg.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return !!(el && el.closest("[data-intro]"));
    });
    await c.close();
    return sigue ? "el toque no la quitó" : true;
  });

  // La red falla, el archivo de JavaScript no llega: el telón tiene que subir
  // igual, porque lo sube el CSS. Si esto se rompe, el visitante se queda
  // mirando una pantalla oscura encima del catálogo.
  await revisar(AREA, "Aunque no cargue el JavaScript, el telón igual sube", async () => {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    await c.route("**/catalogo.js", (r) => r.abort());
    const pg = await c.newPage();
    await pg.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const salio = await pg.evaluate(() => !!document.querySelector("[data-intro]"));
    await pg.waitForTimeout(DURA + 400);
    const tapa = await pg.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return !!(el && el.closest("[data-intro]"));
    });
    await c.close();
    if (!salio) return "ni siquiera apareció";
    return tapa ? "se quedó tapando la página" : true;
  });

  await revisar(AREA, "No aparece si el visitante pidió menos animaciones", async () => {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const pg = await c.newPage();
    await nav(pg, "/");
    const tapa = await pg.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return !!(el && el.closest("[data-intro]"));
    });
    await c.close();
    return tapa ? "apareció de todas formas" : true;
  });

  await revisar(AREA, "Sin JavaScript no aparece y se entra directo", async () => {
    const c = await navegador.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
    const pg = await c.newPage();
    await pg.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const tapa = await pg.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return !!(el && el.closest("[data-intro]"));
    });
    await c.close();
    return tapa ? "tapó la página de un visitante sin JavaScript" : true;
  });
}

await navegador.close();

// ---------- Informe ----------
const fallos = res.filter((r) => r.estado === "FALLA");
console.log("\n" + "=".repeat(78));
let areaActual = "";
for (const r of res) {
  if (r.area !== areaActual) { areaActual = r.area; console.log(`\n## ${areaActual}`); }
  console.log(`  ${r.estado === "OK" ? "OK   " : "FALLA"} ${r.n}${r.d ? "\n         -> " + r.d : ""}`);
}
console.log("\n" + "=".repeat(78));
console.log(`TOTAL: ${res.length} pruebas · ${res.length - fallos.length} pasan · ${fallos.length} fallan`);
servidor.close();
process.exit(fallos.length ? 1 : 0);
