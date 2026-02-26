import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_PRODUCTOS = "1c418b3a-38b1-8186-8da9-cfa6c2f0fcd2";
const DB_REGISTROS = "1d418b3a-38b1-808b-9afb-c45193c1270b";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pedidoPageId, productoNombre, cantidad } = req.body;

  if (!pedidoPageId || !productoNombre || !cantidad) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Search for product by name
    const productSearch = await notion.databases.query({
      database_id: DB_PRODUCTOS,
      filter: {
        property: "title",
        title: { equals: productoNombre },
      },
    });

    const productoPageId =
      productSearch.results.length > 0 ? productSearch.results[0].id : null;

    // Create line item in Registros
    // IMPORTANT: "Unidades " has a trailing space in the property name
    const properties = {
      title: {
        title: [{ text: { content: productoNombre } }],
      },
      "Unidades ": {
        number: cantidad,
      },
      Pedidos: {
        relation: [{ id: pedidoPageId }],
      },
    };

    if (productoPageId) {
      properties["Productos"] = {
        relation: [{ id: productoPageId }],
      };
    }

    await notion.pages.create({
      parent: { database_id: DB_REGISTROS },
      properties,
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Error creating registro:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleGet(req, res) {
  const { pedidoId } = req.query;
  if (!pedidoId) {
    return res.status(400).json({ error: "Missing pedidoId" });
  }

  try {
    let allResults = [];
    let cursor = undefined;
    do {
      const response = await notion.databases.query({
        database_id: DB_REGISTROS,
        filter: { property: "Pedidos", relation: { contains: pedidoId } },
        start_cursor: cursor,
        page_size: 100,
      });
      allResults = allResults.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const productos = allResults.map(reg => {
      const auxProd = reg.properties["AUX Producto Texto"];
      const nombre = (auxProd?.formula?.string || "").trim()
        || (reg.properties["Nombre"]?.title || []).map(t => t.plain_text).join("").trim();
      const unidades = reg.properties["Unidades "]?.number || 0;
      return { nombre, unidades };
    }).filter(p => p.nombre && p.unidades > 0);

    return res.status(200).json(productos);
  } catch (error) {
    console.error("Error loading registros:", error);
    return res.status(500).json({ error: error.message });
  }
}
