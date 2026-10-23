// Escáner y movimientos de stock: entrada, salida, ajuste, devolución o muestra.
// El código se lee con pistola (escribe + Enter) o con la cámara. Si es nuevo, se busca el
// producto una vez y queda vinculado. Sin precios en ningún lado.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Producto } from "../../lib/types";
import { useRol } from "../../lib/sesion";
import {
  anularMovimiento,
  aprenderCodigo,
  buscarEnCatalogo,
  listarDepositos,
  NOMBRE_TIPO,
  productoPorId,
  registrarMovimiento,
  resolverCodigo,
  SIGNO,
  TIPOS_MOVIMIENTO,
  ultimosMovimientos,
  type Deposito,
  type MovimientoStock,
  type TipoMovimientoStock,
} from "../../lib/stock";
import { CamaraLector } from "./CamaraLector";

function FichaProducto({ p }: { p: Producto }) {
  return (
    <div className="esc-producto">
      {p.imagen ? <img src={p.imagen} alt="" /> : <div className="esc-sin-foto">sin foto</div>}
      <div>
        <strong>{p.producto}</strong>
        <div className="crm-fila-datos">
          <span>{p.origen}</span>
          {p.linea && <span>{p.linea}</span>}
          {p.codigo_origen && <span>Cód. {p.codigo_origen}</span>}
        </div>
      </div>
    </div>
  );
}

export function Movimientos() {
  const rol = useRol();
  const puedeCargar = rol === "admin" || rol === "deposito";
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [deposito, setDeposito] = useState("");
  const [tipo, setTipo] = useState<TipoMovimientoStock>("entrada");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoLeido, setCodigoLeido] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Producto[] | null>(null);
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [camara, setCamara] = useState(false);
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const recargar = useCallback(() => {
    ultimosMovimientos().then(setMovs).catch(() => {});
  }, []);

  useEffect(() => {
    listarDepositos()
      .then((d) => {
        setDepositos(d);
        setDeposito((x) => x || d[0]?.id || "");
      })
      .catch((e: Error) => setAviso({ tipo: "error", texto: e.message }));
    recargar();
  }, [recargar]);

  const limpiar = () => {
    setCodigo("");
    setCodigoLeido(null);
    setCandidatos(null);
    setElegido(null);
    setBusqueda("");
    setTimeout(() => entrada.current?.focus(), 0);
  };

  const leer = useCallback(async (c: string) => {
    const cod = c.trim();
    if (!cod) return;
    setCamara(false);
    setAviso(null);
    setCodigoLeido(cod);
    setElegido(null);
    try {
      const r = await resolverCodigo(cod);
      setCandidatos(r);
      if (r.length === 1) setElegido(r[0]);
    } catch (e) {
      setAviso({ tipo: "error", texto: (e as Error).message });
    }
  }, []);

  const vincular = async (p: Producto) => {
    setElegido(p);
    setCandidatos([p]);
    if (codigoLeido) {
      try {
        await aprenderCodigo(codigoLeido, p);
        setAviso({ tipo: "ok", texto: `Código ${codigoLeido} vinculado a “${p.producto}”. La próxima vez se reconoce solo.` });
      } catch (e) {
        setAviso({ tipo: "error", texto: (e as Error).message });
      }
    }
  };

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!elegido || !deposito) return;
    const n = Number(cantidad.replace(",", "."));
    if (!(n > 0)) return setAviso({ tipo: "error", texto: "La cantidad tiene que ser mayor a 0." });
    try {
      await registrarMovimiento({ producto: elegido, codigo: codigoLeido, deposito_id: deposito, tipo, cantidad: n, motivo: motivo.trim() || null });
      setAviso({ tipo: "ok", texto: `${NOMBRE_TIPO[tipo]}: ${n} × ${elegido.producto}` });
      setCantidad("1");
      limpiar();
      recargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: (err as Error).message });
    }
  };

  const resultados = busqueda.trim().length >= 2 ? buscarEnCatalogo(busqueda) : [];

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <h2>Escáner y movimientos</h2>
        {depositos.length > 1 && (
          <select className="crm-select" value={deposito} onChange={(e) => setDeposito(e.target.value)}>
            {depositos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        )}
        {depositos.length === 1 && <span className="crm-sec">{depositos[0].nombre}</span>}
      </div>

      {!puedeCargar && <div className="auth-aviso">Tu usuario puede ver los movimientos; los cargan el depósito y el administrador.</div>}

      {puedeCargar && (
        <>
          <div className="ldt-tipos">
            {TIPOS_MOVIMIENTO.map((t) => (
              <button key={t.id} type="button" className={`ldt-tipo ${tipo === t.id ? "activo" : ""}`} onClick={() => setTipo(t.id)}>
                {t.nombre}
              </button>
            ))}
          </div>

          <form
            className="esc-lectura"
            onSubmit={(e) => {
              e.preventDefault();
              leer(codigo);
            }}
          >
            <input
              ref={entrada}
              className="search-input"
              autoFocus
              inputMode="text"
              placeholder="Escaneá con la pistola o escribí el código y Enter"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <button type="button" className="crm-btn-primario" onClick={() => setCamara(true)}>
              📷 Cámara
            </button>
          </form>

          {codigoLeido !== null && (
            <div className="esc-resultado">
              {codigoLeido && (
                <div className="crm-sec" style={{ marginLeft: 0 }}>
                  Código leído: <strong>{codigoLeido}</strong>
                </div>
              )}

              {elegido ? (
                <form className="crm-form" onSubmit={registrar}>
                  <FichaProducto p={elegido} />
                  <div className="crm-grid">
                    <label>
                      Cantidad
                      <input inputMode="decimal" autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                    </label>
                    <label className="crm-ancho">
                      Motivo (opcional)
                      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="remito, proveedor, rotura…" />
                    </label>
                  </div>
                  <div className="crm-acciones">
                    <button type="button" className="btn-salir" onClick={limpiar}>
                      Cancelar
                    </button>
                    <button type="submit" className={`crm-btn-primario ${SIGNO[tipo] < 0 ? "esc-resta" : ""}`}>
                      Registrar {NOMBRE_TIPO[tipo].toLowerCase()} ({SIGNO[tipo] > 0 ? "+" : "−"}
                      {cantidad || 0})
                    </button>
                  </div>
                </form>
              ) : candidatos && candidatos.length > 1 ? (
                <div className="crm-tabla">
                  <div className="crm-vacio" style={{ padding: "8px 12px" }}>Hay varios productos con ese código. Elegí cuál es:</div>
                  {candidatos.map((p) => (
                    <button key={p.id} type="button" className="crm-fila" onClick={() => vincular(p)}>
                      <FichaProducto p={p} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="esc-desconocido">
                  <div className="auth-aviso">
                    {codigoLeido
                      ? "Código nuevo. Buscá el producto una vez y queda vinculado para la próxima."
                      : "Buscá el producto por nombre, proveedor o código."}
                  </div>
                  <input
                    className="search-input"
                    autoFocus
                    placeholder="Buscar producto por nombre, proveedor o código…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                  <div className="crm-tabla">
                    {resultados.map((p) => (
                      <button key={p.id} type="button" className="crm-fila" onClick={() => vincular(p)}>
                        <FichaProducto p={p} />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn-salir" onClick={limpiar}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          {codigoLeido === null && (
            <button
              type="button"
              className="auth-link"
              style={{ alignSelf: "flex-start", padding: 0 }}
              onClick={() => {
                setCodigoLeido("");
                setCandidatos([]);
              }}
            >
              El producto no tiene código: buscarlo por nombre
            </button>
          )}
        </>
      )}

      {aviso && <div className={aviso.tipo === "ok" ? "auth-aviso" : "auth-error"}>{aviso.texto}</div>}

      <div className="crm-seccion">
        <h3>Últimos movimientos</h3>
        {movs.length === 0 && <p className="crm-vacio">Todavía no hay movimientos.</p>}
        <div className="crm-tabla">
          {movs.map((m) => {
            const p = productoPorId(m.producto_id);
            return (
              <div key={m.id} className={`crm-fila crm-fila-estatica ${m.anulado ? "mov-anulado" : ""}`}>
                <div className="crm-fila-principal">
                  <span className={`chip-mov ${SIGNO[m.tipo] > 0 ? "suma" : "resta"}`}>
                    {SIGNO[m.tipo] > 0 ? "+" : "−"}
                    {m.cantidad}
                  </span>
                  <span>{p?.producto ?? m.descripcion}</span>
                </div>
                <div className="crm-fila-datos">
                  <span>{NOMBRE_TIPO[m.tipo]}</span>
                  {m.motivo && <span>{m.motivo}</span>}
                  <span>{new Date(m.creado_en).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
                  {m.anulado && <span>(anulado)</span>}
                  {puedeCargar && !m.anulado && m.referencia_tipo !== "anulacion" && m.referencia_tipo !== "pedido" && (
                    <button
                      type="button"
                      className="auth-link crm-peligro"
                      onClick={() =>
                        confirm("¿Anular este movimiento? Se crea el movimiento inverso; nada se borra.") &&
                        anularMovimiento(m.id)
                          .then(recargar)
                          .catch((e: Error) => setAviso({ tipo: "error", texto: e.message }))
                      }
                    >
                      Anular
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {camara && <CamaraLector onCodigo={leer} onCerrar={() => setCamara(false)} />}
    </div>
  );
}
