// src/AdminPanel.jsx
import React, { useEffect, useState } from "react";

const API_URL = "https://web-production-e7d2.up.railway.app"; // tu backend
const getAdminSecret = () => sessionStorage.getItem("adminSecret") || "";
const setAdminSecret = (s) => sessionStorage.setItem("adminSecret", s || "");

function buildHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-secret": getAdminSecret()
  };
}

async function apiGet(path) {
  const r = await fetch(API_URL + path, { headers: buildHeaders() });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function apiJson(method, path, body) {
  const r = await fetch(API_URL + path, {
    method,
    headers: buildHeaders(),
    body: JSON.stringify(body || {})
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${method} ${path} → ${r.status} ${t}`);
  }
  return r.json();
}

/* =========================================================
   FUNCIÓN PARA GENERAR QR (NUEVA)
   ========================================================= */
async function generarQR(productId) {
  try {
    const r = await apiJson("POST", "/api/pagos/preferencia", {
      product_id: productId
    });

    if (!r.ok) {
      alert("Error generando preferencia");
      return;
    }

    const link = r.link;

    // Crear modal
    const modal = document.createElement("div");
    modal.style = `
      position: fixed; top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.65);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:999999;
    `;

    const card = document.createElement("div");
    card.style = `
      background:#fff;
      padding:20px;
      border-radius:12px;
      width:320px;
      text-align:center;
      box-shadow:0 0 20px rgba(0,0,0,0.4);
    `;

    const title = document.createElement("h2");
    title.innerText = "Escaneá para pagar";

    const canvas = document.createElement("canvas");

    // Generar el QR
    new QRious({
      element: canvas,
      value: link,
      size: 260
    });

    const btn = document.createElement("button");
    btn.innerText = "Cerrar";
    btn.style = `
      margin-top:15px;
      padding:8px 20px;
      font-size:15px;
    `;
    btn.onclick = () => modal.remove();

    card.appendChild(title);
    card.appendChild(canvas);
    card.appendChild(btn);
    modal.appendChild(card);
    document.body.appendChild(modal);

  } catch (e) {
    alert("Error: " + e.message);
  }
}

/* ========================================================= */

export default function AdminPanel() {
  const [adminSecret, setAdminSecretState] = useState(getAdminSecret());
  const [config, setConfig] = useState({});
  const [dispensers, setDispensers] = useState([]);
  const [pagos, setPagos] = useState([]);

  async function cargar() {
    try {
      const cfg = await apiGet("/api/config");
      const ds = await apiGet("/api/dispensers");
      const pg = await apiGet("/api/pagos?limit=20");
      setConfig(cfg);
      setDispensers(ds);
      setPagos(pg);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function guardarAdminSecret() {
    setAdminSecret(adminSecret);
    setAdminSecretState(adminSecret);
    cargar();
  }

  /* =====================================================
      RENDER PRINCIPAL
     ===================================================== */
  return (
    <div style={{ padding: 20, color: "#eee", background: "#0d1117", minHeight: "100vh" }}>
      <h1>Administración Dispenser Agua</h1>

      {/* ---------------- ADMIN SECRET ---------------- */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="password"
          placeholder="Admin secret"
          value={adminSecret}
          onChange={(e) => setAdminSecretState(e.target.value)}
          style={{ padding: "6px 10px", marginRight: 10 }}
        />
        <button onClick={guardarAdminSecret} style={{ padding: "6px 16px" }}>
          Guardar
        </button>
      </div>

      {/* ---------------- DISPENSERS ---------------- */}
      <h2>Dispensers</h2>

      {dispensers.map((d) => (
        <div key={d.id} style={{ border: "1px solid #333", padding: 10, marginBottom: 15, borderRadius: 8 }}>
          <h3>{d.nombre} ({d.device_id})</h3>

          {/* productos */}
          <Productos dispenserId={d.id} />
        </div>
      ))}

      {/* ---------------- PAGOS ---------------- */}
      <h2>Pagos recientes</h2>
      <button onClick={cargar}>Refrescar</button>
      <table style={{ marginTop: 10, width: "100%", color: "#fff" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>mp_payment_id</th>
            <th>Estado</th>
            <th>Producto</th>
            <th>Slot</th>
            <th>Monto</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {pagos.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.mp_payment_id}</td>
              <td>{p.estado}</td>
              <td>{p.producto}</td>
              <td>{p.slot_id}</td>
              <td>{p.monto}</td>
              <td>
                <button onClick={() => apiJson("POST", `/api/pagos/${p.id}/reenviar`)}>
                  Reenviar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   COMPONENTE DE PRODUCTOS POR DISPENSER
   ========================================================= */
function Productos({ dispenserId }) {
  const [productos, setProductos] = useState([]);

  async function cargar() {
    try {
      const r = await apiGet(`/api/productos?dispenser_id=${dispenserId}`);
      setProductos(r);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar(p) {
    await apiJson("PUT", `/api/productos/${p.id}`, p);
    cargar();
  }

  return (
    <>
      {productos.map((p) => (
        <div key={p.id} style={{ background: "#161b22", padding: 10, marginBottom: 10, borderRadius: 6 }}>
          <h4>{p.nombre} (slot {p.slot})</h4>

          <div style={{ display: "flex", gap: 10 }}>
            <div>
              Precio:
              <input
                type="number"
                value={p.precio}
                onChange={(e) => (p.precio = Number(e.target.value))}
              />
            </div>

            <div>
              Habilitado:
              <input
                type="checkbox"
                checked={p.habilitado}
                onChange={(e) => (p.habilitado = e.target.checked)}
              />
            </div>

            <button onClick={() => guardar(p)}>Guardar</button>
            <button onClick={() => generarQR(p.id)}>QR</button>
          </div>
        </div>
      ))}
    </>
  );
}
