# Arquitectura del Sistema — ERP de Costeo de Recetas para Restaurantes

**Versión:** 1.0 (documento de arquitectura, previo a desarrollo)
**Stack:** Next.js + React + TypeScript + TailwindCSS + Shadcn UI · Supabase (PostgreSQL, Auth, Storage) · API REST

---

## 1. Resumen ejecutivo

El objetivo es reemplazar por completo un libro de Excel de costeo de recetas con una plataforma web tipo ERP, modular y escalable. Este documento define el modelo de datos, la estructura del proyecto, los flujos de navegación, los wireframes de las pantallas clave, y un plan de desarrollo por fases con el MVP claramente delimitado.

**No se escribirá código hasta que este documento sea aprobado.**

---

## 2. Modelo de base de datos (ERD)

### 2.1 Principios de diseño

- Todo normalizado (3FN), sin duplicar costos ni nombres.
- Los costos calculados (costo total, costo por porción, food cost, etc.) **no se guardan como texto libre**: se derivan de tablas base y se persisten en columnas calculadas o se recalculan vía funciones/triggers, guardando snapshot histórico en `receta_version`.
- Toda entidad "catálogo" (familias, unidades, proveedores) tiene `activo boolean` en lugar de borrado físico, salvo el hard-delete explícito permitido por rol Administrador.
- Auditoría centralizada en una tabla `auditoria` genérica (patrón *event log*) en lugar de una tabla de historial por entidad.
- Multi-tenant ready: cada tabla incluye `organizacion_id` (aunque el MVP se use con una sola organización) para permitir SaaS multi-restaurante a futuro sin migración destructiva.

### 2.2 Entidades principales

```
organizaciones
├── id (uuid, PK)
├── nombre
├── created_at

usuarios (extiende auth.users de Supabase)
├── id (uuid, PK, FK -> auth.users.id)
├── organizacion_id (FK)
├── nombre_completo
├── rol_id (FK -> roles.id)
├── activo
├── created_at

roles
├── id (PK)
├── nombre            -- Administrador, Costos, Chef, Consulta
├── permisos (jsonb)  -- permisos granulares por módulo/acción

unidades_medida
├── id (PK)
├── organizacion_id (FK)
├── nombre            -- Kilogramo, Gramo, Litro...
├── abreviatura        -- kg, gr, lt
├── tipo               -- peso | volumen | unidad
├── es_base            -- si es la unidad base de su tipo (gr para peso, ml para volumen)
├── factor_a_base       -- ej. 1 kg = 1000 (factor hacia gr)
├── activo

proveedores
├── id (PK)
├── organizacion_id (FK)
├── nombre
├── nit
├── contacto
├── telefono
├── email
├── activo
├── created_at

familias
├── id (PK)
├── organizacion_id (FK)
├── nombre
├── tipo               -- 'insumo' | 'receta' (una familia puede aplicar a insumos o recetas)
├── orden
├── activo

subfamilias
├── id (PK)
├── familia_id (FK)
├── nombre
├── orden
├── activo

insumos
├── id (PK)
├── organizacion_id (FK)
├── codigo (unique)
├── nombre
├── descripcion
├── familia_id (FK)
├── proveedor_id (FK)
├── unidad_compra_id (FK -> unidades_medida)
├── unidad_almacen_id (FK -> unidades_medida)
├── unidad_produccion_id (FK -> unidades_medida)
├── factor_conversion         -- entre compra y producción si no son directamente convertibles
├── costo_compra              -- costo de la unidad de compra
├── costo_unidad_base         -- costo por gr o ml (calculado)
├── iva_porcentaje
├── merma_porcentaje
├── rendimiento_porcentaje
├── activo
├── observaciones
├── updated_at
├── updated_by (FK -> usuarios)

insumo_precio_historico          -- para el panel de comparación de costos
├── id (PK)
├── insumo_id (FK)
├── costo_anterior
├── costo_nuevo
├── variacion_absoluta
├── variacion_porcentual
├── fecha
├── usuario_id (FK)

recetas
├── id (PK)
├── organizacion_id (FK)
├── codigo (unique)
├── nombre
├── familia_id (FK)
├── subfamilia_id (FK, nullable)
├── descripcion
├── tiempo_preparacion_min
├── porciones
├── peso_final
├── rendimiento_porcentaje
├── estado                 -- borrador | activa | archivada
├── version_actual (int)
├── es_subreceta (boolean) -- si puede usarse como ingrediente de otra receta
├── favorito (boolean, por usuario -> tabla aparte, ver receta_favoritos)
├── food_cost_objetivo
├── margen_objetivo
├── precio_venta_sugerido
├── precio_venta_real
├── costo_total_actual        -- desnormalizado y recalculado por trigger, para lectura rápida en listados
├── costo_porcion_actual
├── food_cost_actual
├── activo
├── created_at / updated_at / updated_by

receta_ingredientes
├── id (PK)
├── receta_id (FK -> recetas)
├── tipo_ingrediente       -- 'insumo' | 'subreceta'
├── insumo_id (FK, nullable)
├── subreceta_id (FK -> recetas, nullable)
├── cantidad
├── unidad_id (FK)
├── merma_porcentaje
├── orden
├── costo_unitario_snapshot   -- costo al momento de guardar, para trazabilidad
├── costo_total_snapshot

receta_versiones
├── id (PK)
├── receta_id (FK)
├── numero_version
├── snapshot (jsonb)      -- receta + ingredientes completos en ese momento
├── costo_total
├── created_at
├── created_by (FK)
├── motivo_cambio

receta_etiquetas / etiquetas   -- tabla puente many-to-many
etiquetas
├── id (PK)
├── nombre        -- Vegano, Sin gluten, Picante...
├── color

receta_etiquetas
├── receta_id (FK)
├── etiqueta_id (FK)

receta_favoritos
├── usuario_id (FK)
├── receta_id (FK)

receta_imagenes
├── id (PK)
├── receta_id (FK)
├── storage_path (Supabase Storage)
├── orden
├── es_principal

receta_adjuntos
├── id (PK)
├── receta_id (FK)
├── tipo         -- pdf | excel | manual | foto
├── storage_path
├── nombre_archivo
├── uploaded_by / uploaded_at

auditoria (event log genérico)
├── id (PK)
├── organizacion_id (FK)
├── entidad             -- 'receta' | 'insumo' | 'familia' ...
├── entidad_id
├── accion              -- create | update | delete
├── campo
├── valor_anterior
├── valor_nuevo
├── usuario_id (FK)
├── created_at

configuracion_organizacion
├── organizacion_id (PK/FK)
├── food_cost_objetivo_default
├── margen_objetivo_default
├── iva_default
├── costo_operativo_porcentaje
├── comision_plataformas_porcentaje
├── descuento_promedio_porcentaje
```

### 2.3 Relaciones clave

- `receta_ingredientes.subreceta_id` referencia a `recetas.id` → permite anidar recetas dentro de recetas (grafo dirigido acíclico; se valida en backend para evitar referencias circulares).
- Al actualizar `insumos.costo_compra`, un trigger recalcula `costo_unidad_base` y dispara la actualización en cascada de `receta_ingredientes.costo_unitario_snapshot` → `recetas.costo_total_actual` para todas las recetas (y subrecetas padre) que lo usan.
- `insumo_precio_historico` alimenta el "Panel de costos" (comparación anterior vs nuevo, variación %, impacto).

### 2.4 Índices y rendimiento

- Índices B-tree en `recetas(codigo)`, `insumos(codigo)`, `recetas(familia_id, subfamilia_id)`.
- Índice `GIN` con `pg_trgm` sobre `recetas.nombre` e `insumos.nombre` para búsqueda instantánea tipo "contains".
- Vistas materializadas para el Dashboard (`vw_dashboard_indicadores`), refrescadas por trigger o cron cada pocos minutos, para no recalcular agregados en cada carga.
- Row Level Security (RLS) de Supabase por `organizacion_id` y por rol.

---

## 3. Estructura de carpetas del proyecto

```
recetario-erp/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── recuperar-password/
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx              # shell con sidebar + topbar
│       │   │   ├── page.tsx                # Dashboard
│       │   │   ├── recetas/
│       │   │   │   ├── page.tsx            # listado + buscador + filtros
│       │   │   │   ├── nueva/page.tsx
│       │   │   │   └── [id]/
│       │   │   │       ├── page.tsx        # detalle/edición receta
│       │   │   │       ├── versiones/page.tsx
│       │   │   │       └── historial/page.tsx
│       │   │   ├── insumos/
│       │   │   │   ├── page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   ├── familias/
│       │   │   ├── subfamilias/
│       │   │   ├── unidades-medida/
│       │   │   ├── proveedores/
│       │   │   ├── panel-costos/
│       │   │   ├── configuracion/
│       │   │   │   ├── margenes/
│       │   │   │   └── usuarios-roles/
│       │   │   └── importar-exportar/
│       │   └── api/                        # route handlers (REST) para lógica server-side pesada
│       │       ├── recetas/
│       │       ├── insumos/
│       │       ├── costeo/                 # recálculo en cascada
│       │       └── importar/
│       ├── components/
│       │   ├── ui/                         # shadcn primitives
│       │   ├── recetas/                    # RecetaForm, IngredientesTable, RendimientoCalculator...
│       │   ├── insumos/
│       │   ├── dashboard/                  # KpiCard, AlertList, ChartCostos
│       │   └── shared/                     # DataTable, SearchBar, FilterBar, FileUploader
│       ├── lib/
│       │   ├── supabase/                   # client.ts, server.ts, middleware.ts
│       │   ├── costeo/                     # funciones puras de cálculo (conversión, food cost, etc.)
│       │   ├── validators/                 # esquemas zod
│       │   └── utils/
│       ├── hooks/                          # useRecetas, useInsumos, useCosteo...
│       ├── types/                          # tipos generados desde Supabase + tipos de dominio
│       └── styles/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── functions/                          # Edge Functions (recalculo en cascada, importaciones pesadas)
├── packages/                               # (futuro) código compartido si se separan apps (móvil, POS)
└── docs/
    └── arquitectura-erp-recetas.md         # este documento
```

**Por qué esta estructura:** separa claramente UI (`components`), lógica de dominio pura y testeable (`lib/costeo`), y acceso a datos (`lib/supabase`), lo que permite que el motor de costeo se reutilice desde Edge Functions, API routes o el cliente sin duplicar lógica — clave para que módulos futuros (inventarios, compras, POS) reutilicen el mismo motor de cálculo.

---

## 4. Flujo de navegación

```
Login (Supabase Auth)
   │
   ▼
Dashboard ──────────────────────────────────────────────┐
   │                                                     │
   ├── Recetas                                           │
   │     ├── Listado (buscar/filtrar/favoritos)          │
   │     ├── Nueva receta ─┐                              │
   │     └── Detalle receta │→ Ingredientes                │
   │             ├── Costeo automático (panel lateral)     │
   │             ├── Subrecetas (link a receta relacionada)│
   │             ├── Versiones / Historial                 │
   │             ├── Imágenes / Adjuntos                    │
   │             └── Etiquetas                               │
   │                                                          │
   ├── Insumos                                                │
   │     ├── Listado                                          │
   │     └── Detalle insumo → historial de precio              │
   │                                                             │
   ├── Familias / Subfamilias / Unidades / Proveedores (catálogos)
   │                                                             │
   ├── Panel de Costos (comparación global, alertas de variación)
   │                                                             │
   ├── Importar / Exportar (Excel, CSV, PDF)
   │                                                             │
   └── Configuración
         ├── Márgenes y Food Cost objetivo
         └── Usuarios y Roles
```

Navegación principal: **sidebar fijo** (estilo Linear/Notion) con los módulos, **topbar** con buscador global instantáneo (⌘K estilo command palette), notificaciones de alertas, y selector de organización (preparado para multi-tenant).

---

## 5. Diseño de interfaz (wireframes descriptivos)

### 5.1 Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ Topbar: [🔍 Buscar...]         [🔔 Alertas]  [Usuario ▾] │
├───────────┬─────────────────────────────────────────────┤
│ Sidebar   │  KPIs (grid de tarjetas)                     │
│ • Dash    │  [# Recetas] [# Insumos] [Costo prom.]       │
│ • Recetas │  [Recetas desactualizadas] [Pendientes]      │
│ • Insumos │                                               │
│ • Familias│  Últimas recetas modificadas (tabla compacta) │
│ • Panel$  │                                               │
│ • Config  │  Alertas de cambios de costo (lista con link) │
└───────────┴─────────────────────────────────────────────┘
```

### 5.2 Listado de recetas

```
[🔍 Buscar por código, nombre, ingrediente...]  [Filtros ▾] [+ Nueva receta]

Tabla / grid con: Imagen · Código · Nombre · Familia · Costo/porción ·
Food Cost % · Estado · ⭐ Favorito · Etiquetas
→ Click en fila abre el detalle. Vista alternable tabla/tarjetas (estilo Airtable).
```

### 5.3 Detalle de receta (pantalla central del sistema)

```
┌───────────────────────────────┬───────────────────────────┐
│ Datos generales                │  Panel de Costeo (fijo)   │
│ Código / Nombre / Familia      │  Costo ingredientes: $     │
│ Porciones / Peso final         │  Costo por porción: $      │
│ Imagen principal                │  Food Cost %: __            │
│                                  │  Precio sugerido: $          │
│ Tabla de ingredientes            │  Margen: __%                  │
│ [Insumo/Subreceta] [Cant] [Und]  │  [Editar márgenes]              │
│ [Costo unit.][Costo total][🗑]   │                                   │
│ [+ Agregar ingrediente]           │  Alertas si supera Food Cost      │
│                                     │                                  │
│ Tabs: Versiones · Historial ·      │                                  │
│ Adjuntos · Etiquetas                │                                  │
└───────────────────────────────┴───────────────────────────┘
```

El panel de costeo se recalcula en vivo (optimistic UI) al editar cantidades o insumos.

### 5.4 Panel de costos (comparativo)

```
[Filtro: rango de fechas] [Filtro: familia] [Filtro: insumo]

Tabla: Insumo | Costo anterior | Costo nuevo | Variación $ | Variación % | # Recetas afectadas
Click en fila → detalle de recetas impactadas con su nuevo food cost.
```

**Estilo visual general:** paleta neutra (grises/blancos) con un color de acento único, tipografía sans-serif (Inter), tarjetas con bordes suaves y sombra mínima, alta densidad de datos pero con buen espaciado — inspirado en Linear/Stripe Dashboard, evitando el look "genérico de admin template".

---

## 6. Plan de desarrollo por fases

### Fase 0 — Fundamentos (1 semana)
- Setup del repo, Next.js + TS + Tailwind + Shadcn.
- Proyecto Supabase, esquema inicial de auth, roles y RLS.
- CI básico, entorno de staging.

### Fase 1 — MVP (núcleo funcional real, reemplaza Excel)
**Objetivo:** que el usuario pueda dejar de usar Excel para lo esencial.
- Catálogos: Unidades de medida, Familias, Subfamilias, Proveedores.
- Insumos: CRUD completo + conversión automática de unidades + costo por gr/ml.
- Recetas: CRUD, ingredientes (solo insumos, sin subrecetas todavía), cálculo automático de costo total, costo por porción, food cost.
- Buscador básico y filtros por familia/estado.
- Dashboard con KPIs esenciales.
- Autenticación y roles básicos (Administrador / Costos / Chef / Consulta).
- Exportar receta a PDF/Excel.

### Fase 2 — Costeo avanzado
- Subrecetas (recetas dentro de recetas) con recálculo en cascada.
- Rendimientos (merma, % de rendimiento) con cálculo de costo real.
- Configuración de márgenes/food cost objetivo por organización.
- Panel de costos comparativo + historial de precios de insumo.
- Alertas automáticas (cambio de precio, pérdida de rentabilidad, food cost excedido).

### Fase 3 — Trazabilidad y colaboración
- Historial de cambios (auditoría) por receta e insumo.
- Versionado de recetas con restauración de versión anterior.
- Favoritos, etiquetas, imágenes múltiples, adjuntos.
- Importación masiva desde Excel (recetas, insumos, listas de precio).

### Fase 4 — Escalabilidad y pulido
- Búsqueda instantánea con `pg_trgm`, paginación optimizada, vistas materializadas para Dashboard.
- Command palette (⌘K), mejoras UX, modo oscuro.
- Permisos granulares por rol (más allá de los 4 roles base).

### Fase 5 — Módulos futuros (post-MVP, arquitectura ya preparada)
- Inventarios, Compras, Órdenes de compra, Conteos físicos.
- Ingeniería de menú, Control de desperdicios.
- Integración POS.
- Reportes financieros.
- IA: sugerencia de precios, detección de anomalías de costo, sustitución de ingredientes.

---

## 7. Priorización MVP vs. avanzado

| Incluido en MVP | Fase posterior |
|---|---|
| Insumos, familias, unidades, conversión automática | Subrecetas anidadas |
| Recetas con ingredientes y costeo automático | Versionado y restauración |
| Costo por porción, food cost, precio sugerido | Panel de costos comparativo, alertas |
| Roles y autenticación | Permisos granulares avanzados |
| Exportar PDF/Excel | Importar masivo, historial/auditoría completa |
| Dashboard básico | Vistas materializadas, búsqueda `pg_trgm`, command palette |
| — | Inventarios, compras, POS, IA |

Esta priorización asegura que, al terminar la Fase 1, el restaurante ya puede operar sin el Excel — las fases siguientes agregan robustez, trazabilidad y los módulos ERP más amplios sin requerir rediseño de base de datos, porque el esquema del punto 2 ya contempla todas las entidades desde el inicio.

---

## 8. Próximos pasos

1. Revisar y ajustar el modelo de datos (sección 2) — es la base de todo lo demás.
2. Confirmar el alcance exacto del MVP (sección 7).
3. Aprobar este documento.
4. Iniciar Fase 0 (setup del proyecto y Supabase).

¿Quieres que ajuste algo del modelo de datos o del alcance del MVP antes de continuar, o avanzamos con el setup del proyecto?
