import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_PEDIDOS = "1c418b3a-38b1-8176-a42b-000b33f3b1aa";

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

async function handleGet(req, res) {
  try {
    const filter = req.query.filter || "todos";

    let notionFilter = undefined;
    if (filter === "pendientes") {
      notionFilter = {
        and: [
          { property: "Recogido", checkbox: { equals: false } },
          { property: "No acude", checkbox: { equals: false } },
        ],
      };
    } else if (filter === "recogidos") {
      notionFilter = {
        property: "Recogido",
        checkbox: { equals: true },
      };
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

    const pedidos = allResults.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        titulo: extractTitle(p["Pedido"]),
        fecha: extractDateStart(p["Fecha entrega"]),
        recogido: p["Recogido"]?.checkbox || false,
        noAcude: p["No acude"]?.checkbox || false,
        pagado: p["Pagado al reservar"]?.checkbox || false,
        incidencia: p["Incidencia"]?.checkbox || false,
        notas: extractRichText(p["Notas"]),
        numPedido: p["Nº Pedido"]?.number || 0,
      };
    });

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
