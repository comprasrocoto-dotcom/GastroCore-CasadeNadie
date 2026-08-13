'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * CampoNumero v9.10 — el campo numérico del sistema.
 *
 * · SIN spinners (nada de flechitas arriba/abajo): texto con teclado numérico.
 * · Formato colombiano EN VIVO: miles con punto (1.000.000) y decimales con
 *   coma (0,5) mientras escribes.
 * · sufijo="%" pinta el símbolo dentro del campo, a la derecha.
 * · Emite siempre un number limpio por onCambio (coma → punto).
 */
export function CampoNumero({
  valor,
  onCambio,
  decimales = 2,
  sufijo,
  className = '',
  inputRef,
  placeholder,
}: {
  valor: number;
  onCambio: (n: number) => void;
  decimales?: number;
  sufijo?: string;
  className?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState<string>(() => formatear(valor, decimales));
  const propio = useRef<HTMLInputElement | null>(null);
  const editando = useRef(false);

  // Formatea un número al estilo es-CO sin forzar decimales de relleno.
  function formatear(n: number, dec: number): string {
    if (!isFinite(n)) return '';
    if (n === 0) return '0';
    const partes = Math.abs(n).toFixed(dec).split('.');
    const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const deci = (partes[1] || '').replace(/0+$/, '');
    return (n < 0 ? '-' : '') + entero + (deci ? ',' + deci : '');
  }

  function parsear(t: string): number {
    const limpio = t.replace(/\./g, '').replace(',', '.');
    const n = Number(limpio);
    return isFinite(n) ? n : 0;
  }

  // Si el valor cambia desde afuera (cargar datos, Reiniciar), sincronizar.
  useEffect(() => {
    if (!editando.current && parsear(texto) !== valor) {
      setTexto(formatear(valor, decimales));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function alEscribir(e: React.ChangeEvent<HTMLInputElement>) {
    // 1. sanear: solo dígitos, una coma, un signo menos inicial
    let crudo = e.target.value.replace(/[^\d,.-]/g, '');
    crudo = crudo.replace(/\./g, ''); // los puntos son formato, no dato
    const neg = crudo.startsWith('-');
    crudo = crudo.replace(/-/g, '');
    const iComa = crudo.indexOf(',');
    let entero = iComa === -1 ? crudo : crudo.slice(0, iComa);
    const deci = iComa === -1 ? '' : crudo.slice(iComa + 1).replace(/,/g, '').slice(0, decimales);
    entero = entero.replace(/^0+(?=\d)/, '');
    // 2. re-formatear miles en vivo
    const enteroFmt = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const mostrado = (neg ? '-' : '') + (enteroFmt || (iComa !== -1 ? '0' : '')) + (iComa !== -1 ? ',' + deci : '');
    setTexto(mostrado);
    onCambio(parsear(mostrado));
  }

  return (
    <span className={'relative inline-flex ' + (sufijo ? '' : '')}>
      <input
        ref={(el) => { propio.current = el; if (inputRef) inputRef(el); }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        onFocus={() => { editando.current = true; }}
        onBlur={() => { editando.current = false; setTexto(formatear(parsear(texto), decimales)); }}
        onChange={alEscribir}
        className={className + (sufijo ? ' !pr-6' : '')}
      />
      {sufijo && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-medium text-salvia-400">
          {sufijo}
        </span>
      )}
    </span>
  );
}
