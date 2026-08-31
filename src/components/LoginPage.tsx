import { useState, useEffect, useRef, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: "var(--bg-page)",
        backgroundImage: `radial-gradient(ellipse at 50% 50%, var(--accent-tint)66 0%, transparent 70%)`,
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black text-sm"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Orbe
            </div>
            <span className="text-[var(--text-primary)] font-bold text-xl tracking-tight">Operating System</span>
          </div>
          <p className="text-[11px] tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
            Plataforma Operacional Interna
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
              E-mail
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors"
              style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors"
                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
                style={{ color: "var(--text-tertiary)" }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              backgroundColor: loading || !email || !password ? "var(--accent-tint)" : "var(--accent)",
              color: loading || !email || !password ? "var(--text-quaternary)" : "var(--bg-page)",
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
