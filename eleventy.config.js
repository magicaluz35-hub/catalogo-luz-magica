// Configuración de Eleventy — Catálogo Luz Mágica
// Esto le dice al generador dónde están los archivos y cómo construir el sitio.
// El dueño NO necesita tocar este archivo.

import fs from "node:fs";
import { revisarDatos, informar } from "./pruebas/revisar-datos.mjs";

export default function (eleventyConfig) {
  // Antes de construir, se revisan los datos. Si hay algo imposible —un
  // precio en cero, una línea que no existe, un WhatsApp mal escrito— la
  // construcción se detiene aquí y Cloudflare deja publicada la versión
  // anterior, que estaba bien. El dueño ve el motivo en el registro del
  // despliegue, escrito en sus palabras.
  //
  // Vale la pena el susto: sin esto, esos errores se publican y la página
  // se ve perfecta. Nadie se entera hasta que un cliente lo encuentra.
  // La lista de lo que se revisa está en pruebas/revisar-datos.mjs.
  {
    const resultado = revisarDatos();
    const cuantos = informar(resultado);
    if (cuantos) {
      throw new Error(
        `No se publicó: hay ${cuantos} error${cuantos === 1 ? "" : "es"} en los datos. ` +
        "El detalle está arriba, en el registro. El catálogo anterior sigue en línea."
      );
    }
  }

  // ¿Existe este archivo en el repositorio?
  // Lo usa el pie de página para mostrar el logo oficial de una red
  // apenas alguien lo suba a img/, y mientras tanto dejar el nombre
  // escrito. Así no hay que tocar código para cambiarlo.
  eleventyConfig.addFilter("existe", (ruta) =>
    fs.existsSync("." + String(ruta || ""))
  );

  // Copia tal cual las carpetas de estilos, scripts e imágenes
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Las fotos viven en la carpeta img/ de la raíz del repositorio,
  // la misma del catálogo anterior. Se copian tal cual al sitio publicado.
  eleventyConfig.addPassthroughCopy({ "img": "img" });

  // Formatea un número como precio colombiano: 360000 -> "$ 360.000"
  eleventyConfig.addFilter("pesos", (valor) => {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "";
    return "$ " + n.toLocaleString("es-CO");
  });

  // ---- Plazos de entrega ----
  // El dueño escribe NÚMEROS, no frases: "de 15 a 20" en vez de copiar una
  // oración entera en cada mueble. La frase la arma el sitio, así siempre
  // está escrita igual y no hay forma de equivocarse con una palabra.
  const dias = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  eleventyConfig.addFilter("fraseEntrega", (desde, hasta) => {
    const d = dias(desde), h = dias(hasta);
    if (d && h) return `Fabricación bajo pedido: entrega de ${d} a ${h} días hábiles.`;
    if (h) return `Fabricación bajo pedido: entrega hasta ${h} días hábiles.`;
    if (d) return `Fabricación bajo pedido: entrega desde ${d} días hábiles.`;
    return "";
  });

  // El plazo más largo de todo el catálogo. Se calcula solo: si mañana el
  // dueño carga un mueble de 30 días, la nota del catálogo y la cifra de la
  // portada se corrigen solas. Antes eran textos sueltos que había que
  // acordarse de cambiar, y por eso las tarjetas prometían 15 días cuando
  // ya había muebles de 25.
  const topeCatalogo = (productos, negocio) => {
    let tope = dias(negocio && negocio.plazoHasta) || 0;
    for (const p of productos || []) tope = Math.max(tope, dias(p.plazoHasta) || 0);
    return tope;
  };

  eleventyConfig.addFilter("cifraEntrega", (productos, negocio) => {
    const d = dias(negocio && negocio.plazoDesde);
    const tope = topeCatalogo(productos, negocio);
    if (!d || !tope) return "";
    return d === tope ? String(d) : `${d}–${tope}`;
  });

  eleventyConfig.addFilter("notaEntrega", (productos, negocio) => {
    const d = dias(negocio && negocio.plazoDesde), h = dias(negocio && negocio.plazoHasta);
    if (!d || !h) return "";
    const tope = topeCatalogo(productos, negocio);
    // Sin muebles lentos no hay nada que advertir: se dice el plazo y ya.
    if (tope <= h) return `Todos los muebles se fabrican a pedido y se entregan entre ${d} y ${h} días hábiles.`;
    return `El plazo depende del mueble: la mayoría se entrega entre ${d} y ${h} días hábiles y algunos tardan hasta ${tope}. El plazo de cada uno está en su ficha.`;
  });

  // Deja solo los productos de una categoría
  eleventyConfig.addFilter("deCategoria", (productos, slug) =>
    (productos || []).filter((p) => p.categoria === slug)
  );

  // Deja solo las categorías de un grupo ("tocadores" o "acompanar")
  eleventyConfig.addFilter("deGrupo", (categorias, grupo) =>
    (categorias || []).filter((c) => c.grupo === grupo)
  );

  // Busca una categoría por su identificador web.
  // Nunjucks no trae un selectattr con comparación fiable, así que va aparte.
  eleventyConfig.addFilter("categoriaDe", (categorias, slug) =>
    (categorias || []).filter((c) => c.slug === slug)[0]
  );

  // Todos los productos de una categoría menos uno (para "también te puede interesar")
  eleventyConfig.addFilter("menos", (productos, sku) =>
    (productos || []).filter((p) => p.sku !== sku)
  );

  // Cuenta los productos de todas las categorías de un grupo
  eleventyConfig.addFilter("cuentaGrupo", (productos, categorias, grupo) => {
    const slugs = (categorias || [])
      .filter((c) => c.grupo === grupo)
      .map((c) => c.slug);
    return (productos || []).filter((p) => slugs.includes(p.categoria)).length;
  });

  // Deja solo los asesores activos
  eleventyConfig.addFilter("activos", (asesores) =>
    (asesores || []).filter((a) => a.activo !== false)
  );

  // Corta una lista a los primeros N elementos
  eleventyConfig.addFilter("primeros", (lista, n) => (lista || []).slice(0, n));

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
}
