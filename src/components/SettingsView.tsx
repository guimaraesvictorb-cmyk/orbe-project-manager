import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/database.types";
import {
  ShieldCheck, Users, Sun, Moon, Mail, Loader2, Check,
  AlertCircle, Trash2, UserPlus, RefreshCw, Copy,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador", coordenador: "Coordenador",
  gt: "Gestor de Tráfego", gp: "Gestor de Projetos",
};

type Section = "geral" | "seguranca" | "equipe";

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

function EquipeSection() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Profile["role"]>("gt");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("display_name");
    setMembers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ email: inviteEmail, display_name: inviteName, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao convidar");
      setInviteResult({ ok: true, msg: `Convite enviado para ${inviteEmail}` });
      setInviteEmail(""); setInviteName("");
      setShowInvite(false);
      loadMembers();
    } catch (err: unknown) {
      setInviteResult({ ok: false, msg: (err as Error).message });
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, role: Profile["role"]) {
    setUpdatingRole(userId);
    await supabase.from("profiles").update({ role }).eq("id", userId);
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)));
    setUpdatingRole(null);
  }

  async function toggleActive(userId: string, current: boolean) {
    await supabase.from("profiles").update({ is_active: !current }).eq("id", userId);
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, is_active: !current } : m)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[var(--text-primary)] font-semibold text-base mb-1">Minha Equipe</h2>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Gerencie os membros e funções da equipe Orbe.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadMembers} className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-surface)]" style={{ color: "var(--text-tertiary)" }}>
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
          >
            <UserPlus size={13} />
            Convidar
          </button>
        </div>
      </div>

      {inviteResult && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: inviteResult.ok ? "var(--accent-tint)" : "#1a0505",
            border: `1px solid ${inviteResult.ok ? "var(--accent-a33)" : "#EF444433"}`,
            color: inviteResult.ok ? "var(--accent)" : "var(--danger)",
          }}
        >
          {inviteResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}
          {inviteResult.msg}
        </div>
      )}

      {showInvite && (
        <form onSubmit={handleInvite} className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Convidar novo membro</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Nome</label>
              <input
                value={inviteName} onChange={(e) => setInviteName(e.target.value)} required
                placeholder="Nome completo"
                className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none"
                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Função</label>
              <select
                value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Profile["role"])}
                className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>E-mail</label>
            <input
              type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
              placeholder="email@agenciaorbe.co"
              className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none"
              style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-2 rounded-lg text-xs border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
              Cancelar
            </button>
            <button
              type="submit" disabled={inviting}
              className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
            >
              {inviting ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              {inviting ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="grid px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ gridTemplateColumns: "1fr 100px 100px 80px", backgroundColor: "var(--bg-surface)", color: "var(--text-quaternary)", borderBottom: "1px solid var(--bg-surface-2)" }}
          >
            <span>Membro</span><span>Função</span><span>Status</span><span></span>
          </div>
          {members.map((m) => (
            <div
              key={m.id}
              className="grid items-center px-4 py-3 gap-3"
              style={{ gridTemplateColumns: "1fr 100px 100px 80px", borderBottom: "1px solid var(--bg-surface-2)" }}
            >
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] font-medium truncate">{m.display_name}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{m.email}</p>
              </div>

              <select
                value={m.role}
                onChange={(e) => changeRole(m.id, e.target.value as Profile["role"])}
                disabled={updatingRole === m.id}
                className="rounded-lg px-2 py-1.5 text-[11px] text-[var(--text-primary)] focus:outline-none disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>

              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit"
                style={{
                  backgroundColor: m.is_active ? "var(--accent-tint)" : "#1a0505",
                  color: m.is_active ? "var(--accent)" : "var(--danger)",
                }}
              >
                {m.is_active ? "Ativo" : "Inativo"}
              </span>

              <button
                onClick={() => toggleActive(m.id, m.is_active)}
                className="text-[11px] px-2 py-1 rounded-lg border transition-colors"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = m.is_active ? "#ef444444" : "var(--accent-a44)";
                  (e.currentTarget as HTMLButtonElement).style.color = m.is_active ? "var(--danger)" : "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
                }}
              >
                {m.is_active ? <Trash2 size={12} /> : <Check size={12} />}
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <div className="py-12 text-center">
              <Users size={24} className="mx-auto mb-2" style={{ color: "#222" }} />
              <p className="text-sm text-[var(--text-primary)]">Nenhum membro encontrado</p>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px]" style={{ color: "var(--text-quaternary)" }}>{members.length} membro{members.length !== 1 ? "s" : ""} cadastrado{members.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function SettingsView({ profile }: SettingsViewProps) {
  const [section, setSection] = useState<Section>("geral");
  const isAdmin = profile?.role === "admin";
  const isCoord = profile?.role === "coordenador";

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
        {(isAdmin || isCoord) && (
          <SectionBtn id="equipe" label="Minha Equipe" active={section} onClick={setSection} />
        )}
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-10 py-8">
          {section === "geral"     && <GeralSection profile={profile} />}
          {section === "seguranca" && <SegurancaSection />}
          {section === "equipe"    && (isAdmin || isCoord) && <EquipeSection />}
        </div>
      </div>
    </div>
  );
}
