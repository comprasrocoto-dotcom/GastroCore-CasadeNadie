'use client';
/** v11.0 — EXPORTAR A EXCEL: la relación completa, hecha obra de arte.
 *  Diseño de la mesa: portada, una hoja Recetas y una Subrecetas; cada
 *  preparación como bloque (título azul marino, líneas con cebra suave,
 *  moneda es-CO) y, si se marca el chulito, su ficha técnica en texto. */
import { useState } from 'react';
import type { CellValue } from 'exceljs';

type Linea = { item: string; tipo: string; cantidad: number; unidad: string; merma_pct: number; costo_unitario: number; costo_linea: number };
type Ficha = { preparacion: string; uso: string; notas: string } | null;
type Item = { id: string; nombre: string; referencia: string; familia?: string; rendimiento: number; unidad_rendimiento?: string; costo_total: number; costo_porcion?: number; costo_unitario?: number; food_cost?: number; precio_real?: number; activo: boolean; ingredientes: Linea[]; ficha: Ficha };

export default function ExportarPage() {
  const [conFichas, setConFichas] = useState(true);
  const [soloActivas, setSoloActivas] = useState(true);
  const [estado, setEstado] = useState<'idle' | 'trabajando' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function descargar() {
    setEstado('trabajando'); setMsg('Reuniendo la información…');
    try {
      const r = await fetch('/api/exportacion', { cache: 'no-store' }).then((x) => x.json());
      if (!r.ok) throw new Error(String(r.error || 'No se pudo leer'));
      setMsg('Dibujando el Excel…');
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'GastroCore';
      const AZUL = 'FF1E3A5F', AMBAR = 'FFB45309', CEBRA = 'FFF8FAFC', LINEA = 'FFE2E8F0';
      const money = '"$"#,##0';
      const filtrar = (xs: Item[]) => (soloActivas ? xs.filter((x) => x.activo) : xs);

      function hoja(nombre: string, items: Item[], esSub: boolean) {
        const ws = wb.addWorksheet(nombre, { views: [{ showGridLines: false }] });
        ws.columns = [{ width: 4 }, { width: 42 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 14 }];
        let fila = 1;
        items.forEach((it) => {
          // ── título del bloque ──
          ws.mergeCells(fila, 1, fila, 8);
          const t = ws.getCell(fila, 1);
          t.value = `${it.nombre}${it.referencia ? '   ·   ' + it.referencia : ''}${it.familia ? '   ·   ' + it.familia : ''}`;
          t.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
          t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: esSub ? AMBAR : AZUL } };
          t.alignment = { vertical: 'middle', indent: 1 };
          ws.getRow(fila).height = 22;
          fila++;
          // ── resumen ──
          ws.mergeCells(fila, 1, fila, 8);
          const s = ws.getCell(fila, 1);
          s.value = esSub
            ? `Rinde ${it.rendimiento.toLocaleString('es-CO')} ${it.unidad_rendimiento || ''}   ·   Costo total $${Math.round(it.costo_total).toLocaleString('es-CO')}   ·   Costo por ${it.unidad_rendimiento || 'unidad'} $${(it.costo_unitario || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`
            : `${it.rendimiento} porción(es)   ·   Costo del plato $${Math.round(it.costo_total).toLocaleString('es-CO')}   ·   Precio real ${it.precio_real ? '$' + it.precio_real.toLocaleString('es-CO') : 'sin precio'}   ·   Food Cost ${it.food_cost ? (it.food_cost * 100).toFixed(1) + '%' : '—'}`;
          s.font = { color: { argb: 'FF64748B' }, size: 9 };
          s.alignment = { indent: 1 };
          fila++;
          // ── cabecera de ingredientes ──
          const cab = ['', 'Ingrediente', 'Tipo', 'Cantidad', 'Unidad', '% Merma', 'Costo unit.', 'Costo línea'];
          cab.forEach((c, j) => {
            const cell = ws.getCell(fila, j + 1);
            cell.value = c;
            cell.font = { bold: true, size: 9, color: { argb: 'FF334155' } };
            cell.border = { bottom: { style: 'medium', color: { argb: esSub ? AMBAR : AZUL } } };
          });
          fila++;
          // ── líneas con cebra ──
          it.ingredientes.forEach((g, k) => {
            const vals = ['', g.item, g.tipo, g.cantidad, g.unidad, g.merma_pct ? g.merma_pct + '%' : '', g.costo_unitario, g.costo_linea];
            vals.forEach((v, j) => {
              const cell = ws.getCell(fila, j + 1);
              cell.value = v as CellValue;
              cell.font = { size: 10 };
              if (k % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CEBRA } };
              if (j >= 6) { cell.numFmt = money; cell.alignment = { horizontal: 'right' }; }
              if (j === 3) cell.alignment = { horizontal: 'right' };
              cell.border = { bottom: { style: 'hair', color: { argb: LINEA } } };
            });
            fila++;
          });
          // ── ficha técnica (el chulito) ──
          if (conFichas && it.ficha && (it.ficha.preparacion || it.ficha.uso || it.ficha.notas)) {
            const secciones: [string, string][] = [['PREPARACIÓN', it.ficha.preparacion], ['USO / MONTAJE', it.ficha.uso], ['NOTAS', it.ficha.notas]];
            secciones.filter(([, v]) => v).forEach(([tit, texto]) => {
              ws.mergeCells(fila, 2, fila, 8);
              const c1 = ws.getCell(fila, 2);
              c1.value = tit;
              c1.font = { bold: true, size: 8, color: { argb: esSub ? AMBAR : AZUL } };
              fila++;
              ws.mergeCells(fila, 2, fila, 8);
              const c2 = ws.getCell(fila, 2);
              c2.value = texto;
              c2.font = { size: 9, color: { argb: 'FF475569' } };
              c2.alignment = { wrapText: true, vertical: 'top' };
              ws.getRow(fila).height = Math.min(90, 14 * Math.ceil(texto.length / 95));
              fila++;
            });
          }
          fila += 2; // aire entre bloques
        });
      }
      // portada
      const p = wb.addWorksheet('Portada', { views: [{ showGridLines: false }] });
      p.getColumn(2).width = 60;
      p.mergeCells('B3:B3'); p.getCell('B3').value = r.data.negocio || 'GastroCore';
      p.getCell('B3').font = { bold: true, size: 22, color: { argb: AZUL } };
      p.getCell('B4').value = 'Relación completa de recetas y subrecetas';
      p.getCell('B4').font = { size: 12, color: { argb: 'FF64748B' } };
      p.getCell('B6').value = 'Generado: ' + new Date().toLocaleString('es-CO') + (conFichas ? '   ·   con fichas técnicas' : '') + (soloActivas ? '   ·   solo activas' : '');
      p.getCell('B6').font = { size: 9, color: { argb: 'FF94A3B8' } };
      hoja('Recetas', filtrar(r.data.recetas), false);
      hoja('Subrecetas', filtrar(r.data.subrecetas), true);

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `GastroCore — Recetario completo ${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      setEstado('ok'); setMsg('✓ Excel descargado — revisa tu carpeta de descargas.');
    } catch (e) {
      setEstado('error'); setMsg(e instanceof Error ? e.message : 'No se pudo generar.');
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-ink">⬇️ Exportar a Excel</h1>
      <p className="mt-1 text-sm text-salvia-600">La relación completa: cada receta y subreceta con el detalle de sus ingredientes, costos y — si quieres — sus fichas técnicas.</p>
      <div className="card mt-5 space-y-4 p-5">
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={conFichas} onChange={(e) => setConFichas(e.target.checked)} className="h-4 w-4 accent-[#1E3A5F]" />
          <span className="text-sm text-ink">Incluir <b>fichas técnicas</b> (preparación, uso y notas — solo texto)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} className="h-4 w-4 accent-[#1E3A5F]" />
          <span className="text-sm text-ink">Solo <b>activas</b> (desmárcalo para incluir las desactivadas)</span>
        </label>
        <button onClick={descargar} disabled={estado === 'trabajando'} className="btn-primary w-full disabled:opacity-50">
          {estado === 'trabajando' ? msg : '⬇️ Descargar Excel'}
        </button>
        {estado === 'ok' && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        {estado === 'error' && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
      </div>
      <p className="mt-4 text-xs text-salvia-500">💡 Para el PDF de una preparación: entra a su detalle y usa el botón <b>⬇️ PDF</b> — se imprime limpia, sin botones ni menús.</p>
    </main>
  );
}
