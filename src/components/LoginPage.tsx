import { useState, useEffect, useRef, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { OrbeMark } from "./OrbeMark";
import { useMouseGlow } from "../hooks/useMouseGlow";

interface LoginPageProps {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "forgot" | "forgot-sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  useMouseGlow(pageRef, 70, 20);

  useEffect(() => { emailRef.current?.focus(); }, [mode]);

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

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    // Supabase não confirma se o e-mail existe (evita vazar quem tem conta),
    // então essa chamada sempre "dá certo" do ponto de vista da tela.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    setMode("forgot-sent");
  }

  return (
    <div ref={pageRef} className="orbe-ambient-bold min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <OrbeMark size={820} animated className="orbe-watermark" />
      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <OrbeMark size={52} animated glow />
            <span className="font-display text-[var(--text-primary)] font-bold text-2xl tracking-tight">ORBE</span>
          </div>
          <p className="text-[11px] tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
            {mode === "login" ? "Plataforma Operacional Interna" : "Recuperar acesso"}
          </p>
        </div>

        {/* Form */}
        {mode === "forgot-sent" ? (
          <div
            className="orbe-glass rounded-2xl p-6 space-y-4 text-center"
            style={{ border: "1px solid var(--border)", boxShadow: "0 24px 64px -24px var(--glow-strong), inset 0 1px 0 var(--accent-a22)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Se <strong style={{ color: "var(--text-primary)" }}>{email}</strong> tiver uma conta, chega um link por e-mail pra criar uma senha nova.
            </p>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
            >
              Voltar pro login
            </button>
          </div>
        ) : mode === "forgot" ? (
          <form
            onSubmit={handleForgotSubmit}
            className="orbe-glass rounded-2xl p-6 space-y-4"
            style={{ border: "1px solid var(--border)", boxShadow: "0 24px 64px -24px var(--glow-strong), inset 0 1px 0 var(--accent-a22)" }}
          >
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Digite seu e-mail e mandamos um link pra você criar uma senha nova.</p>
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
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-a22)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !email}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                style={{
                  background: loading || !email ? "var(--accent-tint)" : "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                  color: loading || !email ? "var(--text-quaternary)" : "#ffffff",
                }}
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : "Enviar link"}
              </button>
            </div>
          </form>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="orbe-glass rounded-2xl p-6 space-y-4"
          style={{ border: "1px solid var(--border)", boxShadow: "0 24px 64px -24px var(--glow-strong), inset 0 1px 0 var(--accent-a22)" }}
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
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-a22)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                Senha
              </label>
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(""); }}
                className="text-[11px] font-semibold"
                style={{ color: "var(--accent)" }}
              >
                Esqueceu a senha?
              </button>
            </div>
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
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-a22)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none"; }}
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
              background: loading || !email || !password ? "var(--accent-tint)" : "linear-gradient(135deg, var(--accent), var(--accent-hover))",
              color: loading || !email || !password ? "var(--text-quaternary)" : "#ffffff",
              boxShadow: loading || !email || !password ? "none" : "0 8px 24px -8px var(--glow-strong)",
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Entrar"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
