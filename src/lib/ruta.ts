// Navegación mínima por hash (#/clientes, #/clientes/<id>) para el CRM.
// Sin hash = cotizador. El hash de recuperación de clave (#...type=recovery) lo maneja supabase-js.
import { useEffect, useState } from "react";

export type Ruta =
  | { pantalla: "cotizador" }
  | { pantalla: "presupuestos" }
  | { pantalla: "oportunidades" }
  | { pantalla: "oportunidad"; id: string }
  | { pantalla: "equipo" }
  | { pantalla: "comisiones" }
  | { pantalla: "dashboard" }
  | { pantalla: "pedidos" }
  | { pantalla: "pedido"; id: string }
  | { pantalla: "stock" }
  | { pantalla: "movimientos" }
  | { pantalla: "clientes" }
  | { pantalla: "cliente_nuevo" }
  | { pantalla: "cliente"; id: string };

function leer(): Ruta {
  const partes = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (partes[0] === "presupuestos") return { pantalla: "presupuestos" };
  if (partes[0] === "equipo") return { pantalla: "equipo" };
  if (partes[0] === "comisiones") return { pantalla: "comisiones" };
  if (partes[0] === "pedidos") return partes[1] ? { pantalla: "pedido", id: partes[1] } : { pantalla: "pedidos" };
  if (partes[0] === "stock") return { pantalla: "stock" };
  if (partes[0] === "dashboard") return { pantalla: "dashboard" };
  if (partes[0] === "movimientos") return { pantalla: "movimientos" };
  if (partes[0] === "oportunidades") return partes[1] ? { pantalla: "oportunidad", id: partes[1] } : { pantalla: "oportunidades" };
  if (partes[0] !== "clientes") return { pantalla: "cotizador" };
  if (partes[1] === "nuevo") return { pantalla: "cliente_nuevo" };
  if (partes[1]) return { pantalla: "cliente", id: partes[1] };
  return { pantalla: "clientes" };
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => {
    const cambio = () => setRuta(leer());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);
  return ruta;
}

export function ir(hash: string) {
  window.location.hash = hash;
}
