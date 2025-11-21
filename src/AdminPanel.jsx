import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "./api";

export default function AdminPanel() {
  const [dispensers, setDispensers] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const ds = await apiGet("/api/dispensers");
      const ps = await apiGet("/api/productos");
      const pg = await apiGet("/api/pagos?limit=20");
      setDispensers(ds);
      setProductos(ps);
      setPagos(pg);
    } finally {
      setLoading(false);
    }
  }

  async function addDispenser() {
    try {
      await apiPost("/api/dispensers", { nombre: "" });
      loadAll();
    } catch (e) {
      alert("Error creando dispenser: " + e.message);
    }
  }

  async function saveProducto(p) {
    try {
      await apiPut(`/api/productos/${p.id}`, {
        nombre: p.nombre,
        precio: p.precio,
        habilitado: p.habilitado,
        slot: p.slot
      });
      loadAll();
    } catch (e) {
      alert("Error guardando: " + e.message);
    }
  }

  async function vincularMP() {
    try {
      const r = await apiGet("/api/mp/oauth/init");
      if (!r.url) return alert("No se pudo obtener URL OAuth");
      window.location.href = r.url;
    } catch (e) {
      alert("Error OAuth: " + e.message);
    }
  }

  async function desvincularMP() {
    await apiPost("/api/mp/oauth/unlink", {});
    alert("Cuenta desvinculada");
    loadAll();
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="panel">
      <h1>Administración Dispensers</h1>

      <button onClick={addDispenser} className="add">
        + Agregar Dispenser
      </button>

      <button onClick={vincularMP} className="vincular">
        Vincular MP
      </button>

      <button onClick={desvincularMP} className="desvincular">
        Desvincular
      </button>

      {loading && <p>Cargando...</p>}

      {dispensers.map((d) => (
        <div key={d.id} className="disp-card">
          <h2>{d.nombre}</h2>

          {productos
            .filter((p) => p.dispenser_id === d.id)
            .map((p) => (
              <div key={p.id} className="prod-row">
                <input
                  value={p.nombre}
                  onChange={(e) =>
                    setProductos((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, nombre: e.target.value } : x
                      )
                    )
                  }
                />

                <input
                  type="number"
                  value={p.precio}
                  onChange={(e) =>
                    setProductos((prev) =>
                      prev.map((x) =>
                        x.id === p.id ? { ...x, precio: e.target.value } : x
                      )
                    )
                  }
                />

                <button onClick={() => saveProducto(p)}>Guardar</button>
              </div>
            ))}
        </div>
      ))}

      <h2>Pagos recientes</h2>
      {pagos.map((p) => (
        <div key={p.id} className="pago">
          #{p.id} — {p.monto} — {p.estado} — slot {p.slot_id}
        </div>
      ))}
    </div>
  );
}
