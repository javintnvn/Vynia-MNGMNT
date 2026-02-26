import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_PEDIDOS = "1c418b3a-38b1-81a1-9f3c-da137557fcf6";
const DB_REGISTROS = "1d418b3a-38b1-808b-9afb-c45193c1270b";

function extractTitle(prop) {
  if (!prop || prop.type !== "title") return "";
  return (prop.title || []).map((t) => t.plain_text).join("");
}

function extractRichText(prop) {
  if (!prop || prop.type !== "rich_text") return "";
  return (prop.rich_text || []).map((t) => t.plain_text).join("");
}

function extractDateStart(prop) {
  if (!prop || prop.type !== "date" || !prop.date) return "";
  return prop.date.start || "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fecha } = req.query;
  if (!fecha) {
    return res.status(400).json({ error: "Missing fecha parameter" });
  }

  try {
    // 1. Get pedidos for the given date (include recogido for frontend discrimination)
    const pedidosRes = await notion.databases.query({
      database_id: DB_PEDIDOS,
      filter: {
        and: [
          { property: "Fecha entrega", date: { on_or_after: fecha } },
          { property: "Fecha entrega", date: { before: nextDay(fecha) } },
          { property: "No acude", checkbox: { equals: false } },
        ],
      },
      page_size: 100,
    });

    const pedidos = pedidosRes.results;
    if (pedidos.length === 0) {
      return res.status(200).json({ productos: [] });
    }

    // Build pedido info map + fetch client names
    const pedidoMap = {};
    const clientIdsToFetch = new Set();

    for (const page of pedidos) {
      const p = page.properties;
      const clientRelation = p["Clientes"]?.relation || [];
      const clientId = clientRelation.length > 0 ? clientRelation[0].id : null;
      const telRollup = p["Teléfono"]?.rollup?.array || [];
      const telefono = telRollup.length > 0 ? (telRollup[0].phone_number || "") : "";

      pedidoMap[page.id] = {
        pedidoId: page.id,
        pedidoTitulo: extractTitle(p["Pedido"]),
        fecha: extractDateStart(p["Fecha entrega"]),
        recogido: p["Recogido"]?.checkbox || false,
        noAcude: p["No acude"]?.checkbox || false,
        pagado: p["Pagado al reservar"]?.checkbox || false,
        incidencia: p["Incidencia"]?.checkbox || false,
        notas: extractRichText(p["Notas"]),
        numPedido: p["Nº Pedido"]?.unique_id?.number || 0,
        clienteId: clientId,
        cliente: "",
        telefono,
      };
      if (clientId) clientIdsToFetch.add(clientId);
    }

    // Fetch client names in parallel
    const clientNames = {};
    await Promise.all(
      [...clientIdsToFetch].map(async (cid) => {
        try {
          const clientPage = await notion.pages.retrieve({ page_id: cid });
          const titleProp = Object.values(clientPage.properties).find(p => p.type === "title");
          clientNames[cid] = titleProp ? (titleProp.title || []).map(t => t.plain_text).join("") : "";
        } catch { clientNames[cid] = ""; }
      })
    );

    // Assign client names to pedidos
    for (const ped of Object.values(pedidoMap)) {
      if (ped.clienteId) ped.cliente = clientNames[ped.clienteId] || "";
    }

    // 2. Query registros for ALL pedidos in parallel
    const productosAgg = {}; // nombre -> { totalUnidades, pedidos: [] }
    const pedidoProductos = {}; // pedidoId -> [{ nombre, unidades }]
    const pedidoIds = Object.keys(pedidoMap);

    for (const pid of pedidoIds) pedidoProductos[pid] = [];

    await Promise.all(pedidoIds.map(async (pedidoId) => {
      let cursor = undefined;
      do {
        const regRes = await notion.databases.query({
          database_id: DB_REGISTROS,
          filter: {
            property: "Pedidos",
            relation: { contains: pedidoId },
          },
          start_cursor: cursor,
          page_size: 100,
        });

        for (const reg of regRes.results) {
          const auxProd = reg.properties["AUX Producto Texto"];
          const nombre = (auxProd?.formula?.string || "").trim()
            || extractTitle(reg.properties["Nombre"]);
          const unidades = reg.properties["Unidades "]?.number || 0;

          if (!nombre || unidades === 0) continue;

          pedidoProductos[pedidoId].push({ nombre, unidades });

          if (!productosAgg[nombre]) {
            productosAgg[nombre] = { nombre, totalUnidades: 0, pedidos: [] };
          }
          productosAgg[nombre].totalUnidades += unidades;
          productosAgg[nombre].pedidos.push({
            ...pedidoMap[pedidoId],
            unidades,
          });
        }

        cursor = regRes.has_more ? regRes.next_cursor : undefined;
      } while (cursor);
    }));

    // Attach full product list to each pedido entry in productosAgg
    for (const prod of Object.values(productosAgg)) {
      for (const ped of prod.pedidos) {
        ped.productos = pedidoProductos[ped.pedidoId] || [];
      }
    }

    // Sort by name
    const productos = Object.values(productosAgg).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    );

    return res.status(200).json({ productos });
  } catch (error) {
    console.error("Error loading produccion:", error);
    return res.status(500).json({ error: error.message });
  }
}

function nextDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
