/* Luz Mágica — lógica del catálogo
   Todo corre en el navegador del cliente. No hay servidor ni base de datos.

   Hace cinco cosas:
   1. Atribución de asesor por enlace (?a=07) — la comisión es del primero.
   2. Estado del horario en vivo.
   3. Armado de los mensajes de WhatsApp.
   4. Filtros, orden y comparador del listado.
   5. Pedido guardado, verificador de números y códigos QR del equipo.
*/
(function () {
  "use strict";

  // ---------- Datos que la página deja escritos ----------
  function leerJSON(id, porDefecto) {
    var nodo = document.getElementById(id);
    if (!nodo) return porDefecto;
    try { return JSON.parse(nodo.textContent); } catch (e) { return porDefecto; }
  }

  var ASESORES = leerJSON("datos-asesores", []);
  var NEGOCIO = leerJSON("datos-negocio", {});
  var LLAVE_ASESOR = "lm_asesor";
  var LLAVE_PEDIDO = "lm_pedido";

  // ---------- Guardado seguro (puede fallar en modo privado) ----------
  function guardar(llave, valor) {
    try { localStorage.setItem(llave, JSON.stringify(valor)); } catch (e) { /* sin guardado */ }
  }
  function recuperar(llave) {
    try {
      var crudo = localStorage.getItem(llave);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) { return null; }
  }

  // ---------- 1. Atribución de asesor ----------
  var DIAS = (NEGOCIO.dias || 90) * 24 * 60 * 60 * 1000;

  function buscarAsesor(codigo) {
    for (var i = 0; i < ASESORES.length; i++) {
      if (String(ASESORES[i].codigo) === String(codigo)) return ASESORES[i];
    }
    return null;
  }

  function asesorPorDefecto() {
    var activos = ASESORES.filter(function (a) { return a.activo !== false && a.enRotacion && a.whatsapp; });
    if (!activos.length) return buscarAsesor("00") || ASESORES[0] || null;
    // Reparto parejo: al mismo visitante siempre le toca el mismo.
    var i = Math.floor(Math.random() * activos.length);
    return activos[i];
  }

  function resolverAsesor() {
    var guardado = recuperar(LLAVE_ASESOR);
    var vigente = guardado && guardado.codigo && (Date.now() - (guardado.desde || 0) < DIAS);

    var params = new URLSearchParams(window.location.search);
    var delEnlace = params.get("a");
    var nuevo = delEnlace ? buscarAsesor(delEnlace) : null;

    // Regla "primero": la comisión queda con el PRIMER VENDEDOR QUE ENVIÓ SU ENLACE.
    // Solo una asignación que vino de un enlace bloquea a las siguientes.
    // Un reparto automático de la casa no es nadie enviando un enlace, así que
    // se deja reemplazar en cuanto llega un enlace de verdad.
    if (vigente && guardado.origen === "enlace") {
      var previo = buscarAsesor(guardado.codigo);
      if (previo) {
        // Si vuelve con el enlace del mismo asesor, se renuevan los días de vigencia.
        if (nuevo && nuevo.codigo === previo.codigo) {
          guardar(LLAVE_ASESOR, { codigo: previo.codigo, desde: Date.now(), origen: "enlace" });
        }
        return { asesor: previo, origen: "enlace" };
      }
    }

    if (nuevo) {
      guardar(LLAVE_ASESOR, { codigo: nuevo.codigo, desde: Date.now(), origen: "enlace" });
      return { asesor: nuevo, origen: "enlace" };
    }

    // Sin enlace, pero ya había un reparto vigente: se respeta, para que el mismo
    // visitante no caiga con un asesor distinto en cada visita.
    if (vigente) {
      var repartoPrevio = buscarAsesor(guardado.codigo);
      if (repartoPrevio) return { asesor: repartoPrevio, origen: "reparto" };
    }

    var reparto = asesorPorDefecto();
    if (reparto) {
      guardar(LLAVE_ASESOR, { codigo: reparto.codigo, desde: Date.now(), origen: "reparto" });
    }
    return { asesor: reparto, origen: "reparto" };
  }

  var ASIGNADO = resolverAsesor();
  var ASESOR = ASIGNADO.asesor || { codigo: "00", nombre: "Luz Mágica", whatsapp: NEGOCIO.whatsapp };
  var NUMERO = ASESOR.whatsapp || NEGOCIO.whatsapp || "";
  var REF = "Ref A-" + ASESOR.codigo;

  function pintarAsesor() {
    document.querySelectorAll("[data-asesor-nombre]").forEach(function (n) { n.textContent = ASESOR.nombre; });
    document.querySelectorAll("[data-asesor-codigo]").forEach(function (n) { n.textContent = ASESOR.codigo; });
    var origen = document.querySelector("[data-asesor-origen]");
    if (origen) {
      origen.textContent = ASIGNADO.origen === "enlace"
        ? "Llegaste con el enlace de " + ASESOR.nombre + ", así que te acompaña durante toda la visita."
        : "Entraste sin un enlace de asesor, así que te asignamos uno del equipo.";
    }
  }

  // ---------- 2. Estado del horario ----------
  var DIAS_SEMANA = ["Domingos", "Lunes a viernes", "Lunes a viernes", "Lunes a viernes", "Lunes a viernes", "Lunes a viernes", "Sábados"];

  function franjaDeHoy() {
    var etiqueta = DIAS_SEMANA[new Date().getDay()];
    var horario = NEGOCIO.horario || [];
    for (var i = 0; i < horario.length; i++) {
      if (horario[i].dias === etiqueta) return horario[i];
    }
    return null;
  }

  function enMinutos(hhmm) {
    var partes = String(hhmm || "").split(":");
    return Number(partes[0]) * 60 + Number(partes[1] || 0);
  }

  function pintarHorario() {
    var caja = document.querySelector("[data-estado-horario]");
    var texto = document.querySelector("[data-estado-texto]");
    if (!caja || !texto) return;

    var hoy = franjaDeHoy();
    var ahora = new Date();
    var minutos = ahora.getHours() * 60 + ahora.getMinutes();
    var abierto = false;

    if (hoy && hoy.desde && hoy.hasta) {
      abierto = minutos >= enMinutos(hoy.desde) && minutos < enMinutos(hoy.hasta);
    }

    if (abierto) {
      texto.textContent = "Abierto ahora · te responden enseguida";
      caja.classList.remove("estado--cerrado");
    } else {
      caja.classList.add("estado--cerrado");
      if (hoy && hoy.nota) {
        texto.textContent = "Hoy: " + hoy.nota.toLowerCase();
      } else {
        texto.textContent = "Cerrado ahora · escríbenos y te responden al abrir";
      }
    }
  }

  // ---------- 3. Mensajes de WhatsApp ----------
  function enlaceWA(texto) {
    return "https://wa.me/" + NUMERO + "?text=" + encodeURIComponent(texto);
  }

  function urlDe(ruta) {
    return window.location.origin + ruta + "?a=" + ASESOR.codigo;
  }

  function opcionesDe(formulario) {
    var datos = {};
    if (!formulario) return datos;
    formulario.querySelectorAll("input[type=radio]:checked").forEach(function (i) {
      datos[i.name] = i.value;
    });
    return datos;
  }

  function textoFicha(boton) {
    var form = document.querySelector("[data-opciones]");
    var o = opcionesDe(form);
    var lineas = ["¡Hola Luz Mágica! Me interesa:"];
    lineas.push(boton.dataset.nombre + " · " + boton.dataset.precio);
    if (o.color) lineas.push("· Color: " + o.color);
    if (o.enchape) lineas.push("· Enchape: " + o.enchape);
    lineas.push(urlDe("/producto/" + String(boton.dataset.sku).toLowerCase() + "/") + " · " + REF);
    return lineas.join("\n");
  }

  // Lee el formulario de datos del cliente. Nada de esto sale del navegador:
  // se arma dentro del mensaje y se va derecho al WhatsApp del asesor.
  function datosCliente() {
    var form = document.querySelector("[data-datos-cliente]");
    if (!form) return null;
    var d = {};
    form.querySelectorAll("input, textarea, select").forEach(function (campo) {
      if (campo.type === "checkbox") d[campo.name] = campo.checked;
      else d[campo.name] = (campo.value || "").trim();
    });
    return d;
  }

  function textoPedido() {
    var pedido = recuperar(LLAVE_PEDIDO) || [];
    var d = datosCliente();
    var lineas = ["PEDIDO · Luz Mágica", ""];

    if (d && (d.nombre || d.telefono || d.direccion)) {
      lineas.push("CLIENTE");
      if (d.nombre) lineas.push("Nombre: " + d.nombre);
      if (d.telefono) lineas.push("WhatsApp: " + d.telefono);
      var donde = [];
      if (d.ciudad) donde.push(d.ciudad);
      if (d.barrio) donde.push("Barrio " + d.barrio);
      if (donde.length) lineas.push(donde.join(" · "));
      if (d.direccion) lineas.push("Dirección: " + d.direccion);
      var piso = [];
      if (d.piso) piso.push("Piso " + d.piso);
      if (d.ascensor) piso.push("con ascensor");
      else if (d.piso) piso.push("sin ascensor");
      if (piso.length) lineas.push(piso.join(", "));
      if (d.indicaciones) lineas.push("Indicaciones: " + d.indicaciones);
      lineas.push("");
    }

    lineas.push("PRODUCTOS");
    var total = 0;
    pedido.forEach(function (p, i) {
      var cantidad = Number(p.cantidad) || 1;
      var subtotal = (Number(p.precio) || 0) * cantidad;
      total += subtotal;
      lineas.push((i + 1) + ". " + p.nombre + " (" + p.sku + ")");
      var variante = [];
      if (p.color) variante.push("Color: " + p.color);
      if (p.enchape && p.enchape !== "Sin enchape") variante.push("Enchape: " + p.enchape);
      else if (p.enchape) variante.push("Sin enchape");
      if (variante.length) lineas.push("   " + variante.join(" · "));
      lineas.push("   " + (cantidad > 1 ? cantidad + " × " + pesos(p.precio) + " = " : "") + pesos(subtotal));
    });

    lineas.push("");
    lineas.push("Total productos: " + pesos(total));
    lineas.push("Domicilio: por confirmar según barrio y piso");

    if (d && d.observaciones) {
      lineas.push("");
      lineas.push("Observaciones: " + d.observaciones);
    }

    lineas.push("");
    lineas.push(urlDe("/pedido/") + " · " + REF);
    return lineas.join("\n");
  }

  function actualizarEnlacesWA() {
    document.querySelectorAll("[data-wa]").forEach(function (a) {
      var texto;
      if (a.hasAttribute("data-wa-ficha")) texto = textoFicha(a);
      else if (a.hasAttribute("data-wa-pedido")) texto = textoPedido();
      else texto = (a.dataset.waTexto || "¡Hola Luz Mágica!") + "\n" + REF;
      a.setAttribute("href", enlaceWA(texto));
    });

    var previo = document.querySelector("[data-wa-previo]");
    var botonFicha = document.querySelector("[data-wa-ficha]");
    if (previo) {
      previo.textContent = botonFicha ? textoFicha(botonFicha) : "";
    }

    var previoPedido = document.querySelector("[data-wa-previo-pedido]");
    if (previoPedido) previoPedido.textContent = textoPedido();

    var elegido = document.querySelector("[data-elegido-color]");
    var form = document.querySelector("[data-opciones]");
    if (elegido && form) {
      var o = opcionesDe(form);
      if (o.color) elegido.textContent = o.color;
    }
  }

  function pesos(v) {
    var n = Number(v) || 0;
    return "$ " + n.toLocaleString("es-CO");
  }

  // ---------- 4. Listado: filtros, orden y comparador ----------
  function iniciarListado() {
    var rejilla = document.querySelector("[data-rejilla]");
    if (!rejilla) return;

    var tarjetas = Array.prototype.slice.call(rejilla.querySelectorAll("[data-producto]"));
    var estado = { precio: "todos", led: "todos", orden: "destacados", q: "" };
    var comparar = [];

    var params = new URLSearchParams(window.location.search);
    if (params.get("precio")) estado.precio = params.get("precio");
    if (params.get("q")) estado.q = params.get("q").toLowerCase();

    function enRango(v) {
      if (estado.precio === "bajo") return v <= 500000;
      if (estado.precio === "medio") return v > 500000 && v <= 1000000;
      if (estado.precio === "alto") return v > 1000000;
      return true;
    }

    function normalizar(t) {
      return String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    }

    function aplicar() {
      var visibles = 0;
      tarjetas.forEach(function (t) {
        var precio = Number(t.dataset.precio) || 0;
        var led = t.dataset.led;
        var nombre = normalizar(t.dataset.nombre + " " + t.dataset.sku);
        var pasa = enRango(precio)
          && (estado.led === "todos" || led === estado.led)
          && (!estado.q || nombre.indexOf(normalizar(estado.q)) !== -1);
        t.hidden = !pasa;
        if (pasa) visibles++;
      });

      if (estado.orden !== "destacados") {
        var orden = tarjetas.slice().sort(function (a, b) {
          var pa = Number(a.dataset.precio) || 0, pb = Number(b.dataset.precio) || 0;
          return estado.orden === "menor" ? pa - pb : pb - pa;
        });
        orden.forEach(function (t) { rejilla.appendChild(t); });
      }

      var contador = document.querySelector("[data-contador]");
      var palabra = document.querySelector("[data-contador-palabra]");
      if (contador) contador.textContent = visibles;
      if (palabra) palabra.textContent = visibles === 1 ? "producto" : "productos";

      var vacio = document.querySelector("[data-vacio]");
      if (vacio) vacio.hidden = visibles !== 0;
      rejilla.hidden = visibles === 0;
    }

    document.querySelectorAll("[data-filtro]").forEach(function (b) {
      b.addEventListener("click", function () {
        var campo = b.dataset.filtro;
        estado[campo] = b.dataset.valor;
        document.querySelectorAll('[data-filtro="' + campo + '"]').forEach(function (otro) {
          otro.classList.remove("opcion--activa", "ficha--activa");
          otro.classList.add(otro.classList.contains("opcion") ? "opcion" : "ficha");
        });
        b.classList.add(b.classList.contains("opcion") ? "opcion--activa" : "ficha--activa");
        aplicar();
      });
    });

    document.querySelectorAll("[data-orden]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.orden = b.dataset.orden;
        document.querySelectorAll("[data-orden]").forEach(function (o) { o.classList.remove("ficha--activa"); });
        b.classList.add("ficha--activa");
        aplicar();
      });
    });

    document.querySelectorAll("[data-limpiar]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.precio = "todos"; estado.led = "todos"; estado.q = "";
        document.querySelectorAll("[data-filtro]").forEach(function (o) {
          o.classList.remove("opcion--activa", "ficha--activa");
          if (o.dataset.valor === "todos") o.classList.add(o.classList.contains("opcion") ? "opcion--activa" : "ficha--activa");
        });
        aplicar();
      });
    });

    // Comparador
    var barra = document.querySelector("[data-barra-comparar]");
    var textoBarra = document.querySelector("[data-comparar-texto]");
    var caja = document.querySelector("[data-comparador]");
    var tabla = document.querySelector("[data-comparador-tabla]");

    function pintarBarra() {
      if (!barra) return;
      barra.hidden = comparar.length === 0;
      if (textoBarra) {
        textoBarra.textContent = comparar.length === 1
          ? "Elegiste 1 mueble. Marca otro para compararlos lado a lado."
          : "Dos muebles listos para comparar.";
      }
      tarjetas.forEach(function (t) {
        var boton = t.querySelector("[data-comparar]");
        if (!boton) return;
        var activo = comparar.indexOf(t.dataset.sku) !== -1;
        boton.textContent = activo ? "Quitar de la comparación" : "Comparar";
        boton.classList.toggle("boton--activo", activo);
      });
    }

    document.querySelectorAll("[data-comparar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sku = b.dataset.comparar;
        var i = comparar.indexOf(sku);
        if (i !== -1) comparar.splice(i, 1);
        else if (comparar.length < 2) comparar.push(sku);
        else comparar = [comparar[1], sku];
        if (caja) caja.hidden = true;
        pintarBarra();
      });
    });

    var limpiarCmp = document.querySelector("[data-comparar-limpiar]");
    if (limpiarCmp) limpiarCmp.addEventListener("click", function () {
      comparar = [];
      if (caja) caja.hidden = true;
      pintarBarra();
    });

    var abrirCmp = document.querySelector("[data-comparar-abrir]");
    if (abrirCmp) abrirCmp.addEventListener("click", function () {
      if (comparar.length < 2 || !tabla || !caja) return;
      var elegidos = comparar.map(function (sku) {
        return tarjetas.filter(function (t) { return t.dataset.sku === sku; })[0];
      });
      var filas = [
        ["Precio", function (t) { return pesos(t.dataset.precio); }],
        ["Luz LED", function (t) { return t.dataset.led === "si" ? "Sí" : "No"; }],
        ["Línea", function (t) { return t.dataset.categoria; }],
        ["Entrega", function () { return "10 a 15 días hábiles"; }]
      ];
      var html = '<table class="tabla"><thead><tr><th scope="col">Comparación</th>';
      elegidos.forEach(function (t) { html += "<th scope=\"col\">" + t.dataset.nombre + "</th>"; });
      html += "</tr></thead><tbody>";
      filas.forEach(function (f) {
        html += '<tr><th scope="row">' + f[0] + "</th>";
        elegidos.forEach(function (t) { html += "<td>" + f[1](t) + "</td>"; });
        html += "</tr>";
      });
      html += "</tbody></table>";
      tabla.innerHTML = html;
      caja.hidden = false;
      caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    aplicar();
    pintarBarra();
  }

  // ---------- 5a. Pedido guardado ----------
  function pintarContadorPedido() {
    var pedido = recuperar(LLAVE_PEDIDO) || [];
    var piezas = pedido.reduce(function (s, p) { return s + (Number(p.cantidad) || 1); }, 0);
    document.querySelectorAll("[data-pedido-contador]").forEach(function (n) {
      n.textContent = piezas;
      n.hidden = piezas === 0;
    });
  }

  function escapar(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Un renglón del pedido se identifica por producto + color + enchape:
  // el mismo tocador en blanco y en rosado son dos renglones distintos.
  function claveRenglon(p) {
    return [p.sku, p.color || "", p.enchape || ""].join("|");
  }

  function iniciarAgregar() {
    document.querySelectorAll("[data-agregar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var o = opcionesDe(document.querySelector("[data-opciones]"));
        var nuevo = {
          sku: b.dataset.sku,
          nombre: b.dataset.nombre,
          precio: Number(b.dataset.precio),
          color: o.color || "",
          enchape: o.enchape || "",
          foto: b.dataset.foto || "",
          cantidad: 1
        };
        var pedido = recuperar(LLAVE_PEDIDO) || [];
        var yaEsta = pedido.filter(function (p) { return claveRenglon(p) === claveRenglon(nuevo); })[0];
        if (yaEsta) yaEsta.cantidad = (Number(yaEsta.cantidad) || 1) + 1;
        else pedido.push(nuevo);
        guardar(LLAVE_PEDIDO, pedido);

        var original = b.textContent;
        b.textContent = "Añadido al pedido";
        setTimeout(function () { b.textContent = original; }, 1800);
        pintarContadorPedido();
        actualizarEnlacesWA();
      });
    });
  }

  function iniciarPedido() {
    iniciarAgregar();

    var lista = document.querySelector("[data-pedido-lista]");
    if (!lista) return;

    var vacio = document.querySelector("[data-pedido-vacio]");
    var pie = document.querySelector("[data-pedido-pie]");
    var totalNodo = document.querySelector("[data-pedido-total]");

    function pintar() {
      var pedido = recuperar(LLAVE_PEDIDO) || [];
      if (vacio) vacio.hidden = pedido.length > 0;
      if (pie) pie.hidden = pedido.length === 0;
      lista.innerHTML = "";

      var total = 0;
      pedido.forEach(function (p, i) {
        var cantidad = Number(p.cantidad) || 1;
        var subtotal = (Number(p.precio) || 0) * cantidad;
        total += subtotal;

        var variante = [];
        if (p.color) variante.push(escapar(p.color));
        if (p.enchape) variante.push(escapar(p.enchape));

        var foto = p.foto
          ? '<img src="' + escapar(p.foto) + '" alt="" width="72" height="90" loading="lazy">'
          : '<span class="pedido__sinfoto" aria-hidden="true"></span>';

        var fila = document.createElement("article");
        fila.className = "pedido__linea";
        fila.innerHTML =
          '<div class="pedido__foto">' + foto + "</div>" +
          '<div class="pedido__datos">' +
            '<p class="tarjeta__sku">' + escapar(p.sku) + "</p>" +
            "<h2>" + escapar(p.nombre) + "</h2>" +
            (variante.length ? '<p class="pedido__variante">' + variante.join(" · ") + "</p>" : "") +
          "</div>" +
          '<div class="pedido__cantidad">' +
            '<button type="button" class="pedido__paso" data-menos="' + i + '" aria-label="Quitar uno">−</button>' +
            '<span class="pedido__num" aria-label="Cantidad">' + cantidad + "</span>" +
            '<button type="button" class="pedido__paso" data-mas="' + i + '" aria-label="Agregar uno">+</button>' +
          "</div>" +
          '<div class="pedido__precio">' +
            "<p>" + pesos(subtotal) + "</p>" +
            '<button type="button" class="enlace-boton" data-quitar="' + i + '">Quitar</button>' +
          "</div>";
        lista.appendChild(fila);
      });

      if (totalNodo) totalNodo.textContent = pesos(total);
      pintarContadorPedido();
      actualizarEnlacesWA();
    }

    lista.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      var pedido = recuperar(LLAVE_PEDIDO) || [];
      var i;

      if (b.dataset.quitar !== undefined) {
        pedido.splice(Number(b.dataset.quitar), 1);
      } else if (b.dataset.mas !== undefined) {
        i = Number(b.dataset.mas);
        pedido[i].cantidad = (Number(pedido[i].cantidad) || 1) + 1;
      } else if (b.dataset.menos !== undefined) {
        i = Number(b.dataset.menos);
        pedido[i].cantidad = (Number(pedido[i].cantidad) || 1) - 1;
        if (pedido[i].cantidad < 1) pedido.splice(i, 1);
      } else {
        return;
      }

      guardar(LLAVE_PEDIDO, pedido);
      pintar();
    });

    // Cada cambio en el formulario rearma el mensaje de WhatsApp
    var form = document.querySelector("[data-datos-cliente]");
    if (form) {
      form.addEventListener("input", actualizarEnlacesWA);
      form.addEventListener("change", actualizarEnlacesWA);
    }

    iniciarValidacion();
    pintar();
  }

  // ---------- 5a-bis. El pedido no sale sin los datos del cliente ----------
  // Qué se exige en cada campo. El orden manda: es el orden del formulario,
  // y el primero que falle es al que saltamos.
  var REGLAS = [
    { campo: "nombre", vacio: "Escribe tu nombre completo.",
      prueba: function (v) { return v.trim().length >= 3; },
      malo: "Escribe tu nombre completo, no solo una letra." },
    { campo: "telefono", vacio: "Necesitamos tu WhatsApp para responderte.",
      prueba: function (v) { return v.replace(/\D/g, "").length >= 7; },
      malo: "Ese número está incompleto. Escríbelo con el indicativo." },
    { campo: "ciudad", vacio: "Dinos en qué ciudad estás." },
    { campo: "barrio", vacio: "El barrio define el valor del domicilio." },
    { campo: "direccion", vacio: "Escribe la dirección donde entregamos.",
      prueba: function (v) { return v.trim().length >= 6; },
      malo: "Esa dirección se ve incompleta." },
    { campo: "piso", vacio: "El piso también define el domicilio. Si es casa, escribe 1." }
  ];

  function iniciarValidacion() {
    var form = document.querySelector("[data-datos-cliente]");
    var boton = document.querySelector("[data-wa-pedido]");
    if (!form || !boton) return;
    var resumen = document.querySelector("[data-resumen-error]");

    function mostrarError(nombre, mensaje) {
      var campo = form.querySelector("[name='" + nombre + "']");
      var hueco = form.querySelector("[data-error-de='" + nombre + "']");
      if (campo) {
        campo.classList.toggle("campo--malo", !!mensaje);
        campo.setAttribute("aria-invalid", mensaje ? "true" : "false");
      }
      if (hueco) {
        hueco.textContent = mensaje || "";
        hueco.hidden = !mensaje;
      }
    }

    function revisar() {
      var malos = [];
      REGLAS.forEach(function (r) {
        var campo = form.querySelector("[name='" + r.campo + "']");
        if (!campo) return;
        var v = campo.value || "";
        var mensaje = "";
        if (!v.trim()) mensaje = r.vacio;
        else if (r.prueba && !r.prueba(v)) mensaje = r.malo;
        mostrarError(r.campo, mensaje);
        if (mensaje) malos.push({ campo: campo, mensaje: mensaje });
      });
      return malos;
    }

    // Mientras escribe, solo quitamos el error que ya corrigió. No sumamos
    // errores nuevos en campos que todavía no ha tocado.
    form.addEventListener("input", function (e) {
      var nombre = e.target.name;
      var regla = REGLAS.filter(function (r) { return r.campo === nombre; })[0];
      if (!regla || !e.target.classList.contains("campo--malo")) return;
      var v = e.target.value || "";
      if (v.trim() && (!regla.prueba || regla.prueba(v))) mostrarError(nombre, "");
    });

    boton.addEventListener("click", function (e) {
      var malos = revisar();
      if (!malos.length) {
        if (resumen) resumen.hidden = true;
        return; // deja pasar: el enlace abre WhatsApp
      }
      e.preventDefault();
      if (resumen) {
        resumen.textContent = malos.length === 1
          ? "Falta un dato para poder enviar el pedido."
          : "Faltan " + malos.length + " datos para poder enviar el pedido.";
        resumen.hidden = false;
      }
      malos[0].campo.focus();
      malos[0].campo.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // ---------- 5b. Compartir conservando el código ----------
  function iniciarCompartir() {
    document.querySelectorAll("[data-compartir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var enlace = urlDe("/producto/" + String(b.dataset.sku).toLowerCase() + "/");
        if (navigator.share) {
          navigator.share({ url: enlace }).catch(function () { copiar(enlace, b); });
        } else {
          copiar(enlace, b);
        }
      });
    });

    document.querySelectorAll("[data-copiar]").forEach(function (b) {
      b.addEventListener("click", function () {
        copiar(window.location.origin + b.dataset.copiar, b);
      });
    });

    document.querySelectorAll("[data-enlace-base]").forEach(function (n) {
      n.textContent = window.location.origin + n.dataset.enlaceBase;
    });
  }

  function copiar(texto, boton) {
    var original = boton.textContent;
    function listo() {
      boton.textContent = "Copiado";
      setTimeout(function () { boton.textContent = original; }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo, function () { boton.textContent = texto; });
    } else {
      boton.textContent = texto;
    }
  }

  // ---------- 5b-bis. Carrusel de líneas ----------
  function iniciarCarrusel() {
    var caja = document.querySelector("[data-carrusel]");
    if (!caja) return;
    var pista = caja.querySelector("[data-carrusel-pista]");
    var izq = caja.querySelector("[data-carrusel-izq]");
    var der = caja.querySelector("[data-carrusel-der]");
    if (!pista) return;

    function refrescar() {
      var sobra = pista.scrollWidth - pista.clientWidth;
      var hayIzq = pista.scrollLeft > 4;
      var hayDer = sobra > 4 && pista.scrollLeft < sobra - 4;
      caja.toggleAttribute("data-hay-izq", hayIzq);
      caja.toggleAttribute("data-hay-der", hayDer);
      if (izq) izq.hidden = !hayIzq;
      if (der) der.hidden = !hayDer;
    }

    function mover(signo) {
      pista.scrollBy({ left: signo * Math.round(pista.clientWidth * 0.8), behavior: "smooth" });
    }

    if (izq) izq.addEventListener("click", function () { mover(-1); });
    if (der) der.addEventListener("click", function () { mover(1); });
    pista.addEventListener("scroll", refrescar, { passive: true });
    window.addEventListener("resize", refrescar);

    // Deja a la vista la línea en la que está el visitante
    var activa = pista.querySelector(".ficha--activa");
    if (activa && activa.offsetLeft > pista.clientWidth * 0.6) {
      pista.scrollLeft = activa.offsetLeft - 20;
    }
    refrescar();
  }

  // ---------- 5c. Verificador de números ----------
  function iniciarVerificador() {
    var form = document.querySelector("[data-verificador]");
    if (!form) return;
    var salida = document.querySelector("[data-verificador-resultado]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var digitos = String(form.numero.value || "").replace(/\D/g, "");
      if (digitos.length < 7) {
        salida.hidden = false;
        salida.className = "resultado resultado--no";
        salida.innerHTML = '<span class="resultado__marca" aria-hidden="true">!</span><p><strong>Escribe el número completo</strong>Necesitamos al menos los siete dígitos para poder verificarlo.</p>';
        return;
      }

      var encontrado = null;
      ASESORES.forEach(function (a) {
        if (!a.whatsapp || a.activo === false) return;
        var suyo = String(a.whatsapp).replace(/\D/g, "");
        if (suyo.endsWith(digitos) || digitos.endsWith(suyo)) encontrado = a;
      });

      salida.hidden = false;
      if (encontrado) {
        salida.className = "resultado resultado--si";
        salida.innerHTML = '<span class="resultado__marca" aria-hidden="true">✓</span><p><strong>Número autorizado</strong>Pertenece a ' + encontrado.nombre + ". Puedes continuar la conversación con tranquilidad.</p>";
      } else {
        salida.className = "resultado resultado--no";
        salida.innerHTML = '<span class="resultado__marca" aria-hidden="true">!</span><p><strong>Ese número no es del equipo</strong>No aparece en la lista de asesores autorizados. No consignes ni compartas tus datos; escríbenos a la línea principal para confirmarlo.</p>';
      }
    });
  }

  // ---------- 5d. Códigos QR del equipo ----------
  function iniciarQR() {
    var cajas = document.querySelectorAll("[data-qr]");
    if (!cajas.length) return;
    var intentos = 0;
    var reloj = setInterval(function () {
      intentos++;
      if (typeof window.qrcode === "function") {
        clearInterval(reloj);
        cajas.forEach(function (caja) {
          var qr = window.qrcode(0, "M");
          qr.addData(window.location.origin + caja.dataset.qr);
          qr.make();
          caja.innerHTML = qr.createImgTag(4, 8);
        });
      } else if (intentos > 40) {
        clearInterval(reloj);
        cajas.forEach(function (caja) { caja.innerHTML = '<p class="nota">No se pudo dibujar el código QR. Copia el enlace de arriba.</p>'; });
      }
    }, 100);
  }

  // ---------- Arranque ----------
  function iniciar() {
    pintarAsesor();
    pintarHorario();
    iniciarListado();
    iniciarCarrusel();
    iniciarPedido();
    iniciarCompartir();
    iniciarVerificador();
    iniciarQR();
    pintarContadorPedido();
    actualizarEnlacesWA();

    document.querySelectorAll("[data-opciones]").forEach(function (f) {
      f.addEventListener("change", actualizarEnlacesWA);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
