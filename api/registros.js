import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_PRODUCTOS = "1c418b3a-38b1-8150-824c-000b6afbcc5f";
const DB_REGISTROS = "1d418b3a-38b1-8039-b0bb-000bb10081f3";

export default async function handler(req, res) {
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
