import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/database.types";
import {
  ShieldCheck, Save, KeyRound, CheckCircle2,
  AlertCircle, Monitor, Globe, LogOut, Users, Check, Loader2,
  ChevronDown, Trash2, X,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  gt: "Gestor de Tráfego",
  gp: "Gestor de Projetos",
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

const SECTION_ACCESS: Record<string, string[]> = {
  admin:      ["dashboard","tarefas","clientes","financeiro","pipeline","processos","central","rastreamento","super-agente","copy-ia","relatorios","whatsapp","integracoes","leads-capturados"],
  coordenador:["dashboard","tarefas","clientes","financeiro","pipeline","processos","central","rastreamento","super-agente","copy-ia","relatorios","whatsapp","integracoes","leads-capturados"],
  gp:         ["dashboard","tarefas","clientes","pipeline","processos","central","super-agente","copy-ia","relatorios"],
  gt:         ["dashboard","tarefas","clientes","pipeline","processos","central","super-agente","copy-ia","relatorios","integracoes"],
};

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard", tarefas: "Tarefas", clientes: "Clientes",
  financeiro: "Financeiro", pipeline: "Oportunidades", processos: "Processos",
  central: "Central", rastreamento: "Rastreamento", "super-agente": "Super Agente",
  "copy-ia": "Copy IA", relatorios: "Relatórios", whatsapp: "WhatsApp",
  integracoes: "Integrações", "leads-capturados": "Leads Capturados",
};

interface ProfileViewProps { profile: Profile | null; userEmail: string }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4 py-4" style={{ borderBottom: "1px solid #111" }}>
      <p className="text-xs pt-2.5 font-medium" style={{ color: "#555" }}>{label}</p>
      <div>{children}</div>
    </div>
  );
}

const inputCls = "w-full bg-black border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:outline-none transition-colors max-w-sm";

interface TeamMember { id: string; email: string; display_name: string; role: string; is_active: boolean }

function initials(name: string, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function TeamPanel({ currentUserId }: { currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  function loadMembers() {
    setLoading(true);
    supabase.from("profiles").select("id,email,display_name,role,is_active").order("created_at")
      .then(({ data }) => {
        setMembers(data ?? []);
        const edits: Record<string, string> = {};
        data?.forEach((m) => { edits[m.id] = m.role; });
        setRoleEdits(edits);
        setLoading(false);
      });
  }

  async function saveRole(memberId: string) {
    setSaving((s) => ({ ...s, [memberId]: true }));
    await supabase.rpc("admin_update_user_role", { target_id: memberId, new_role: roleEdits[memberId] });
    setSaving((s) => ({ ...s, [memberId]: false }));
    setSaved((s) => ({ ...s, [memberId]: true }));
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: roleEdits[memberId] } : m));
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin" style={{ color: "#7B61FF" }} /></div>;

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} style={{ color: "#7B61FF" }} />
          <p className="text-sm font-semibold text-white">Membros da equipe</p>
        </div>
        <p className="text-xs" style={{ color: "#555" }}>Gerencie as funções e acessos do time. A função define quais seções cada membro pode ver.</p>
      </div>

      {removeError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#1a0505", border: "1px solid #EF444433", color: "#EF4444" }}>
          <AlertCircle size={12} />{removeError}
        </div>
      )}

      <div className="space-y-2.5">
        {members.map((member) => {
          const isMe = member.id === currentUserId;
          const sections = SECTION_ACCESS[roleEdits[member.id]] ?? [];
          const granted = Object.keys(SECTION_LABELS).filter((s) => sections.includes(s));
          const isExpanded = !!expanded[member.id];
          const isConfirming = confirming === member.id;

          return (
            <div
              key={member.id}
              className="rounded-xl border overflow-hidden transition-colors"
              style={{ borderColor: isConfirming ? "#EF444444" : "#1a1a1a", backgroundColor: "#0a0a0a" }}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: "#1A1230", color: "#7B61FF" }}
                >
                  {initials(member.display_name, member.email)}
                </div>

                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white flex items-center gap-2 truncate">
                    <span className="truncate">{member.display_name || member.email}</span>
                    {isMe && <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1A1230", color: "#7B61FF" }}>Você</span>}
                    {!member.is_active && <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1a0505", color: "#EF4444" }}>Inativo</span>}
                  </p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "#444" }}>{member.email}</p>
                </div>

                {/* Role + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={roleEdits[member.id] ?? member.role}
                    onChange={(e) => setRoleEdits((r) => ({ ...r, [member.id]: e.target.value }))}
                    className="rounded-lg px-2 py-1.5 text-xs text-white border appearance-none cursor-pointer focus:outline-none"
                    style={{ backgroundColor: "#080808", borderColor: "#1e1e1e" }}
                  >
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button
                    onClick={() => saveRole(member.id)}
                    disabled={saving[member.id] || roleEdits[member.id] === member.role}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all"
                    style={{ backgroundColor: saved[member.id] ? "#1A1230" : "#7B61FF22", color: "#7B61FF", border: "1px solid #7B61FF33" }}
                  >
                    {saving[member.id] ? <Loader2 size={11} className="animate-spin" /> : saved[member.id] ? <Check size={11} /> : <Save size={11} />}
                    {saved[member.id] ? "Salvo" : "Salvar"}
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => setConfirming(member.id)}
                      title="Remover acesso"
                      className="flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
                      style={{ borderColor: "#1e1e1e", color: "#555" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e1e1e"; (e.currentTarget as HTMLButtonElement).style.color = "#555"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {isConfirming ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ backgroundColor: "#1a0505", borderTop: "1px solid #EF444422" }}>
                  <p className="text-xs" style={{ color: "#EF4444" }}>
                    Remover o acesso de <strong>{member.display_name || member.email}</strong>? O login dele será bloqueado.
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirming(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: "#333", color: "#A3A3A3" }}
                    >
                      <X size={11} />Cancelar
                    </button>
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={removing === member.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ backgroundColor: "#EF4444", color: "#000" }}
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
                  style={{ color: "#555", borderTop: "1px solid #111" }}
                >
                  <ChevronDown size={12} className="transition-transform" style={{ transform: isExpanded ? "rotate(180deg)" : "none" }} />
                  {granted.length} de {Object.keys(SECTION_LABELS).length} seções liberadas
                </button>
              )}

              {isExpanded && !isConfirming && (
                <div className="px-4 pb-3.5 flex flex-wrap gap-1.5">
                  {Object.keys(SECTION_LABELS).map((sec) => {
                    const hasAccess = sections.includes(sec);
                    return (
                      <span key={sec} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: hasAccess ? "#1A1230" : "#111", color: hasAccess ? "#7B61FF" : "#333" }}>
                        {SECTION_LABELS[sec]}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px]" style={{ color: "#333" }}>
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

  const inputStyle = { borderColor: "#1e1e1e" };
  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = "#7B61FF44");
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = "#1e1e1e");

  const navItems = [
    { id: "perfil", label: "Configurações de perfil" },
    ...(isAdmin ? [{ id: "equipe", label: "Equipe & Acessos" }] : []),
    { id: "seguranca", label: "Segurança" },
  ];

  return (
    <div className="flex h-full" style={{ backgroundColor: "#060606" }}>
      {/* Sub-sidebar */}
      <aside className="flex-shrink-0 flex flex-col py-6 overflow-y-auto" style={{ width: 200, borderRight: "1px solid #111", backgroundColor: "#060606" }}>
        <p className="text-[9px] font-bold tracking-widest uppercase px-4 mb-1" style={{ color: "#333" }}>Conta</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id as typeof section)}
            className="w-full text-left px-4 py-2 text-xs transition-colors duration-100"
            style={{
              color: section === item.id ? "#fff" : "#555",
              backgroundColor: section === item.id ? "#1A1230" : "transparent",
              borderLeft: section === item.id ? "2px solid #7B61FF" : "2px solid transparent",
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
                <h2 className="text-white font-semibold text-base">Configurações de perfil</h2>
                <button
                  onClick={handleSaveName}
                  disabled={saving || !displayName.trim() || displayName.trim() === (profile?.display_name ?? "")}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ backgroundColor: savedName ? "#1A1230" : "#7B61FF", color: savedName ? "#7B61FF" : "#000" }}
                >
                  {savedName ? <CheckCircle2 size={13} /> : <Save size={13} />}
                  {saving ? "Salvando..." : savedName ? "Salvo!" : "Salvar"}
                </button>
              </div>

              <div className="flex items-center gap-6 mb-8 pb-6" style={{ borderBottom: "1px solid #111" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-2xl font-bold"
                  style={{ backgroundColor: "#1A1230", color: "#7B61FF", border: "2px solid #7B61FF33" }}>
                  {(displayName || email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{displayName || "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#555" }}>{email}</p>
                  {profile && (
                    <div className="flex items-center gap-1 mt-2">
                      {profile.role === "admin" && <ShieldCheck size={11} style={{ color: "#7B61FF" }} />}
                      <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1A1230", color: "#7B61FF" }}>
                        {ROLE_LABELS[profile.role] ?? profile.role}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Field label="E-mail">
                  <p className="text-sm py-2.5 px-3 rounded-lg" style={{ color: "#555", backgroundColor: "#0a0a0a", border: "1px solid #111" }}>
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
                  <p className="text-sm py-2.5 px-3 rounded-lg max-w-sm" style={{ color: "#888", backgroundColor: "#0a0a0a", border: "1px solid #111" }}>
                    {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? "—"}
                  </p>
                  {isAdmin && (
                    <p className="text-[10px] mt-1.5" style={{ color: "#444" }}>
                      Para alterar a função de um membro, acesse <button onClick={() => setSection("equipe")} className="underline" style={{ color: "#7B61FF" }}>Equipe & Acessos</button>.
                    </p>
                  )}
                </Field>

                {profile?.id && (
                  <Field label="ID do usuário">
                    <p className="text-xs py-2.5 font-mono" style={{ color: "#333" }}>{profile.id}</p>
                  </Field>
                )}

                {/* Seções acessíveis */}
                <Field label="Seções habilitadas">
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(SECTION_ACCESS[profile?.role ?? ""] ?? []).map((sec) => (
                      <span key={sec} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ backgroundColor: "#1A1230", color: "#7B61FF" }}>
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
              <h2 className="text-white font-semibold text-base mb-8">Equipe & Acessos</h2>
              <TeamPanel currentUserId={profile.id} />
            </>
          )}

          {/* ── Segurança ── */}
          {section === "seguranca" && (
            <>
              <h2 className="text-white font-semibold text-base mb-8">Segurança</h2>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound size={14} style={{ color: "#7B61FF" }} />
                  <p className="text-sm font-semibold text-white">Alterar senha</p>
                </div>
                <p className="text-xs mb-6" style={{ color: "#555" }}>Após alterar, você será desconectado de todos os dispositivos.</p>

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
                    <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg max-w-sm" style={{ backgroundColor: "#1a0505", border: "1px solid #ef444433" }}>
                      <AlertCircle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: "#ef4444" }}>{pwError}</p>
                    </div>
                  )}
                  {pwSuccess && (
                    <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg max-w-sm" style={{ backgroundColor: "#1A1230", border: "1px solid #7B61FF33" }}>
                      <CheckCircle2 size={13} style={{ color: "#7B61FF", flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: "#7B61FF" }}>Senha alterada com sucesso!</p>
                    </div>
                  )}
                  <button type="submit" disabled={savingPw || !newPw || !confirmPw}
                    className="flex items-center gap-2 mt-6 px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                    style={{ backgroundColor: "#7B61FF", color: "#000" }}>
                    <KeyRound size={13} />
                    {savingPw ? "Alterando..." : "Alterar senha"}
                  </button>
                </form>
              </div>

              <div style={{ borderTop: "1px solid #111", paddingTop: "2rem" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Globe size={14} style={{ color: "#7B61FF" }} />
                  <p className="text-sm font-semibold text-white">Sessões ativas</p>
                </div>
                <p className="text-xs mb-6" style={{ color: "#555" }}>Dispositivos com acesso à sua conta.</p>
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#111" }}>
                  <div className="grid grid-cols-4 px-4 py-2" style={{ backgroundColor: "#0a0a0a", borderBottom: "1px solid #111" }}>
                    {["Sessão", "Último acesso", "Região", ""].map((h) => (
                      <p key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#333" }}>{h}</p>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 items-center px-4 py-3 gap-2">
                    <div className="flex items-center gap-2">
                      <Monitor size={13} style={{ color: "#7B61FF" }} />
                      <span className="text-xs text-white">Este dispositivo</span>
                    </div>
                    <span className="text-xs" style={{ color: "#555" }}>Agora</span>
                    <span className="text-xs" style={{ color: "#555" }}>Brasil</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: "#1A1230", color: "#7B61FF" }}>Atual</span>
                  </div>
                </div>
                <button onClick={() => supabase.auth.signOut({ scope: "others" })}
                  className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-xs border transition-colors"
                  style={{ borderColor: "#1e1e1e", color: "#555" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e1e1e"; (e.currentTarget as HTMLButtonElement).style.color = "#555"; }}>
                  <LogOut size={13} />Encerrar todas as outras sessões
                </button>
              </div>

              <div style={{ borderTop: "1px solid #111", paddingTop: "2rem", marginTop: "2rem" }}>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={14} style={{ color: "#7B61FF" }} />
                  <p className="text-sm font-semibold text-white">Verificação em 2 etapas</p>
                </div>
                <p className="text-xs mb-4" style={{ color: "#555" }}>Adicione uma camada extra de segurança à sua conta.</p>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ backgroundColor: "#0a0a0a", borderColor: "#111" }}>
                  <div>
                    <p className="text-xs text-white font-medium">Autenticação por aplicativo</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#444" }}>Google Authenticator, Authy, etc.</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded" style={{ backgroundColor: "#111", color: "#444" }}>Em breve</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
