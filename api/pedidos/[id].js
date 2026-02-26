import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const { properties } = req.body;

  if (!id || !properties) {
    return res.status(400).json({ error: "Missing id or properties" });
  }

  try {
    await notion.pages.update({
      page_id: id,
      properties,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error updating page:", error);
    return res.status(500).json({ error: error.message });
  }
}
