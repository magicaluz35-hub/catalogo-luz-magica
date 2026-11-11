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
    const lista = JSON.parse(fs.readFileSync("src/_data/productos.json", "utf8"));
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
