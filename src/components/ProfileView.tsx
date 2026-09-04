import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/database.types";
import {
  ShieldCheck, Save, KeyRound, CheckCircle2,
  AlertCircle, Monitor, Globe, LogOut, Users, Check, Loader2,
  ChevronDown, Trash2, X, UserPlus, Copy, Mail,
} from "lucide-react";
import { SECTION_ACCESS, SECTION_LABELS } from "../lib/permissions";
import { timeAgo } from "../lib/formatters";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  gt: "Gestor de Tráfego",
  gp: "Gestor de Projetos",
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

interface ProfileViewProps { profile: Profile | null; userEmail: string }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-4" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
      <p className="text-xs pt-2.5 font-medium" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      <div>{children}</div>
    </div>
  );
}

const inputCls = "w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none transition-colors max-w-sm";

interface TeamMember { id: string; email: string; display_name: string; role: string; is_active: boolean; custom_sections: string[] | null }

function initials(name: string, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const ALL_SECTIONS = Object.keys(SECTION_LABELS);

function TeamPanel({ currentUserId }: { currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [sectionEdits, setSectionEdits] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("gt");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastSeen, setLastSeen] = useState<Record<string, string | null>>({});

  useEffect(() => {
    loadMembers();
    loadActivity();
  }, []);

  function loadMembers() {
    setLoading(true);
    supabase.from("profiles").select("id,email,display_name,role,is_active,custom_sections").order("created_at")
      .then(({ data }) => {
        setMembers(data ?? []);
        const roles: Record<string, string> = {};
        const sections: Record<string, string[]> = {};
        data?.forEach((m) => {
          roles[m.id] = m.role;
          sections[m.id] = m.custom_sections ?? SECTION_ACCESS[m.role] ?? [];
        });
        setRoleEdits(roles);
        setSectionEdits(sections);
        setLoading(false);
      });
  }

  async function loadActivity() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-user-activity`, {
        headers: { authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const json = await res.json();
      if (!res.ok) return;
      const map: Record<string, string | null> = {};
      for (const id in json.activity) map[id] = json.activity[id].last_sign_in_at;
      setLastSeen(map);
    } catch {
      // Não crítico — a tela funciona normalmente sem essa info.
    }
  }

  function toggleSection(memberId: string, section: string) {
    setSectionEdits((prev) => {
      const current = prev[memberId] ?? [];
      const next = current.includes(section)
        ? current.filter((s) => s !== section)
        : [...current, section];
      return { ...prev, [memberId]: next };
    });
  }

  function resetSectionsToRoleDefault(memberId: string) {
    const role = roleEdits[memberId];
    setSectionEdits((prev) => ({ ...prev, [memberId]: SECTION_ACCESS[role] ?? [] }));
  }

  function isDirty(member: TeamMember): boolean {
    const roleChanged = roleEdits[member.id] !== member.role;
    const savedSections = member.custom_sections ?? SECTION_ACCESS[member.role] ?? [];
    const pendingSections = sectionEdits[member.id] ?? [];
    const sectionsChanged =
      savedSections.length !== pendingSections.length ||
      !savedSections.every((s) => pendingSections.includes(s));
    return roleChanged || sectionsChanged;
  }

  async function saveMember(memberId: string) {
    setSaving((s) => ({ ...s, [memberId]: true }));
    const member = members.find((m) => m.id === memberId);
    const newRole = roleEdits[memberId];
    if (member && newRole !== member.role) {
      await supabase.rpc("admin_update_user_role", { target_id: memberId, new_role: newRole });
    }
    const newSections = sectionEdits[memberId] ?? [];
    await supabase.from("profiles").update({ custom_sections: newSections }).eq("id", memberId);

    setSaving((s) => ({ ...s, [memberId]: false }));
    setSaved((s) => ({ ...s, [memberId]: true }));
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole, custom_sections: newSections } : m));
    setTimeout(() => setSaved((s) => ({ ...s, [memberId]: false })), 2000);
  }

  async function removeMember(memberId: string) {
    setRemoving(memberId);
    setRemoveError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-user`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ target_id: memberId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao remover membro");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setConfirming(null);
    } catch (err: unknown) {
      setRemoveError((err as Error).message);
    } finally {
      setRemoving(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
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
      if (!res.ok) throw new Error(json.error ?? "Erro ao adicionar membro");
      setCreatedCreds({ email: inviteEmail, password: json.tempPassword });
      setInviteEmail(""); setInviteName(""); setInviteRole("gt");
      setShowInvite(false);
      loadMembers();
    } catch (err: unknown) {
      setInviteError((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  function copyCreds() {
    if (!createdCreds) return;
    navigator.clipboard.writeText(`URL: studio.agenciaorbe.co\nE-mail: ${createdCreds.email}\nSenha temporária: ${createdCreds.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-4">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Membros da equipe</p>
          </div>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Gerencie as funções e acessos do time. A função define quais seções cada membro pode ver.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
        >
          <UserPlus size={13} />Adicionar membro
        </button>
      </div>

      {createdCreds && (
        <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: "var(--accent-tint)", borderColor: "var(--accent-a33)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Membro criado! Repasse esses dados com segurança:</p>
          <div className="text-xs space-y-0.5 font-mono" style={{ color: "var(--text-secondary)" }}>
            <p>URL: studio.agenciaorbe.co</p>
            <p>E-mail: {createdCreds.email}</p>
            <p>Senha temporária: {createdCreds.password}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={copyCreds} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copiado!" : "Copiar"}
            </button>
            <button onClick={() => setCreatedCreds(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "var(--text-tertiary)" }}>Fechar</button>
          </div>
        </div>
      )}

      {showInvite && (
        <form onSubmit={handleInvite} className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Adicionar novo membro</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Nome</label>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required placeholder="Nome completo"
                className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none"
                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Função</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>E-mail</label>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="email@agenciaorbe.co"
              className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none"
              style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }} />
          </div>
          {inviteError && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--danger)" }}>
              <AlertCircle size={12} />{inviteError}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-2 rounded-lg text-xs border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={inviting} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              {inviting ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              {inviting ? "Criando..." : "Adicionar"}
            </button>
          </div>
        </form>
      )}

      {removeError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "var(--danger-tint)", border: "1px solid #EF444433", color: "var(--danger)" }}>
          <AlertCircle size={12} />{removeError}
        </div>
      )}

      <div className="space-y-2.5">
        {members.map((member) => {
          const isMe = member.id === currentUserId;
          const sections = sectionEdits[member.id] ?? [];
          const granted = ALL_SECTIONS.filter((s) => sections.includes(s));
          const isExpanded = !!expanded[member.id];
          const isConfirming = confirming === member.id;
          const dirty = isDirty(member);

          return (
            <div
              key={member.id}
              className="rounded-xl border overflow-hidden transition-colors"
              style={{ borderColor: isConfirming ? "#EF444444" : "var(--border)", backgroundColor: "var(--bg-surface)" }}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  {initials(member.display_name, member.email)}
                </div>

                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 truncate">
                    <span className="truncate">{member.display_name || member.email}</span>
                    {isMe && <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>Você</span>}
                    {!member.is_active && <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--danger-tint)", color: "var(--danger)" }}>Inativo</span>}
                  </p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-quaternary)" }}>{member.email}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-quaternary)" }}>
                    Último acesso: {member.id in lastSeen ? (lastSeen[member.id] ? timeAgo(lastSeen[member.id]!) : "nunca entrou") : "—"}
                  </p>
                </div>

                {/* Role + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={roleEdits[member.id] ?? member.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setRoleEdits((r) => ({ ...r, [member.id]: newRole }));
                      setSectionEdits((s) => ({ ...s, [member.id]: SECTION_ACCESS[newRole] ?? [] }));
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] border appearance-none cursor-pointer focus:outline-none"
                    style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-strong)" }}
                  >
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button
                    onClick={() => saveMember(member.id)}
                    disabled={saving[member.id] || !dirty}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all"
                    style={{ backgroundColor: saved[member.id] ? "var(--accent-tint)" : "var(--accent-a22)", color: "var(--accent)", border: "1px solid var(--accent-a33)" }}
                  >
                    {saving[member.id] ? <Loader2 size={11} className="animate-spin" /> : saved[member.id] ? <Check size={11} /> : <Save size={11} />}
                    {saved[member.id] ? "Salvo" : "Salvar"}
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => setConfirming(member.id)}
                      title="Remover acesso"
                      className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
                      style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444444"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {isConfirming ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ backgroundColor: "var(--danger-tint)", borderTop: "1px solid #EF444422" }}>
                  <p className="text-xs" style={{ color: "var(--danger)" }}>
                    Remover o acesso de <strong>{member.display_name || member.email}</strong>? O login dele será bloqueado.
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirming(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: "var(--text-quaternary)", color: "var(--text-secondary)" }}
                    >
                      <X size={11} />Cancelar
                    </button>
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={removing === member.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ backgroundColor: "var(--danger)", color: "var(--bg-page)" }}
                    >
                      {removing === member.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Confirmar remoção
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [member.id]: !e[member.id] }))}
                  className="w-full flex items-center gap-1.5 px-4 py-2 text-[11px] transition-colors"
                  style={{ color: "var(--text-tertiary)", borderTop: "1px solid var(--bg-surface-2)" }}
                >
                  <ChevronDown size={12} className="transition-transform" style={{ transform: isExpanded ? "rotate(180deg)" : "none" }} />
                  {granted.length} de {ALL_SECTIONS.length} seções liberadas
                  {dirty && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1" style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>não salvo</span>}
                </button>
              )}

              {isExpanded && !isConfirming && (
                <div className="px-4 pb-3.5">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ALL_SECTIONS.map((sec) => {
                      const hasAccess = sections.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => toggleSection(member.id, sec)}
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors cursor-pointer"
                          style={{
                            backgroundColor: hasAccess ? "var(--accent-tint)" : "transparent",
                            color: hasAccess ? "var(--accent)" : "var(--text-quaternary)",
                            borderColor: hasAccess ? "var(--accent-a44)" : "#222",
                          }}
                        >
                          {SECTION_LABELS[sec]}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => resetSectionsToRoleDefault(member.id)}
                    className="text-[10px] underline"
                    style={{ color: "var(--text-quaternary)" }}
                  >
                    Restaurar padrão da função
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>
        As permissões entram em vigor no próximo login do membro.
      </p>
    </div>
  );
}

export function ProfileView({ profile, userEmail }: ProfileViewProps) {
  const email = profile?.email ?? userEmail;
  const isAdmin = profile?.role === "admin";
  const [section, setSection] = useState<"perfil" | "equipe" | "seguranca">("perfil");

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState(false);

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  async function handleSaveName() {
    if (!displayName.trim() || !profile) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", profile.id);
    setSaving(false);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2500);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(""); setPwSuccess(false);
    if (newPw.length < 6) { setPwError("Mínimo 6 caracteres."); return; }
    if (newPw !== confirmPw) { setPwError("As senhas não coincidem."); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) { setPwError(error.message); return; }
    setPwSuccess(true);
    setNewPw(""); setConfirmPw("");
    setTimeout(() => setPwSuccess(false), 3000);
  }

  const inputStyle = { borderColor: "var(--border-strong)" };
  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = "var(--accent-a44)");
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = "var(--border-strong)");

  const navItems = [
    { id: "perfil", label: "Configurações de perfil" },
    ...(isAdmin ? [{ id: "equipe", label: "Equipe & Acessos" }] : []),
    { id: "seguranca", label: "Segurança" },
  ];

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Sub-sidebar */}
      <aside className="flex-shrink-0 flex flex-col py-6 overflow-y-auto" style={{ width: 200, borderRight: "1px solid var(--bg-surface-2)", backgroundColor: "var(--bg-page)" }}>
        <p className="text-[9px] font-bold tracking-widest uppercase px-4 mb-1" style={{ color: "var(--text-quaternary)" }}>Conta</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id as typeof section)}
            className="w-full text-left px-4 py-2 text-xs transition-colors duration-100"
            style={{
              color: section === item.id ? "var(--text-primary)" : "var(--text-tertiary)",
              backgroundColor: section === item.id ? "var(--accent-tint)" : "transparent",
              borderLeft: section === item.id ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-10 py-8">

          {/* ── Perfil ── */}
          {section === "perfil" && (
            <>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[var(--text-primary)] font-semibold text-base">Configurações de perfil</h2>
                <button
                  onClick={handleSaveName}
                  disabled={saving || !displayName.trim() || displayName.trim() === (profile?.display_name ?? "")}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ backgroundColor: savedName ? "var(--accent-tint)" : "var(--accent)", color: savedName ? "var(--accent)" : "var(--bg-page)" }}
                >
                  {savedName ? <CheckCircle2 size={13} /> : <Save size={13} />}
                  {saving ? "Salvando..." : savedName ? "Salvo!" : "Salvar"}
                </button>
              </div>

              <div className="flex items-center gap-6 mb-8 pb-6" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-2xl font-bold"
                  style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)", border: "2px solid var(--accent-a33)" }}>
                  {(displayName || email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[var(--text-primary)] font-semibold text-sm">{displayName || "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{email}</p>
                  {profile && (
                    <div className="flex items-center gap-1 mt-2">
                      {profile.role === "admin" && <ShieldCheck size={11} style={{ color: "var(--accent)" }} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>
                        {ROLE_LABELS[profile.role] ?? profile.role}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Field label="E-mail">
                  <p className="text-sm py-2.5 px-3 rounded-lg" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--bg-surface-2)" }}>
                    {email}
                  </p>
                </Field>

                <Field label="Nome de exibição">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    placeholder="Seu nome completo"
                    className={inputCls}
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </Field>

                <Field label="Função">
                  <p className="text-sm py-2.5 px-3 rounded-lg max-w-sm" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--bg-surface-2)" }}>
                    {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? "—"}
                  </p>
                  {isAdmin && (
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--text-quaternary)" }}>
                      Para alterar a função de um membro, acesse <button onClick={() => setSection("equipe")} className="underline" style={{ color: "var(--accent)" }}>Equipe & Acessos</button>.
                    </p>
                  )}
                </Field>

                {profile?.id && (
                  <Field label="ID do usuário">
                    <p className="text-xs py-2.5 font-mono" style={{ color: "var(--text-quaternary)" }}>{profile.id}</p>
                  </Field>
                )}

                {/* Seções acessíveis */}
                <Field label="Seções habilitadas">
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(SECTION_ACCESS[profile?.role ?? ""] ?? []).map((sec) => (
                      <span key={sec} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>
                        {SECTION_LABELS[sec]}
                      </span>
                    ))}
                  </div>
                </Field>
              </div>
            </>
          )}

          {/* ── Equipe & Acessos ── */}
          {section === "equipe" && isAdmin && profile?.id && (
            <>
              <h2 className="text-[var(--text-primary)] font-semibold text-base mb-8">Equipe & Acessos</h2>
              <TeamPanel currentUserId={profile.id} />
            </>
          )}

          {/* ── Segurança ── */}
          {section === "seguranca" && (
            <>
              <h2 className="text-[var(--text-primary)] font-semibold text-base mb-8">Segurança</h2>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound size={14} style={{ color: "var(--accent)" }} />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Alterar senha</p>
                </div>
                <p className="text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>Após alterar, você será desconectado de todos os dispositivos.</p>

                <form onSubmit={handleChangePassword}>
                  <div className="space-y-4">
                    <Field label="Nova senha">
                      <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Mínimo 6 caracteres" className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                    </Field>
                    <Field label="Confirmar senha">
                      <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Repita a nova senha" className={inputCls} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
                    </Field>
                  </div>

                  {pwError && (
                    <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg max-w-sm" style={{ backgroundColor: "var(--danger-tint)", border: "1px solid #ef444433" }}>
                      <AlertCircle size={13} style={{ color: "var(--danger)", flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: "var(--danger)" }}>{pwError}</p>
                    </div>
                  )}
                  {pwSuccess && (
                    <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg max-w-sm" style={{ backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-a33)" }}>
                      <CheckCircle2 size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: "var(--accent)" }}>Senha alterada com sucesso!</p>
                    </div>
                  )}
                  <button type="submit" disabled={savingPw || !newPw || !confirmPw}
                    className="flex items-center gap-2 mt-6 px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
                    <KeyRound size={13} />
                    {savingPw ? "Alterando..." : "Alterar senha"}
                  </button>
                </form>
              </div>

              <div style={{ borderTop: "1px solid var(--bg-surface-2)", paddingTop: "2rem" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Globe size={14} style={{ color: "var(--accent)" }} />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Sessões ativas</p>
                </div>
                <p className="text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>Dispositivos com acesso à sua conta.</p>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--bg-surface-2)" }}>
                  <div className="grid grid-cols-4 px-4 py-2" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--bg-surface-2)" }}>
                    {["Sessão", "Último acesso", "Região", ""].map((h) => (
                      <p key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)" }}>{h}</p>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 items-center px-4 py-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Monitor size={13} style={{ color: "var(--accent)" }} />
                      <span className="text-xs text-[var(--text-primary)]">Este dispositivo</span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Agora</span>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Brasil</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>Atual</span>
                  </div>
                </div>
                <button onClick={() => supabase.auth.signOut({ scope: "others" })}
                  className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-xs border transition-colors"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--danger)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; }}>
                  <LogOut size={13} />Encerrar todas as outras sessões
                </button>
              </div>

              <div style={{ borderTop: "1px solid var(--bg-surface-2)", paddingTop: "2rem", marginTop: "2rem" }}>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={14} style={{ color: "var(--accent)" }} />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Verificação em 2 etapas</p>
                </div>
                <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>Adicione uma camada extra de segurança à sua conta.</p>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--bg-surface-2)" }}>
                  <div>
                    <p className="text-xs text-[var(--text-primary)] font-medium">Autenticação por aplicativo</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-quaternary)" }}>Google Authenticator, Authy, etc.</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-quaternary)" }}>Em breve</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
