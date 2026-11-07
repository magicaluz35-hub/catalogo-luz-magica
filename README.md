# Catálogo web de Luz Mágica

Catálogo de tocadores, espejos y muebles fabricados a pedido, con pedidos por WhatsApp
y atribución de comisiones por asesor.

Sitio estático generado con [Eleventy](https://www.11ty.dev/), publicado en Cloudflare
Pages y editado por el dueño desde [Pages CMS](https://pagescms.org). Todo en planes
gratuitos; lo único que cuesta es el dominio propio, si se compra.

---

## Puesta en marcha (una sola vez)

**Importante: las cuentas de GitHub y de Cloudflare deben crearse con el correo del
negocio, no con el de quien desarrolla.** Si no, el dueño queda dependiendo de un
tercero, que es justo lo que este proyecto viene a resolver.

1. **GitHub.** El repositorio ya existe en la cuenta del negocio, con las 273 fotos en
   la carpeta `img/`. Hay que subir el contenido de esta carpeta **encima**, lo que
   reemplaza los archivos del catálogo anterior (`index.html`, `datos.json` y el
   `.pages.yml` viejo) y **deja `img/` intacta**. Las fotos no se vuelven a subir: este
   proyecto las lee de ahí con los mismos nombres (`p105-1.webp`, etc.).
   Quien suba los archivos necesita permiso de escritura en el repositorio
   (Settings → Collaborators).
2. **Cloudflare.** Entrar con la cuenta del negocio → Workers & Pages → Create →
   conectar el repositorio. La configuración ya viene en `wrangler.jsonc`:
   compila con `npm run build`, publica la carpeta `_site` y, si alguien abre un enlace
   viejo, muestra la página 404 propia en vez de un error del navegador.
3. **Panel de edición.** Entrar a <https://pagescms.org>, iniciar sesión con la cuenta de
   GitHub del negocio y elegir el repositorio. El archivo `.pages.yml` ya define todos
   los campos editables; no hay nada más que configurar.
4. **Dominio** (opcional). En Cloudflare Pages → Custom domains. Mientras tanto el sitio
   vive en `https://<nombre-del-proyecto>.pages.dev`. Al cambiar el dominio, actualizar
   también el campo `dominio` en *Datos del negocio* dentro del panel.

Cada vez que el dueño guarda algo en el panel, GitHub recibe el cambio y Cloudflare
reconstruye el sitio solo, en menos de un minuto.

---

## Antes de publicar

- [ ] **Ponerle nombre a cada asesor.** Los 14 números reales ya están cargados; en el
      panel aparecen como `[NOMBRE 01]`, `[NOMBRE 02]`… Hay que reemplazarlos por el
      nombre de cada persona antes de publicar, porque esos nombres salen en la página
      pública de asesores autorizados.
- [ ] Confirmar la regla de comisión en *Datos del negocio → Comisiones*. Viene
      configurada en "del primero que envió el enlace".
- [ ] Revisar que las 10 portadas de línea sean las que el dueño quiere. Se asignaron
      automáticamente con la foto del producto destacado de cada línea.

---

## Cómo funciona la atribución de asesores

Cada asesor tiene un código de dos dígitos y un enlace propio:

```
https://luzmagica.com/?a=07
```

Cuando un cliente abre ese enlace, el catálogo guarda el código en su navegador y
**todos** los botones de WhatsApp del sitio —el flotante, el de cada ficha, el del
configurador y el del pedido— escriben a ese asesor. Dura 90 días, configurable.

La regla por defecto es **"del primero"**: si el cliente luego abre el enlace de otro
asesor, el guardado no se reemplaza. Para cambiarla a "del último", basta elegirlo en el
panel.

El código viaja también dentro del mensaje de WhatsApp (`Ref A-07`), así que la
atribución queda probada en el chat aunque el cliente cambie de celular o borre los
datos del navegador.

Quien entra sin enlace cae en el reparto entre los asesores marcados como
*"Recibe clientes que llegan sin enlace"*.

Los enlaces y los códigos QR de cada asesor están en `/equipo`, una página que no sale
en el menú. La lista pública de números autorizados está en `/asesores`, con un
verificador para que el cliente confirme que quien lo contactó es del equipo.

---

## Estructura

```
.pages.yml              Campos que ve el dueño en el panel de edición
eleventy.config.js      Configuración del generador
wrangler.jsonc          Configuración de publicación en Cloudflare
src/
  _data/
    negocio.json        Nombre, dirección, horarios, políticas, colores, textos
    asesores.json       Los 15 números: nombre, WhatsApp, código, activo
    categorias.json     Las 10 líneas del catálogo
    productos.json      Los productos
    anio.js             Año del pie de página (automático)
  _includes/            Plantillas compartidas: base, cabecera, pie, tarjeta, listado
  assets/
    estilos.css         Colores de marca al principio del archivo
    catalogo.js         Asesores, horario, WhatsApp, filtros, comparador, pedido
  fotos/                Fotos subidas desde el panel
  index.njk             Inicio
  catalogo.njk          Todo el catálogo
  categoria.njk         Una página por línea
  producto.njk          Una página por producto
  disena.njk            Configurador "Diseña el tuyo"
  asesores.njk          Números autorizados y verificador
  equipo.njk            Enlaces y códigos QR (uso interno)
  pedido.njk            Pedido guardado
  404.njk               Enlace vencido
```

## Para trabajar en local

```bash
npm install
npm start          # servidor de pruebas en http://localhost:8080
npm run build      # genera el sitio en _site/
```

## Decisiones que conviene no cambiar

- **La dirección de un producto sale de su SKU**, no de su nombre. Así, renombrar,
  cambiar el precio, la foto o la línea no rompe los enlaces que ya circulan por
  WhatsApp. Cambiar el SKU sí los rompe.
- **La línea no va dentro de la dirección** del producto, para poder moverlo de línea sin
  romper nada.
- **Nada depende de un servidor.** Asesores, filtros, comparador y pedido corren en el
  navegador; el sitio son archivos estáticos. Por eso no consume cuota de Cloudflare
  Workers y el plan gratuito alcanza de sobra.
- **Los números de los asesores son públicos a propósito**, para que el cliente pueda
  verificar quién está autorizado a venderle.

## Lo que no incluye y por qué

- **Pasarela de pago.** El negocio es contra entrega.
- **Calculadora de domicilio.** Las tarifas por barrio no están definidas; el sitio dice
  que se confirma por WhatsApp antes de fabricar.
- **Configurador 3D y realidad aumentada.** Exigirían modelar los 115 muebles.
- **Reseñas.** Necesitan moderación y permiso de los clientes.
