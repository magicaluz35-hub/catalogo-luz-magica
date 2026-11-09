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

  function textoPedido() {
    var pedido = recuperar(LLAVE_PEDIDO) || [];
    var lineas = ["¡Hola Luz Mágica! Quiero hacer este pedido:"];
    var total = 0;
    pedido.forEach(function (p) {
      lineas.push("· " + p.nombre + " (" + p.sku + ") — " + pesos(p.precio));
      total += Number(p.precio) || 0;
    });
    lineas.push("Total aproximado: " + pesos(total));
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
    document.querySelectorAll("[data-pedido-contador]").forEach(function (n) {
      n.textContent = pedido.length;
      n.hidden = pedido.length === 0;
    });
  }

  function iniciarPedido() {
    document.querySelectorAll("[data-agregar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var pedido = recuperar(LLAVE_PEDIDO) || [];
        if (!pedido.some(function (p) { return p.sku === b.dataset.sku; })) {
          pedido.push({ sku: b.dataset.sku, nombre: b.dataset.nombre, precio: Number(b.dataset.precio) });
          guardar(LLAVE_PEDIDO, pedido);
        }
        b.textContent = "Añadido al pedido";
        pintarContadorPedido();
        actualizarEnlacesWA();
      });
    });

    var lista = document.querySelector("[data-pedido-lista]");
    if (!lista) return;
    var pedido = recuperar(LLAVE_PEDIDO) || [];
    var vacio = document.querySelector("[data-pedido-vacio]");
    var pie = document.querySelector("[data-pedido-pie]");

    if (!pedido.length) {
      if (vacio) vacio.hidden = false;
      return;
    }
    if (pie) pie.hidden = false;

    var total = 0;
    pedido.forEach(function (p) {
      total += Number(p.precio) || 0;
      var fila = document.createElement("div");
      fila.className = "pedido__linea";
      fila.innerHTML = '<div><p class="tarjeta__sku">' + p.sku + '</p><p><strong>' + p.nombre + "</strong></p></div>"
        + "<div><p>" + pesos(p.precio) + '</p><button type="button" class="enlace-boton" data-quitar="' + p.sku + '">Quitar</button></div>';
      lista.appendChild(fila);
    });

    var totalNodo = document.querySelector("[data-pedido-total]");
    if (totalNodo) totalNodo.textContent = pesos(total);

    lista.addEventListener("click", function (e) {
      var sku = e.target && e.target.dataset ? e.target.dataset.quitar : null;
      if (!sku) return;
      var actual = (recuperar(LLAVE_PEDIDO) || []).filter(function (p) { return p.sku !== sku; });
      guardar(LLAVE_PEDIDO, actual);
      window.location.reload();
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
