# Vynia MNGMNT

Sistema de gestion de pedidos para **Vynia**, conectado a Notion como base de datos.

## Funcionalidades

- **Pedidos** — Lista de pedidos con filtros (pendientes, hoy, recogidos, todos). Toggle de recogido y no acude. Nombre de cliente, telefono y notas visibles
- **Nuevo Pedido** — Formulario: cliente + telefono + fecha/hora + productos del catalogo con cantidades + pagado + notas
- **Produccion** — Vista agregada de productos por dia con cantidades totales. Drill-down a pedidos individuales con modal de detalle

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + Vite 6 |
| Backend | Vercel Serverless Functions |
| Base de datos | Notion API (`@notionhq/client@2.3.0`) |
| Deploy | Vercel (autodeploy desde `main`) |

## Estructura

```
api/
  pedidos.js        GET (listar) + POST (crear)
  pedidos/[id].js   PATCH (actualizar)
  clientes.js       POST (buscar o crear cliente)
  registros.js      POST (crear linea de pedido)
  produccion.js     GET (produccion diaria agregada)
src/
  App.jsx           Componente principal (toda la UI)
  api.js            Cliente API frontend
```

## Desarrollo local

```bash
npm install

# Con API (necesita NOTION_TOKEN en .env.local)
vercel dev

# Solo frontend (modo DEMO sin API)
npx vite
```

## Variables de entorno

| Variable | Descripcion |
|----------|-------------|
| `NOTION_TOKEN` | Token de la integracion "Frontend Vynia" en Notion |

## Modos

- **LIVE** — Conecta a Notion API real
- **DEMO** — Datos locales para testing sin conexion
