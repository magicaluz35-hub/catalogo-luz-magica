// Configuración de Eleventy — Catálogo Luz Mágica
// Esto le dice al generador dónde están los archivos y cómo construir el sitio.
// El dueño NO necesita tocar este archivo.

export default function (eleventyConfig) {
  // Copia tal cual las carpetas de estilos, scripts e imágenes
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Las fotos viven en la carpeta img/ de la raíz del repositorio,
  // la misma del catálogo anterior. Se copian tal cual al sitio publicado.
  eleventyConfig.addPassthroughCopy({ "img": "img" });
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });

  // Formatea un número como precio colombiano: 360000 -> "$ 360.000"
  eleventyConfig.addFilter("pesos", (valor) => {
    const n = Number(valor);
    if (!Number.isFinite(n)) return "";
    return "$ " + n.toLocaleString("es-CO");
  });

  // Convierte un texto en un identificador para URL: "París Modular" -> "paris-modular"
  eleventyConfig.addFilter("slug", (texto) =>
    String(texto)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );

  // Deja solo los productos de una categoría
  eleventyConfig.addFilter("deCategoria", (productos, slug) =>
    (productos || []).filter((p) => p.categoria === slug)
  );

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
