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
5. Elige la **iluminación**: *sin luz*, *luz LED*, *ojos de buey* o las dos. Los ojos
   de buey son los bombillos redondos alrededor del espejo, estilo camerino, y el
   cliente los busca aparte de la cinta LED: de esto depende en qué filtro del
   catálogo aparece el mueble.
6. Marca las casillas que apliquen: *favoritos de la casa*, *recién llegados*.
7. Guarda.

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

**La posición de un mueble es el número de su código, por diez.** LM-005 va en la
posición 50, LM-149 en la 1490. Así el catálogo web queda en el mismo orden del PDF
impreso, que es de donde salen los códigos: el número del código es el número de la
página. Si agregas el LM-150, su posición es 1500 y queda de último en su línea.

Puedes adelantar un mueble poniéndole un número menor — entre la posición 50 y la 60
caben nueve sin tocar los demás. Eso se sale del orden del PDF a propósito, y está bien
mientras sea una decisión tuya.

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
- **Plazos de entrega:** solo se escriben **números**, nunca frases. Las frases que
  lee el cliente las arma el catálogo solo, y por eso siempre están escritas igual.
  - El **plazo normal del taller** está en *Datos del negocio*, en dos campos:
    *desde* y *hasta* (hoy, 10 y 15). Vale para todos los muebles que no tengan
    plazo propio.
  - Un **mueble que tarde distinto** lleva sus dos números en *Productos → Días de
    entrega, desde y hasta*. Si son de 15 a 20 días, va 15 y 20. Si el plazo es solo
    un tope —hasta 25 días—, deja *desde* vacío y pon 25 en *hasta*. Hoy hay 21
    muebles así: 11 de 15 a 20 días y 10 de hasta 25.
  - **Las tarjetas del catálogo no dicen días a propósito.** La tarjeta es idéntica
    para los 115 muebles, así que cualquier cifra ahí sería mentira en uno de cada
    cinco. Dicen solo *Hecho a pedido*.
  - **Lo demás se calcula solo.** La nota de arriba de las tarjetas, la línea de la
    página del pedido y la cifra grande de la portada salen del mueble más lento que
    haya cargado. Si mañana entra uno de 30 días, los tres se corrigen solos. No hay
    nada que acordarse de cambiar.
- **Horarios, dirección, teléfono, formas de pago, texto de domicilios:** en
  *Datos del negocio*. El letrero de "Abierto / Cerrado" del catálogo se calcula solo con
  los horarios que pongas ahí.
- **Los colores ya no se muestran en la página.** Antes había una paleta con los seis
  colores, y se quitó: con algunos colores y enchapes **cambia el precio**, así que una
  paleta fija prometía un precio que el taller no siempre puede sostener. Ahora quien
  dice qué hay disponible y cuánto vale es la asesora, y la página se lo advierte al
  cliente en cada ficha. Ese texto se cambia en *Datos del negocio → Aviso sobre los
  colores*; si lo dejas vacío, el aviso desaparece.
- **Los enchapes tampoco se eligen en la página**, por la misma razón: el gris humo
  cuesta más que el plata, y la ficha los ofrecía todos al mismo precio. Además 42
  muebles ya dicen *con enchape* en su propio nombre y 29 dicen *sin enchape*, así que
  el selector se contradecía con el producto. El mismo aviso cubre las dos cosas.
- **La foto grande de la portada:** son **dos** fotos de la misma escena, en
  *Datos del negocio*. La *foto principal* es la vertical y se usa en celular;
  la *foto principal para computador* es la horizontal. Cada visitante descarga
  solo la que le toca. Dos cosas al cambiarlas: que el letrero de Luz Mágica
  quede **pegado al borde de arriba** (el recorte siempre respeta esa esquina)
  y que la mitad izquierda quede despejada, porque ahí va el texto. Si borras
  la horizontal, en computador se usa la vertical.

---

## La presentación de marca

Es el logo de Luz Mágica que se enciende a pantalla completa cuando alguien
entra al inicio: aparece apagado, titila como un neón que arranca, se queda
prendido alumbrando el cuarto, y el telón sube para mostrar la página.

Cómo se porta:

- **Dura tres segundos** y se puede saltar tocando la pantalla.
- **Solo sale en el inicio.** Cuando un asesor manda el enlace de un mueble
  puntual, el cliente entra derecho a ese mueble: ahí viene a ver *ese*
  tocador y un telón de tres segundos estorba justo en el momento de más
  ganas. El inicio sí es una entrada, y ahí la presentación tiene sentido.
- **No se repite mientras la persona recorre el catálogo.** Si entra, mira
  tocadores, abre un espejo y vuelve al inicio, no la vuelve a ver.
- **Sí vuelve a salir si abre el inicio en una pestaña nueva**, porque esa es
  una entrada nueva. Es también la manera más fácil de volver a verla cuando
  quieras mostrarla a alguien: abre el inicio en otra pestaña.
- **No le sale a todo el mundo.** A quien tiene activada la opción de "reducir
  animaciones" en su teléfono —la usa mucha gente que se marea con el
  movimiento— se le entra directo al catálogo.
- **Usa el archivo del logo**, en *Datos del negocio → Logo de la presentación*.
  Son 55 KB y el catálogo lo pide antes que todo lo demás, así que ya está
  cargado cuando la pantalla aparece.
- **Si cambias ese logo, cambia también el color del fondo.** El negro del
  archivo se funde con el fondo de la pantalla, y por eso el letrero se ve
  flotando en la luz en vez de pegado sobre un recuadro. Los dos campos están
  juntos en *Datos del negocio*: si subes un logo con fondo de otro color, hay
  que poner ese mismo color en *Color del fondo de la presentación*. La versión
  del logo que va aquí es la acostada y con fondo negro, no la cuadrada.

Para apagarla: *Datos del negocio* → desmarca **Presentación de marca al
entrar**. El visitante pasa derecho al catálogo y nada más cambia.

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
