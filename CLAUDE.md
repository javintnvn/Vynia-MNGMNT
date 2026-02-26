# Vynia MNGMNT — Sistema de Gestion de Pedidos

## Stack
- **Frontend**: React 19 + Vite 6 (single-file UI en `src/App.jsx`)
- **Backend**: Vercel Serverless Functions (directorio `api/`)
- **Database**: Notion API via `@notionhq/client@2.3.0`
- **Deploy**: Vercel (proyecto `vynia-mngmnt`, repo `javintnvn/Vynia-MNGMNT`)
- **URL produccion**: `https://vynia-mngmnt.vercel.app`

## Estructura

```
Vynia-MNGMNT/
├── api/                    # Vercel Serverless Functions
│   ├── pedidos.js          # GET (listar con filtro) + POST (crear pedido)
│   ├── pedidos/[id].js     # PATCH (toggle recogido, no acude, etc.)
│   ├── clientes.js         # POST (buscar o crear cliente)
│   ├── registros.js        # POST (crear linea de pedido)
│   └── produccion.js       # GET (produccion diaria agregada con clientes)
├── src/
│   ├── App.jsx             # Componente principal (toda la UI, ~1400 lineas)
│   └── api.js              # Cliente API frontend (wrapper fetch)
├── main.jsx                # Entry point React
├── index.html
├── vite.config.js
├── vercel.json             # Rewrites: /api/* → serverless, /* → SPA
├── .env.local              # NOTION_TOKEN (gitignored)
└── package.json
```

## Bases de Datos Notion

Todas dentro de la pagina "Gestiona Tu Obrador" (`1c418b3a-38b1-80ba-8e58-d69cbdaa2228`).
Integracion: **Frontend Vynia** (debe tener acceso a cada BD individualmente).

| BD | ID | Uso |
|----|-----|-----|
| Pedidos | `1c418b3a-38b1-81a1-9f3c-da137557fcf6` | Pedidos de clientes |
| Clientes | `1c418b3a-38b1-811f-b3ab-ea7a5e513ace` | Datos de clientes |
| Productos | `1c418b3a-38b1-8186-8da9-cfa6c2f0fcd2` | Catalogo de productos |
| Registros | `1d418b3a-38b1-808b-9afb-c45193c1270b` | Lineas de pedido (producto + cantidad) |

## Propiedades Notion importantes

### Pedidos
- `"Pedido"` — title (ej: "Pedido Maria Garcia")
- `"Fecha entrega"` — date, puede incluir hora (ej: `2026-02-26T10:30:00`)
- `"Fecha Creacion"` — date de creacion del pedido (OJO: con tilde en "Creacion")
- `"Recogido"` — checkbox
- `"No acude"` — checkbox (nombre exacto con espacio)
- `"Pagado al reservar"` — checkbox (nombre exacto)
- `"Incidencia"` — checkbox
- `"Notas"` — rich_text
- `"Clientes"` — relation a BD Clientes (array de ids)
- `"N Pedido"` — unique_id (acceder via `.unique_id.number`)
- `"Telefono"` — rollup desde Clientes (acceder via `.rollup.array[0].phone_number`)

### Registros
- `"Nombre"` — title (contiene solo un espacio " ", **NO usar** para nombre de producto)
- `"AUX Producto Texto"` — formula (string) — **nombre real del producto**, derivado de la relacion Productos. Acceder via `.formula.string`
- `"Unidades "` — number (**espacio trailing**, no borrar)
- `"Pedidos"` — relation a BD Pedidos
- `"Productos"` — relation a BD Productos

### Clientes
- title — nombre del cliente
- `"Telefono"` — phone_number

### Productos
- title — nombre del producto (ej: "Brownie", "Cookies de chocolate y avellanas")
- El catalogo completo esta hardcodeado en `src/App.jsx` como `CATALOGO[]`

## API Endpoints

### GET /api/pedidos
- Query params: `filter=todos|pendientes|recogidos`
- Devuelve array de pedidos con: id, titulo, fecha, recogido, noAcude, pagado, incidencia, notas, numPedido
- Paginacion automatica via cursor

### POST /api/pedidos
- Body: `{ properties: { ... } }` — propiedades Notion del pedido
- Devuelve `{ id }` del pedido creado

### PATCH /api/pedidos/:id
- Body: `{ properties: { ... } }` — propiedades a actualizar
- Usado para toggle recogido, no acude, etc.

### POST /api/clientes
- Body: `{ nombre, telefono? }`
- Busca cliente por nombre exacto. Si no existe, lo crea
- Devuelve `{ id, created: boolean }`

### POST /api/registros
- Body: `{ pedidoPageId, productoNombre, cantidad }`
- Busca producto por nombre en BD Productos y crea registro en BD Registros
- Vincula registro a pedido y producto

### GET /api/produccion
- Query params: `fecha=YYYY-MM-DD`
- Devuelve `{ productos: [...] }` con estructura:
  ```json
  {
    "nombre": "Brownie",
    "totalUnidades": 5,
    "pedidos": [
      {
        "pedidoId": "abc-123",
        "pedidoTitulo": "Pedido Maria Garcia",
        "cliente": "Maria Garcia",
        "telefono": "612345678",
        "unidades": 3,
        "fecha": "2026-02-26T10:30:00",
        "recogido": false,
        "noAcude": false,
        "pagado": true,
        "incidencia": false,
        "notas": "Sin nueces",
        "numPedido": 42,
        "productos": [
          { "nombre": "Brownie", "unidades": 3 },
          { "nombre": "Cookie Oreo", "unidades": 2 }
        ]
      }
    ]
  }
  ```
- Filtra pedidos por fecha (no recogidos, no no-acude)
- Resuelve nombres de clientes via pages.retrieve en la relacion Clientes
- Lee nombre de producto de formula `"AUX Producto Texto"`, no del titulo
- Incluye lista completa de productos de cada pedido en `pedido.productos`

## Frontend API client (src/api.js)

Exporta objeto `notion` con metodos:
- `loadAllPedidos()` — GET /api/pedidos?filter=todos
- `loadPedidos()` — GET /api/pedidos?filter=pendientes
- `toggleRecogido(pageId, currentValue)` — PATCH toggle
- `toggleNoAcude(pageId, currentValue)` — PATCH toggle
- `updatePage(pageId, properties)` — PATCH generico
- `findOrCreateCliente(nombre, telefono)` — POST /api/clientes
- `crearPedido(clienteNombre, clientePageId, fecha, hora, pagado, notas, lineas)` — POST pedido + registros
- `crearRegistro(pedidoPageId, productoNombre, cantidad)` — POST /api/registros
- `loadProduccion(fecha)` — GET /api/produccion?fecha=...

## Tabs de la app

1. **Pedidos** — Lista de pedidos con filtros estadisticos (pendientes/hoy/recogidos/todos), pills de filtro, toggle recogido/no acude, enlace telefono
2. **Nuevo** — Formulario para crear pedido: cliente (autocompletado) + telefono + fecha (presets hoy/manana/pasado + datepicker + hora) + productos del catalogo (busqueda + cantidades) + pagado toggle + notas
3. **Produccion** — Vista agregada de productos por dia. Selector de fecha (presets + datepicker). Lista de productos con badge de cantidad total. Accordion: click en producto muestra pedidos con nombre de cliente. Click en pedido abre modal con detalle completo (cliente, telefono, fecha, productos, badges pagado/recogido/incidencia/no-acude, notas)

## UI / UX

- **Palette**: Vynia brand — primario `#4F6867`, secundario `#1B1C39`, accent `#E1F2FC`, bg `#EFE9E4`, muted `#A2C2D0`
- **Fuentes**: Roboto Condensed (titulos/numeros), Inter (texto)
- **Responsive**: Mobile-first, max-width 960px centrado
- **Tooltips**: Todos los botones tienen `title` para hover descriptivo
- **Print**: CSS @media print para imprimir lista de pedidos/produccion
- **Bottom nav**: 3 tabs fijas (Pedidos, Nuevo, Produccion) con safe-area-inset-bottom

## Modos

- **LIVE** — Conecta a Notion API real (por defecto si API disponible)
- **DEMO** — Datos locales hardcodeados para testing sin API. Incluye pedidos, clientes y produccion de demo. Se activa con toggle en header o automaticamente si falla la API

## Desarrollo local

```bash
npm install
vercel dev          # para API routes (necesita NOTION_TOKEN en .env.local)
# o
npx vite            # solo frontend (modo DEMO funciona sin API)
```

## Deploy

- Vercel project name: `vynia-mngmnt` en team `javiers-projects-9e54bc4d`
- Variable de entorno en Vercel: `NOTION_TOKEN`
- Git integration: push a `main` autodeploya automaticamente
- Repo: `github.com/javintnvn/Vynia-MNGMNT`

## Notas tecnicas

- `@notionhq/client` debe ser v2.x (v5.x elimino `databases.query`, NO actualizar)
- El campo `"Unidades "` en Registros tiene un espacio trailing — respetar siempre
- El campo `"Nombre"` (title) en Registros contiene solo `" "` — usar `"AUX Producto Texto"` (formula) para el nombre real del producto
- `"N Pedido"` es tipo `unique_id`, acceder via `.unique_id.number`
- El telefono del cliente viene de un rollup en Pedidos: `p["Telefono"]?.rollup?.array[0]?.phone_number`
- Para obtener nombre de cliente desde produccion: resolver relacion `"Clientes"` → `notion.pages.retrieve` → buscar propiedad tipo `title`
- Toda la UI esta en un solo componente `App.jsx` (~1400 lineas) — no hay componentes separados
- El catalogo de productos esta hardcodeado en `CATALOGO[]` en App.jsx (no se carga de la API)
