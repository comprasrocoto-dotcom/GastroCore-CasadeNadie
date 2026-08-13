'use client';
/** v11.3 — PDF DE OBRA, edición de la mesa: banda con acento, TARJETAS de
 *  resumen (no línea gris), columna Cant. real (la merma visible), fila
 *  TOTAL, decimales inteligentes y pie tipográfico. Un componente para
 *  recetas (azul) y subrecetas (ámbar), alimentado por /api/exportacion. */
import { useState } from 'react';

type Linea = { item: string; tipo: string; cantidad: number; unidad: string; merma_pct: number; costo_unitario: number; costo_linea: number };
type Item = { id: string; nombre: string; referencia: string; familia?: string; rendimiento: number; unidad_rendimiento?: string; costo_total: number; costo_unitario?: number; food_cost?: number; precio_real?: number; ingredientes: Linea[]; ficha: { preparacion: string; uso: string; notas: string } | null };

const entero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const fino = (n: number) => (Math.abs(n) > 0 && Math.abs(n) < 100 ? '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : entero(n));

export function BotonPDF({ id, tipo }: { id: string; tipo: 'receta' | 'subreceta' }) {
  const [trabajando, setTrabajando] = useState(false);

  async function descargar() {
    if (trabajando) return;
    setTrabajando(true);
    try {
      const r = await fetch('/api/exportacion', { cache: 'no-store' }).then((x) => x.json());
      if (!r.ok) throw new Error('No se pudo leer la información');
      const it: Item | undefined = (tipo === 'receta' ? r.data.recetas : r.data.subrecetas).find((x: Item) => String(x.id) === String(id));
      if (!it) throw new Error('No se encontró la preparación');
      const negocio: string = r.data.negocio || 'GastroCore';

      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const esSub = tipo === 'subreceta';
      const color: [number, number, number] = esSub ? [180, 83, 9] : [30, 58, 95];
      const acento: [number, number, number] = esSub ? [251, 191, 36] : [96, 165, 250];
      const tinta: [number, number, number] = [15, 23, 42];
      const gris: [number, number, number] = [100, 116, 139];

      // ═══ banda de título con acento ═══
      doc.setFillColor(...color);
      doc.rect(0, 0, 210, 27, 'F');
      doc.setFillColor(...acento);
      doc.rect(0, 27, 210, 1.4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      const nombreLineas = doc.splitTextToSize(it.nombre, 148);
      doc.setFontSize(nombreLineas.length > 1 ? 13 : 16);
      doc.text(nombreLineas.slice(0, 2), 14, nombreLineas.length > 1 ? 11 : 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text([it.referencia, it.familia, esSub ? 'SUBRECETA' : 'RECETA'].filter(Boolean).join('    ·    '), 14, 22.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(negocio, 196, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }), 196, 17, { align: 'right' });

      // ═══ tarjetas de resumen ═══
      const tarjetas: [string, string][] = esSub
        ? [['RINDE', `${it.rendimiento.toLocaleString('es-CO')} ${it.unidad_rendimiento || ''}`],
           ['COSTO TOTAL', entero(it.costo_total)],
           [`COSTO / ${(it.unidad_rendimiento || 'UNIDAD').toUpperCase()}`, fino(it.costo_unitario || 0)],
           ['INGREDIENTES', String(it.ingredientes.length)]]
        : [['PORCIONES', String(it.rendimiento)],
           ['COSTO DEL PLATO', entero(it.costo_total)],
           ['PRECIO REAL', it.precio_real ? entero(it.precio_real) : '—'],
           ['FOOD COST', it.food_cost ? (it.food_cost * 100).toFixed(1) + '%' : '—']];
      const cw = 44, gap = 2.4, x0 = 14, y0 = 34;
      tarjetas.forEach(([lab, val], i) => {
        const x = x0 + i * (cw + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y0, cw, 13, 1.2, 1.2, 'FD');
        doc.setTextColor(...gris);
        doc.setFontSize(6.3);
        doc.setFont('helvetica', 'bold');
        doc.text(lab, x + 3, y0 + 4.6);
        doc.setTextColor(...tinta);
        doc.setFontSize(10.5);
        doc.text(val, x + 3, y0 + 10.2);
      });

      // ═══ tabla de ingredientes (con Cant. real y TOTAL) ═══
      const cantReal = (g: Linea) => g.merma_pct ? g.cantidad / (1 - g.merma_pct / 100) : g.cantidad;
      autoTable(doc, {
        startY: 52,
        head: [['Ingrediente', 'Tipo', 'Cantidad', 'Unidad', '% Merma', 'Cant. real', 'Costo unit.', 'Costo línea']],
        body: it.ingredientes.map((g) => [g.item, g.tipo, g.cantidad.toLocaleString('es-CO'), g.unidad, g.merma_pct ? g.merma_pct + '%' : '—', cantReal(g).toLocaleString('es-CO', { maximumFractionDigits: 1 }), fino(g.costo_unitario), entero(g.costo_linea)]),
        foot: [[{ content: 'COSTO TOTAL DE LA PREPARACIÓN', colSpan: 7, styles: { halign: 'right' } }, entero(it.ingredientes.reduce((a, g) => a + (g.costo_linea || 0), 0))]],
        theme: 'plain',
        headStyles: { fillColor: color, textColor: 255, fontSize: 8, fontStyle: 'bold', cellPadding: 2.2 },
        bodyStyles: { fontSize: 8.5, textColor: tinta, cellPadding: 2 },
        footStyles: { fontSize: 9, fontStyle: 'bold', textColor: color, fillColor: [255, 255, 255], lineWidth: { top: 0.4 }, lineColor: color },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 52 }, 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
        styles: { lineColor: [226, 232, 240], lineWidth: 0.1 },
        margin: { left: 14, right: 14 },
      });

      // ═══ ficha técnica ═══
      let y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 70) + 12;
      if (it.ficha && (it.ficha.preparacion || it.ficha.uso || it.ficha.notas)) {
        const secciones: [string, string][] = [['PREPARACIÓN', it.ficha.preparacion], ['USO / MONTAJE', it.ficha.uso], ['NOTAS', it.ficha.notas]];
        secciones.filter(([, v]) => v).forEach(([titulo, texto]) => {
          const lineas = doc.splitTextToSize(texto, 178);
          if (y + lineas.length * 4.4 + 14 > 280) { doc.addPage(); y = 22; }
          doc.setFillColor(...acento);
          doc.rect(14, y - 3.2, 2, 4.4, 'F');
          doc.setTextColor(...color);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(titulo, 18.5, y);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(14, y + 2.2, 196, y + 2.2);
          y += 7.5;
          doc.setTextColor(51, 65, 85);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setLineHeightFactor(1.35);
          doc.text(lineas, 14, y);
          y += lineas.length * 4.4 + 8;
        });
      }

      // ═══ pie tipográfico ═══
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(14, 287, 196, 287);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7.2);
        doc.text(negocio + '   ·   Recetario interno — GastroCore', 14, 291.5);
        doc.text('Página ' + p + ' de ' + total, 196, 291.5, { align: 'right' });
      }
      doc.save(it.nombre.replace(/[\\/:*?"<>|]/g, '') + '.pdf');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo generar el PDF');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <button onClick={descargar} disabled={trabajando} className="btn-secondary no-imprimir disabled:opacity-50" title="Descargar esta preparación en PDF">
      {trabajando ? 'Generando…' : '⬇️ PDF'}
    </button>
  );
}
