import { notion, cached, delay } from "./_notion.js";

const DB_PEDIDOS = "1c418b3a-38b1-81a1-9f3c-da137557fcf6";

// Client name cache (persists on warm instances, avoids re-fetching same clients)
const _clientCache = new Map();
const CLIENT_CACHE_TTL = 300000; // 5 min

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
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method === "POST") {
    return handlePost(req, res);
  }
  return res.status(405).json({ error: "Method not allowed" });
}

function nextDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

async function handleGet(req, res) {
  try {
    const filter = req.query.filter || "todos";
    const fecha = req.query.fecha; // YYYY-MM-DD — filter by delivery date
    const clienteId = req.query.clienteId; // filter by client relation

    const conditions = [];

    // Client filter: pedidos for a specific client
    if (clienteId) {
      conditions.push({ property: "Clientes", relation: { contains: clienteId } });
    }

    // Date filter: if fecha is provided, filter to that specific day
    if (fecha) {
      conditions.push({ property: "Fecha entrega", date: { on_or_after: fecha } });
      conditions.push({ property: "Fecha entrega", date: { before: nextDay(fecha) } });
    }

    // Status filter
    if (filter === "pendientes") {
      conditions.push({ property: "Recogido", checkbox: { equals: false } });
      conditions.push({ property: "No acude", checkbox: { equals: false } });
    } else if (filter === "recogidos") {
      conditions.push({ property: "Recogido", checkbox: { equals: true } });
    }

    let notionFilter = undefined;
    if (conditions.length === 1) {
      notionFilter = conditions[0];
    } else if (conditions.length > 1) {
      notionFilter = { and: conditions };
    }

    const sorts = [{ property: "Fecha entrega", direction: "ascending" }];

    let allResults = [];
    let cursor = undefined;
    do {
      const response = await notion.databases.query({
        database_id: DB_PEDIDOS,
        ...(notionFilter && { filter: notionFilter }),
        sorts,
        start_cursor: cursor,
        page_size: 100,
      });
      allResults = allResults.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    // Build pedido list + collect client IDs to resolve
    const clientIdsToFetch = new Set();
    const pedidosRaw = allResults.map((page) => {
      const p = page.properties;
      const clientRelation = p["Clientes"]?.relation || [];
      const clientId = clientRelation.length > 0 ? clientRelation[0].id : null;
      const telRollup = p["Teléfono"]?.rollup?.array || [];
      const telefono = telRollup.length > 0 ? (telRollup[0].phone_number || "") : "";
      if (clientId) clientIdsToFetch.add(clientId);
      return {
        id: page.id,
        titulo: extractTitle(p["Pedido"]),
        fecha: extractDateStart(p["Fecha entrega"]),
        recogido: p["Recogido"]?.checkbox || false,
        noAcude: p["No acude"]?.checkbox || false,
        pagado: p["Pagado al reservar"]?.checkbox || false,
        incidencia: p["Incidencia"]?.checkbox || false,
        notas: extractRichText(p["Notas"]),
        numPedido: p["Nº Pedido"]?.unique_id?.number || 0,
        clienteId: clientId,
        telefono,
      };
    });

    // Resolve client names in batches of 5 (with persistent cache)
    const clientNames = {};
    const now = Date.now();
    const uncachedIds = [];
    for (const cid of clientIdsToFetch) {
      const entry = _clientCache.get(cid);
      if (entry && now - entry.ts < CLIENT_CACHE_TTL) {
        clientNames[cid] = entry.name;
      } else {
        uncachedIds.push(cid);
      }
    }
    const fetchClient = async (cid) => {
      try {
        const clientPage = await notion.pages.retrieve({ page_id: cid });
        const titleProp = Object.values(clientPage.properties).find(p => p.type === "title");
        const name = titleProp ? (titleProp.title || []).map(t => t.plain_text).join("") : "";
        clientNames[cid] = name;
        _clientCache.set(cid, { name, ts: Date.now() });
      } catch { clientNames[cid] = ""; }
    };
    for (let i = 0; i < uncachedIds.length; i += 5) {
      await Promise.all(uncachedIds.slice(i, i + 5).map(fetchClient));
      if (i + 5 < uncachedIds.length) await delay(200);
    }

    const pedidos = pedidosRaw.map(ped => ({
      ...ped,
      cliente: ped.clienteId ? (clientNames[ped.clienteId] || "") : "",
    }));

    return res.status(200).json(pedidos);
  } catch (error) {
    console.error("Error querying pedidos:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function handlePost(req, res) {
  try {
    const { properties } = req.body;
    if (!properties) {
      return res.status(400).json({ error: "Missing properties" });
    }

    const page = await notion.pages.create({
      parent: { database_id: DB_PEDIDOS },
      properties,
    });

    return res.status(201).json({ id: page.id });
  } catch (error) {
    console.error("Error creating pedido:", error);
    return res.status(500).json({ error: error.message });
  }
}
