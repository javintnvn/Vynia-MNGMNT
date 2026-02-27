import { notion, cached } from "./_notion.js";

const DB_CLIENTES = "1c418b3a-38b1-811f-b3ab-ea7a5e513ace";
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

  const { tel } = req.query;
  if (!tel || tel.replace(/\D/g, "").length < 6) {
    return res.status(400).json({ error: "Introduce un número de teléfono válido" });
  }

  const cleanTel = tel.replace(/\D/g, "");
  // Strip leading 34 (Spain country code) if present for searching
  const searchTel = cleanTel.startsWith("34") && cleanTel.length > 9
    ? cleanTel.slice(2)
    : cleanTel;

  try {
    // 1. Find client(s) by phone number
    const clientSearch = await notion.databases.query({
      database_id: DB_CLIENTES,
      filter: {
        property: "Teléfono",
        phone_number: { contains: searchTel },
      },
      page_size: 5,
    });

    if (clientSearch.results.length === 0) {
      return res.status(200).json({ pedidos: [], cliente: null });
    }

    const clienteId = clientSearch.results[0].id;
    const titleProp = Object.values(clientSearch.results[0].properties).find(p => p.type === "title");
    const clienteNombre = titleProp
      ? (titleProp.title || []).map(t => t.plain_text).join("")
      : "";

    // 2. Query pedidos for this client (non-archived, recent first)
    const pedidosRes = await notion.databases.query({
      database_id: DB_PEDIDOS,
      filter: {
        property: "Clientes",
        relation: { contains: clienteId },
      },
      sorts: [{ property: "Fecha entrega", direction: "descending" }],
      page_size: 20,
    });

    // 3. Build public-safe pedido list
    const pedidos = [];
    for (const page of pedidosRes.results) {
      const p = page.properties;
      const estado = p["Estado"]?.status?.name || null;
      // Fallback to checkboxes for legacy pedidos
      const effectiveEstado = estado
        || (p["Recogido"]?.checkbox ? "Recogido" : null)
        || (p["No acude"]?.checkbox ? "No acude" : null)
        || (p["Incidencia"]?.checkbox ? "Incidencia" : null)
        || "Sin empezar";

      pedidos.push({
        numPedido: p["Nº Pedido"]?.unique_id?.number || 0,
        fecha: extractDateStart(p["Fecha entrega"]),
        estado: effectiveEstado,
        notas: extractRichText(p["Notas"]),
        pagado: p["Pagado al reservar"]?.checkbox || false,
        _id: page.id, // needed to fetch registros, stripped before response
      });
    }

    // 4. Fetch registros (products) for each pedido in parallel (batches of 5)
    const fetchRegistros = async (pedidoId) => {
      const regRes = await notion.databases.query({
        database_id: DB_REGISTROS,
        filter: { property: "Pedidos", relation: { contains: pedidoId } },
        page_size: 100,
      });
      return regRes.results.map(reg => {
        const auxProd = reg.properties["AUX Producto Texto"];
        const nombre = (auxProd?.formula?.string || "").trim()
          || extractTitle(reg.properties["Nombre"]);
        const unidades = reg.properties["Unidades "]?.number || 0;
        return { nombre, unidades };
      }).filter(p => p.nombre && p.unidades > 0);
    };

    for (let i = 0; i < pedidos.length; i += 5) {
      const batch = pedidos.slice(i, i + 5);
      const results = await Promise.all(batch.map(ped => fetchRegistros(ped._id)));
      batch.forEach((ped, idx) => { ped.productos = results[idx]; });
    }

    // Strip internal IDs before sending response
    const safePedidos = pedidos.map(({ _id, ...rest }) => rest);

    return res.status(200).json({
      cliente: clienteNombre,
      pedidos: safePedidos,
    });
  } catch (error) {
    console.error("Error tracking pedidos:", error);
    return res.status(500).json({ error: "Error al consultar pedidos" });
  }
}
