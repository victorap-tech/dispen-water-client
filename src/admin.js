const API = "https://web-production-e7d2.up.railway.app";

function adminSecret() {
  return sessionStorage.getItem("adminSecret") || "";
}

function auth() {
  return {
    "Content-Type": "application/json",
    "x-admin-secret": adminSecret()
  };
}

function loginAdmin() {
  const v = document.getElementById("adminSecretInput").value.trim();
  if (!v) return alert("Ingrese adminSecret");
  sessionStorage.setItem("adminSecret", v);
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("panel").style.display = "block";
  cargarDispensers();
  cargarPagos();
}

async function cargarDispensers() {
  const r = await fetch(API + "/api/dispensers", { headers: auth() });
  const j = await r.json();
  const cont = document.getElementById("dispensers");
  cont.innerHTML = "";

  j.forEach(d => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>${d.device_id}</b><br>
      <label>Nombre:</label><input id="n-${d.id}" value="${d.nombre}"><br>
      <label>Stock:</label><input id="s-${d.id}" value="${d.stock}"><br>
      <label>Precio:</label><input id="p-${d.id}" value="${d.precio}"><br>
      <button onclick="guardar(${d.id})">Guardar</button>
      <button onclick="qr(${d.id})">QR</button>
    `;
    cont.appendChild(div);
  });
}

async function guardar(id) {
  const nombre = document.getElementById("n-"+id).value;
  const stock  = document.getElementById("s-"+id).value;
  const precio = document.getElementById("p-"+id).value;

  await fetch(API + "/api/dispensers/" + id, {
    method:"PUT",
    headers: auth(),
    body: JSON.stringify({nombre, stock, precio})
  });

  alert("Guardado");
}

function qr(id) {
  window.open(API + "/api/dispensers/" + id + "/qr", "_blank");
}

async function agregarDispenser() {
  await fetch(API + "/api/dispensers", {
    method:"POST",
    headers: auth(),
    body: JSON.stringify({nombre:"Nuevo", stock:0, precio:0})
  });
  cargarDispensers();
}

async function cargarPagos() {
  const r = await fetch(API + "/api/pagos", { headers: auth() });
  const j = await r.json();
  const div = document.getElementById("pagos");
  div.innerHTML = "";
  j.forEach(p => {
    const line = document.createElement("div");
    line.className = "card";
    line.innerHTML = `
      <b>${p.payment_id}</b> - ${p.estado}<br>
      Producto: ${p.producto} — Monto: ${p.monto}<br>
      ${p.fecha}
    `;
    div.appendChild(line);
  });
}

function vincularMP() {
  window.location.href = API + "/api/mp/oauth/init";
}

async function desvincularMP() {
  await fetch(API + "/api/mp/unlink", {
    method:"POST",
    headers: auth()
  });
  alert("Cuenta MP desvinculada");
}
