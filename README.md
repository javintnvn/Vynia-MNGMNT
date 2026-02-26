# Vynia MNGMNT

Sistema de gestion de pedidos para **Vynia**, conectado a Notion como base de datos.

**URL produccion:** [vynia-mngmnt.vercel.app](https://vynia-mngmnt.vercel.app)

## Funcionalidades

### Pedidos
- Lista de pedidos filtrable por fecha (Hoy / Manana / Pasado / Todos + date picker)
- Filtros de estado: Pendientes, Recogidos, Todos
- Buscador global de pedidos (por cliente, telefono, notas, numero de pedido) — independiente de filtros
- Cards con nombre de cliente, hora entrega, telefono, productos, notas, importe
- Click en pedido abre modal con detalle completo + productos cargados desde Registros
- Click en telefono ofrece Llamar o enviar WhatsApp
- Toggle de recogido y no acude
- Cancelar pedido (archiva en Notion) y cambiar fecha de entrega desde el modal
- Badges: PAGADO, INCIDENCIA
- Stats bar con contadores (total, pendientes, recogidos)

### Nuevo Pedido
- Formulario: cliente (autocompletado) + telefono
- Selector de fecha (presets Hoy/Manana/Pasado + datepicker + hora)
- Productos del catalogo con busqueda y cantidades
- Toggle pagado + notas
- Crea cliente en Notion si no existe

### Produccion
- Vista agregada de productos por dia con cantidades totales
- Toggle Pendiente / Todo el dia: discrimina pedidos recogidos de la produccion pendiente
- Muestra unidades pendientes vs recogidas (con tachado) por producto y en resumen global
- Selector de fecha (presets + datepicker)
- Click en producto expande los pedidos que lo contienen (recogidos aparecen tachados con badge RECOGIDO)
- Click en pedido abre modal con detalle completo (cliente, telefono, fecha, productos, badges, notas)
- Precarga automatica al iniciar la app para carga instantanea

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + Vite 6 |
| Backend | Vercel Serverless Functions |
| Base de datos | Notion API (`@notionhq/client@2.3.0`) |
| Deploy | Vercel (autodeploy desde `main`) |

## Estructura

```
Vynia-MNGMNT/
├── api/                    # Vercel Serverless Functions
│   ├── pedidos.js          # GET (listar con filtro fecha/estado) + POST (crear pedido)
│   ├── pedidos/[id].js     # PATCH (toggle recogido, no acude, etc.)
│   ├── clientes.js         # GET (buscar) + POST (buscar o crear cliente)
│   ├── registros.js        # GET (productos de un pedido) + POST (crear linea de pedido)
│   └── produccion.js       # GET (produccion diaria agregada con clientes, incluye recogidos)
├── src/
│   ├── App.jsx             # Componente principal (toda la UI, ~1500 lineas)
│   └── api.js              # Cliente API frontend (wrapper fetch)
├── main.jsx                # Entry point React
├── index.html
├── vite.config.js
├── vercel.json             # Rewrites: /api/* → serverless, /* → SPA
├── .env.local              # NOTION_TOKEN (gitignored)
└── package.json
```

## API Endpoints

### GET /api/pedidos
- Query params: `filter=todos|pendientes|recogidos`, `fecha=YYYY-MM-DD`
- Filtra por fecha a nivel de Notion (on_or_after + before nextDay)
- Resuelve nombres de clientes via `pages.retrieve` en la relacion Clientes
- Resuelve telefono via rollup
- Paginacion automatica via cursor
- Devuelve: `[{ id, titulo, fecha, recogido, noAcude, pagado, incidencia, notas, numPedido, cliente, telefono, clienteId }]`

### POST /api/pedidos
- Body: `{ properties: { ... } }` — propiedades Notion del pedido
- Devuelve `{ id }` del pedido creado

### PATCH /api/pedidos/:id
- Body: `{ properties: { ... }, archived?: boolean }` — propiedades a actualizar o archivar
- Usado para toggle recogido, no acude, cambiar fecha, cancelar pedido (archived)

### POST /api/clientes
- Body: `{ nombre, telefono? }`
- Busca cliente por nombre exacto. Si no existe, lo crea
- Devuelve `{ id, created: boolean }`

### GET /api/registros
- Query params: `pedidoId=<notion_page_id>`
- Devuelve productos de un pedido: `[{ nombre, unidades }]`

### POST /api/registros
- Body: `{ pedidoPageId, productoNombre, cantidad }`
- Busca producto por nombre en BD Productos y crea registro vinculado al pedido

### GET /api/produccion
- Query params: `fecha=YYYY-MM-DD`
- Filtra pedidos del dia (incluye recogidos, excluye no-acude), consulta registros asociados
- Agrega productos con cantidades totales. Incluye flag `recogido` por pedido para discriminar en frontend
- Resuelve nombres de clientes
- Devuelve: `{ productos: [{ nombre, totalUnidades, pedidos: [...] }] }`

## Bases de Datos Notion

La app utiliza 4 bases de datos dentro de la pagina "Gestiona Tu Obrador":

| BD | ID | Uso |
|----|-----|-----|
| Pedidos | `1c418b3a-38b1-81a1-9f3c-da137557fcf6` | Pedidos de clientes |
| Clientes | `1c418b3a-38b1-811f-b3ab-ea7a5e513ace` | Datos de clientes |
| Productos | `1c418b3a-38b1-8186-8da9-cfa6c2f0fcd2` | Catalogo de productos |
| Registros | `1d418b3a-38b1-808b-9afb-c45193c1270b` | Lineas de pedido (producto + cantidad) |

Integracion: **Frontend Vynia** (debe tener acceso a cada BD individualmente).

## Desarrollo local

```bash
npm install

# Con API real (necesita NOTION_TOKEN en .env.local)
vercel dev

# Solo frontend (modo DEMO funciona sin API)
npx vite
```

## Variables de entorno

| Variable | Descripcion |
|----------|-------------|
| `NOTION_TOKEN` | Token de la integracion "Frontend Vynia" en Notion |

Se configura en `.env.local` para desarrollo local y en el dashboard de Vercel para produccion.

## Modos

- **LIVE** — Conecta a Notion API real (por defecto si API disponible)
- **DEMO** — Datos locales hardcodeados para testing sin API. Se activa con toggle en header o automaticamente si falla la API

## UI / UX

- **Palette**: Vynia brand — primario `#4F6867`, secundario `#1B1C39`, accent `#E1F2FC`, bg `#EFE9E4`, muted `#A2C2D0`
- **Fuentes**: Roboto Condensed (titulos/numeros), Inter (texto)
- **Responsive**: Mobile-first, max-width 960px centrado
- **Tooltips**: Hover (desktop) + long-press ~0.4s (movil) con popup animado
- **Print**: CSS @media print para imprimir lista de pedidos/produccion
- **Bottom nav**: 3 tabs fijas (Pedidos, Nuevo, Produccion) con safe-area-inset-bottom

## Deploy

- Vercel project: `vynia-mngmnt`
- Git integration: push a `main` autodeploya
- Repo: `github.com/javintnvn/Vynia-MNGMNT`

## Notas tecnicas

- `@notionhq/client` debe ser v2.x (v5.x elimino `databases.query`, NO actualizar)
- El campo `"Unidades "` en Registros tiene un espacio trailing — respetar siempre
- El campo `"Nombre"` (title) en Registros contiene solo `" "` — usar `"AUX Producto Texto"` (formula) para el nombre real del producto
- `"N Pedido"` es tipo `unique_id`, acceder via `.unique_id.number`
- El telefono del cliente viene de un rollup en Pedidos: `p["Telefono"]?.rollup?.array[0]?.phone_number`
- Para obtener nombre de cliente: resolver relacion `"Clientes"` → `notion.pages.retrieve` → buscar propiedad tipo `title`
- Toda la UI esta en un solo componente `App.jsx` — no hay componentes separados
- El catalogo de productos esta hardcodeado en `CATALOGO[]` en App.jsx
