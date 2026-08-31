import { useCallback } from "react";
import type { Producto } from "../lib/types";
import { crearLinea, type Descuento, type LineaCotizacion } from "../lib/cotizacion";
import { useLocalStorage } from "./useLocalStorage";

interface EstadoCotizacion {
  lineas: LineaCotizacion[];
  descuento: Descuento;
}

const INICIAL: EstadoCotizacion = {
  lineas: [],
  descuento: { modo: "porcentaje", valor: 0 },
};

export function useCotizacion() {
  const [estado, setEstado] = useLocalStorage<EstadoCotizacion>("nbs_cotizacion", INICIAL);

  const agregar = useCallback((p: Producto) => {
    setEstado((s) => ({ ...s, lineas: [...s.lineas, crearLinea(p)] }));
  }, [setEstado]);

  const quitar = useCallback((uid: string) => {
    setEstado((s) => ({ ...s, lineas: s.lineas.filter((l) => l.uid !== uid) }));
  }, [setEstado]);

  const setCantidad = useCallback((uid: string, cantidad: number) => {
    setEstado((s) => ({
      ...s,
      lineas: s.lineas.map((l) => (l.uid === uid ? { ...l, cantidad } : l)),
    }));
  }, [setEstado]);

  const setPrecio = useCallback((uid: string, precioUnitarioOriginal: number | null) => {
    setEstado((s) => ({
      ...s,
      lineas: s.lineas.map((l) => (l.uid === uid ? { ...l, precioUnitarioOriginal } : l)),
    }));
  }, [setEstado]);

  const setDescuento = useCallback((descuento: Descuento) => {
    setEstado((s) => ({ ...s, descuento }));
  }, [setEstado]);

  const limpiar = useCallback(() => setEstado(INICIAL), [setEstado]);

  const reemplazar = useCallback((lineas: LineaCotizacion[], descuento: Descuento) => {
    setEstado({ lineas, descuento });
  }, [setEstado]);

  return {
    lineas: estado.lineas,
    descuento: estado.descuento,
    agregar, quitar, setCantidad, setPrecio, setDescuento, limpiar, reemplazar,
  };
}
