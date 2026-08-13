import { NextRequest, NextResponse } from 'next/server';
import { getReceta, getFamilias, getParametros } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

function money(n: number) {
  return '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
}
function esc(s: unknown) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
    const usuario = req.nextUrl.searchParams.get('usuario') || 'Sistema';

    const [receta, fams, par] = await Promise.all([getReceta(id), getFamilias(), getParametros().catch(() => null)]);
    if (!receta) return NextResponse.json({ ok: false, error: 'Receta no encontrada' }, { status: 404 });

    const fam = fams.find((f) => String(f.id) === String((receta as { familia_id?: string }).familia_id)); // v9.4

    const ings = (receta.ingredientes || []).slice().sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
    const costoIngredientes = ings.reduce((s, x) => s + (Number(x.costo_linea) || 0), 0);
    const rend = Number(receta.rendimiento) || 1;
    const desvioPct = Number(receta.desvio_pct) || 0;
    const desvio = costoIngredientes * (desvioPct / 100);
    const costoTotal = Number(receta.costo_total) || (costoIngredientes + desvio);
    const costoPorcion = Number(receta.costo_porcion) || (costoTotal / rend);
    const mo = Number(receta.margen_objetivo) || 0;
    const fcObj = mo > 1 ? mo / 100 : mo;
    const iva = 8;
    const precioBase = fcObj > 0 ? costoPorcion / fcObj : 0;
    const precioSugerido = precioBase * (1 + iva / 100);
    const precioReal = Number(receta.precio_real) || 0;
    const precioRealBase = precioReal > 0 ? precioReal / (1 + iva / 100) : 0;
    const foodCostReal = precioRealBase > 0 ? (costoPorcion / precioRealBase) : 0;
    const utilidad = precioRealBase - costoPorcion;
    const margenBruto = precioRealBase > 0 ? (utilidad / precioRealBase) * 100 : 0;

    const fcPct = foodCostReal * 100;
    let sem = { color: '#16a34a', label: 'Verde - Optimo' };
    if (fcPct > 35) sem = { color: '#dc2626', label: 'Rojo - Fuera de objetivo' };
    else if (fcPct > 30) sem = { color: '#d97706', label: 'Amarillo - En alerta' };

    const versiones = (receta.historial || []).filter((h) => h.snapshot && h.version);
    const version = versiones.length ? Math.max(...versiones.map((h) => Number(h.version) || 0)) : 1;

    const fecha = (s?: string) => {
      if (!s) return '-';
      const d = new Date(s);
      return isNaN(d.getTime()) ? String(s) : d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
    };
    const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

    const filas = ings.map((x) => {
      const cant = Number(x.cantidad) || 0;
      const merma = Number(x.merma_pct) || 0;
      // v7.2: cantidad bruta por gross-up, consistente con el costeo
      const cantReal = cant / (1 - Math.min(Math.max(merma, 0), 94.9) / 100);
      return '<tr>' +
        '<td>' + esc(x.nombre_item || x.item_id) + '</td>' +
        '<td>' + esc(x.unidad_id || '') + '</td>' +
        '<td class="r">' + cant.toLocaleString('es-CO') + '</td>' +
        '<td class="r">' + merma.toFixed(1) + '%</td>' +
        '<td class="r">' + cantReal.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '</td>' +
        '<td class="r">' + money(Number(x.costo_unitario) || 0) + '</td>' +
        '<td class="r">' + money(Number(x.costo_linea) || 0) + '</td>' +
        '</tr>';
    }).join('');

    const row = (l: string, v: string, strong?: boolean) =>
      '<tr' + (strong ? ' class="tot"' : '') + '><td>' + esc(l) + '</td><td class="r">' + esc(v) + '</td></tr>';

    const html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Receta ' + esc(receta.nombre) + '</title>' +
      '<style>' +
      '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0F172A;margin:0;padding:32px;font-size:12px}' +
      '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1E3A5F;padding-bottom:12px;margin-bottom:16px}' +
      '.logo{width:56px;height:56px;border-radius:8px;background:#1E3A5F;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:20px;margin-right:12px}' +
      '.brand{display:flex;align-items:center}.rest{font-size:13px;color:#64748B;font-weight:bold}' +
      'h1{font-size:20px;margin:2px 0;color:#1E3A5F}.meta{text-align:right;font-size:11px;color:#64748B;line-height:1.5}' +
      '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}' +
      '.cell{border:1px solid #E2E8F0;border-radius:6px;padding:8px}.cell .k{font-size:9px;text-transform:uppercase;color:#94A3B8;letter-spacing:.5px}.cell .v{font-size:12px;font-weight:bold;margin-top:2px}' +
      'h2{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#64748B;border-bottom:1px solid #E2E8F0;padding-bottom:4px;margin:18px 0 8px}' +
      'table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #F1F5F9;text-align:left}th{background:#F8FAFC;font-size:10px;text-transform:uppercase;color:#64748B}' +
      '.r{text-align:right;font-variant-numeric:tabular-nums}' +
      '.two{display:grid;grid-template-columns:1.3fr 1fr;gap:20px}' +
      '.tot td{font-weight:bold;border-top:2px solid #CBD5E1}' +
      '.sem{display:inline-block;padding:6px 12px;border-radius:6px;color:#fff;font-weight:bold;font-size:13px}' +
      '.notas{border:1px dashed #CBD5E1;border-radius:6px;min-height:80px;padding:10px;color:#94A3B8}' +
      '.foot{margin-top:24px;border-top:1px solid #E2E8F0;padding-top:8px;font-size:10px;color:#94A3B8;display:flex;justify-content:space-between}' +
      '@media print{body{padding:12px}.noprint{display:none}}' +
      '@page{margin:14mm;size:A4}' +
      '.btn{background:#1E3A5F;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px}' +
      '</style></head><body>' +
      '<div class="noprint" style="text-align:right;margin-bottom:10px"><button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>' +
      '<div class="hdr"><div class="brand"><div class="logo">GC</div><div><div class="rest">GastroCore &mdash; ' + esc((par && par.nombre_negocio) || 'Restaurante') + '</div>' +
      '<h1>' + esc(receta.nombre) + '</h1><div style="font-size:11px;color:#64748B">' + esc(receta.id) + ' &middot; ' + esc((fam ? fam.nombre : 'General')) + '</div></div></div>' +
      '<div class="meta">Fecha de impresion: ' + esc(ahora) + '<br>Version de la receta: v' + version + '</div></div>' +

      '<h2>Informacion general</h2><div class="grid">' +
      '<div class="cell"><div class="k">Rendimiento</div><div class="v">' + rend + ' porciones</div></div>' +
      '<div class="cell"><div class="k">Porciones</div><div class="v">' + rend + '</div></div>' +
      '<div class="cell"><div class="k">Responsable</div><div class="v">' + esc(receta.actualizado_por || receta.creado_por || 'Sistema') + '</div></div>' +
      '<div class="cell"><div class="k">Ultima modificacion</div><div class="v">' + esc(fecha(receta.actualizado_en)) + '</div></div>' +
      '</div>' +

      '<h2>Ingredientes</h2><table><thead><tr><th>Insumo</th><th>Unidad</th><th class="r">Cantidad</th><th class="r">% Merma</th><th class="r">Cantidad real</th><th class="r">Costo unitario</th><th class="r">Costo total</th></tr></thead><tbody>' + filas + '</tbody></table>' +

      '<div class="two"><div><h2>Resumen de costos</h2><table>' +
      row('Costo de ingredientes', money(costoIngredientes)) +
      row('Costo por merma', money(0)) +
      row('Desvio de mercancia (' + desvioPct + '%)', money(desvio)) +
      row('Costo total del plato', money(costoTotal), true) +
      row('Costo por porcion', money(costoPorcion), true) +
      row('Food Cost objetivo', (fcObj * 100).toFixed(2) + '%') +
      row('Precio sugerido de venta (con INC)', money(precioSugerido), true) +
      row('Precio real de venta', money(precioReal)) +
      row('Food Cost real', fcPct.toFixed(2) + '%', true) +
      row('Utilidad', money(utilidad)) +
      row('Margen bruto', margenBruto.toFixed(2) + '%') +
      row('Rentabilidad', precioReal <= 0 ? 'Sin precio' : (fcPct <= 35 ? 'Rentable' : 'Revisar precio')) +
      '</table></div><div><h2>Indicador de Food Cost</h2>' +
      '<p><span class="sem" style="background:' + sem.color + '">' + esc(sem.label) + ' &middot; ' + fcPct.toFixed(2) + '%</span></p>' +
      '<p style="font-size:10px;color:#94A3B8">Verde: hasta 30% &middot; Amarillo: 30% a 35% &middot; Rojo: superior a 35%.</p>' +
      '<h2>Observaciones</h2><div class="notas">Espacio para notas, instrucciones de preparacion o recomendaciones.</div>' +
      '</div></div>' +

      '<div class="foot"><span>Generado: ' + esc(ahora) + ' &middot; Usuario: ' + esc(usuario) + '</span><span>Version v' + version + ' &middot; Pagina 1</span></div>' +
      '</body></html>';

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
