// Configuración de Eleventy — Catálogo Luz Mágica
// Esto le dice al generador dónde están los archivos y cómo construir el sitio.
// El dueño NO necesita tocar este archivo.

import fs from "node:fs";

export default function (eleventyConfig) {
  // Un producto nunca debe mostrar una foto que no está en el repositorio:
  // el navegador pinta el ícono de imagen rota y parece un sitio abandonado.
  // Aquí se descartan antes de construir y se avisa en el registro, para que
  // quede claro cuál hay que volver a subir.
  (function avisarFotosPerdidas() {
    const dir = "contenido/productos";
    const lista = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(dir + "/" + f, "utf8")));
    const perdidas = [];
    for (const p of lista) {
      for (const f of p.fotos || []) if (!fs.existsSync("." + f)) perdidas.push(`${p.sku} → ${f}`);
    }
    if (perdidas.length) {
      console.warn(
        `\n[Luz Mágica] ¡OJO! ${perdidas.length} foto(s) de productos no están en img/.\n  ` +
        perdidas.join("\n  ") +
        "\n  El navegador va a mostrar el ícono de imagen rota. Sube la foto o quita\n" +
        "  esa línea del producto en el panel.\n"
      );
    }
  })();

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

  // La foto que representa a un atajo de "Encuentra el tuyo".
  // El dueño solo escribe el texto y el enlace; la foto sale sola del
  // producto al que ese enlace lleva, así nunca hay que subir ni mantener
  // una imagen aparte. Si el enlace cambia, la foto cambia con él.
  eleventyConfig.addFilter("fotoAtajo", (productos, enlace) => {
    const lista = productos || [];
    const ruta = String(enlace || "");
    let candidatos;

    const categoria = ruta.match(/^\/categoria\/([^/]+)\//);
    if (categoria) {
      candidatos = lista.filter((p) => p.categoria === categoria[1]);
    } else if (/precio=bajo/.test(ruta)) {
      candidatos = lista.filter((p) => p.precio <= 500000);
    } else if (/precio=medio/.test(ruta)) {
      candidatos = lista.filter((p) => p.precio > 500000 && p.precio <= 1000000);
    } else if (/precio=alto/.test(ruta)) {
      candidatos = lista.filter((p) => p.precio > 1000000);
    } else {
      candidatos = lista;
    }

    // Solo sirven las fotos que de verdad están en el repositorio: una foto
    // declarada pero no subida pinta el ícono de imagen rota.
    const conFoto = candidatos.filter(
      (p) => p.fotos && p.fotos[0] && fs.existsSync("." + p.fotos[0])
    );
    const elegido = conFoto.find((p) => p.destacado) || conFoto[0];
    return elegido ? elegido.fotos[0] : "";
  });

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
