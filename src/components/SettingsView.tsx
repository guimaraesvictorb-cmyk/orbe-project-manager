import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Profile, Client, Task } from "../lib/database.types";
import {
  ShieldCheck, Sun, Moon, Loader2, Check,
  AlertCircle, Copy, Trash2, RotateCcw,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useClients } from "../hooks/useClients";
import { useTasks } from "../hooks/useTasks";

type Section = "geral" | "seguranca" | "lixeira";

interface SettingsViewProps { profile: Profile | null }

function SectionBtn({ id, label, active, onClick }: { id: Section; label: string; active: Section; onClick: (s: Section) => void }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className="w-full text-left px-4 py-2 text-xs transition-colors duration-100"
      style={{
        color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
        backgroundColor: isActive ? "var(--accent-tint)" : "transparent",
        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
      }}
    >
      {label}
    </button>
  );
}

function GeralSection({ profile }: { profile: Profile | null }) {
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState(false);

  async function saveTheme(t: "dark" | "light") {
    setTheme(t);
    if (!profile) return;
    await supabase.from("profiles").update({ theme: t }).eq("id", profile.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[var(--text-primary)] font-semibold text-base mb-1">Geral</h2>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Preferências gerais da plataforma</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">Tema da interface</p>
        <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>Escolha entre tema escuro (padrão) e tema claro.</p>

        <div className="flex gap-3">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => saveTheme(t)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
              style={{
                borderColor: theme === t ? "var(--accent)" : "var(--border-strong)",
                backgroundColor: theme === t ? "var(--accent-tint)" : "var(--bg-surface)",
              }}
            >
              {t === "dark" ? <Moon size={20} style={{ color: theme === t ? "var(--accent)" : "var(--text-tertiary)" }} />
                            : <Sun size={20}  style={{ color: theme === t ? "var(--accent)" : "var(--text-tertiary)" }} />}
              <span className="text-xs font-medium" style={{ color: theme === t ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                {t === "dark" ? "Escuro" : "Claro"}
              </span>
              {theme === t && <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>Ativo</span>}
            </button>
          ))}
        </div>

        {saved && (
          <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "var(--accent)" }}>
            <Check size={12} />Tema salvo!
          </div>
        )}
      </div>
    </div>
  );
}

function SegurancaSection() {
  const [step, setStep] = useState<"idle" | "enrolling" | "verifying" | "done" | "unenrolling">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");
  const [factors, setFactors] = useState<Array<{ id: string; status: string; factor_type: string }>>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
    setLoadingFactors(false);
  }, []);

  useEffect(() => { loadFactors(); }, [loadFactors]);

  async function startEnroll() {
    setError("");
    setStep("enrolling");
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Orbe OS", friendlyName: "Orbe Authenticator" });
    if (err || !data) { setError(err?.message ?? "Erro ao iniciar 2FA"); setStep("idle"); return; }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setStep("verifying");
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setError("Erro ao criar challenge"); return; }
    const { error: err } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: totp });
    if (err) { setError(err.message); return; }
    setStep("done");
    loadFactors();
  }

  async function unenroll(id: string) {
    setError("");
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (err) { setError(err.message); return; }
    loadFactors();
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const verified = factors.filter((f) => f.status === "verified");
  const has2FA = verified.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[var(--text-primary)] font-semibold text-base mb-1">Verificação em 2 etapas</h2>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Adicione uma camada extra de segurança usando um aplicativo autenticador (Google Authenticator, Authy, etc).
        </p>
      </div>

      {loadingFactors ? (
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      ) : (
        <>
          <div className="flex items-start justify-between px-4 py-4 rounded-xl border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} style={{ color: has2FA ? "var(--accent)" : "var(--text-quaternary)" }} />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Autenticação por app</p>
                <p className="text-xs mt-0.5" style={{ color: has2FA ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {has2FA ? "Ativo — sua conta está protegida" : "Não configurado"}
                </p>
              </div>
            </div>
            {has2FA ? (
              <button
                onClick={() => unenroll(verified[0].id)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:border-red-500 hover:text-red-500"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              >
                Remover
              </button>
            ) : step === "idle" ? (
              <button
                onClick={startEnroll}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
              >
                Ativar 2FA
              </button>
            ) : null}
          </div>

          {step === "verifying" && (
            <div className="rounded-xl border p-5 space-y-5" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">1. Escaneie o QR Code</p>
                <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
                  Abra seu app autenticador e escaneie o código abaixo.
                </p>
                {qrCode && (
                  <div className="inline-block p-3 rounded-xl" style={{ backgroundColor: "var(--text-primary)" }}>
                    <img src={qrCode} alt="QR Code 2FA" className="w-40 h-40" />
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <p className="text-[11px] font-mono px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-tertiary)" }}>{secret}</p>
                  <button onClick={copySecret} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--border)]" style={{ color: "var(--text-tertiary)" }}>
                    {copied ? <Check size={13} style={{ color: "var(--accent)" }} /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-quaternary)" }}>Ou insira o código manualmente no app.</p>
              </div>

              <form onSubmit={verifyTotp} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">2. Confirme o código</p>
                  <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>Digite o código de 6 dígitos gerado pelo app.</p>
                  <input
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-40 text-center rounded-lg px-3 py-3 text-lg font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-a44)] tracking-widest"
                    style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--danger)" }}>
                    <AlertCircle size={13} />{error}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep("idle")} className="px-4 py-2 rounded-lg text-xs border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={totp.length !== 6}
                    className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
                  >
                    Verificar e ativar
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === "done" && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-a33)" }}>
              <Check size={14} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--accent)" }}>2FA ativado com sucesso! Sua conta está protegida.</span>
            </div>
          )}

          {error && step === "idle" && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--danger)" }}>
              <AlertCircle size={13} />{error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LixeiraSection() {
  const { clients, fetchDeletedClients, restoreClient } = useClients();
  const { fetchDeletedTasks, restoreTask } = useTasks({});
  const [deletedClients, setDeletedClients] = useState<Client[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [dc, dt] = await Promise.all([fetchDeletedClients(), fetchDeletedTasks()]);
    setDeletedClients(dc);
    setDeletedTasks(dt);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  async function handleRestoreClient(id: string) {
    setRestoring(id);
    await restoreClient(id);
    setDeletedClients((prev) => prev.filter((c) => c.id !== id));
    setRestoring(null);
  }

  async function handleRestoreTask(id: string) {
    setRestoring(id);
    await restoreTask(id);
    setDeletedTasks((prev) => prev.filter((t) => t.id !== id));
    setRestoring(null);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-white font-semibold text-base mb-1">Lixeira</h2>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Clientes e tarefas excluídos ficam aqui — nada é apagado de vez.</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-white mb-2">Clientes ({deletedClients.length})</p>
        {deletedClients.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>Nenhum cliente excluído.</p>
        ) : (
          <div className="space-y-2">
            {deletedClients.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Trash2 size={13} style={{ color: "var(--text-quaternary)" }} />
                  <span className="text-sm text-white truncate">{c.name}</span>
                </div>
                <button onClick={() => handleRestoreClient(c.id)} disabled={restoring === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>
                  {restoring === c.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-white mb-2">Tarefas ({deletedTasks.length})</p>
        {deletedTasks.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>Nenhuma tarefa excluída.</p>
        ) : (
          <div className="space-y-2">
            {deletedTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{t.title}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-quaternary)" }}>{clientNameById.get(t.client_id) ?? "Cliente removido"}</p>
                </div>
                <button onClick={() => handleRestoreTask(t.id)} disabled={restoring === t.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>
                  {restoring === t.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsView({ profile }: SettingsViewProps) {
  const [section, setSection] = useState<Section>("geral");

  return (
    <div className="flex h-full" style={{ backgroundColor: "#060606" }}>
      {/* Sub-sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col py-6 overflow-y-auto"
        style={{ width: 200, borderRight: "1px solid var(--bg-surface-2)", backgroundColor: "#060606" }}
      >
        <p className="text-[9px] font-bold tracking-widest uppercase px-4 mb-3" style={{ color: "var(--text-quaternary)" }}>
          Configurações
        </p>
        <SectionBtn id="geral"     label="Geral"    active={section} onClick={setSection} />
        <SectionBtn id="seguranca" label="Segurança" active={section} onClick={setSection} />
        <SectionBtn id="lixeira"   label="Lixeira"   active={section} onClick={setSection} />
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-10 py-8">
          {section === "geral"     && <GeralSection profile={profile} />}
          {section === "seguranca" && <SegurancaSection />}
          {section === "lixeira"   && <LixeiraSection />}
        </div>
      </div>
    </div>
  );
}
