# Pruebas del catálogo

72 pruebas que recorren el sitio como lo haría un visitante: entran con el
enlace de un asesor, arman un pedido, llenan el formulario, abren el visor de
fotos, filtran el catálogo y revisan que ninguna foto esté rota.

## Cómo correrlas

La primera vez, instala el navegador de pruebas:

```
npm i -D playwright
npx playwright install chromium
```

Después, cada vez:

```
npm run build
npm run probar
```

Al final imprime cuántas pasan y cuántas fallan. Si alguna falla, dice cuál y
por qué. El comando termina en error cuando hay fallas, así que sirve también
para frenar un despliegue automático.

## Qué cubren y qué no

**Sí cubren:** que las páginas carguen, que no haya enlaces ni fotos rotas, la
asignación de asesores y la regla de la comisión, que cada botón de WhatsApp
escriba al número correcto, el carrito, el formulario obligatorio campo por
campo, los filtros, la búsqueda, el visor de fotos, el sitio sin JavaScript, y
que en celular nada se desborde ni quede un botón más chico que el dedo.

**No cubren:** que WhatsApp abra de verdad en un teléfono, que el asesor reciba
el mensaje, que una foto se vea bonita, que un precio esté al día, ni que el
mapa lleve a la dirección correcta. Eso hay que probarlo a mano.

## Revisar la ortografía

Aparte de las 74 pruebas, hay un revisor de ortografía que lee todo el texto que ve
el visitante: los nombres y descripciones de los 115 productos, los datos del negocio,
las plantillas y los mensajes del JavaScript.

```
pip install spylls
python3 pruebas/ortografia.py
```

Usa el diccionario de español que está en `pruebas/dicc/`. Marca solo palabras que no
reconoce. Las propias del negocio —enchape, WPC, Carvalo, Solterón, gamuza— están en la
lista `PROPIAS` dentro del script: si entra un producto con una palabra nueva legítima,
agrégala ahí para que el revisor vuelva a dar cero.

Ojo: un diccionario encuentra palabras mal escritas, pero no tildes que cambian el
sentido ("esta" por "está") ni concordancias. Eso sigue necesitando ojo humano.

## Si una prueba falla

Que una prueba falle no siempre significa que el sitio esté roto: puede estar
mal medida. Antes de cambiar código, reproduce a mano lo que dice la prueba.
En la primera ronda, cinco de siete fallas eran de las pruebas, no del sitio.
