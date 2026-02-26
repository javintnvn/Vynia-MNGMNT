const API_BASE = "/api";

async function apiCall(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errData.error || `API Error ${res.status}`);
  }
  return res.json();
}

export const notion = {
  async loadAllPedidos() {
    return apiCall("/pedidos?filter=todos");
  },

  async loadPedidos() {
    return apiCall("/pedidos?filter=pendientes");
  },

  async loadPedidosByDate(fecha) {
    const params = fecha ? `?fecha=${fecha}` : "?filter=todos";
    return apiCall(`/pedidos${params}`);
  },

  async toggleRecogido(pageId, currentValue) {
    return apiCall(`/pedidos/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Recogido: { checkbox: !currentValue },
        },
      }),
    });
  },

  async toggleNoAcude(pageId, currentValue) {
    return apiCall(`/pedidos/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          "No acude": { checkbox: !currentValue },
        },
      }),
    });
  },

  async updatePage(pageId, properties) {
    return apiCall(`/pedidos/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    });
  },

  async archivarPedido(pageId) {
    return apiCall(`/pedidos/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
  },

  async searchClientes(q) {
    return apiCall(`/clientes?q=${encodeURIComponent(q)}`);
  },

  async findOrCreateCliente(nombre, telefono) {
    return apiCall("/clientes", {
      method: "POST",
      body: JSON.stringify({ nombre, telefono }),
    });
  },

  async crearPedido(clienteNombre, clientePageId, fecha, hora, pagado, notas, lineas) {
    const fechaStr = hora ? `${fecha}T${hora}:00` : fecha;
    const today = new Date().toISOString().split("T")[0];

    const properties = {
      Pedido: {
        title: [{ text: { content: `Pedido ${clienteNombre}` } }],
      },
      Clientes: {
        relation: [{ id: clientePageId }],
      },
      "Fecha entrega": {
        date: { start: fechaStr },
      },
      "Fecha Creación": {
        date: { start: today },
      },
      "Pagado al reservar": {
        checkbox: pagado,
      },
    };

    if (notas) {
      properties["Notas"] = {
        rich_text: [{ text: { content: notas } }],
      };
    }

    const pedidoRes = await apiCall("/pedidos", {
      method: "POST",
      body: JSON.stringify({ properties }),
    });

    if (!pedidoRes?.id) throw new Error("No se pudo crear el pedido");

    // Create line items
    for (const linea of lineas) {
      await apiCall("/registros", {
        method: "POST",
        body: JSON.stringify({
          pedidoPageId: pedidoRes.id,
          productoNombre: linea.nombre,
          cantidad: linea.cantidad,
        }),
      });
    }

    return pedidoRes;
  },

  async crearRegistro(pedidoPageId, productoNombre, cantidad) {
    return apiCall("/registros", {
      method: "POST",
      body: JSON.stringify({ pedidoPageId, productoNombre, cantidad }),
    });
  },

  async loadProduccion(fecha) {
    return apiCall(`/produccion?fecha=${fecha}`);
  },
};
