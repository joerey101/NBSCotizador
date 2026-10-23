// Une el cotizador con los presupuestos guardados en Supabase: cliente de la lista,
// Guardar (COT-NNNN), estado, Nuevo, y los pedidos que llegan desde Presupuestos / Clientes.
// Sin Supabase configurado devuelve undefined y el cotizador funciona como siempre.
import { useEffect, useMemo, useRef, useState } from "react";
import type { DatosCliente, Moneda, Producto, TipoCambio } from "../lib/types";
import type { Descuento, LineaCotizacion, Totales } from "../lib/cotizacion";
import {
  abrirPresupuesto,
  cambiarEstado,
  guardarPresupuesto,
  type EstadoPresupuesto,
  type PresupuestoAbierto,
} from "../lib/presupuestos";
import { escucharPedidos } from "../lib/eventos";
import { miVendedorId } from "../lib/equipo";
import { crearPedidoDesdePresupuesto } from "../lib/stock";
import { ir } from "../lib/ruta";
import { supabase } from "../lib/supabase";
import { cargarClienteConPrincipal, datosDesdeCliente } from "./crm/ClienteSelector";
import type { CrmPanel } from "./CotizacionPanel";
import { useLocalStorage } from "./useLocalStorage";

interface Params {
  lineas: LineaCotizacion[];
  descuento: Descuento;
  reemplazar: (l: LineaCotizacion[], d: Descuento) => void;
  cliente: DatosCliente;
  setCliente: (c: DatosCliente) => void;
  clienteDefault: DatosCliente;
  monedaPresupuesto: Moneda;
  setMoneda: (m: Moneda) => void;
  tc: TipoCambio;
  setTc: (t: TipoCambio) => void;
  totales: Totales;
  porId: Map<string, Producto>;
}

/** Huella de lo que se guarda (sin fotos) para saber si hay cambios sin guardar. */
function firma(p: Pick<Params, "lineas" | "descuento" | "cliente" | "monedaPresupuesto" | "tc">) {
  return JSON.stringify([
    p.lineas.map((l) => [l.productoId, l.producto, l.cantidad, l.precioUnitarioOriginal]),
    p.descuento,
    p.cliente,
    p.monedaPresupuesto,
    p.tc.USD_ARS,
    p.tc.EUR_ARS,
  ]);
}

export function useCrmCotizador(p: Params): CrmPanel | undefined {
  const [abierto, setAbierto] = useLocalStorage<PresupuestoAbierto | null>("nbs_cot_abierto", null);
  const [clienteId, setClienteId] = useLocalStorage<string | null>("nbs_cot_cliente_id", null);
  const [firmaGuardada, setFirmaGuardada] = useLocalStorage<string | null>("nbs_cot_firma", null);
  const [vendedorId, setVendedorId] = useLocalStorage<string | null>("nbs_cot_vendedor_id", null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<CrmPanel["aviso"]>(null);

  const firmaActual = useMemo(
    () => firma(p),
    [p.lineas, p.descuento, p.cliente, p.monedaPresupuesto, p.tc] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sinGuardar = p.lineas.length > 0 && firmaActual !== firmaGuardada;

  const avisar = (a: CrmPanel["aviso"]) => {
    setAviso(a);
    if (a?.tipo === "ok") setTimeout(() => setAviso((x) => (x === a ? null : x)), 4000);
  };

  const nuevo = (conConfirmacion: boolean) => {
    if (conConfirmacion && sinGuardar && !confirm("Hay cambios sin guardar. ¿Empezar un presupuesto nuevo igual?")) return;
    p.reemplazar([], { modo: "porcentaje", valor: 0 });
    p.setCliente({ ...p.clienteDefault, vendedor: p.cliente.vendedor || p.clienteDefault.vendedor });
    setAbierto(null);
    setClienteId(null);
    setFirmaGuardada(null);
    setAviso(null);
  };

  // Vendedor por defecto: el del usuario conectado (por su email)
  useEffect(() => {
    if (!supabase || vendedorId) return;
    miVendedorId().then((id) => id && setVendedorId(id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pedidos desde otras pantallas. El listener se registra una vez y usa siempre lo último.
  const ultimo = useRef({ p, sinGuardar, nuevo });
  ultimo.current = { p, sinGuardar, nuevo };
  useEffect(() => {
    if (!supabase) return;
    return escucharPedidos(async (pedido) => {
      const { p, sinGuardar, nuevo } = ultimo.current;
      if (sinGuardar && !confirm("El cotizador tiene cambios sin guardar. ¿Reemplazarlos?")) return;
      try {
        if (pedido.tipo === "abrir") {
          const d = await abrirPresupuesto(pedido.id, p.porId);
          p.reemplazar(d.lineas, d.descuento);
          p.setMoneda(d.monedaPresupuesto);
          p.setTc(d.tasas);
          p.setCliente(d.cliente);
          setClienteId(d.clienteId);
          if (d.vendedorId) setVendedorId(d.vendedorId);
          setAbierto(d.abierto);
          setFirmaGuardada(
            firma({ lineas: d.lineas, descuento: d.descuento, cliente: d.cliente, monedaPresupuesto: d.monedaPresupuesto, tc: d.tasas })
          );
          avisar({ tipo: "ok", texto: `Abriste ${d.abierto.numero}.` });
        } else {
          nuevo(false);
          const { cliente, contacto } = await cargarClienteConPrincipal(pedido.clienteId);
          p.setCliente(datosDesdeCliente(cliente, contacto, { ...p.clienteDefault, vendedor: p.cliente.vendedor }));
          setClienteId(cliente.id);
        }
      } catch (e) {
        avisar({ tipo: "error", texto: (e as Error).message });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supabase) return undefined;

  return {
    abierto,
    clienteVinculado: !!clienteId,
    vendedorId,
    onVendedor: (id, nombre) => {
      setVendedorId(id);
      if (nombre) p.setCliente({ ...p.cliente, vendedor: nombre });
    },
    sinGuardar,
    guardando,
    aviso,
    onElegirCliente: (c, contacto) => {
      p.setCliente(datosDesdeCliente(c, contacto, p.cliente));
      setClienteId(c.id);
    },
    onGuardar: async () => {
      if (!clienteId) {
        avisar({ tipo: "error", texto: "Elegí el cliente de la lista (👤 Elegir cliente) antes de guardar." });
        return;
      }
      let titulo = abierto?.titulo ?? null;
      if (!abierto) {
        const sugerido = `${p.cliente.empresa || p.cliente.nombre} ${p.cliente.fecha || ""}`.trim();
        titulo = prompt("Nombre del presupuesto (para encontrarlo después):", sugerido);
        if (titulo === null) return; // canceló
      }
      setGuardando(true);
      try {
        const r = await guardarPresupuesto({
          id: abierto?.id,
          titulo: titulo || "",
          clienteId,
          vendedorId,
          cliente: p.cliente,
          monedaPresupuesto: p.monedaPresupuesto,
          tasas: p.tc,
          descuento: p.descuento,
          lineas: p.lineas,
          totales: p.totales,
        });
        setAbierto(r);
        setFirmaGuardada(firmaActual);
        const pend = p.totales.nPendientesPrecio;
        avisar({
          tipo: "ok",
          texto: `Guardado ${r.numero}.` + (pend ? ` Ojo: ${pend} renglón(es) sin precio quedan fuera del total.` : ""),
        });
      } catch (e) {
        avisar({ tipo: "error", texto: (e as Error).message });
      } finally {
        setGuardando(false);
      }
    },
    onEstado: async (estado: EstadoPresupuesto) => {
      if (!abierto) return;
      try {
        await cambiarEstado(abierto.id, estado);
        setAbierto({ ...abierto, estado });
      } catch (e) {
        avisar({ tipo: "error", texto: (e as Error).message });
      }
    },
    onNuevo: () => nuevo(true),
    onCrearPedido: async () => {
      if (!abierto) return;
      if (sinGuardar) {
        avisar({ tipo: "error", texto: "Guardá los cambios antes de crear el pedido." });
        return;
      }
      try {
        const r = await crearPedidoDesdePresupuesto(abierto.id);
        avisar({ tipo: "ok", texto: r.existente ? `Ya existía el pedido ${r.numero}.` : `Pedido ${r.numero} creado.` });
        ir(`/pedidos/${r.id}`);
      } catch (e) {
        avisar({ tipo: "error", texto: (e as Error).message });
      }
    },
  };
}
