/* LOTI-CUENTAS — exportar / importar Excel con ExcelJS (se carga solo cuando se usa).
 * La exportación reproduce la hoja "Hoja1" de CUENTAS_FORMATO.xlsx (mismas columnas,
 * colores y fórmulas), con tantas filas como haya en la app.
 */
(function () {
  'use strict';

  var EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  var cargando = null;

  function cargarExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (cargando) return cargando;
    cargando = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = EXCELJS_URL;
      s.crossOrigin = "anonymous";
      s.async = true;
      s.onload = function () { window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS no disponible')); };
      s.onerror = function () { cargando = null; reject(new Error('No se pudo cargar ExcelJS')); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  var AZUL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
  var AMARILLO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  var BORDE = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  var FMT_SOLES = '"S/ "#,##0.00;[Red]-"S/ "#,##0.00';
  var FMT_FECHA = 'dd/mm/yyyy';

  function n(v) { return window.Calc.pos(v); }
  function vacio(v) { return v === '' || v == null; }

  function exportar(lot, res) {
    return cargarExcelJS().then(function (ExcelJS) {
      var wb = new ExcelJS.Workbook();
      wb.creator = 'LOTI-CUENTAS';
      wb.calcProperties = { fullCalcOnLoad: true };
      var ws = wb.addWorksheet('Hoja1');

      [['A', 11.55], ['B', 5.89], ['C', 27.33], ['D', 11.89], ['E', 14], ['F', 13], ['G', 12], ['H', 11],
       ['I', 14.22], ['J', 18], ['K', 6.89], ['L', 24], ['M', 13], ['N', 3], ['O', 20]].forEach(function (w) { ws.getColumn(w[0]).width = w[1]; });

      function cab(ref, texto) {
        var c = ws.getCell(ref);
        c.value = texto; c.fill = AZUL; c.border = BORDE;
        c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        return c;
      }
      function celda(ref, valor, fmt, centro) {
        var c = ws.getCell(ref);
        c.value = valor; c.border = BORDE;
        if (fmt) c.numFmt = fmt;
        if (centro) c.alignment = { horizontal: 'center' };
        return c;
      }
      function formula(ref, f, resultado, fmt) {
        return celda(ref, { formula: f, result: resultado }, fmt, true);
      }

      /* 1. Encabezado */
      var c3 = ws.getCell('C3');
      c3.value = 'LUGAR DE LOTIZACIÓN:'; c3.fill = AMARILLO; c3.font = { bold: true };
      ws.mergeCells('D3:H3');
      ws.getCell('D3').value = lot.lugar || '';
      ws.getCell('D3').font = { bold: true, size: 12 };

      /* 2. Separaciones (B..I, J opcional) y socios (K..M) */
      var conRecibido = !!lot.autoYape;
      cab('B5', 'N°'); cab('C5', 'LISTA DE SEPARACIONES'); cab('D5', 'MANZANA'); cab('E5', 'LOTES');
      cab('F5', 'N° CELULAR'); cab('G5', 'ADELANTO'); cab('H5', 'OPCION'); cab('I5', 'DIA DE FIRMA');
      if (conRecibido) cab('J5', 'RECIBIDO POR');
      cab('K5', 'N°'); cab('L5', 'SOCIO'); cab('M5', 'YAPE');
      cab('O5', 'BOLETERO');
      var todosGrupos = window.Calc.porBoletero(lot);
      var grupos = todosGrupos.filter(function (g) { return g.n > 0; });
      var nombreBol = {};
      todosGrupos.forEach(function (g) { nombreBol[g.id] = g.nombre; });

      var socios = lot.socios || [];
      var nombreSocio = {};
      socios.forEach(function (s, i) { nombreSocio[s.id] = s.nombre || ('Socio ' + (i + 1)); });

      var orden = [];
      todosGrupos.forEach(function (g) { g.indices.forEach(function (i) { orden.push(lot.separaciones[i]); }); });
      var seps = orden.length ? orden : [{}];
      var s1 = 6, sN = 5 + seps.length;
      seps.forEach(function (s, i) {
        var r = s1 + i;
        celda('B' + r, i + 1, null, true);
        celda('C' + r, s.cliente || '');
        celda('D' + r, s.manzana || '', null, true);
        celda('E' + r, s.lotes || '', null, true);
        celda('F' + r, s.celular || '', null, true);
        celda('G' + r, vacio(s.adelanto) ? null : n(s.adelanto), FMT_SOLES);
        celda('H' + r, s.opcion ? s.opcion.toUpperCase() : '', null, true);
        var f = null;
        if (s.fecha && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) {
          var p = s.fecha.split('-');
          f = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
        }
        celda('I' + r, f, FMT_FECHA, true);
        if (conRecibido) celda('J' + r, s.opcion === 'Yape' && nombreSocio[s.recibidoPor] ? nombreSocio[s.recibidoPor] : '');
        ws.getCell('H' + r).dataValidation = { type: 'list', allowBlank: true, formulae: ['"YAPE,EFECTIVO"'] };
        celda('O' + r, s.id && window.Calc.sepConDatos(s) ? (nombreBol[s.boleteroId] || '') : '');
      });
      var totSep = sN + 1;
      cab('F' + totSep, 'TOTAL=');
      formula('G' + totSep, 'SUM(G' + s1 + ':G' + sN + ')', res.totalAdelantos, FMT_SOLES);
      ws.getCell('G' + totSep).fill = AZUL;
      ws.getCell('G' + totSep).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      var soc1 = 6, socN = 5 + Math.max(socios.length, 1);
      socios.forEach(function (s, i) {
        var r = soc1 + i;
        celda('K' + r, i + 1, null, true);
        celda('L' + r, s.nombre || '');
        var y = window.Calc.yapeSocio(lot, s);
        if (lot.autoYape && !s.yapeManual) {
          formula('M' + r, 'SUMIFS($G$' + s1 + ':$G$' + sN + ',$H$' + s1 + ':$H$' + sN + ',"YAPE",$J$' + s1 + ':$J$' + sN + ',L' + r + ')', y, FMT_SOLES);
        } else {
          celda('M' + r, vacio(s.yape) ? null : y, FMT_SOLES);
        }
      });

      /* 3. Gastos */
      var g0 = totSep + 2;
      cab('B' + g0, 'N°'); cab('C' + g0, 'GASTOS'); cab('D' + g0, 'COSTO');
      cab('E' + g0, 'P. UNITARIO'); cab('F' + g0, 'CANTIDAD');
      var gastos = lot.gastos && lot.gastos.length ? lot.gastos : [{}];
      var g1 = g0 + 1, gN = g0 + gastos.length;
      gastos.forEach(function (g, i) {
        var r = g1 + i;
        celda('B' + r, i + 1, null, true);
        celda('C' + r, g.concepto || '');
        if (g.tipo === 'personal') {
          celda('E' + r, n(g.precioUnit), FMT_SOLES);
          celda('F' + r, n(g.cantidad), '0', true);
          formula('D' + r, 'E' + r + '*F' + r, window.Calc.costoGasto(g), FMT_SOLES);
        } else {
          celda('D' + r, vacio(g.monto) ? null : n(g.monto), FMT_SOLES);
          celda('E' + r, null); celda('F' + r, null);
        }
      });
      var totGas = gN + 1;
      celda('C' + totGas, 'TOTAL=').font = { bold: true };
      ws.getCell('C' + totGas).alignment = { horizontal: 'right' };
      formula('D' + totGas, 'SUM(D' + g1 + ':D' + gN + ')', res.totalGastos, FMT_SOLES);
      ws.getCell('D' + totGas).fill = AZUL;
      ws.getCell('D' + totGas).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      /* 4. Resultado */
      var r0 = totGas + 4, r1 = r0 + 1;
      cab('C' + r0, 'MONTO TOTAL RECAUDADO');
      ws.mergeCells('D' + r0 + ':E' + r0); cab('D' + r0, 'MONTO PARA CADA SOCIO');
      formula('C' + r1, '$G$' + totSep + '-$D$' + totGas, res.recaudado, FMT_SOLES).font = { bold: true, size: 12 };
      ws.mergeCells('D' + r1 + ':E' + r1);
      var rngK = 'K' + soc1 + ':K' + socN;
      formula('D' + r1, 'IF(COUNT(' + rngK + ')=0,0,$C$' + r1 + '/COUNT(' + rngK + '))', res.porSocio, FMT_SOLES).font = { bold: true, size: 12 };

      /* 5. Distribución de ganancias */
      var d0 = r0 + 3;
      cab('B' + d0, 'N°'); cab('C' + d0, 'DISTRIBUCIÓN DE GANANCIAS'); cab('D' + d0, 'DESCUENTO');
      cab('E' + d0, 'MONTO FINAL'); cab('F' + d0, 'ESTADO');
      socios.forEach(function (s, i) {
        var r = d0 + 1 + i, k = soc1 + i, d = res.distribucion[i];
        formula('B' + r, 'K' + k, i + 1);
        formula('C' + r, 'L' + k, s.nombre || '').alignment = { horizontal: 'left' };
        formula('D' + r, 'M' + k, d.descuento, FMT_SOLES);
        formula('E' + r, '$D$' + r1 + '-D' + r, d.montoFinal, FMT_SOLES).font = { bold: true };
        formula('F' + r, 'IF(E' + r + '<-0.005,"DEBE DEVOLVER",IF(E' + r + '>0.005,"SE LE DEBE PAGAR","SALDADO"))', d.estado.toUpperCase());
      });
      if (socios.length) {
        ws.addConditionalFormatting({
          ref: 'F' + (d0 + 1) + ':F' + (d0 + socios.length),
          rules: [{ type: 'containsText', operator: 'containsText', text: 'DEBE DEVOLVER', priority: 1,
            style: { font: { color: { argb: 'FFC00000' }, bold: true } } }]
        });
      }

      /* 6. Hoja "Por boletero" */
      if (grupos.length) {
        var wb2 = wb.addWorksheet('Por boletero');
        [['A', 3], ['B', 5.89], ['C', 27.33], ['D', 14], ['E', 13], ['F', 14], ['G', 14], ['H', 11], ['I', 14.22]]
          .forEach(function (w) { wb2.getColumn(w[0]).width = w[1]; });
        var cab2 = function (ref, texto) {
          var c = wb2.getCell(ref);
          c.value = texto; c.fill = AZUL; c.border = BORDE;
          c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        };
        var cel2 = function (ref, v, fmt, centro) {
          var c = wb2.getCell(ref);
          c.value = v; c.border = BORDE;
          if (fmt) c.numFmt = fmt;
          if (centro) c.alignment = { horizontal: 'center' };
          return c;
        };
        var t1 = wb2.getCell('C1');
        t1.value = 'RECAUDADO POR BOLETERO'; t1.fill = AMARILLO; t1.font = { bold: true };
        wb2.mergeCells('D1:G1');
        wb2.getCell('D1').value = lot.lugar || '';
        wb2.getCell('D1').font = { bold: true, size: 12 };

        var rO = '\'Hoja1\'!$O$' + s1 + ':$O$' + sN, rG = '\'Hoja1\'!$G$' + s1 + ':$G$' + sN, rH = '\'Hoja1\'!$H$' + s1 + ':$H$' + sN;
        cab2('B3', 'N°'); cab2('C3', 'BOLETERO / PERSONAL'); cab2('D3', 'SEPARACIONES');
        cab2('E3', 'YAPE'); cab2('F3', 'EFECTIVO'); cab2('G3', 'TOTAL RECAUDADO');
        grupos.forEach(function (g, i) {
          var r = 4 + i, crit = 'C' + r;
          cel2('B' + r, i + 1, null, true);
          cel2('C' + r, g.nombre);
          cel2('D' + r, { formula: 'COUNTIF(' + rO + ',' + crit + ')', result: g.n }, '0', true);
          cel2('E' + r, { formula: 'SUMIFS(' + rG + ',' + rO + ',' + crit + ',' + rH + ',"YAPE")', result: g.yape }, FMT_SOLES);
          cel2('F' + r, { formula: 'SUMIFS(' + rG + ',' + rO + ',' + crit + ',' + rH + ',"EFECTIVO")', result: g.efectivo }, FMT_SOLES);
          cel2('G' + r, { formula: 'SUMIF(' + rO + ',' + crit + ',' + rG + ')', result: g.total }, FMT_SOLES).font = { bold: true };
        });
        var rt = 4 + grupos.length, r1b = 4, rNb = rt - 1;
        var sumG = grupos.reduce(function (a, g) { return { n: a.n + g.n, y: a.y + g.yape, e: a.e + g.efectivo, t: a.t + g.total }; }, { n: 0, y: 0, e: 0, t: 0 });
        cab2('C' + rt, 'TOTAL=');
        ['D', 'E', 'F', 'G'].forEach(function (col, k) {
          var c = cel2(col + rt, { formula: 'SUM(' + col + r1b + ':' + col + rNb + ')', result: [sumG.n, sumG.y, sumG.e, sumG.t][k] }, k ? FMT_SOLES : '0', true);
          c.fill = AZUL; c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });

        // Detalle: la misma lista de separaciones, separada por boletero
        var fila = rt + 3;
        grupos.forEach(function (g) {
          var tg = wb2.getCell('C' + fila);
          tg.value = g.nombre.toUpperCase(); tg.font = { bold: true, size: 12 };
          fila++;
          cab2('B' + fila, 'N°'); cab2('C' + fila, 'CLIENTE'); cab2('D' + fila, 'MANZANA'); cab2('E' + fila, 'LOTES');
          cab2('F' + fila, 'N° CELULAR'); cab2('G' + fila, 'ADELANTO'); cab2('H' + fila, 'OPCION'); cab2('I' + fila, 'DIA DE FIRMA');
          var desde = fila + 1;
          var idxs = g.indices.filter(function (i) { return window.Calc.sepConDatos(lot.separaciones[i]); });
          idxs.forEach(function (idx, j) {
            var sp = lot.separaciones[idx], r = desde + j, f = null;
            if (sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha)) { var p = sp.fecha.split('-'); f = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
            cel2('B' + r, j + 1, null, true);
            cel2('C' + r, sp.cliente || '');
            cel2('D' + r, sp.manzana || '', null, true);
            cel2('E' + r, sp.lotes || '', null, true);
            cel2('F' + r, sp.celular || '', null, true);
            cel2('G' + r, vacio(sp.adelanto) ? null : n(sp.adelanto), FMT_SOLES);
            cel2('H' + r, sp.opcion ? sp.opcion.toUpperCase() : '', null, true);
            cel2('I' + r, f, FMT_FECHA, true);
          });
          var hasta = desde + idxs.length - 1, rtot = hasta + 1;
          cab2('F' + rtot, 'TOTAL=');
          var ct = cel2('G' + rtot, { formula: 'SUM(G' + desde + ':G' + hasta + ')', result: g.total }, FMT_SOLES, true);
          ct.fill = AZUL; ct.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          fila = rtot + 3;
        });
        wb2.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      }

      ws.views = [{ showGridLines: true }];
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

      return wb.xlsx.writeBuffer().then(function (buf) {
        return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      });
    });
  }

  /* ---------------- Importar ---------------- */
  function norm(v) {
    return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
  }
  function valor(cell) {
    var v = cell ? cell.value : null;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('result' in v) v = v.result;
      else if ('formula' in v || 'sharedFormula' in v) v = null;
      else if (v.richText) v = v.richText.map(function (t) { return t.text; }).join('');
      else if ('text' in v) v = v.text;
      else if (v.error) v = null;
    }
    return v;
  }
  function texto(cell) {
    var v = valor(cell);
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).trim();
  }
  function fechaISO(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) {
      return v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0');
    }
    if (typeof v === 'number' && v > 20000 && v < 80000) { // número de serie de Excel
      return fechaISO(new Date(Math.round((v - 25569) * 86400000)));
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      return y + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return '';
  }
  function montoStr(v, limpiar) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return isFinite(v) && v > 0 ? String(Math.round(v * 100) / 100) : (v === 0 ? '0' : '');
    var s = limpiar(String(v));
    return s && isFinite(parseFloat(s)) ? s : '';
  }

  function importar(file, h) {
    return cargarExcelJS().then(function (ExcelJS) {
      return file.arrayBuffer().then(function (buf) {
        var wb = new ExcelJS.Workbook();
        return wb.xlsx.load(buf).then(function () { return wb; });
      });
    }).then(function (wb) {
      var ws = wb.getWorksheet('Hoja1') || wb.worksheets[0];
      if (!ws) throw { userMessage: 'El Excel no tiene hojas' };
      var maxR = Math.min(ws.rowCount || 0, 2000), maxC = Math.min(Math.max(ws.columnCount || 0, 13), 40);
      var at = function (r, c) { return ws.getRow(r).getCell(c); };

      function buscar(pred) {
        for (var r = 1; r <= maxR; r++) for (var c = 1; c <= maxC; c++) {
          var t = norm(texto(at(r, c)));
          if (t && pred(t)) return { r: r, c: c };
        }
        return null;
      }
      function columnas(r, desde, mapa) {
        var out = {};
        for (var c = desde; c <= maxC; c++) {
          var t = norm(texto(at(r, c)));
          if (!t) continue;
          Object.keys(mapa).forEach(function (k) { if (out[k] == null && mapa[k](t)) out[k] = c; });
        }
        return out;
      }
      function esTotal(r, c1, c2) {
        for (var c = c1; c <= c2; c++) if (/^TOTAL\b/.test(norm(texto(at(r, c))))) return true;
        return false;
      }

      var datos = { lugar: '', separaciones: [], gastos: [], socios: [], autoYape: false };

      /* Lugar */
      var pl = buscar(function (t) { return t.indexOf('LUGAR DE LOTIZACION') === 0; });
      if (pl) {
        var resto = texto(at(pl.r, pl.c)).split(':').slice(1).join(':').trim();
        if (resto) datos.lugar = resto;
        else for (var c = pl.c + 1; c <= pl.c + 8; c++) { var tl = texto(at(pl.r, c)); if (tl) { datos.lugar = tl; break; } }
      }

      /* Separaciones */
      var ps = buscar(function (t) { return t === 'LISTA DE SEPARACIONES'; });
      if (!ps) throw { userMessage: 'No se encontró la tabla "LISTA DE SEPARACIONES". ¿Es un Excel con el formato de cuentas?' };
      var cs = columnas(ps.r, ps.c + 1, {
        manzana: function (t) { return t.indexOf('MANZANA') === 0; },
        lotes: function (t) { return t.indexOf('LOTE') === 0; },
        celular: function (t) { return t.indexOf('CELULAR') >= 0; },
        adelanto: function (t) { return t.indexOf('ADELANTO') === 0; },
        opcion: function (t) { return t.indexOf('OPCION') === 0; },
        fecha: function (t) { return t.indexOf('FIRMA') >= 0 || t.indexOf('FECHA') >= 0; },
        recibido: function (t) { return t.indexOf('RECIBIDO') === 0; },
        boletero: function (t) { return t.indexOf('BOLETER') === 0 || t.indexOf('PERSONAL QUE SEPARO') === 0; },
        socio: function (t) { return t === 'SOCIO'; }
      });
      var c0 = ps.c;
      if (cs.manzana == null) cs.manzana = c0 + 1;
      if (cs.lotes == null) cs.lotes = c0 + 2;
      if (cs.celular == null) cs.celular = c0 + 3;
      if (cs.adelanto == null) cs.adelanto = c0 + 4;
      if (cs.opcion == null) cs.opcion = c0 + 5;
      if (cs.fecha == null) cs.fecha = c0 + 6;
      var ultimaSep = Math.max(cs.fecha, cs.recibido || 0, cs.opcion);
      var recibidoNombres = [];
      for (var r = ps.r + 1; r <= maxR; r++) {
        if (esTotal(r, c0 - 1, ultimaSep)) break;
        var s = h.nuevaSep();
        s.cliente = texto(at(r, c0));
        s.manzana = texto(at(r, cs.manzana));
        s.lotes = texto(at(r, cs.lotes));
        s.celular = texto(at(r, cs.celular));
        s.adelanto = montoStr(valor(at(r, cs.adelanto)), h.limpiarMonto);
        var op = norm(texto(at(r, cs.opcion)));
        s.opcion = op.indexOf('YAPE') >= 0 ? 'Yape' : (op.indexOf('EFECT') >= 0 ? 'Efectivo' : '');
        s.fecha = fechaISO(valor(at(r, cs.fecha)));
        var rec = cs.recibido ? texto(at(r, cs.recibido)) : '';
        s.boletero = cs.boletero ? texto(at(r, cs.boletero)) : '';
        if (!(s.cliente || s.manzana || s.lotes || s.celular || s.adelanto)) {
          // fila vacía: si hay varias seguidas, se terminó la tabla
          var siguienteVacia = !texto(at(r + 1, c0)) && !texto(at(r + 1, cs.adelanto));
          if (siguienteVacia && !esTotal(r + 1, c0 - 1, ultimaSep)) break;
          continue;
        }
        datos.separaciones.push(s);
        recibidoNombres.push(rec);
      }

      /* Socios */
      var pso = cs.socio ? { r: ps.r, c: cs.socio } : buscar(function (t) { return t === 'SOCIO'; });
      var formulasYape = [];
      if (pso) {
        var cy = columnas(pso.r, pso.c + 1, { yape: function (t) { return t.indexOf('YAPE') === 0; } }).yape || pso.c + 1;
        for (var r2 = pso.r + 1; r2 <= maxR; r2++) {
          var nombre = texto(at(r2, pso.c));
          var nro = texto(at(r2, pso.c - 1));
          var yv = valor(at(r2, cy));
          if (!nombre && !nro && (yv == null || yv === '')) break;
          var so = h.nuevoSocio(nombre);
          so.yape = montoStr(yv, h.limpiarMonto);
          so.yapeManual = false;
          var raw = at(r2, cy).value;
          formulasYape.push(!!(raw && typeof raw === 'object' && /SUMIF/i.test(raw.formula || '')));
          datos.socios.push(so);
        }
      }

      /* Recibido por (si el Excel lo trae) */
      if (cs.recibido && recibidoNombres.some(Boolean)) {
        datos.autoYape = true;
        var porNombre = {};
        datos.socios.forEach(function (so) { porNombre[norm(so.nombre)] = so.id; });
        datos.separaciones.forEach(function (s, i) { s.recibidoPor = porNombre[norm(recibidoNombres[i])] || ''; });
        // Yape escrito a mano (no fórmula) en un Excel con "RECIBIDO POR" = monto sobrescrito
        datos.socios.forEach(function (so, i) {
          if (formulasYape[i]) { so.yapeManual = false; so.yape = ''; }
          else so.yapeManual = so.yape !== '';
        });
      }

      /* Gastos */
      var pg = buscar(function (t) { return t === 'GASTOS'; });
      if (pg) {
        var cg = columnas(pg.r, pg.c + 1, {
          costo: function (t) { return t.indexOf('COSTO') === 0; },
          unit: function (t) { return t.indexOf('UNIT') >= 0; },
          cant: function (t) { return t.indexOf('CANTIDAD') === 0; }
        });
        if (cg.costo == null) cg.costo = pg.c + 1;
        for (var r3 = pg.r + 1; r3 <= maxR; r3++) {
          if (esTotal(r3, pg.c - 1, cg.costo)) break;
          var concepto = texto(at(r3, pg.c));
          var costo = valor(at(r3, cg.costo));
          var unit = cg.unit ? valor(at(r3, cg.unit)) : null;
          var cant = cg.cant ? valor(at(r3, cg.cant)) : null;
          var costoTxt = typeof costo === 'number' ? montoStr(costo, h.limpiarMonto) : '';
          if (!concepto && !costoTxt && unit == null) {
            if (!texto(at(r3 + 1, pg.c)) && !esTotal(r3 + 1, pg.c - 1, cg.costo)) break;
            continue;
          }
          var g;
          if (typeof unit === 'number' && typeof cant === 'number') {
            g = h.nuevoGasto(concepto, 'personal');
            g.precioUnit = montoStr(unit, h.limpiarMonto);
            g.cantidad = String(Math.max(0, Math.round(cant)));
          } else if (/^PERSONAL\b/.test(norm(concepto))) {
            g = h.nuevoGasto(concepto, 'personal');
            if (costoTxt) { g.precioUnit = costoTxt; g.cantidad = '1'; }
          } else {
            g = h.nuevoGasto(concepto, 'fijo');
            g.monto = costoTxt;
          }
          // limpiar notas largas del formato original, p. ej. "PERSONAL (SEGÚN EL NUMERO ...)"
          g.concepto = g.concepto.replace(/\s*\(SEG[UÚ]N[^)]*\)\s*$/i, '').trim();
          datos.gastos.push(g);
        }
      }
      return datos;
    });
  }

  window.LotiExcel = { exportar: exportar, importar: importar, cargar: cargarExcelJS };
})();
