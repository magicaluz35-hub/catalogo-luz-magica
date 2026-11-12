// Arma la lista de productos leyendo la carpeta contenido/productos/,
// donde cada mueble es un archivo suelto.
//
// Están separados a propósito: el panel de edición solo sabe buscar y
// ordenar cuando el contenido viene de una carpeta. Con los 115 en un
// solo archivo había que bajar por la lista entera para encontrar uno.
//
// El sitio los muestra en el orden del campo "orden" (10, 20, 30...),
// que el dueño puede cambiar desde el panel para mover un mueble
// adelante. Los que no lo traigan quedan de últimos.
import fs from "node:fs";
import path from "node:path";

const CARPETA = "contenido/productos";

export default function () {
  const archivos = fs
    .readdirSync(CARPETA)
    .filter((f) => f.endsWith(".json"));

  const productos = archivos.map((f) => {
    const texto = fs.readFileSync(path.join(CARPETA, f), "utf8");
    try {
      return JSON.parse(texto);
    } catch (e) {
      throw new Error(
        `El archivo ${CARPETA}/${f} tiene un error de formato y no se pudo leer: ${e.message}`
      );
    }
  });

  const sinSku = productos.filter((p) => !p.sku).length;
  if (sinSku) {
    console.warn(
      `\n[Luz Mágica] ¡OJO! ${sinSku} producto(s) sin SKU. Sin SKU no se les puede\n` +
      `  armar la dirección web, así que no van a salir en el catálogo.\n`
    );
  }

  return productos
    .filter((p) => p.sku)
    .sort((a, b) => {
      const oa = Number.isFinite(a.orden) ? a.orden : Infinity;
      const ob = Number.isFinite(b.orden) ? b.orden : Infinity;
      // A igual orden (o sin orden), por SKU, para que la lista no baile
      // entre una construcción y la siguiente.
      return oa - ob || String(a.sku).localeCompare(String(b.sku));
    });
}
