// Pantalla a la que lleva el link de "¿Olvidaste tu contraseña?" (llega con #type=recovery).
import { useState, type FormEvent } from "react";
import { recargarApp, supabase } from "../lib/supabase";
import logoNbs from "../assets/logo_nbs.png";

const MINIMO = 8;

export function NuevaClave() {
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (clave.length < MINIMO) return setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`);
    if (clave !== repetida) return setError("Las dos contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) {
      setError(/same|different/i.test(error.message) ? "Elegí una contraseña distinta a la anterior." : error.message);
      setEnviando(false);
      return;
    }
    recargarApp();
  };

  return (
    <div className="auth-pantalla">
      <form className="auth-caja" onSubmit={guardar}>
        <img src={logoNbs} alt="Logo NBS" className="auth-logo" />
        <h1>Contraseña nueva</h1>
        <p className="auth-sub">Elegí tu contraseña nueva (mínimo {MINIMO} caracteres).</p>
        <label>
          Contraseña nueva
          <input type="password" autoComplete="new-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        <label>
          Repetila
          <input type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        </label>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="auth-boton" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </div>
  );
}
