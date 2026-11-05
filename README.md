# Catálogo Luz Mágica

Sitio estático: `index.html` (diseño), `datos.json` (todo el contenido), `img/` (fotos) y `.pages.yml` (configuración del panel de edición).
El diseño nunca se edita: todo lo que cambia el dueño está en `datos.json`, y se edita con el panel.

## Publicar (una sola vez)
1. Crear cuenta en github.com y un repositorio **privado** llamado `catalogo-luz-magica`. Subir todos los archivos de esta carpeta (botón "Add file" > "Upload files"; arrastrar la carpeta `img` incluida).
2. Crear cuenta en cloudflare.com > "Workers & Pages" > "Create" > "Pages" > "Connect to Git". Elegir el repositorio. Dejar el comando de build vacío y el directorio de salida en `/`. Pulsar "Save and Deploy". Cloudflare da un enlace tipo `catalogo-luz-magica.pages.dev`.
3. Entrar a app.pagescms.org con la cuenta de GitHub, instalar la app en ese repositorio y abrirlo.

## Editar (el día a día)
Entrar a app.pagescms.org, abrir "Catálogo Luz Mágica", cambiar lo que se necesite y pulsar Guardar. Cloudflare publica el cambio solo en 1 o 2 minutos. Las fotos nuevas se suben desde el mismo panel.
