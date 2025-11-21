<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin Dispen Agua</title>

<style>
body { font-family: Arial; padding: 15px; }
input, button { padding: 8px; margin: 5px; }
.dispenser { border: 1px solid #ccc; padding: 10px; margin-top: 15px; }
</style>

</head>

<body>

<h2>Administración Dispenser Agua</h2>

<div id="login">
  <p>Ingrese adminSecret:</p>
  <input id="secret" />
  <button onclick="login()">Ingresar</button>
</div>

<div id="panel" style="display:none;">
  <button onclick="vincular()">Vincular MP</button>
  <button onclick="desvincular()">Desvincular</button>
  <button onclick="agregar()">Agregar Dispenser</button>

  <h3>Dispensers</h3>
  <div id="dispensers"></div>

  <h3>Pagos recientes</h3>
  <button onclick="cargarPagos()">Refrescar</button>
  <table border="1" cellpadding="4">
    <thead><tr><th>ID</th><th>Estado</th><th>Producto</th><th>Fecha</th></tr></thead>
    <tbody id="pagos"></tbody>
  </table>
</div>

<script>
const API = "https://web-production-e7d2.up.railway.app";
let adminSecret = "";

// ---------------- LOGIN -----------------
function login() {
    adminSecret = document.getElementById("secret").value.trim();
    if (!adminSecret) return alert("Falta adminSecret");

    sessionStorage.setItem("adminSecret", adminSecret);
    document.getElementById("login").style.display = "none";
    document.getElementById("panel").style.display = "block";
    cargarDispensers();
}

// Cargar si ya estaba logueado
const saved = sessionStorage.getItem("adminSecret");
if (saved) {
    adminSecret = saved;
    document.getElementById("login").style.display = "none";
    document.getElementById("panel").style.display = "block";
    cargarDispensers();
}

// ---------------- API -----------------
async function api(path, body) {
    return fetch(API + path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret
        },
        body: JSON.stringify(body)
    }).then(r => r.json());
}

// ---------------- DISPENSERS -----------------
async function cargarDispensers() {
    const r = await api("/api/list_dispensers", {});
    const cont = document.getElementById("dispensers");
    cont.innerHTML = "";

    r.lista.forEach(d => {
        const div = document.createElement("div");
        div.className = "dispenser";
        div.innerHTML = `
           <b>ID:</b> ${d.dispenser}<br>
           Producto A: <input id="p1-${d.dispenser}" value="${d.p1_nombre}">
           Precio: <input id="pr1-${d.dispenser}" value="${d.p1_precio}">
           <br>
           Producto B: <input id="p2-${d.dispenser}" value="${d.p2_nombre}">
           Precio: <input id="pr2-${d.dispenser}" value="${d.p2_precio}">
           <br>
           <button onclick="guardar('${d.dispenser}')">Guardar</button>
           <button onclick="qr('${d.dispenser}')">QR</button>
        `;
        cont.appendChild(div);
    });
}

async function guardar(id) {
    await api("/api/update_dispenser", {
        dispenser: id,
        p1_nombre: document.getElementById("p1-" + id).value,
        p1_precio: document.getElementById("pr1-" + id).value,
        p2_nombre: document.getElementById("p2-" + id).value,
        p2_precio: document.getElementById("pr2-" + id).value
    });
    alert("Guardado!");
}

function qr(id) {
    window.open(API + "/api/qr/" + id, "_blank");
}

async function agregar() {
    const id = prompt("ID nuevo (ej: dispen-03):");
    if (!id) return;
    await api("/api/add_dispenser", { dispenser: id });
    cargarDispensers();
}

// ---------------- PAGOS -----------------
async function cargarPagos() {
    const r = await api("/api/pagos_recientes", {});
    const tbody = document.getElementById("pagos");
    tbody.innerHTML = "";

    r.pagos.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${p.payment_id}</td><td>${p.estado}</td><td>${p.producto}</td><td>${p.fecha}</td>`;
        tbody.appendChild(tr);
    });
}

// ---------------- MERCADO PAGO -----------------
function vincular() {
    window.location.href = API + "/api/mp_auth_start?adminSecret=" + adminSecret;
}
function desvincular() {
    window.location.href = API + "/api/mp_remove?adminSecret=" + adminSecret;
}

</script>

</body>
</html>
