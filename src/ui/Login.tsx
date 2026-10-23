// Pantalla de ingreso: email + contraseña, y "¿Olvidaste tu contraseña?".
// El alta pública está desactivada en Supabase: las cuentas las crea un administrador.
import { useState, type FormEvent } from "react";
import { recargarApp, supabase, URL_APP } from "../lib/supabase";
import logoNbs from "../assets/logo_nbs.png";

function mensajeError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "El email todavía no está confirmado. Pedile al administrador que lo confirme.";
  if (/fetch|network/i.test(msg)) return "No hay conexión. Para entrar hace falta internet.";
  if (/rate limit|too many/i.test(msg)) return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  return msg;
}

export function Login() {
  const [modo, setModo] = useState<"entrar" | "recuperar">("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    if (error) {
      setError(mensajeError(error.message));
      setEnviando(false);
      return;
    }
    recargarApp();
  };

  const recuperar = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: URL_APP });
    setEnviando(false);
    if (error) {
      setError(mensajeError(error.message));
      return;
    }
    setAviso("Si el email tiene una cuenta, te llegó un link para elegir una contraseña nueva. Revisá también el correo no deseado.");
  };

  return (
    <div className="auth-pantalla">
      <form className="auth-caja" onSubmit={modo === "entrar" ? entrar : recuperar}>
        <img src={logoNbs} alt="Logo NBS" className="auth-logo" />
        <h1>NBS · Catálogo y Cotización</h1>
        <p className="auth-sub">
          {modo === "entrar" ? "Ingresá con tu usuario" : "Te mandamos un link para elegir una contraseña nueva"}
        </p>

        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        {modo === "entrar" && (
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
        )}

        {error && <div className="auth-error">{error}</div>}
        {aviso && <div className="auth-aviso">{aviso}</div>}

        <button type="submit" className="auth-boton" disabled={enviando}>
          {enviando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Enviar link"}
        </button>

        <button
          type="button"
          className="auth-link"
          onClick={() => {
            setModo(modo === "entrar" ? "recuperar" : "entrar");
            setError(null);
            setAviso(null);
          }}
        >
          {modo === "entrar" ? "¿Olvidaste tu contraseña?" : "Volver a ingresar"}
        </button>
      </form>
    </div>
  );
}
