// src/AdminPanel.jsx – Admin Dispen-Agua (2 productos, con OAuth MP)
import React, { useEffect, useMemo, useRef, useState } from "react";

// ⚙️ URL del backend
// - En producción: poné REACT_APP_API_URL en Railway
// - En dev: si servís el front desde el mismo dominio/puerto, usa window.location.origin
const API_URL = (process.env.REACT_APP_API_URL || window.location.origin).replace(
  /\/$/,
  ""
);

// ========================
// Helpers de auth admin
// ========================
const getAdminSecret = () => sessionStorage.getItem("adminSecret") || "";
const setAdminSecret = (s) => sessionStorage.setItem("adminSecret", s || "");

// ========================
// Helpers de fetch
// ========================
async function apiGet(path) {
  const r = await fetch(`${API_URL}${path}`, {
    headers: { "x-admin-secret": getAdminSecret() },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`GET ${path} → ${r.status} ${t}`);
  }
  return r.json();
}

async function apiJson(method, path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": getAdminSecret(),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${method} ${path} → ${r.status} ${t}`);
  }
  return r.status === 204 ? { ok: true } : r.json();
}

// ========================
// Utilidades UI
// ========================
const prettyMoney = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(n || 0));

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");

// Siempre 2 slots (1 = fría, 2 = caliente)
function normalizeTwo(products) {
  const map = {};
  (products || []).forEach((p) => (map[p.slot] = p));
  const arr = [];
  for (let s = 1; s <= 2; s++) {
    arr.push(
      map[s] || {
        id: null,
        nombre: s === 1 ? "Agua fría" : "Agua caliente",
        precio: "",
        slot: s,
        habilitado: true,
        __placeholder: true,
      }
    );
  }
  return arr;
}

// ========================
// Componente principal
// ========================
export default function AdminPanel() {
  const [authOk, setAuthOk] = useState(!!getAdminSecret());
  const [checkingAuth, setCheckingAuth] = useState(false);

  const [mpMode, setMpMode] = useState("test");
  const live = mpMode === "live";

  // Estado OAuth según backend: {vinculado, user_id}
  const [mpOAuth, setMpOAuth] = useState({ vinculado: false, user_id: "" });

  const [dispensers, setDispensers] = useState([]);
  const [slotsByDisp, setSlotsByDisp] = useState({});
  const [expanded, setExpanded] = useState({});
  const editRef = useRef({});

  const [pagos, setPagos] = useState([]);
  const pagosTimer = useRef(null);

  const [qrLink, setQrLink] = useState("");
  const [showQR, setShowQR] = useState(false);

  const [creatingDisp, setCreatingDisp] = useState(false);

  // ========================
  // LOGIN ADMIN
  // ========================
  const promptPassword = async () => {
    const pwd = window.prompt("Ingresá la contraseña de admin:");
    if (!pwd) return false;

    setAdminSecret(pwd);
    setCheckingAuth(true);

    try {
      const r = await fetch(`${API_URL}/api/dispensers`, {
        headers: { "x-admin-secret": pwd },
      });
      if (!r.ok) throw new Error("Auth error");
      setAuthOk(true);
      return true;
    } catch {
      alert("Contraseña inválida o backend inaccesible.");
      setAdminSecret("");
      setAuthOk(false);
      return false;
    } finally {
      setCheckingAuth(false);
    }
  };

  // ========================
  // Carga de configuración
  // ========================
  const loadConfig = async () => {
    try {
      const c = await apiGet("/api/config");
      setMpMode((c?.mp_mode || "test").toLowerCase());
    } catch {
      /* ignore */
    }
  };

  const loadOAuthStatus = async () => {
    try {
      const data = await apiGet("/api/mp/oauth/status");
      // Espera: { vinculado: bool, user_id: "..." }
      setMpOAuth({
        vinculado: !!data.vinculado,
        user_id: data.user_id || "",
      });
    } catch {
      /* ignore */
    }
  };

  const toggleMode = async () => {
    try {
      await apiJson("POST", "/api/mp/mode", {
        mode: live ? "test" : "live",
      });
      await loadConfig();
    } catch (e) {
      alert(e.message);
    }
  };

  // ========================
  // Dispensers
  // ========================
  const loadDispensers = async () => {
    const ds = await apiGet("/api/dispensers");
    setDispensers(ds || []);
    const ex = {};
    (ds || []).forEach((d, i) => (ex[d.id] = i === 0));
    setExpanded(ex);
  };

  const loadProductosOf = async (dispId) => {
    try {
      const data = await apiGet(`/api/productos?dispenser_id=${dispId}`);
      const two = normalizeTwo(data);

      const prefix = `${dispId}-`;
      const editing = Object.keys(editRef.current).some(
        (k) => k.startsWith(prefix) && editRef.current[k]
      );
      if (!editing) {
        setSlotsByDisp((prev) => ({
          ...prev,
          [dispId]: two,
        }));
      }
    } catch {
      /* ignore */
    }
  };

  const loadAllSlots = async () => {
    await Promise.all((dispensers || []).map((d) => loadProductosOf(d.id)));
  };

  const loadPagos = async () => {
    try {
      const data = await apiGet("/api/pagos?limit=10");
      setPagos(data || []);
    } catch {
      /* ignore */
    }
  };

  // ========================
  // useEffect – inicio
  // ========================
  useEffect(() => {
    if (!authOk) return;
    (async () => {
      await Promise.all([loadConfig(), loadOAuthStatus(), loadDispensers()]);
    })();

    return () => {
      if (pagosTimer.current) clearInterval(pagosTimer.current);
    };
  }, [authOk]);

  useEffect(() => {
    if (!authOk || (dispensers || []).length === 0) return;
    loadAllSlots();
    loadPagos();
    pagosTimer.current = setInterval(() => loadPagos(), 5000);
  }, [dispensers.length, authOk]);

  const setEditing = (dispId, slot, v) => {
    editRef.current[`${dispId}-${slot}`] = v;
  };

  const updateSlotField = (dispId, slot, field, value) => {
    setSlotsByDisp((prev) => {
      const arr = prev[dispId] ? [...prev[dispId]] : [];
      const idx = slot - 1;
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [dispId]: arr };
    });
  };

  // ========================
  // Crear dispenser
  // ========================
  const crearDispenser = async () => {
    const nombre = window.prompt(
      "Nombre interno del dispenser (ej: dispen-02). Si lo dejás vacío, se genera automático:"
    );
    setCreatingDisp(true);
    try {
      const payload = {};
      if (nombre && nombre.trim()) {
        payload.nombre = nombre.trim();
      }
      const r = await apiJson("POST", "/api/dispensers", payload);
      await loadDispensers();
      alert(`Dispenser creado: ${r.dispenser?.device_id || "OK"}`);
    } catch (e) {
      alert("Error creando dispenser: " + e.message);
    } finally {
      setCreatingDisp(false);
    }
  };

  // ========================
  // Guardar configuración de producto
  // ========================
  const saveSlot = (disp, slotIdx) => async () => {
    const slotNum = slotIdx + 1;
    const row = (slotsByDisp[disp.id] || [])[slotIdx];
    if (!row) return;

    try {
      const payload = {
        nombre: String(row.nombre || "").trim(),
        precio: Number(row.precio || 0),
        habilitado: !!row.habilitado,
        slot: slotNum,
      };

      if (!payload.nombre) return alert("Ingresá un nombre");
      if (!payload.precio || payload.precio <= 0)
        return alert("Ingresá precio > 0");

      let res;
      if (row.__placeholder || !row.id) {
        // crear
        res = await apiJson("POST", "/api/productos", {
          ...payload,
          dispenser_id: disp.id,
        });
      } else {
        // actualizar
        res = await apiJson("PUT", `/api/productos/${row.id}`, payload);
      }

      const p = res?.producto;
      if (p) {
        setSlotsByDisp((prev) => {
          const arr = [...(prev[disp.id] || [])];
          arr[slotIdx] = p;
          return { ...prev, [disp.id]: arr };
        });
      }

      alert("Guardado");
    } catch (e) {
      alert(e.message);
    } finally {
      await loadProductosOf(disp.id);
      setEditing(disp.id, slotNum, false);
    }
  };

  // ========================
  // Toggle habilitado
  // ========================
  const toggleHabilitado = (disp, slotIdx) => async (checked) => {
    const row = (slotsByDisp[disp.id] || [])[slotIdx];
    if (!row?.id) return alert("Primero guardá el producto");

    updateSlotField(disp.id, slotIdx + 1, "habilitado", checked);

    try {
      const res = await apiJson("PUT", `/api/productos/${row.id}`, {
        habilitado: !!checked,
      });

      const p = res?.producto;
      if (p) {
        setSlotsByDisp((prev) => {
          const arr = [...(prev[disp.id] || [])];
          arr[slotIdx] = p;
          return { ...prev, [disp.id]: arr };
        });
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // ========================
  // QR de pago
  // ========================
  const mostrarQR = (row) => async () => {
    if (!row?.id) return alert("Guardá primero");
    try {
      const r = await apiJson("POST", "/api/pagos/preferencia", {
        product_id: row.id,
      });
      if (!r.ok || !r.link) return alert("Error creando link de pago");
      setQrLink(r.link);
      setShowQR(true);
    } catch (e) {
      alert(e.message);
    }
  };

  const qrImg = useMemo(() => {
    if (!qrLink) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      qrLink
    )}`;
  }, [qrLink]);

  // ========================
  // OAuth – Vincular / Desvincular
  // ========================
  const iniciarVinculacion = async () => {
    try {
      const r = await apiGet("/api/mp/oauth/init");
      const url = r.url || r.auth_url;
      if (!url) return alert("No se pudo obtener URL de MercadoPago.");
      window.open(url, "_blank");
    } catch (e) {
      alert("Error iniciando vinculación: " + e.message);
    }
  };

  const desvincular = async () => {
    if (!window.confirm("¿Desvincular la cuenta de MercadoPago?")) return;
    try {
      await apiJson("POST", "/api/mp/oauth/unlink", {});
      await loadOAuthStatus();
      alert("Cuenta MercadoPago desvinculada.");
    } catch (e) {
      alert("Error desvinculando: " + e.message);
    }
  };

  // ========================
  // VISTA LOGIN
  // ========================
  if (!authOk) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 460, margin: "100px auto" }}>
          <h1 style={styles.title}>Dispen-Agua · Admin</h1>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Ingresá con la contraseña de administrador para gestionar
            dispensers, precios y cuentas de MercadoPago.
          </p>
          <button
            style={{ ...styles.primaryBtn, marginTop: 12, width: "100%" }}
            onClick={promptPassword}
            disabled={checkingAuth}
          >
            {checkingAuth ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // PANEL PRINCIPAL
  // ========================
  return (
    <div style={styles.page}>
      {/* HEADER */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Administración Dispen-Agua</h1>
          <div style={styles.subtitle}>
            Backend: <code>{API_URL}</code>
          </div>

          {/* Estado de MP */}
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <b>MercadoPago (OAuth): </b>
            {mpOAuth.vinculado ? (
              <span style={{ color: "#10b981", fontWeight: 700 }}>
                Vinculado – usuario #{mpOAuth.user_id || "?"}
              </span>
            ) : (
              <span style={{ color: "#ef4444", fontWeight: 700 }}>
                No vinculado
              </span>
            )}
          </div>

          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {mpOAuth.vinculado
              ? "Los links de cobro se crearán con la cuenta vinculada."
              : "Si no hay cuenta vinculada, se usan los tokens globales (TEST / LIVE)."}
          </div>
        </div>

        {/* ACCIONES */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={styles.secondaryBtn} onClick={iniciarVinculacion}>
            Vincular MP
          </button>
          <button style={styles.dangerBtn} onClick={desvincular}>
            Desvincular
          </button>

          {/* Chip de modo MP (solo relevante si NO hay OAuth) */}
          <span
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: live ? "#10b981" : "#f59e0b",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {live ? "LIVE" : "TEST"}
          </span>
          <button style={styles.secondaryBtn} onClick={toggleMode}>
            Cambiar modo
          </button>
        </div>
      </header>

      {/* BOTÓN AGREGAR DISPENSER */}
      <section style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2 style={styles.h2}>Dispensers configurados</h2>
          <button
            style={styles.primaryBtn}
            onClick={crearDispenser}
            disabled={creatingDisp}
          >
            {creatingDisp ? "Creando…" : "Agregar dispenser"}
          </button>
        </div>
      </section>

      {/* LISTA DE DISPENSERS */}
      {dispensers.map((disp) => {
        const rows = slotsByDisp[disp.id] || normalizeTwo([]);
        return (
          <section key={disp.id} style={styles.card}>
            <div
              style={styles.dispHeader}
              onClick={() =>
                setExpanded((e) => ({ ...e, [disp.id]: !e[disp.id] }))
              }
            >
              <div style={styles.dispTitle}>
                <span style={styles.dispBadge}>{disp.device_id}</span>
                <b>{disp.nombre}</b>
              </div>
            </div>

            {expanded[disp.id] && (
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Nombre</th>
                      <th>Precio</th>
                      <th>Activo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const slotNum = idx + 1;
                      return (
                        <tr key={`${disp.id}-${slotNum}`}>
                          <td>{slotNum}</td>

                          <td>
                            <input
                              style={styles.inputInline}
                              value={row.nombre}
                              onChange={(e) =>
                                updateSlotField(
                                  disp.id,
                                  slotNum,
                                  "nombre",
                                  e.target.value
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              style={styles.inputInline}
                              type="number"
                              value={row.precio}
                              onChange={(e) =>
                                updateSlotField(
                                  disp.id,
                                  slotNum,
                                  "precio",
                                  e.target.value
                                )
                              }
                            />
                          </td>

                          <td>
                            <Toggle
                              checked={!!row.habilitado}
                              onChange={(v) => toggleHabilitado(disp, idx)(v)}
                            />
                          </td>

                          <td>
                            <button
                              style={styles.primaryBtn}
                              onClick={saveSlot(disp, idx)}
                            >
                              Guardar
                            </button>
                            <button
                              style={{ ...styles.qrBtn, marginLeft: 6 }}
                              onClick={mostrarQR(row)}
                            >
                              QR
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {/* PAGOS RECIENTES */}
      <section style={styles.card}>
        <h2 style={styles.h2}>Pagos recientes</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>mp_payment_id</th>
                <th>Estado</th>
                <th>Monto</th>
                <th>Slot</th>
                <th>Producto</th>
                <th>Device</th>
                <th>Fecha</th>
                <th>Reintentar</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const puede = p.estado === "approved" && !p.dispensado;
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.mp_payment_id}</td>
                    <td>{p.estado}</td>
                    <td>{prettyMoney(p.monto)}</td>
                    <td>{p.slot_id}</td>
                    <td>{p.producto}</td>
                    <td>{p.device_id}</td>
                    <td>{fmtDate(p.created_at)}</td>
                    <td>
                      <button
                        style={{
                          ...styles.secondaryBtn,
                          opacity: puede ? 1 : 0.5,
                        }}
                        disabled={!puede}
                        onClick={() =>
                          apiJson("POST", `/api/pagos/${p.id}/reenviar`).then(
                            (r) => alert(r.msg || "OK")
                          )
                        }
                      >
                        ↻
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL QR */}
      {showQR && (
        <div style={styles.modalBackdrop} onClick={() => setShowQR(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Link de pago</h3>
            <p style={{ fontSize: 12, wordBreak: "break-all" }}>{qrLink}</p>
            {qrImg && (
              <img
                src={qrImg}
                alt="QR"
                style={{ width: 220, height: 220, borderRadius: 8 }}
              />
            )}
            <button
              style={{ ...styles.primaryBtn, marginTop: 12 }}
              onClick={() => setShowQR(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// Toggle simple
// ========================
function Toggle({ checked, onChange }) {
  return (
    <label style={styles.switch}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: "none" }}
      />
      <span
        style={{
          ...styles.slider,
          background: checked ? "#10b981" : "#374151",
          justifyContent: checked ? "flex-end" : "flex-start",
        }}
      >
        <span style={styles.knob} />
      </span>
    </label>
  );
}

// ========================
// STYLES
// ========================
const styles = {
  page: {
    background: "#0b1220",
    color: "#e5e7eb",
    minHeight: "100vh",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    padding: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800 },
  subtitle: { fontSize: 12, opacity: 0.7 },
  h2: { fontSize: 18, marginBottom: 8 },

  card: {
    background: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 16,
  },

  primaryBtn: {
    background: "#10b981",
    padding: "8px 12px",
    border: "none",
    borderRadius: 10,
    color: "#06251d",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },

  secondaryBtn: {
    background: "#1f2937",
    padding: "8px 12px",
    border: "1px solid #374151",
    borderRadius: 10,
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 13,
  },

  dangerBtn: {
    background: "#ef4444",
    padding: "8px 12px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    color: "#2a0a0a",
    fontWeight: 700,
    fontSize: 13,
  },

  qrBtn: {
    background: "#3b82f6",
    padding: "8px 10px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    color: "#061528",
    fontWeight: 700,
    fontSize: 13,
  },

  inputInline: {
    width: "100%",
    padding: "6px 8px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e5e7eb",
    outline: "none",
    fontSize: 13,
  },

  table: {
    width: "100%",
    borderSpacing: 0,
    fontSize: 13,
  },

  dispHeader: { cursor: "pointer" },
  dispTitle: { display: "flex", gap: 8, alignItems: "center" },
  dispBadge: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 999,
    background: "#1f2937",
    border: "1px solid #374151",
  },

  switch: { position: "relative", width: 44, height: 24, display: "inline-block" },
  slider: {
    position: "relative",
    width: "100%",
    height: "100%",
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    padding: 2,
    boxSizing: "border-box",
    transition: "background .2s",
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#f9fafb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
    transition: "transform .2s",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "grid",
    placeItems: "center",
    zIndex: 50,
  },
  modal: {
    background: "#0b1220",
    padding: 22,
    borderRadius: 16,
    maxWidth: 480,
    width: "90%",
    border: "1px solid rgba(255,255,255,0.12)",
  },
};
