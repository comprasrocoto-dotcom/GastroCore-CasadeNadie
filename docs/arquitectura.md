# GastroCore — Arquitectura técnica (v10.14)

## 1. El flujo de datos

**Sheets es la única fuente de verdad**. Apps Script expone una API HTTP (`doPost`) con un router por recurso: `insumos`, `recetas`, `subrecetas`, `familias`, `fichas`, `recetario`, `analytics`, `parametros`, `usuarios`, `historial`, `snapshots`. El router normaliza recurso y acción a minúsculas antes de resolverlos. Cada controller implementa `list / getById / create / update / setActivo` (+ acciones propias como `actualizarinsumo` del puente o `restaurar` de snapshots).

## 2. Costeo (gross-up)

- **Merma divide:** cantidad real = cantidad ÷ (1 − merma%). Servir 100 g con 10% de merma cuesta como 111 g.
- **Desvío multiplica** el costo de ingredientes.
- **Precio sugerido** = (costo porción ÷ FC objetivo) × (1 + impuesto). FC objetivo global con excepciones por familia (`FC_POR_FAMILIA` en Configuración).
- Guardar parámetros con cambios ejecuta `recalcularTodo()` y sincroniza `margen_objetivo` en las 86+ recetas.

## 3. Subrecetas: maestro-calculadora (v9.0 → v10)

Toda preparación vive en **Insumos** como artículo `SUB.` — la subreceta (hoja `SubRecetas`) es su **calculadora**: ingredientes (en `IngredientesReceta`, columna `subreceta_id`) + rendimiento → `costo_unitario`. **EL PUENTE** (`actualizarinsumo`) empuja ese costo al insumo maestro con: registro en `PreciosHistoricos` ("Actualizado desde subreceta X"), y recálculo en cascada de las recetas que lo usan. Desde v9.11 el puente es un **botón consciente** dentro de la subreceta (sin pregunta al guardar). Las fichas técnicas de subrecetas comparten la hoja `FichaTecnica` (`receta_id = SUBR-…`), sin foto por diseño.

## 4. Recetario público

`construirRecetario_()` arma el agregado: recetas activas por familia (con `centro_costo` de la familia) + subrecetas activas bajo la categoría **`SUB. RECETAS`** (ingredientes indexados por `subreceta_id`, `foto_url` forzada vacía, sin precios). El **estilo** (`RECETARIO_TEMA` en Configuración, lista blanca de 6 ids) viaja en `parametros` y se aplica en `lib/temasRecetario.ts` → banda con degradado, fondo, títulos, bordes y placeholder.

## 5. Las tres capas de caché

1. **Backend (CacheService):** el recetario y catálogos se cachean por `CACHE_VER`; toda escritura vía `Repo_` incrementa la versión → invalidación automática.
2. **Datos en Vercel:** `unstable_cache` con etiquetas globales y por recurso. Guardar ejecuta `revalidateTag(tag, { expire: 0 })` después de confirmar la escritura.
3. **TTL en memoria** (`lib/api/gastrocore.ts`): lecturas con TTL por recurso y *stale-while-revalidate*; cada mutación purga un superconjunto seguro de recursos afectados, y una entidad desconocida purga todo.
Las páginas del recetario usan `dynamic = 'force-dynamic'`: render por petición sobre datos cacheados — tras una purga, el primer refresco ya trae lo nuevo.

## 6. Seguridad y auditoría

- Token de API solo en el servidor (nunca en el cliente); rotación desde Configuración (se muestra una vez). Apps Script falla cerrado si `API_TOKEN` no está configurado.
- Las sesiones HMAC fallan cerradas si `AUTH_SECRET` tiene menos de 32 caracteres. Las claves nuevas/cambiadas exigen 10 caracteres y el backend limita intentos fallidos de login durante 15 minutos.
- Roles servidor: Admin (todo) / Chef (recetas, subrecetas, fichas, fotos, puente) / Lector (solo ver).
- `HistorialRecetas` con snapshot JSON completo por versión → diff y **restaurar**. `SnapshotsSemanales` (trigger lunes 6 AM, instalar a mano) alimenta la evolución del Análisis.
- Fechas como texto `yyyy-MM-dd` (apóstrofo) donde aplica; `LockService` en escrituras.

## 7. Lecciones de guerra (para el mantenedor)

- Parches por reemplazo **siempre con asserts** — un replace que no encuentra su ancla falla en silencio.
- El código es **posicional**: renombrar cabeceras ok, mover columnas jamás.
- `/recetas` y los editores son client components: `curl` no ejecuta JS.
- El detalle del recetario vive en `DetalleReceta` (el modal es solo el marco).
- El fósil `getSubreceta→getReceta` durmió desde v9.0 hasta la primera subreceta real: **los bugs dormidos despiertan cuando el sistema se usa.**
