# Vynia MNGMNT — Sistema de Gestion de Pedidos

## Stack
- **Frontend**: React 19 + Vite 6
- **Backend**: Vercel Serverless Functions
- **Database**: Notion API via `@notionhq/client`
- **Deploy**: Vercel

## Estructura

```
Vynia-MNGMNT/
├── api/                    # Vercel Serverless Functions
│   ├── pedidos.js          # GET (listar) + POST (crear pedido)
│   ├── pedidos/[id].js     # PATCH (toggle recogido, no acude, etc.)
│   ├── clientes.js         # POST (buscar o crear cliente)
│   ├── registros.js        # POST (crear linea de pedido)
│   └── produccion.js       # GET (produccion diaria agregada)
├── src/
│   ├── App.jsx             # Componente principal (toda la UI)
│   └── api.js              # Cliente API frontend
├── main.jsx                # Entry point React
├── index.html
├── vite.config.js
├── vercel.json
├── .env.local              # NOTION_TOKEN (gitignored)
└── package.json
```

## Bases de Datos Notion

| BD | ID | Uso |
|----|-----|-----|
| Pedidos | `1c418b3a-38b1-81a1-9f3c-da137557fcf6` | Pedidos de clientes |
| Clientes | `1c418b3a-38b1-811f-b3ab-ea7a5e513ace` | Datos de clientes |
| Productos | `1c418b3a-38b1-8186-8da9-cfa6c2f0fcd2` | Catalogo de productos |
| Registros | `1d418b3a-38b1-808b-9afb-c45193c1270b` | Lineas de pedido (producto + cantidad) |

## Propiedades Notion importantes

- `"Unidades "` en Registros tiene un **espacio trailing** — no borrar
- `"No acude"` en Pedidos — nombre exacto con espacio
- `"Pagado al reservar"` en Pedidos — nombre exacto
- `"Fecha entrega"` en Pedidos — tipo date, puede incluir hora
- `"Fecha Creacion"` en Pedidos — fecha de creacion del pedido

## Desarrollo local

```bash
npm install
vercel dev          # para API routes (necesita NOTION_TOKEN en .env.local)
# o
npx vite            # solo frontend (modo DEMO funciona sin API)
```

## Tabs de la app

1. **Pedidos** — Lista de pedidos con filtros (pendientes/hoy/recogidos/todos), toggle recogido/no acude
2. **Nuevo** — Formulario para crear pedido (cliente + fecha + productos del catalogo)
3. **Produccion** — Vista agregada de productos por dia con drill-down a pedidos

## Modos

- **LIVE** — Conecta a Notion API real
- **DEMO** — Datos locales para testing sin API
