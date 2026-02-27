import { notion, cached } from "./_notion.js";

const DB_PRODUCTOS = "1c418b3a-38b1-8186-8da9-cfa6c2f0fcd2";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const productos = await cached("productos", 300000, async () => {
      const result = [];
      let cursor;
      do {
        const resp = await notion.databases.query({
          database_id: DB_PRODUCTOS,
          start_cursor: cursor,
          page_size: 100,
        });
        for (const page of resp.results) {
          const p = page.properties;
          const nombre = p["Nombre"]?.title?.[0]?.plain_text?.trim();
          const precio = p["Precio"]?.number;
          const cat = p["Categoría"]?.select?.name || "";
          if (nombre && precio != null) {
            result.push({ nombre, precio, cat });
          }
        }
        cursor = resp.has_more ? resp.next_cursor : undefined;
      } while (cursor);
      result.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return result;
    });
    res.status(200).json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
