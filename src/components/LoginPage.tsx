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
        backgroundColor: "#000",
        backgroundImage: `radial-gradient(ellipse at 50% 50%, #1A123066 0%, transparent 70%)`,
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-black text-sm"
              style={{ backgroundColor: "#7B61FF" }}
            >
              Orbe
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Operating System</span>
          </div>
          <p className="text-[11px] tracking-widest uppercase" style={{ color: "#555" }}>
            Plataforma Operacional Interna
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a" }}
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>
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
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333] focus:outline-none transition-colors"
              style={{ backgroundColor: "#080808", border: "1px solid #1e1e1e" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7B61FF44")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>
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
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-[#333] focus:outline-none transition-colors"
                style={{ backgroundColor: "#080808", border: "1px solid #1e1e1e" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#7B61FF44")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none"
                style={{ color: "#555" }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
            style={{
              backgroundColor: loading || !email || !password ? "#1A1230" : "#7B61FF",
              color: loading || !email || !password ? "#333" : "#000",
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
