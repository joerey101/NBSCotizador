// Selector de vendedor (lista compartida y cacheada mientras la app está abierta).
import { useEffect, useState } from "react";
import { listarVendedores, nombreVendedor, type Vendedor } from "../../lib/equipo";

let cache: Promise<Vendedor[]> | null = null;

export function useVendedores(): Vendedor[] {
  const [vs, setVs] = useState<Vendedor[]>([]);
  useEffect(() => {
    cache ??= listarVendedores().catch(() => {
      cache = null;
      return [];
    });
    cache.then(setVs);
  }, []);
  return vs;
}

/** Después de editar el equipo, para que los selectores relean la lista. */
export function olvidarVendedores() {
  cache = null;
}

interface Props {
  value: string | null;
  onChange: (id: string | null, nombre: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VendedorSelect({ value, onChange, disabled, className }: Props) {
  const vendedores = useVendedores();
  return (
    <select
      className={className}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const v = vendedores.find((x) => x.id === e.target.value);
        onChange(v?.id ?? null, v ? nombreVendedor(v) : "");
      }}
    >
      <option value="">— Sin vendedor —</option>
      {vendedores.map((v) => (
        <option key={v.id} value={v.id}>
          {nombreVendedor(v)} ({v.comision_pct}%)
        </option>
      ))}
    </select>
  );
}
