/* LOTI-CUENTAS — lógica de cálculo (sin dependencias del DOM).
 * Replica las fórmulas de CUENTAS_FORMATO.xlsx:
 *   Total adelantos        = SUM(adelantos)               (G16 = SUM(G6:G15))
 *   Total gastos           = SUM(costos)                  (D24 = SUM(D19:D23))
 *   Monto total recaudado  = Total adelantos − Total gastos (C29 = G16 − D24)
 *   Monto para cada socio  = Recaudado ÷ N° de socios     (D29 = C29 / B36)
 *   Descuento (socio)      = su monto Yape                (D32 = M6)
 *   Monto final (socio)    = Monto para cada socio − Descuento (E32 = $D$29 − D32)
 */
(function (global) {
  'use strict';

  /** Convierte cualquier valor a número; vacío, texto o inválido => 0. */
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/,/g, '').replace(/[^\d.\-]/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  /** Monto no negativo (adelantos y costos no admiten negativos). */
  function pos(v) {
    var n = num(v);
    return n < 0 ? 0 : n;
  }

  function costoGasto(g) {
    if (g.tipo === 'personal') return pos(g.precioUnit) * pos(g.cantidad);
    return pos(g.monto);
  }

  function yapeAutomatico(lot, socioId) {
    var total = 0;
    (lot.separaciones || []).forEach(function (s) {
      if (s.opcion === 'Yape' && s.recibidoPor === socioId) total += pos(s.adelanto);
    });
    return total;
  }

  /** Monto Yape del socio: automático (si el interruptor está activo y no fue sobrescrito) o manual. */
  function yapeSocio(lot, socio) {
    if (lot.autoYape && !socio.yapeManual) return yapeAutomatico(lot, socio.id);
    return pos(socio.yape);
  }

  var EPS = 0.005;

  function estado(montoFinal) {
    if (montoFinal < -EPS) return 'debe devolver';
    if (montoFinal > EPS) return 'se le debe pagar';
    return 'saldado';
  }

  function calcular(lot) {
    var seps = lot.separaciones || [];
    var gastos = lot.gastos || [];
    var socios = lot.socios || [];

    var totalAdelantos = seps.reduce(function (a, s) { return a + pos(s.adelanto); }, 0);
    var costos = gastos.map(costoGasto);
    var totalGastos = costos.reduce(function (a, b) { return a + b; }, 0);
    var recaudado = totalAdelantos - totalGastos;
    var nSocios = socios.length;
    var porSocio = nSocios > 0 ? recaudado / nSocios : 0;

    var distribucion = socios.map(function (s, i) {
      var descuento = yapeSocio(lot, s);
      var final = porSocio - descuento;
      return {
        n: i + 1, id: s.id, nombre: s.nombre || '',
        descuento: descuento, montoFinal: final, estado: estado(final),
        automatico: !!(lot.autoYape && !s.yapeManual)
      };
    });

    var yapeSinAsignar = 0;
    if (lot.autoYape) {
      var ids = {};
      socios.forEach(function (s) { ids[s.id] = true; });
      seps.forEach(function (s) {
        if (s.opcion === 'Yape' && pos(s.adelanto) > 0 && !ids[s.recibidoPor]) yapeSinAsignar += pos(s.adelanto);
      });
    }

    return {
      totalAdelantos: totalAdelantos,
      costos: costos,
      totalGastos: totalGastos,
      recaudado: recaudado,
      nSocios: nSocios,
      porSocio: porSocio,
      distribucion: distribucion,
      yapeSinAsignar: yapeSinAsignar
    };
  }

  var fmtNum = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** 1234.5 => "S/ 1,234.50"; -20 => "-S/ 20.00" */
  function soles(n) {
    n = num(n);
    if (Math.abs(n) < EPS) n = 0;
    return (n < 0 ? '-' : '') + 'S/ ' + fmtNum.format(Math.abs(n));
  }

  global.Calc = {
    num: num, pos: pos, costoGasto: costoGasto, yapeAutomatico: yapeAutomatico,
    yapeSocio: yapeSocio, estado: estado, calcular: calcular, soles: soles, EPS: EPS
  };
})(typeof window !== 'undefined' ? window : this);
