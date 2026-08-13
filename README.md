# GastroCore v10.14.1

Sistema de costeo de recetas y recetario de cocina de **Restaurantes Rocoto**. Costeo en tiempo real, subrecetas con puente al maestro de insumos, recetario público con estilos por marca, y analítica de decisiones.

## Arquitectura

```
Next.js 16 (Vercel) ──POST──▶ Apps Script (Code.gs v10.14) ──▶ Google Sheets "Base de Costos"
        │                              │                              (única fuente de verdad)
   3 capas de caché            CacheService por versión         Fotos → carpeta de Drive
```

- El frontend **nunca** toca el Sheet: todo pasa por la API de Apps Script con token (solo en el servidor de Vercel).
- Lecturas: `POST {mode:'read', resource, params}` · Escrituras: `POST {resource, action, data}`.
- Roles servidor (Admin / Chef / Lector) vía `proxy.ts` + validación en backend.

## Módulos

| Vista | Qué hace |
|---|---|
| **Insumos** | Maestro de artículos con costos, clasificaciones, carga por plano (CSV) |
| **Subrecetas** | Calculadora de preparaciones; **EL PUENTE** empuja el costo calculado al insumo maestro (historial + recálculo en cascada); ficha técnica sin foto; modo lectura al entrar |
| **Recetas** | Platos por familia directa, costeo gross-up (merma ÷, desvío ×), precio sugerido con impuesto |
| **Recetario** | Vista pública de cocina: categorías, 🏷 centros de costo, sección **SUB. RECETAS**, fichas con foto+lupa, **6 estilos de color** por proyecto |
| **Panel** | KPIs + **🔬 Lectura de experto** (dinero en la mesa, frontera del objetivo, concentración, fichas incompletas, familia despareja) |
| **Análisis** | Simulador de impacto, alertas, tops, evolución semanal, **📣 Lectura del período** |
| **Configuración** | FC objetivo (+excepciones por familia), impuesto, identidad, 🎨 estilo del recetario, respaldo, rotación de token |

## Convenciones críticas

- **Despliegue backend:** editar Code.gs → *Implementar → Nueva versión* (misma URL). El botón ▶ ejecuta la función del **desplegable**.
- **Env vars Vercel:** `GASTROCORE_API_URL`, `GASTROCORE_API_TOKEN`, `AUTH_SECRET` — cambios requieren Redeploy. `AUTH_SECRET` debe tener al menos 32 caracteres (el generador del backend produce 64 hex).
- **Runtime Vercel:** Node.js 24.x. El archivo `package.json` fija la misma rama usada para validar esta entrega.
- **Interruptores Apps Script:** `BATCHGET_OFF=false` para lecturas v4; mantener `BATCHUPDATE_OFF=true` hasta aprobar una escritura real en una copia.
- **Build de producción:** `npm run build` ejecuta TypeScript y ESLint antes de compilar. Vercel instala con `npm ci`.
- **Raíz de despliegue:** `package.json`, `package-lock.json`, `app/` y `vercel.json` deben quedar en la raíz enviada a Vercel. Este ZIP ya viene plano; no lo envuelvas en otra carpeta.
- **Posicional:** el código lee las hojas por posición de columna (ESQUEMA). Renombrar cabeceras es seguro; **mover o insertar columnas rompe todo**.
- **Caché:** backend por versión (se invalida solo al escribir) · datos en Vercel por etiquetas `['recetario']` (5 min, purgados al guardar) · toda mutación limpia el caché TTL de lecturas.

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — el detalle técnico completo.
- Manual de usuario: en la app (`/manual`), portada del sistema.
