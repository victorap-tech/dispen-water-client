const API_URL = "https://web-production-e7d2.up.railway.app";

export function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-secret": sessionStorage.getItem("adminSecret") || ""
  };
}

export async function apiGet(path) {
  const r = await fetch(API_URL + path, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(API_URL + path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPut(path, body) {
  const r = await fetch(API_URL + path, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
