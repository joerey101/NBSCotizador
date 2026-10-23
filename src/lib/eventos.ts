// Avisos entre las pantallas del CRM y el cotizador (que queda montado en segundo plano).
// Ej.: desde "Presupuestos" se pide abrir uno; desde la ficha del cliente, empezar uno nuevo.
export type PedidoCotizador =
  | { tipo: "abrir"; id: string }
  | { tipo: "nuevo_para_cliente"; clienteId: string };

const EVENTO = "nbs:cotizador";

export function pedirAlCotizador(p: PedidoCotizador) {
  window.dispatchEvent(new CustomEvent<PedidoCotizador>(EVENTO, { detail: p }));
}

export function escucharPedidos(fn: (p: PedidoCotizador) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<PedidoCotizador>).detail);
  window.addEventListener(EVENTO, h);
  return () => window.removeEventListener(EVENTO, h);
}
