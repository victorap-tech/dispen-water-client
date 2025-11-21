import React, { useState } from "react";
import AdminPanel from "./AdminPanel";

export default function App() {
  const [logged, setLogged] = useState(
    !!sessionStorage.getItem("adminSecret")
  );
  const [secret, setSecret] = useState("");

  function login() {
    if (!secret.trim()) return alert("Ingrese adminSecret");
    sessionStorage.setItem("adminSecret", secret.trim());
    setLogged(true);
  }

  if (!logged) {
    return (
      <div className="login">
        <h1>Administración Dispenser Agua</h1>
        <input
          placeholder="adminSecret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <button onClick={login}>Ingresar</button>
      </div>
    );
  }

  return <AdminPanel />;
}
