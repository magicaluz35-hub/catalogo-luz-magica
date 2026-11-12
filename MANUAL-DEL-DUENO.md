# Manual del catálogo — Luz Mágica

Esta guía es para quien administra el catálogo. No hay que saber programar.

Todo se hace desde **pagescms.org**, entrando con la cuenta de GitHub del negocio.
Cada vez que guardas algo, el catálogo se actualiza solo en menos de un minuto.

---

## Las cuatro secciones del panel

| Sección | Para qué sirve |
|---|---|
| **Productos** | Agregar, cambiar o quitar muebles |
| **Asesores** | Los nombres y números del equipo |
| **Líneas del catálogo** | Las 10 categorías |
| **Datos del negocio** | Dirección, horarios, políticas, colores, textos |

---

## Agregar un producto

1. Entra a **Productos** y presiona el botón para agregar uno nuevo.
2. Llena el nombre, el código SKU, el precio y la línea a la que pertenece.
3. Escribe la descripción: qué trae y qué lo hace especial. Si la dejas vacía sale un
   texto general, pero es mejor escribirla.
4. Sube las fotos. **La primera es la más importante**: es la que se ve en el catálogo y
   la que aparece cuando alguien comparte el enlace por WhatsApp.
5. Marca las casillas que apliquen: *tiene luz LED*, *favoritos de la casa*,
   *recién llegados*.
6. Guarda.

### Sobre el código SKU

El SKU forma la dirección del producto en internet. El mueble `LM-105` vive en
`catalogo-luz-magica.luzmagica.workers.dev/producto/lm-105`.

Puedes cambiar el nombre, el precio, la descripción, las fotos y hasta la línea: el
enlace sigue funcionando. **Lo único que no se puede cambiar es el SKU.** Si lo cambias,
todos los enlaces que los asesores ya mandaron por WhatsApp dejan de abrir ese producto.

Si de verdad necesitas corregir un SKU, hazlo antes de que alguien lo comparta.

**Cómo numerar el próximo mueble**

1. Las letras `LM` no cambian nunca.
2. El número sigue al más alto que ya exista, más uno. Hoy el más alto es **LM-149**,
   así que el próximo es **LM-150**. Para verlo, entra a *Productos* y ordena por la
   columna del código: el último de la lista es el más alto.
3. Siempre tres cifras: `LM-150`, no `LM-15` ni `LM-0150`.
4. Hay 37 números sin usar entre el 5 y el 149, de muebles del catálogo viejo que no
   pasaron. **No los rellenes**: sigue contando hacia adelante.

**Cuando un mismo mueble tiene dos precios** según el enchape, van dos fichas con el
mismo número y una letra al final: la `A` es la versión más económica y la `B` la más
costosa. Así están las 7 parejas que ya existen — por ejemplo `LM-034A` ($1.200.000,
enchape plata) y `LM-034B` ($1.300.000, gris humo u oro rosa). Un mueble con un solo
precio no lleva letra.

**Nunca repitas un código** ni reutilices el de un mueble descontinuado: quien tenga el
enlace viejo cae en el mueble equivocado.

---

## Las fotos

- **Todas en vertical** y con el mismo encuadre. Es lo que más cambia la impresión del
  catálogo: fotos parejas se ven como una marca, fotos revueltas se ven improvisadas.
- Fondo limpio y buena luz. Si es un mueble con LED, que se vea encendido.
- Primero la foto del mueble solo; después, si hay, una en el showroom.
- No hace falta reducirlas: el panel las procesa.

---

## Agregar o quitar un asesor

En **Asesores** cada persona tiene cuatro datos:

- **Nombre** — como lo ve el cliente.
- **WhatsApp** — con indicativo y solo números: `573001234567`. Sin el signo `+` y sin
  espacios.
- **Código** — dos dígitos. Es lo que arma su enlace personal.
- **Activo** — la casilla que lo prende y lo apaga.

**Cuando alguien entra al equipo:** agrégalo, ponle un código que no esté usado, marca
*Activo* y pásale su enlace. Lo encuentra solo en `luzmagica.com/equipo`, junto con su
código QR.

**Cuando alguien se va:** desmarca *Activo*. Desaparece de la lista pública, deja de
recibir clientes nuevos y su enlace deja de asignarle a nadie. No lo borres: así queda
el registro de las comisiones viejas.

**No cambies el código** de alguien que ya repartió su enlace: perdería los clientes que
tenía asignados.

---

## Cómo funcionan las comisiones

Cada asesor tiene un enlace propio, por ejemplo `luzmagica.com/?a=07`. Cuando un cliente
lo abre, el catálogo lo recuerda durante 90 días y **todos** los botones de WhatsApp le
escriben a ese asesor.

Si el cliente después abre el enlace de otra persona, **la comisión se queda con el
primero**. Eso está configurado en *Datos del negocio → Comisiones* y se puede cambiar a
"del último" si alguna vez lo prefieres.

Además, el código viaja dentro del mensaje de WhatsApp (`Ref A-07`), así que si hay una
discusión, la prueba está en el chat.

---

## Cambiar precios, horarios o políticas

- **Precios:** en cada producto.
- **Horarios, dirección, teléfono, formas de pago, texto de domicilios:** en
  *Datos del negocio*. El letrero de "Abierto / Cerrado" del catálogo se calcula solo con
  los horarios que pongas ahí.
- **Colores y enchapes disponibles:** también en *Datos del negocio*. Lo que pongas ahí
  aparece en todas las fichas y en "Diseña el tuyo".

---

## Si algo sale mal

**Guardé un cambio y el catálogo sigue igual.**
Espera un minuto y recarga la página. El sitio se reconstruye después de cada cambio.

**Sigue igual después de varios minutos.**
Puede que se haya agotado el límite mensual de reconstrucciones (500 al mes, que son unas
16 por día). Entra a Cloudflare → Workers & Pages → el proyecto → Deployments y mira si
el último falló.

**El panel no me deja entrar.**
Revisa que estés usando la cuenta de GitHub del negocio.

**Un cliente dice que un enlace no abre.**
Es normal si el producto se retiró o si le cambiaron el SKU. El cliente no ve un error
feo: le sale una página que lo manda al catálogo y a WhatsApp.

**Alguien está vendiendo con un número que no es del equipo.**
Mándale al cliente `luzmagica.com/asesores`: ahí puede verificar cualquier número.

---

## Lo que nunca hay que cambiar

1. El **SKU** de un producto que ya se publicó.
2. El **código** de un asesor que ya repartió su enlace.
3. El **identificador web** de una línea del catálogo.

Todo lo demás se puede cambiar cuantas veces quieras.
