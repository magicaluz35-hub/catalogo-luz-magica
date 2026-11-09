// Configuración de Eleventy — Catálogo Luz Mágica
// Esto le dice al generador dónde están los archivos y cómo construir el sitio.
// El dueño NO necesita tocar este archivo.

export default function (eleventyConfig) {
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
