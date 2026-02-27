import { notion } from "./_notion.js";

const DB_CLIENTES = "1c418b3a-38b1-811f-b3ab-ea7a5e513ace";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleSearch(req, res);
  }
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

async function handleSearch(req, res) {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(200).json([]);
  }

  try {
    const term = q.trim();
    const search = await notion.databases.query({
      database_id: DB_CLIENTES,
      filter: {
        or: [
          { property: "title", title: { contains: term } },
          { property: "Teléfono", phone_number: { contains: term } },
          { property: "Correo electrónico", email: { contains: term } },
        ],
      },
      page_size: 10,
    });

    const clientes = search.results.map((page) => {
      const titleProp = Object.values(page.properties).find(p => p.type === "title");
      const nombre = titleProp ? (titleProp.title || []).map(t => t.plain_text).join("") : "";
      const tel = page.properties["Teléfono"]?.phone_number || "";
      const email = page.properties["Correo electrónico"]?.email || "";
      return { id: page.id, nombre, telefono: tel, email };
    });

    return res.status(200).json(clientes);
  } catch (error) {
    console.error("Error searching clientes:", error);
    return res.status(500).json({ error: error.message });
  }
}
