const API_BASE = "https://web-production-e7d2.up.railway.app";

const $ = (sel) => document.querySelector(sel);

function getAdminSecret() {
  return sessionStorage.getItem("adminSecret") || "";
}

function setAdminSecret(value) {
  sessionStorage.setItem("adminSecret", value || "");
}

function buildHeaders(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const s = getAdminSecret();
  if (s) h["x-admin-secret"] = s;
  return h;
}

async function apiGet(path) {
  const r = await fetch(API_BASE + path, {
    method: "GET",
    headers: buildHeaders(false),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`GET ${path} → ${r.status} ${txt}`);
  }
  return r.json();
}

async function apiJson(method, path, body) {
  const r = await fetch(API_BASE + path, {
    method,
    headers: buildHeaders(true),
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${method} ${path} → ${r.status} ${txt}`);
  }
  return r.json();
}

function showStatus(msg, isError = false) {
  const bar = $("#statusBar");
  if (!bar) return;
  bar.textContent = msg;
  bar.style.background = isError
    ? "rgba(220, 38, 38, 0.96)"
    : "rgba(37, 99, 235, 0.96)";
  bar.classList.add("show");
  setTimeout(() => bar.classList.remove("show"), 2500);
}

/* ======================= RENDER ======================= */

async function loadAll() {
  try {
    showStatus("Cargando datos…");
    const [config, dispensers, productos, pagos] = await Promise.all([
      apiGet("/api/config"),
      apiGet("/api/dispensers"),
      apiGet("/api/productos"),
      apiGet("/api/pagos?limit=40"),
    ]);

    renderConfig(config);
    renderDispensers(dispensers, productos);
    renderPagos(pagos);
    showStatus("Datos cargados.");
  } catch (err) {
    console.error(err);
    showStatus("Error cargando datos. Revisar admin secret / backend.", true);
  }
}

function renderConfig(config) {
  $("#mpModeLabel").textContent = `Modo: ${config.mp_mode || "test"}`;
  $("#mpLinkedLabel").textContent = `Vinculado: ${
    config.oauth_linked ? "Sí" : "No"
  }`;
}

function renderDispensers(dispensers, productos) {
  const cont = $("#dispensersContainer");
  cont.innerHTML = "";

  const mapProd = {};
  (productos || []).forEach((p) => {
    if (!p.dispenser_id) return;
    if (!mapProd[p.dispenser_id]) mapProd[p.dispenser_id] = [];
    mapProd[p.dispenser_id].push(p);
  });

  dispensers.forEach((d) => {
    const card = document.createElement("div");
    card.className = "dispenser-card";

    const header = document.createElement("div");
    header.className = "dispenser-header";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = d.nombre || "";
    nameInput.placeholder = "Nombre";

    const devInput = document.createElement("input");
    devInput.type = "text";
    devInput.value = d.device_id || "";
    devInput.placeholder = "device_id";

    const lblActivo = document.createElement("label");
    lblActivo.className = "switch-label";
    const chkActivo = document.createElement("input");
    chkActivo.type = "checkbox";
    chkActivo.checked = !!d.activo;
    lblActivo.append(chkActivo, document.createTextNode("Activo"));

    const btnGuardarDisp = document.createElement("button");
    btnGuardarDisp.textContent = "Guardar dispenser";
    btnGuardarDisp.addEventListener("click", async () => {
      try {
        const body = {
          nombre: nameInput.value.trim(),
          device_id: devInput.value.trim(),
          activo: chkActivo.checked,
        };
        await apiJson("PUT", `/api/dispensers/${d.id}`, body);
        showStatus("Dispenser guardado.");
        loadAll();
      } catch (err) {
        console.error(err);
        showStatus("Error guardando dispenser.", true);
      }
    });

    header.append(
      nameInput,
      devInput,
      lblActivo,
      btnGuardarDisp
    );
    card.appendChild(header);

    const prods = (mapProd[d.id] || []).slice().sort((a, b) => a.slot - b.slot);

    const table = document.createElement("table");
    table.className = "product-table";
    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Slot</th><th>Nombre</th><th>Precio</th><th>Activo</th><th>Acciones</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");

    prods.forEach((p) => {
      const tr = document.createElement("tr");
      tr.className = "product-row";

      const tdSlot = document.createElement("td");
      tdSlot.textContent = p.slot;

      const tdNombre = document.createElement("td");
      const inNombre = document.createElement("input");
      inNombre.type = "text";
      inNombre.value = p.nombre || "";
      tdNombre.appendChild(inNombre);

      const tdPrecio = document.createElement("td");
      const inPrecio = document.createElement("input");
      inPrecio.type = "number";
      inPrecio.step = "1";
      inPrecio.min = "0";
      inPrecio.value = p.precio != null ? p.precio : 0;
      tdPrecio.appendChild(inPrecio);

      const tdHab = document.createElement("td");
      const lblHab = document.createElement("label");
      lblHab.className = "switch-label";
      const chkHab = document.createElement("input");
      chkHab.type = "checkbox";
      chkHab.checked = !!p.habilitado;
      lblHab.append(chkHab, document.createTextNode("On"));
      tdHab.appendChild(lblHab);

      const tdAcc = document.createElement("td");
      const btnAccWrap = document.createElement("div");
      btnAccWrap.className = "product-row-actions";

      const btnGuardarProd = document.createElement("button");
      btnGuardarProd.textContent = "Guardar";
      btnGuardarProd.addEventListener("click", async () => {
        try {
          const body = {
            nombre: inNombre.value.trim(),
            precio: Number(inPrecio.value || 0),
            habilitado: chkHab.checked,
          };
          await apiJson("PUT", `/api/productos/${p.id}`, body);
          showStatus("Producto guardado.");
          loadAll();
        } catch (err) {
          console.error(err);
          showStatus("Error guardando producto.", true);
        }
      });

      const btnQR = document.createElement("button");
      btnQR.textContent = "QR";
      btnQR.addEventListener("click", async () => {
        try {
          const res = await apiJson("POST", "/api/pagos/preferencia", {
            product_id: p.id,
          });
          const link = res.link;
          if (link) {
            window.open(link, "_blank");
            showStatus("Preferencia creada. Se abrió el link.");
          } else {
            showStatus("Respuesta sin link de pago.", true);
          }
        } catch (err) {
          console.error(err);
          showStatus("Error creando preferencia MP.", true);
        }
      });

      btnAccWrap.append(btnGuardarProd, btnQR);
      tdAcc.appendChild(btnAccWrap);

      tr.append(tdSlot, tdNombre, tdPrecio, tdHab, tdAcc);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    card.appendChild(table);

    cont.appendChild(card);
  });
}

function renderPagos(pagos) {
  const body = $("#pagosBody");
  body.innerHTML = "";
  (pagos || []).forEach((p) => {
    const tr = document.createElement("tr");

    const c = (txt) => {
      const td = document.createElement("td");
      td.textContent = txt;
      return td;
    };

    tr.appendChild(c(p.id));
    tr.appendChild(c(p.mp_payment_id));
    tr.appendChild(c(p.estado));
    tr.appendChild(c(p.producto));
    tr.appendChild(c(p.slot_id));
    tr.appendChild(c(p.device_id || ""));
    tr.appendChild(c(p.monto));
    tr.appendChild(c(p.created_at ? p.created_at.replace("T", " ").slice(0, 19) : ""));

    const tdAcc = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Reenviar";
    btn.addEventListener("click", async () => {
      try {
        await apiJson("POST", `/api/pagos/${p.id}/reenviar`, {});
        showStatus("Comando MQTT reenviado.");
      } catch (err) {
        console.error(err);
        showStatus("Error reenviando comando.", true);
      }
    });
    tdAcc.appendChild(btn);
    tr.appendChild(tdAcc);

    body.appendChild(tr);
  });
}

/* =================== HANDLERS UI ====================== */

function setupUi() {
  $("#backendUrl").textContent = API_BASE;

  // Admin secret
  const inputSecret = $("#adminSecretInput");
  const btnSaveSecret = $("#saveAdminSecretBtn");
  const saved = getAdminSecret();
  if (saved) inputSecret.value = saved;

  btnSaveSecret.addEventListener("click", () => {
    setAdminSecret(inputSecret.value.trim());
    showStatus("Admin secret guardado en este navegador.");
    loadAll();
  });

  // MP mode
  $("#btnMpTest").addEventListener("click", async () => {
    try {
      await apiJson("POST", "/api/mp/mode", { mode: "test" });
      showStatus("Modo MP: TEST");
      loadAll();
    } catch (err) {
      console.error(err);
      showStatus("Error cambiando modo MP.", true);
    }
  });

  $("#btnMpLive").addEventListener("click", async () => {
    try {
      await apiJson("POST", "/api/mp/mode", { mode: "live" });
      showStatus("Modo MP: PROD");
      loadAll();
    } catch (err) {
      console.error(err);
      showStatus("Error cambiando modo MP.", true);
    }
  });

  // Vincular / desvincular
  $("#btnMpVincular").addEventListener("click", async () => {
    try {
      const res = await apiGet("/api/mp/oauth/init");
      if (res.url) {
        showStatus("Redirigiendo a MercadoPago…");
        window.location.href = res.url;
      } else {
        showStatus("No se recibió URL OAuth.", true);
      }
    } catch (err) {
      console.error(err);
      showStatus("Error obteniendo URL OAuth.", true);
    }
  });

  $("#btnMpDesvincular").addEventListener("click", async () => {
    try {
      await apiJson("POST", "/api/mp/oauth/unlink", {});
      showStatus("Cuenta MP desvinculada.");
      loadAll();
    } catch (err) {
      console.error(err);
      showStatus("Error desvinculando cuenta MP.", true);
    }
  });

  // Agregar dispenser
  $("#btnAgregarDispenser").addEventListener("click", async () => {
    try {
      const res = await apiJson("POST", "/api/dispensers", {});
      showStatus("Dispenser creado.");
      console.log("Nuevo dispenser", res);
      loadAll();
    } catch (err) {
      console.error(err);
      showStatus("Error creando dispenser.", true);
    }
  });

  // Refrescar pagos
  $("#btnRefrescarPagos").addEventListener("click", loadAll);
}

/* ===================== INIT ========================= */

document.addEventListener("DOMContentLoaded", () => {
  setupUi();
  loadAll();
});
