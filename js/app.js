/* LOTI-CUENTAS — interfaz, guardado local y exportaciones. */
(function () {
  'use strict';

  var KEY = 'loticuentas.v1';
  var C = window.Calc;
  var $ = function (id) { return document.getElementById(id); };

  var db = { activeId: null, items: {} };
  var storageOk = true;

  /* ================= Utilidades ================= */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function mesAnio(d) {
    var m = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    d = d || new Date();
    return m[d.getMonth()] + ' ' + d.getFullYear();
  }
  /** Limpia un monto escrito: solo dígitos y un separador decimal; sin negativos. */
  function limpiarMonto(v) {
    var s = String(v || '').replace(/[^\d.,]/g, '');
    if (s.indexOf('.') >= 0) s = s.replace(/,/g, '');
    else if ((s.match(/,/g) || []).length === 1 && /,\d{0,2}$/.test(s)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    var i = s.indexOf('.');
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    return s;
  }
  function limpiarEntero(v) { return String(v || '').replace(/[^\d]/g, ''); }

  var toastTimer;
  function toast(msg, err) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ================= Modelo ================= */
  function nuevaSep() {
    return { id: uid(), cliente: '', manzana: '', lotes: '', celular: '', adelanto: '', opcion: '', fecha: '', recibidoPor: '', boletero: '' };
  }
  function nuevoGasto(concepto, tipo) {
    return { id: uid(), concepto: concepto || '', tipo: tipo || 'fijo', monto: '', precioUnit: '', cantidad: '' };
  }
  function nuevoSocio(nombre) {
    return { id: uid(), nombre: nombre || '', yape: '', yapeManual: false };
  }
  function nuevaLot(nombre) {
    var t = Date.now();
    return {
      id: uid(), nombre: nombre || ('Lotización – ' + mesAnio()), lugar: '',
      creado: t, actualizado: t, autoYape: false,
      separaciones: [nuevaSep()],
      gastos: [nuevoGasto('Movilidad', 'fijo'), nuevoGasto('Personal', 'personal')],
      socios: [nuevoSocio(''), nuevoSocio('')]
    };
  }

  /** Lotización de ejemplo con datos ficticios. */
  function ejemplo() {
    var l = nuevaLot('Ejemplo – Lotización Los Girasoles (Nov 2026)');
    l.lugar = 'Sector Los Girasoles (ejemplo)';
    var ana = nuevoSocio('Ana Torres'), car = nuevoSocio('Carlos Mendoza'), ros = nuevoSocio('Rosa Huamán');
    l.socios = [ana, car, ros];
    l.separaciones = [
      ['Pedro Ramírez Soto', 'A', '3', '900 111 001', '500', 'Yape', '2026-11-02', ana.id, 'Miguel'],
      ['María Flores León', 'A', '4', '900 111 002', '800', 'Efectivo', '2026-11-03', '', 'Lucía'],
      ['Luis Paredes Ccama', 'B', '1-2', '900 111 003', '1000', 'Yape', '2026-11-05', car.id, 'Miguel'],
      ['Elena Vargas Ruiz', 'C', '7', '900 111 004', '300', 'Efectivo', '2026-11-08', '', 'Lucía'],
      ['Jorge Salas Quispe', 'C', '8', '900 111 005', '400', 'Yape', '2026-11-10', ana.id, 'Miguel']
    ].map(function (r) {
      return { id: uid(), cliente: r[0], manzana: r[1], lotes: r[2], celular: r[3], adelanto: r[4], opcion: r[5], fecha: r[6], recibidoPor: r[7], boletero: r[8] };
    });
    var mov = nuevoGasto('Movilidad', 'fijo'); mov.monto = '120';
    var per = nuevoGasto('Personal', 'personal'); per.precioUnit = '50'; per.cantidad = '3';
    var ref = nuevoGasto('Refrigerio', 'fijo'); ref.monto = '45.50';
    l.gastos = [mov, per, ref];
    ana.yape = '900'; car.yape = '1000'; ros.yape = '';
    return l;
  }

  /** Asegura que una lotización (p. ej. importada) tenga todos los campos. */
  function normalizar(l) {
    l = l && typeof l === 'object' ? l : {};
    var base = nuevaLot(l.nombre || 'Lotización importada');
    var out = {
      id: String(l.id || base.id), nombre: String(l.nombre || base.nombre), lugar: String(l.lugar || ''),
      creado: +l.creado || base.creado, actualizado: +l.actualizado || base.actualizado,
      autoYape: !!l.autoYape,
      separaciones: Array.isArray(l.separaciones) ? l.separaciones.map(function (s) {
        var n = nuevaSep();
        Object.keys(n).forEach(function (k) { if (s && s[k] != null) n[k] = String(s[k]); });
        if (n.opcion !== 'Yape' && n.opcion !== 'Efectivo') n.opcion = '';
        n.adelanto = limpiarMonto(n.adelanto);
        return n;
      }) : [],
      gastos: Array.isArray(l.gastos) ? l.gastos.map(function (g) {
        var n = nuevoGasto();
        Object.keys(n).forEach(function (k) { if (g && g[k] != null) n[k] = String(g[k]); });
        n.tipo = n.tipo === 'personal' ? 'personal' : 'fijo';
        n.monto = limpiarMonto(n.monto); n.precioUnit = limpiarMonto(n.precioUnit); n.cantidad = limpiarEntero(n.cantidad);
        return n;
      }) : [],
      socios: Array.isArray(l.socios) ? l.socios.map(function (s) {
        var n = nuevoSocio();
        if (s && s.id) n.id = String(s.id);
        n.nombre = String((s && s.nombre) || '');
        n.yape = limpiarMonto(s && s.yape);
        n.yapeManual = !!(s && s.yapeManual);
        return n;
      }) : []
    };
    return out;
  }

  function cur() { return db.items[db.activeId]; }

  /* ================= Guardado ================= */
  function cargar() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.items) {
          db = { activeId: d.activeId, items: {} };
          Object.keys(d.items).forEach(function (k) { var l = normalizar(d.items[k]); db.items[l.id] = l; });
        }
      }
    } catch (e) {
      storageOk = false;
    }
    if (!Object.keys(db.items).length) {
      var ej = ejemplo();
      db = { activeId: ej.id, items: {} };
      db.items[ej.id] = ej;
    }
    if (!db.items[db.activeId]) db.activeId = ordenadas()[0].id;
  }

  var saveTimer, pendiente = false;
  function guardar(inmediato) {
    if (cur()) cur().actualizado = Date.now();
    clearTimeout(saveTimer);
    pendiente = true;
    var hacer = function () {
      pendiente = false;
      try {
        localStorage.setItem(KEY, JSON.stringify(db));
        storageOk = true;
        estadoGuardado('Guardado ✓');
      } catch (e) {
        storageOk = false;
        estadoGuardado('⚠ No se pudo guardar en este navegador', true);
      }
    };
    if (inmediato) hacer(); else { estadoGuardado('Guardando…'); saveTimer = setTimeout(hacer, 350); }
  }
  function estadoGuardado(txt, err) {
    var el = $('saveStatus');
    el.textContent = txt;
    el.className = 'save-status' + (err ? ' err' : '');
  }

  function ordenadas() {
    return Object.keys(db.items).map(function (k) { return db.items[k]; })
      .sort(function (a, b) { return b.actualizado - a.actualizado; });
  }

  /* ================= Render ================= */
  function renderSelector() {
    var sel = $('selLot');
    var lista = Object.keys(db.items).map(function (k) { return db.items[k]; })
      .sort(function (a, b) { return a.creado - b.creado; });
    sel.innerHTML = lista.map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === db.activeId ? ' selected' : '') + '>' + esc(l.nombre) + '</option>';
    }).join('');
  }

  function opcionesSocios(sel) {
    var l = cur();
    var h = '<option value="">— Elegir —</option>';
    l.socios.forEach(function (s, i) {
      h += '<option value="' + esc(s.id) + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.nombre || ('Socio ' + (i + 1))) + '</option>';
    });
    return h;
  }

  function attrs(list, id, field) {
    return ' data-list="' + list + '" data-id="' + esc(id) + '" data-field="' + field + '"';
  }

  /** "900 111 222 / 955 000 111" => ["900 111 222", "955 000 111"] (máx. 3) */
  function partirCel(c) {
    return String(c || '').split('/').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3);
  }
  function inputCel(id, valor, i) {
    return '<input class="in" type="tel" inputmode="tel" autocomplete="off" maxlength="15" placeholder="' + (i ? 'Otro número' : 'Celular') +
      '" value="' + esc(valor) + '" data-cel="' + esc(id) + '" aria-label="Celular ' + (i + 1) + '">';
  }
  function celularesHTML(s) {
    var nums = partirCel(s.celular);
    if (!nums.length) nums = [''];
    var h = '<div class="cel-list">';
    nums.forEach(function (n, i) { h += inputCel(s.id, n, i); });
    if (nums.length < 3) h += '<button type="button" class="btn-mini no-print" data-addcel="' + esc(s.id) + '">+ otro número</button>';
    return h + '</div>';
  }

  function renderSep() {
    var l = cur();
    $('tblSep').classList.toggle('with-recibido', !!l.autoYape);
    $('sepBody').innerHTML = l.separaciones.map(function (s, i) {
      var a = function (f) { return attrs('separaciones', s.id, f); };
      return '<tr>' +
        '<td class="c-n">' + (i + 1) + '</td>' +
        '<td><input class="in" type="text" autocomplete="off" placeholder="Nombre del cliente" value="' + esc(s.cliente) + '"' + a('cliente') + '></td>' +
        '<td><input class="in" type="text" autocomplete="off" value="' + esc(s.manzana) + '"' + a('manzana') + '></td>' +
        '<td><input class="in" type="text" autocomplete="off" value="' + esc(s.lotes) + '"' + a('lotes') + '></td>' +
        '<td>' + celularesHTML(s) + '</td>' +
        '<td><input class="in money" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(s.adelanto) + '"' + a('adelanto') + ' data-kind="money"></td>' +
        '<td><select class="in"' + a('opcion') + '>' +
          '<option value=""' + (s.opcion === '' ? ' selected' : '') + '>—</option>' +
          '<option value="Yape"' + (s.opcion === 'Yape' ? ' selected' : '') + '>Yape</option>' +
          '<option value="Efectivo"' + (s.opcion === 'Efectivo' ? ' selected' : '') + '>Efectivo</option>' +
        '</select></td>' +
        '<td><input class="in" type="date" value="' + esc(s.fecha) + '"' + a('fecha') + '></td>' +
        '<td><input class="in" type="text" autocomplete="off" list="dlBoleteros" placeholder="¿Quién separó?" value="' + esc(s.boletero) + '"' + a('boletero') + '></td>' +
        '<td class="col-recibido"><select class="in"' + a('recibidoPor') + (s.opcion === 'Yape' ? '' : ' disabled') + '>' + opcionesSocios(s.recibidoPor) + '</select></td>' +
        '<td class="c-del no-print"><button type="button" class="btn-del" data-del="separaciones" data-id="' + esc(s.id) + '" aria-label="Eliminar separación ' + (i + 1) + '">×</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderGas() {
    var l = cur();
    $('gasBody').innerHTML = l.gastos.map(function (g, i) {
      var a = function (f) { return attrs('gastos', g.id, f); };
      var detalle = g.tipo === 'personal'
        ? '<div class="detalle">' +
            '<div><span class="lbl">P. unitario</span><input class="in money" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(g.precioUnit) + '"' + a('precioUnit') + ' data-kind="money"></div>' +
            '<span class="x">×</span>' +
            '<div><span class="lbl">N° personas</span><input class="in money" type="text" inputmode="numeric" placeholder="0" value="' + esc(g.cantidad) + '"' + a('cantidad') + ' data-kind="int"></div>' +
          '</div>'
        : '<div class="detalle"><div><span class="lbl">Monto</span><input class="in money" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(g.monto) + '"' + a('monto') + ' data-kind="money"></div></div>';
      return '<tr>' +
        '<td class="c-n">' + (i + 1) + '</td>' +
        '<td><input class="in" type="text" autocomplete="off" placeholder="Concepto" value="' + esc(g.concepto) + '"' + a('concepto') + '></td>' +
        '<td><select class="in"' + a('tipo') + '>' +
          '<option value="fijo"' + (g.tipo === 'fijo' ? ' selected' : '') + '>Monto fijo</option>' +
          '<option value="personal"' + (g.tipo === 'personal' ? ' selected' : '') + '>Por personal</option>' +
        '</select></td>' +
        '<td>' + detalle + '</td>' +
        '<td class="num calc" data-costo="' + esc(g.id) + '"></td>' +
        '<td class="c-del no-print"><button type="button" class="btn-del" data-del="gastos" data-id="' + esc(g.id) + '" aria-label="Eliminar gasto ' + (i + 1) + '">×</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderSoc() {
    var l = cur();
    $('hintSocios').textContent = l.autoYape
      ? 'El Yape de cada socio se calcula solo con las separaciones pagadas por Yape que recibió. Puedes escribir otro monto para sobrescribirlo (↺ vuelve al automático).'
      : 'Escribe cuánto recibió cada socio por Yape; se descuenta de su parte.';
    $('socBody').innerHTML = l.socios.map(function (s, i) {
      var a = function (f) { return attrs('socios', s.id, f); };
      var auto = l.autoYape && !s.yapeManual;
      var reset = l.autoYape && s.yapeManual
        ? '<button type="button" class="btn-reset" data-reset="' + esc(s.id) + '" title="Volver al cálculo automático" aria-label="Volver al cálculo automático">↺</button>' : '';
      return '<tr>' +
        '<td class="c-n">' + (i + 1) + '</td>' +
        '<td><input class="in" type="text" autocomplete="off" placeholder="Nombre del socio" value="' + esc(s.nombre) + '"' + a('nombre') + '></td>' +
        '<td><div class="yape-cell"><input class="in money' + (auto ? ' auto' : '') + '" type="text" inputmode="decimal" placeholder="0.00" value="' +
          esc(auto ? C.yapeAutomatico(l, s.id).toFixed(2) : s.yape) + '"' + a('yape') + ' data-kind="money">' + reset + '</div></td>' +
        '<td class="c-del no-print"><button type="button" class="btn-del" data-del="socios" data-id="' + esc(s.id) + '" aria-label="Eliminar socio ' + (i + 1) + '">×</button></td>' +
        '</tr>';
    }).join('');
  }

  function setMoney(el, n) {
    el.textContent = C.soles(n);
    el.classList.toggle('neg', n < -C.EPS);
  }

  /** Recalcula y actualiza solo las celdas calculadas (no toca el foco). */
  function actualizar() {
    var l = cur();
    var r = C.calcular(l);
    setMoney($('totAdelantos'), r.totalAdelantos);
    setMoney($('totGastos'), r.totalGastos);
    setMoney($('sumAdel'), r.totalAdelantos);
    setMoney($('sumGas'), r.totalGastos);
    l.gastos.forEach(function (g, i) {
      var td = document.querySelector('[data-costo="' + CSS.escape(g.id) + '"]');
      if (td) setMoney(td, r.costos[i]);
    });
    setMoney($('stAdel'), r.totalAdelantos);
    setMoney($('stGas'), r.totalGastos);
    setMoney($('stRec'), r.recaudado);
    setMoney($('stSoc'), r.porSocio);
    $('stSocNote').textContent = r.nSocios ? ('entre ' + r.nSocios + ' socio' + (r.nSocios > 1 ? 's' : '')) : 'agrega al menos un socio';

    // Yape automático en la tabla de socios
    if (l.autoYape) {
      l.socios.forEach(function (s) {
        if (s.yapeManual) return;
        var inp = document.querySelector('#socBody input[data-field="yape"][data-id="' + CSS.escape(s.id) + '"]');
        if (inp && inp !== document.activeElement) inp.value = C.yapeAutomatico(l, s.id).toFixed(2);
      });
    }

    var w = $('warnYape');
    if (r.yapeSinAsignar > C.EPS) {
      w.hidden = false;
      w.textContent = 'Hay ' + C.soles(r.yapeSinAsignar) + ' pagados por Yape sin indicar qué socio los recibió.';
    } else w.hidden = true;

    $('distBody').innerHTML = r.distribucion.length ? r.distribucion.map(function (d) {
      var cls = d.estado === 'debe devolver' ? 'owe' : (d.estado === 'se le debe pagar' ? 'pay' : 'even');
      return '<tr>' +
        '<td class="c-n">' + d.n + '</td>' +
        '<td>' + esc(d.nombre || ('Socio ' + d.n)) + '</td>' +
        '<td class="num calc">' + C.soles(d.descuento) + (d.automatico ? '<span class="tag-auto">auto</span>' : '') + '</td>' +
        '<td class="num calc strong' + (d.montoFinal < -C.EPS ? ' neg' : '') + '">' + C.soles(d.montoFinal) + '</td>' +
        '<td><span class="badge ' + cls + '">' + d.estado + '</span></td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="5" class="hint" style="padding:12px">Agrega socios para ver la distribución.</td></tr>';

    renderBoleteros(l, r);
    document.title = 'LOTI-CUENTAS · ' + l.nombre;
  }

  function renderBoleteros(l, r) {
    // sugerencias de nombres ya usados
    var nombres = r.boleteros.filter(function (g) { return g.clave; }).map(function (g) { return g.nombre; });
    $('dlBoleteros').innerHTML = nombres.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');

    var S = C.soles, tot = { n: 0, yape: 0, efectivo: 0, total: 0 };
    $('bolBody').innerHTML = r.boleteros.length ? r.boleteros.map(function (g) {
      tot.n += g.n; tot.yape += g.yape; tot.efectivo += g.efectivo; tot.total += g.total;
      return '<tr><td' + (g.clave ? '' : ' class="muted"') + '>' + esc(g.nombre) + '</td><td class="num calc strong">' + S(g.total) + '</td>' +
        '<td class="num">' + g.n + '</td><td class="num">' + S(g.yape) + '</td><td class="num">' + S(g.efectivo) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="hint" style="padding:12px">Aún no hay separaciones.</td></tr>';
    $('bolFoot').innerHTML = r.boleteros.length ? '<tr><td class="tot-label">TOTAL</td><td class="num calc strong">' + S(tot.total) + '</td><td class="num strong">' + tot.n +
      '</td><td class="num strong">' + S(tot.yape) + '</td><td class="num strong">' + S(tot.efectivo) + '</td></tr>' : '';

    // detalle: la misma lista de separaciones, separada por boletero
    var abiertos = {};
    document.querySelectorAll('#bolDetalle details[open]').forEach(function (d) { abiertos[d.dataset.clave] = true; });
    $('bolDetalle').innerHTML = r.boleteros.map(function (g) {
      var filas = g.indices.map(function (i, j) {
        var s = l.separaciones[i];
        return '<tr><td class="c-n">' + (j + 1) + '</td><td>' + esc(s.cliente) + '</td><td>' + esc(s.manzana) + '</td><td>' + esc(s.lotes) + '</td>' +
          '<td>' + partirCel(s.celular).map(esc).join('<br>') + '</td><td class="num">' + (s.adelanto === '' ? '' : S(s.adelanto)) + '</td>' +
          '<td>' + esc(s.opcion) + '</td><td>' + fechaDMY(s.fecha) + '</td></tr>';
      }).join('');
      return '<details data-clave="' + esc(g.clave) + '"' + (abiertos[g.clave] ? ' open' : '') + '>' +
        '<summary><span class="bol-name">' + esc(g.nombre) + '</span><span class="bol-sum">' + g.n + ' sep. · <strong>' + S(g.total) + '</strong></span></summary>' +
        '<div class="table-scroll"><table class="grid ro"><thead><tr><th class="c-n">N°</th><th>Cliente</th><th>Manzana</th><th>Lotes</th><th>N° celular</th>' +
        '<th class="num">Adelanto</th><th>Opción</th><th>Día de firma</th></tr></thead><tbody>' + filas + '</tbody>' +
        '<tfoot><tr><td colspan="5" class="tot-label">TOTAL ' + esc(g.nombre.toUpperCase()) + '</td><td class="num calc strong">' + S(g.total) + '</td><td colspan="2"></td></tr></tfoot>' +
        '</table></div></details>';
    }).join('');
  }

  function renderTodo() {
    var l = cur();
    renderSelector();
    $('lugar').value = l.lugar;
    $('autoYape').checked = !!l.autoYape;
    renderSep(); renderGas(); renderSoc();
    actualizar();
  }

  /* ================= Eventos de edición ================= */
  function buscar(list, id) {
    var arr = cur()[list] || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'lugar') { cur().lugar = el.value; guardar(); actualizar(); return; }
    if (el.dataset && el.dataset.cel) {
      var sp = buscar('separaciones', el.dataset.cel);
      if (!sp) return;
      var limpioCel = el.value.replace(/[^\d +\-]/g, '');
      if (limpioCel !== el.value) el.value = limpioCel;
      sp.celular = Array.prototype.map.call(el.closest('.cel-list').querySelectorAll('input'), function (x) { return x.value.trim(); })
        .filter(Boolean).join(' / ');
      guardar();
      return;
    }
    var list = el.dataset && el.dataset.list;
    if (!list) return;
    var item = buscar(list, el.dataset.id);
    if (!item) return;
    var f = el.dataset.field, v = el.value;
    if (el.dataset.kind === 'money' || el.dataset.kind === 'int') {
      var limpio = el.dataset.kind === 'int' ? limpiarEntero(v) : limpiarMonto(v);
      if (limpio !== v) el.value = limpio;
      v = limpio;
    }
    if (list === 'socios' && f === 'yape' && cur().autoYape && !item.yapeManual) {
      item.yapeManual = true;
      item.yape = v;
      el.classList.remove('auto');
      // añadir botón de volver a automático sin perder el foco
      var cell = el.parentNode;
      if (!cell.querySelector('.btn-reset')) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-reset'; b.textContent = '↺';
        b.title = 'Volver al cálculo automático'; b.setAttribute('aria-label', b.title);
        b.dataset.reset = item.id;
        cell.appendChild(b);
      }
    } else if (el.tagName !== 'SELECT') {
      item[f] = v;
    }
    if (list === 'socios' && f === 'nombre') refrescarSelectSocios();
    guardar();
    actualizar();
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'selLot') { db.activeId = el.value; guardar(true); renderTodo(); window.scrollTo(0, 0); return; }
    if (el.id === 'autoYape') {
      cur().autoYape = el.checked;
      guardar(); renderSep(); renderSoc(); actualizar();
      if (el.checked) toast('Indica en cada separación con Yape qué socio lo recibió');
      return;
    }
    if (el.id === 'fileExcel') { if (el.files[0]) importarExcel(el.files[0]); el.value = ''; return; }
    if (el.id === 'fileJson') { if (el.files[0]) importarJSON(el.files[0]); el.value = ''; return; }
    if (el.tagName !== 'SELECT' || !el.dataset.list) return;
    var item = buscar(el.dataset.list, el.dataset.id);
    if (!item) return;
    item[el.dataset.field] = el.value;
    if (el.dataset.list === 'gastos' && el.dataset.field === 'tipo') {
      // al cambiar de tipo, conservar el costo como punto de partida
      if (el.value === 'personal' && !item.precioUnit && C.pos(item.monto) > 0) { item.precioUnit = item.monto; item.cantidad = item.cantidad || '1'; }
      if (el.value === 'fijo' && !item.monto) { var c = C.pos(item.precioUnit) * C.pos(item.cantidad); if (c > 0) item.monto = String(Math.round(c * 100) / 100); }
      renderGas();
    }
    if (el.dataset.list === 'separaciones' && el.dataset.field === 'opcion') {
      var r = el.closest('tr').querySelector('select[data-field="recibidoPor"]');
      if (r) r.disabled = el.value !== 'Yape';
    }
    guardar();
    actualizar();
  });

  function refrescarSelectSocios() {
    var l = cur();
    document.querySelectorAll('#sepBody select[data-field="recibidoPor"]').forEach(function (sel) {
      var s = buscar('separaciones', sel.dataset.id);
      if (s) sel.innerHTML = opcionesSocios(s.recibidoPor);
    });
    void l;
  }

  function filaVacia(list, it) {
    if (list === 'separaciones') return !(it.cliente || it.manzana || it.lotes || it.celular || it.adelanto || it.fecha || it.boletero);
    if (list === 'gastos') return !(it.concepto || it.monto || it.precioUnit || it.cantidad);
    return !(it.nombre || it.yape);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.del) {
      var list = btn.dataset.del, id = btn.dataset.id, arr = cur()[list];
      var it = buscar(list, id);
      if (!it) return;
      var nombres = { separaciones: 'esta separación', gastos: 'este gasto', socios: 'este socio' };
      if (!filaVacia(list, it) && !confirm('¿Eliminar ' + nombres[list] + '?')) return;
      cur()[list] = arr.filter(function (x) { return x.id !== id; });
      if (list === 'socios') cur().separaciones.forEach(function (s) { if (s.recibidoPor === id) s.recibidoPor = ''; });
      guardar();
      if (list === 'separaciones') renderSep();
      if (list === 'gastos') renderGas();
      if (list === 'socios') { renderSoc(); renderSep(); }
      actualizar();
      return;
    }
    if (btn.dataset.addcel) {
      var box = btn.closest('.cel-list');
      var cuantos = box.querySelectorAll('input').length;
      if (cuantos < 3) {
        btn.insertAdjacentHTML('beforebegin', inputCel(btn.dataset.addcel, '', cuantos));
        box.querySelectorAll('input')[cuantos].focus();
      }
      if (cuantos + 1 >= 3) btn.remove();
      return;
    }
    if (btn.dataset.reset) {
      var s = buscar('socios', btn.dataset.reset);
      if (s) { s.yapeManual = false; s.yape = ''; guardar(); renderSoc(); actualizar(); }
      return;
    }

    switch (btn.dataset.action) {
      case 'addSep': cur().separaciones.push(nuevaSep()); guardar(); renderSep(); actualizar(); enfocarUltima('sepBody'); break;
      case 'addGas': cur().gastos.push(nuevoGasto()); guardar(); renderGas(); actualizar(); enfocarUltima('gasBody'); break;
      case 'addSoc': cur().socios.push(nuevoSocio()); guardar(); renderSoc(); renderSep(); actualizar(); enfocarUltima('socBody'); break;
      case 'nueva': accionNueva(); break;
      case 'duplicar': accionDuplicar(); break;
      case 'renombrar': accionRenombrar(); break;
      case 'borrar': accionBorrar(); break;
      case 'whatsapp': copiarResumen(); break;
      case 'compartir': compartirResumen(); break;
      case 'excel': exportarExcel(); break;
      case 'pdf': imprimir(); break;
      case 'importExcel': $('fileExcel').click(); break;
      case 'backup': descargarRespaldo(); break;
      case 'restore': $('fileJson').click(); break;
    }
  });

  function enfocarUltima(tbodyId) {
    var rows = $(tbodyId).rows;
    if (!rows.length) return;
    var inp = rows[rows.length - 1].querySelector('input[type="text"]');
    if (inp) { inp.focus(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  /* ================= Lotizaciones ================= */
  function nombreUnico(base) {
    var existentes = {};
    Object.keys(db.items).forEach(function (k) { existentes[db.items[k].nombre] = true; });
    if (!existentes[base]) return base;
    for (var i = 2; ; i++) if (!existentes[base + ' (' + i + ')']) return base + ' (' + i + ')';
  }
  function agregarLot(l) {
    db.items[l.id] = l;
    db.activeId = l.id;
    guardar(true);
    renderTodo();
    window.scrollTo(0, 0);
  }
  function accionNueva() {
    var n = prompt('Nombre de la nueva lotización:', 'Lotización – ' + mesAnio());
    if (n === null) return;
    n = n.trim() || ('Lotización – ' + mesAnio());
    agregarLot(nuevaLot(nombreUnico(n)));
    toast('Lotización creada');
  }
  function accionDuplicar() {
    var copia = normalizar(JSON.parse(JSON.stringify(cur())));
    copia.id = uid();
    copia.nombre = nombreUnico(cur().nombre + ' (copia)');
    copia.creado = copia.actualizado = Date.now();
    agregarLot(copia);
    toast('Lotización duplicada');
  }
  function accionRenombrar() {
    var n = prompt('Nuevo nombre:', cur().nombre);
    if (n === null || !n.trim()) return;
    cur().nombre = n.trim();
    guardar(true); renderSelector(); actualizar();
    toast('Nombre actualizado');
  }
  function accionBorrar() {
    var l = cur();
    if (!confirm('¿Borrar la lotización "' + l.nombre + '"?\n\nEsta acción no se puede deshacer. Te recomendamos descargar un respaldo JSON antes.')) return;
    delete db.items[l.id];
    if (!Object.keys(db.items).length) { var n = nuevaLot(); db.items[n.id] = n; }
    db.activeId = ordenadas()[0].id;
    guardar(true); renderTodo();
    toast('Lotización borrada');
  }

  /* ================= Documento de impresión (formal, blanco y negro) ================= */
  function fechaDMY(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function hoyDMY() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function tituloLot(l) { return (l.lugar || '').trim() || l.nombre; }

  function renderImpresion() {
    var l = cur(), r = C.calcular(l), S = C.soles;
    var nombreSocio = {};
    l.socios.forEach(function (s, i) { nombreSocio[s.id] = s.nombre || ('Socio ' + (i + 1)); });
    var h = '';
    h += '<header class="pd-head">' +
      '<p class="pd-kicker">Rendición de cuentas</p>' +
      '<h1>' + (/^lotizaci/i.test(tituloLot(l)) ? '' : 'Lotización ') + esc(tituloLot(l)) + '</h1>' +
      '<p class="pd-meta">Fecha de emisión: ' + hoyDMY() + '</p>' +
      '</header>';

    // Socios
    h += '<section><h2>1. Socios</h2><table><thead><tr><th class="n">N°</th><th>Socio</th><th class="num">Yape recibido</th></tr></thead><tbody>';
    l.socios.forEach(function (s, i) {
      h += '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(nombreSocio[s.id]) + '</td><td class="num">' + S(C.yapeSocio(l, s)) + '</td></tr>';
    });
    if (!l.socios.length) h += '<tr><td colspan="3">Sin socios registrados.</td></tr>';
    h += '</tbody></table></section>';

    // Separaciones
    var conRec = !!l.autoYape;
    h += '<section><h2>2. Lista de separaciones</h2><table><thead><tr><th class="n">N°</th><th>Cliente</th><th>Mz.</th><th>Lotes</th><th>N° celular</th>' +
      '<th class="num">Adelanto</th><th>Opción</th><th>Día de firma</th><th>Boletero</th>' + (conRec ? '<th>Recibido por</th>' : '') + '</tr></thead><tbody>';
    l.separaciones.forEach(function (s, i) {
      h += '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(s.cliente) + '</td><td>' + esc(s.manzana) + '</td><td>' + esc(s.lotes) + '</td>' +
        '<td>' + partirCel(s.celular).map(esc).join('<br>') + '</td>' +
        '<td class="num">' + (s.adelanto === '' ? '' : S(s.adelanto)) + '</td><td>' + esc(s.opcion) + '</td><td>' + fechaDMY(s.fecha) + '</td>' +
        '<td>' + esc(s.boletero) + '</td>' +
        (conRec ? '<td>' + (s.opcion === 'Yape' ? esc(nombreSocio[s.recibidoPor] || '') : '') + '</td>' : '') + '</tr>';
    });
    h += '</tbody><tfoot><tr class="tot"><td colspan="5" class="num">TOTAL ADELANTOS</td><td class="num">' + S(r.totalAdelantos) +
      '</td><td colspan="' + (conRec ? 4 : 3) + '"></td></tr></tfoot></table></section>';

    // Recaudado por boletero
    if (r.boleteros.length) {
      var tb = { n: 0, y: 0, e: 0, t: 0 };
      h += '<section><h2>3. Recaudado por boletero</h2><table class="pd-bol"><thead><tr><th>Boletero / personal</th><th class="num">Separaciones</th>' +
        '<th class="num">Yape</th><th class="num">Efectivo</th><th class="num">Total recaudado</th></tr></thead><tbody>';
      r.boleteros.forEach(function (g) {
        tb.n += g.n; tb.y += g.yape; tb.e += g.efectivo; tb.t += g.total;
        h += '<tr><td>' + esc(g.nombre) + '</td><td class="num">' + g.n + '</td><td class="num">' + S(g.yape) + '</td><td class="num">' + S(g.efectivo) +
          '</td><td class="num"><b>' + S(g.total) + '</b></td></tr>';
      });
      h += '</tbody><tfoot><tr class="tot"><td>TOTAL</td><td class="num">' + tb.n + '</td><td class="num">' + S(tb.y) + '</td><td class="num">' + S(tb.e) +
        '</td><td class="num">' + S(tb.t) + '</td></tr></tfoot></table>';
      r.boleteros.forEach(function (g) {
        h += '<div class="pd-grupo"><h3>' + esc(g.nombre) + '</h3><table><thead><tr><th class="n">N°</th><th>Cliente</th><th>Mz.</th><th>Lotes</th><th>N° celular</th>' +
          '<th class="num">Adelanto</th><th>Opción</th><th>Día de firma</th></tr></thead><tbody>';
        g.indices.forEach(function (i, j) {
          var s = l.separaciones[i];
          h += '<tr><td class="n">' + (j + 1) + '</td><td>' + esc(s.cliente) + '</td><td>' + esc(s.manzana) + '</td><td>' + esc(s.lotes) + '</td>' +
            '<td>' + partirCel(s.celular).map(esc).join('<br>') + '</td><td class="num">' + (s.adelanto === '' ? '' : S(s.adelanto)) + '</td>' +
            '<td>' + esc(s.opcion) + '</td><td>' + fechaDMY(s.fecha) + '</td></tr>';
        });
        h += '</tbody><tfoot><tr class="tot"><td colspan="5" class="num">TOTAL ' + esc(g.nombre.toUpperCase()) + '</td><td class="num">' + S(g.total) +
          '</td><td colspan="2"></td></tr></tfoot></table></div>';
      });
      h += '</section>';
    }
    var sec = r.boleteros.length ? 4 : 3;

    // Gastos
    h += '<section><h2>' + sec + '. Gastos</h2><table><thead><tr><th class="n">N°</th><th>Concepto</th><th>Detalle</th><th class="num">Costo</th></tr></thead><tbody>';
    l.gastos.forEach(function (g, i) {
      var det = g.tipo === 'personal' ? C.pos(g.cantidad) + ' persona(s) × ' + S(g.precioUnit) : 'Monto fijo';
      h += '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(g.concepto) + '</td><td>' + det + '</td><td class="num">' + S(r.costos[i]) + '</td></tr>';
    });
    h += '</tbody><tfoot><tr class="tot"><td colspan="3" class="num">TOTAL GASTOS</td><td class="num">' + S(r.totalGastos) + '</td></tr></tfoot></table></section>';

    // Resultado
    h += '<section class="pd-keep"><h2>' + (sec + 1) + '. Resultado</h2><table class="pd-res"><tbody>' +
      '<tr><td>Total adelantos</td><td class="num">' + S(r.totalAdelantos) + '</td></tr>' +
      '<tr><td>(−) Total gastos</td><td class="num">' + S(r.totalGastos) + '</td></tr>' +
      '<tr class="hl"><td>MONTO TOTAL RECAUDADO</td><td class="num">' + S(r.recaudado) + '</td></tr>' +
      '<tr><td>Número de socios</td><td class="num">' + r.nSocios + '</td></tr>' +
      '<tr class="hl"><td>MONTO PARA CADA SOCIO</td><td class="num">' + S(r.porSocio) + '</td></tr>' +
      '</tbody></table></section>';

    // Distribución
    h += '<section class="pd-keep"><h2>' + (sec + 2) + '. Distribución de ganancias</h2><table class="pd-dist"><thead><tr><th class="n">N°</th><th>Socio</th>' +
      '<th class="num">Le corresponde</th><th class="num">Descuento (Yape)</th><th class="num">Monto final</th><th>Situación</th></tr></thead><tbody>';
    r.distribucion.forEach(function (d) {
      h += '<tr><td class="n">' + d.n + '</td><td>' + esc(d.nombre || ('Socio ' + d.n)) + '</td><td class="num">' + S(r.porSocio) + '</td>' +
        '<td class="num">' + S(d.descuento) + '</td><td class="num final">' + S(d.montoFinal) + '</td>' +
        '<td class="estado">' + d.estado.toUpperCase() + '</td></tr>';
    });
    if (!r.distribucion.length) h += '<tr><td colspan="6">Sin socios registrados.</td></tr>';
    h += '</tbody></table></section>';

    $('printDoc').innerHTML = h;
  }

  var tituloPrevio = null;
  function imprimir() {
    renderImpresion();
    window.print();
  }
  window.addEventListener('beforeprint', function () {
    renderImpresion();
    if (tituloPrevio === null) tituloPrevio = document.title;
    document.title = 'Cuentas - Lotizacion ' + tituloLot(cur()); // nombre sugerido del PDF
  });
  window.addEventListener('afterprint', function () {
    if (tituloPrevio !== null) { document.title = tituloPrevio; tituloPrevio = null; }
  });

  /* ================= Resumen WhatsApp ================= */
  function textoResumen() {
    var l = cur(), r = C.calcular(l);
    var L = [];
    L.push('*' + l.nombre + '*');
    L.push('Lugar: ' + (l.lugar || '—'));
    L.push('');
    L.push('Separaciones: ' + l.separaciones.filter(function (s) { return C.pos(s.adelanto) > 0; }).length);
    L.push('Total adelantos: ' + C.soles(r.totalAdelantos));
    var bols = r.boleteros.filter(function (g) { return g.clave; });
    if (bols.length) {
      L.push('Recaudado por boletero:');
      r.boleteros.forEach(function (g) { L.push('  • ' + g.nombre + ' (' + g.n + ' sep.): ' + C.soles(g.total)); });
    }
    L.push('Gastos: ' + C.soles(r.totalGastos));
    l.gastos.forEach(function (g, i) {
      if (!g.concepto && !r.costos[i]) return;
      var det = g.tipo === 'personal' ? ' (' + C.pos(g.cantidad) + ' × ' + C.soles(g.precioUnit) + ')' : '';
      L.push('  • ' + (g.concepto || 'Gasto ' + (i + 1)) + det + ': ' + C.soles(r.costos[i]));
    });
    L.push('*Monto total recaudado: ' + C.soles(r.recaudado) + '*');
    L.push('*Monto para cada socio (' + r.nSocios + '): ' + C.soles(r.porSocio) + '*');
    L.push('');
    L.push('*Distribución de ganancias*');
    r.distribucion.forEach(function (d) {
      L.push(d.n + '. ' + (d.nombre || 'Socio ' + d.n) + ': ' + C.soles(r.porSocio) + ' − Yape ' + C.soles(d.descuento) +
        ' = *' + C.soles(d.montoFinal) + '* (' + d.estado + ')');
    });
    return L.join('\n');
  }
  function copiarResumen() {
    var txt = textoResumen();
    var ok = function () { toast('Resumen copiado. Pégalo en WhatsApp.'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(ok, function () { copiarFallback(txt) ? ok() : toast('No se pudo copiar', true); });
    } else {
      copiarFallback(txt) ? ok() : toast('No se pudo copiar', true);
    }
  }
  function copiarFallback(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function compartirResumen() {
    if (!navigator.share) return copiarResumen();
    navigator.share({ title: cur().nombre, text: textoResumen() }).catch(function () {});
  }

  /* ================= Respaldo JSON ================= */
  function descargar(blob, nombre) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function nombreArchivo(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'lotizacion';
  }
  function hoyISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function descargarRespaldo() {
    var data = { app: 'LOTI-CUENTAS', version: 1, exportado: new Date().toISOString(), lotizaciones: ordenadas() };
    descargar(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'loti-cuentas_respaldo_' + hoyISO() + '.json');
    toast('Respaldo descargado');
  }
  function importarJSON(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var data;
      try { data = JSON.parse(fr.result); } catch (e) { return toast('El archivo no es un JSON válido', true); }
      var lista = Array.isArray(data) ? data : (data && Array.isArray(data.lotizaciones) ? data.lotizaciones : null);
      if (!lista || !lista.length) return toast('El respaldo no contiene lotizaciones', true);
      var repetidas = lista.filter(function (l) { return l && db.items[l.id]; }).length;
      var msg = 'Se importarán ' + lista.length + ' lotización(es).' +
        (repetidas ? '\n' + repetidas + ' ya existe(n) en este dispositivo y se reemplazará(n) por la versión del respaldo.' : '') +
        '\n\n¿Continuar?';
      if (!confirm(msg)) return;
      var ultima;
      lista.forEach(function (raw) { var l = normalizar(raw); db.items[l.id] = l; ultima = l; });
      db.activeId = ultima.id;
      guardar(true); renderTodo();
      toast('Respaldo importado (' + lista.length + ')');
    };
    fr.onerror = function () { toast('No se pudo leer el archivo', true); };
    fr.readAsText(file);
  }

  /* ================= Excel ================= */
  function exportarExcel() {
    toast('Generando Excel…');
    window.LotiExcel.exportar(cur(), C.calcular(cur())).then(function (blob) {
      descargar(blob, nombreArchivo(cur().nombre) + '.xlsx');
      toast('Excel descargado');
    }).catch(function (e) {
      console.error(e);
      toast('No se pudo generar el Excel. Revisa tu conexión (la primera vez se descarga una librería).', true);
    });
  }
  function importarExcel(file) {
    toast('Leyendo Excel…');
    window.LotiExcel.importar(file, { uid: uid, nuevaSep: nuevaSep, nuevoGasto: nuevoGasto, nuevoSocio: nuevoSocio, limpiarMonto: limpiarMonto })
      .then(function (datos) {
        var base = datos.lugar ? ('Importado – ' + datos.lugar) : ('Importado – ' + file.name.replace(/\.xlsx$/i, ''));
        var l = nuevaLot(nombreUnico(base));
        l.lugar = datos.lugar || '';
        l.separaciones = datos.separaciones;
        l.gastos = datos.gastos;
        l.socios = datos.socios;
        l.autoYape = !!datos.autoYape;
        agregarLot(normalizar(l));
        toast('Excel importado: ' + l.separaciones.length + ' separaciones, ' + l.gastos.length + ' gastos, ' + l.socios.length + ' socios');
      })
      .catch(function (e) {
        console.error(e);
        toast(e && e.userMessage ? e.userMessage : 'No se pudo leer el Excel', true);
      });
  }

  /* ================= Inicio ================= */
  // Guardar de inmediato si el usuario cambia de app o cierra la pestaña
  var flush = function () { if (pendiente) guardar(true); };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  cargar();
  if (navigator.share) $('btnShare').hidden = false;
  renderTodo();
  if (!storageOk) estadoGuardado('⚠ Este navegador no permite guardar', true);
  else guardar(true);

  // Exponer para pruebas
  window.LotiApp = { db: function () { return db; }, cur: cur, normalizar: normalizar, ejemplo: ejemplo, textoResumen: textoResumen, render: renderTodo };
})();
