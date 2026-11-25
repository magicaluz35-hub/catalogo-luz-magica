// Arma la lista de productos leyendo la carpeta contenido/productos/,
// donde cada mueble es un archivo suelto.
//
// Están separados a propósito: el panel de edición solo sabe buscar y
// ordenar cuando el contenido viene de una carpeta. Con los 115 en un
// solo archivo había que bajar por la lista entera para encontrar uno.
//
// El orden sale SOLO del código, no de un campo que alguien tenga que
// llenar. El número del SKU es el número de la página en el catálogo
// impreso, que es de donde salió todo: LM-005 va antes que LM-030.
//
// Antes esto era un campo "Posición en el catálogo" con números de diez en
// diez. Era un detalle del funcionamiento asomándose al panel: nadie que
// administre un catálogo de muebles tiene por qué entender por qué el
// tercer mueble se llama 70. Se calcula y listo.
//
// Las parejas A/B —el mismo mueble en dos acabados— quedan juntas y en
// orden: LM-034A antes que LM-034B.
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

  // LM-034A → 3400, LM-034B → 3401. El número del código manda, y la letra
  // del final solo desempata para que la pareja quede junta.
  const posicion = (sku) => {
    const m = String(sku).match(/^[A-Za-z]+-?(\d+)([A-Za-z]*)$/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const letra = m[2] ? m[2].toUpperCase().charCodeAt(0) - 64 : 0;
    return Number(m[1]) * 100 + letra;
  };

  return productos
    .filter((p) => p.sku)
    .map((p) => ({ ...p, orden: posicion(p.sku) }))
    .sort((a, b) => a.orden - b.orden || String(a.sku).localeCompare(String(b.sku)));
}
