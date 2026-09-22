import { useState, type FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { OrbeMark } from "./OrbeMark";

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (newPw.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (newPw !== confirmPw) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (updateError) { setError("Não foi possível salvar a nova senha. Peça um novo link."); return; }
    setDone(true);
  }

  return (
    <div className="orbe-ambient-bold min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <OrbeMark size={820} animated className="orbe-watermark" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <OrbeMark size={52} animated glow />
            <span className="font-display text-[var(--text-primary)] font-bold text-2xl tracking-tight">ORBE</span>
          </div>
          <p className="text-[11px] tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
            {done ? "Senha atualizada" : "Defina sua nova senha"}
          </p>
        </div>

        <div
          className="orbe-glass rounded-2xl p-6 space-y-4"
          style={{ border: "1px solid var(--border)", boxShadow: "0 24px 64px -24px var(--glow-strong), inset 0 1px 0 var(--accent-a22)" }}
        >
          {done ? (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mx-auto" style={{ backgroundColor: "var(--success-tint)" }}>
                <Check size={18} style={{ color: "var(--success)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Sua senha foi alterada. Pode continuar normalmente.</p>
              <button
                onClick={onDone}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", color: "#ffffff" }}
              >
                Entrar na plataforma
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Nova senha</label>
                <input
                  type="password"
                  autoFocus
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-a22)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Confirmar senha</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors"
                  style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-a22)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              {error && <p className="text-xs text-center" style={{ color: "var(--danger)" }}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !newPw || !confirmPw}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{
                  background: loading || !newPw || !confirmPw ? "var(--accent-tint)" : "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                  color: loading || !newPw || !confirmPw ? "var(--text-quaternary)" : "#ffffff",
                  boxShadow: loading || !newPw || !confirmPw ? "none" : "0 8px 24px -8px var(--glow-strong)",
                }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
