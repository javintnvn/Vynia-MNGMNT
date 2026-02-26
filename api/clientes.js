import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_CLIENTES = "1c418b3a-38b1-8128-83fc-000bc7a1d4a0";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nombre, telefono } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "Missing nombre" });
  }

  try {
    // Search for existing client by title
    const search = await notion.databases.query({
      database_id: DB_CLIENTES,
      filter: {
        property: "title",
        title: { equals: nombre.trim() },
      },
    });

    if (search.results.length > 0) {
      return res.status(200).json({
        id: search.results[0].id,
        created: false,
      });
    }

    // Create new client
    const properties = {
      title: {
        title: [{ text: { content: nombre.trim() } }],
      },
    };

    if (telefono) {
      // Try phone_number first; if the property type is rich_text, this will
      // need adjustment after testing against the live DB
      properties["Teléfono"] = {
        phone_number: telefono,
      };
    }

    const created = await notion.pages.create({
      parent: { database_id: DB_CLIENTES },
      properties,
    });

    return res.status(201).json({
      id: created.id,
      created: true,
    });
  } catch (error) {
    console.error("Error find/create cliente:", error);
    return res.status(500).json({ error: error.message });
  }
}
