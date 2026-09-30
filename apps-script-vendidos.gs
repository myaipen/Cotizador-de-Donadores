/**
 * Inventario compartido de ventas · Cotizador de Bancos FI
 * Pegar en: Google Sheet → Extensiones → Apps Script → reemplazar Código.gs
 * Implementar como App web (Ejecutar como: Yo · Acceso: Cualquier usuario).
 */
const HOJA = 'Vendidos';
const COLS = ['id', 'fecha', 'banco', 'donante', 'cantidad', 'modalidad', 'estado_muestra',
              'paciente', 'ejecutiva', 'status', 'liberado_por', 'fecha_liberacion'];
// Campos que la página puede leer. "paciente" se queda solo en la hoja (dato sensible).
const PUBLICOS = ['id', 'fecha', 'donante', 'cantidad', 'modalidad', 'estado_muestra',
                  'ejecutiva', 'status', 'liberado_por'];

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA);
  if (!sh) {
    sh = ss.insertSheet(HOJA);
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold');
  }
  return sh;
}

function filas_() {
  const v = hoja_().getDataRange().getValues();
  const h = v.shift();
  return v.filter(r => r[0]).map(r => {
    const o = {};
    h.forEach((k, i) => o[k] = r[i] instanceof Date ? r[i].toISOString() : r[i]);
    return o;
  });
}

function publico_(rows) {
  return rows.map(r => { const o = {}; PUBLICOS.forEach(k => o[k] = r[k]); return o; });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, ventas: publico_(filas_()) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    const sh = hoja_();

    if (b.action === 'vender') {
      const activas = filas_().filter(r => r.status === 'vendido');
      const errores = [];
      (b.items || []).forEach(it => {
        const usados = activas.filter(r => String(r.donante) === String(it.donante))
                              .reduce((s, r) => s + Number(r.cantidad || 0), 0);
        const quedan = Number(it.stock) - usados;
        if (Number(it.cantidad) > quedan)
          errores.push('Donante #' + it.donante + ': ' + (quedan > 0 ? 'solo quedan ' + quedan + ' óvulos' : 'ya está vendida'));
      });
      if (errores.length) return json_({ ok: false, error: errores.join('. '), ventas: publico_(filas_()) });

      (b.items || []).forEach(it => sh.appendRow([
        Utilities.getUuid(), new Date(), 'OVODONORS', it.donante, Number(it.cantidad),
        it.modalidad || '', it.estado || '', String(b.paciente || '').slice(0, 80),
        String(b.ejecutiva || '').slice(0, 60), 'vendido', '', ''
      ]));
      return json_({ ok: true, ventas: publico_(filas_()) });
    }

    if (b.action === 'liberar') {
      const v = sh.getDataRange().getValues();
      for (let i = 1; i < v.length; i++) {
        if (v[i][0] === b.id && v[i][9] === 'vendido') {
          sh.getRange(i + 1, 10, 1, 3).setValues([['liberado', String(b.ejecutiva || '').slice(0, 60), new Date()]]);
          return json_({ ok: true, ventas: publico_(filas_()) });
        }
      }
      return json_({ ok: false, error: 'No encontré esa venta (quizá ya se liberó).', ventas: publico_(filas_()) });
    }

    return json_({ ok: false, error: 'Acción no válida' });
  } catch (err) {
    return json_({ ok: false, error: 'Error en el servidor: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}
