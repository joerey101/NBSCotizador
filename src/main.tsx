import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Raiz } from "./Raiz";
import "./styles.css";

// Tema guardado (lo maneja App); se aplica antes para que el login también lo respete.
try {
  const tema = JSON.parse(window.localStorage.getItem("nbs_theme") ?? '"light"');
  document.documentElement.setAttribute("data-theme", tema === "dark" ? "dark" : "light");
} catch {
  /* sin localStorage: queda el tema claro */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Raiz />
  </StrictMode>
);
