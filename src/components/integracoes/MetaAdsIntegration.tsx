import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useClients } from "../../hooks/useClients";
import {
  Check, Loader2, RefreshCw, AlertCircle, ExternalLink,
  Unlink, ChevronDown, ChevronUp,
} from "lucide-react";

const META_STORAGE_KEY = "orbe_meta_token";

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
}

interface MetaInsights {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
}

const META_GRAPH = "https://graph.facebook.com/v18.0";

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

interface SyncResult {
  period: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  results: number;
  cost_per_result: number;
}

async function fetchMonthlyInsights(adAccountId: string, token: string, monthsBack = 3): Promise<SyncResult[]> {
  const now = new Date();

  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      since: d.toISOString().split("T")[0],
      until: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0],
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  const settled = await Promise.allSettled(
    months.map(({ since, until, period }) =>
      metaGet(`/${adAccountId}/insights`, token, {
        fields: "impressions,clicks,spend,reach,ctr,actions",
        time_range: JSON.stringify({ since, until }),
        level: "account",
      }).then((data: { data: MetaInsights[] }) => {
        if (!data.data?.[0]) return null;
        const ins = data.data[0];
        const leads = ins.actions?.find((a) => ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"].includes(a.action_type));
        const purchases = ins.actions?.find((a) => ["purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type));
        const actionVal = Number(leads?.value ?? purchases?.value ?? 0);
        const spend = parseFloat(ins.spend ?? "0");
        return {
          period,
          spend,
          impressions: parseInt(ins.impressions ?? "0"),
          reach: parseInt(ins.reach ?? "0"),
          clicks: parseInt(ins.clicks ?? "0"),
          ctr: parseFloat(ins.ctr ?? "0"),
          results: actionVal,
          cost_per_result: actionVal > 0 ? spend / actionVal : 0,
        } satisfies SyncResult;
      })
    )
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<SyncResult | null> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value as SyncResult);
}

export function MetaAdsIntegration() {
  const { profile } = useAuth();
  const { clients, loading: clientsLoading } = useClients();
  const [token, setToken] = useState(localStorage.getItem(META_STORAGE_KEY) ?? "");
  const [savedToken, setSavedToken] = useState(localStorage.getItem(META_STORAGE_KEY) ?? "");
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncResults, setSyncResults] = useState<Record<string, "ok" | "fail">>({});
  const [error, setError] = useState("");
  const [clientAccountMap, setClientAccountMap] = useState<Record<string, string>>({});
  const [showInstructions, setShowInstructions] = useState(false);

  const activeClients = clients.filter((c) => c.status !== "churned");

  const loadAccounts = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    setError("");
    try {
      const data = await metaGet("/me/adaccounts", t, {
        fields: "id,name,account_status,currency",
        limit: "50",
      });
      setAccounts(data.data ?? []);
    } catch (err: unknown) {
      setError((err as Error).message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (savedToken) loadAccounts(savedToken);
  }, [savedToken, loadAccounts]);

  function saveToken() {
    localStorage.setItem(META_STORAGE_KEY, token);
    setSavedToken(token);
  }

  function disconnect() {
    localStorage.removeItem(META_STORAGE_KEY);
    setSavedToken("");
    setToken("");
    setAccounts([]);
  }

  async function syncClient(clientId: string, adAccountId: string) {
    if (!savedToken || !adAccountId) return;
    setSyncing((s) => ({ ...s, [clientId]: true }));
    setSyncResults((s) => ({ ...s, [clientId]: undefined as unknown as "ok" }));
    try {
      const insights = await fetchMonthlyInsights(adAccountId, savedToken, 3);
      if (insights.length === 0) throw new Error("Nenhum dado encontrado para este período");

      await Promise.all(
        insights.map((ins) =>
          supabase.from("client_ads_metrics").upsert({
            client_id: clientId,
            platform: "meta",
            period: ins.period,
            investimento: ins.spend,
            impressoes: ins.impressions,
            alcance: ins.reach,
            cliques: ins.clicks,
            ctr: ins.ctr,
            resultados: ins.results,
            custo_por_resultado: ins.cost_per_result,
            synced_from_api: true,
          }, { onConflict: "client_id,platform,period" })
        )
      );

      await supabase.from("clients").update({ meta_ads_account_id: adAccountId }).eq("id", clientId);
      setSyncResults((s) => ({ ...s, [clientId]: "ok" }));
    } catch (err: unknown) {
      setError((err as Error).message);
      setSyncResults((s) => ({ ...s, [clientId]: "fail" }));
    } finally {
      setSyncing((s) => ({ ...s, [clientId]: false }));
    }
  }

  const inp = "w-full rounded-lg px-3 py-2 text-xs text-white placeholder-[var(--text-quaternary)] focus:outline-none";
  const inpStyle = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" };

  return (
    <div className="space-y-6">
      {/* Token section */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Meta Ads</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Conecte sua conta para sincronizar métricas automaticamente</p>
          </div>
          {savedToken && accounts.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--accent)" }}>
              <Check size={12} />Conectado ({accounts.length} conta{accounts.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>

        <button onClick={() => setShowInstructions(!showInstructions)} className="flex items-center gap-1.5 text-xs" style={{ color: "#1877F2" }}>
          {showInstructions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Como obter o token de acesso (gratuito)
        </button>

        {showInstructions && (
          <div className="rounded-xl p-4 space-y-2 text-xs" style={{ backgroundColor: "#0a0f1a", border: "1px solid #1877F222" }}>
            <p className="font-bold" style={{ color: "#1877F2" }}>Passo a passo:</p>
            <p style={{ color: "var(--text-tertiary)" }}>1. Acesse <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#1877F2" }}>developers.facebook.com/tools/explorer <ExternalLink size={10} className="inline" /></a></p>
            <p style={{ color: "var(--text-tertiary)" }}>2. Clique em "Generate Access Token"</p>
            <p style={{ color: "var(--text-tertiary)" }}>3. Selecione as permissões: <strong className="text-white">ads_read</strong>, <strong className="text-white">ads_management</strong></p>
            <p style={{ color: "var(--text-tertiary)" }}>4. Copie o token gerado e cole abaixo</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-quaternary)" }}>O token expira em 60 dias. Para tokens permanentes, configure um App próprio no Meta Developers.</p>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole seu token de acesso Meta aqui..."
            type="password"
            className={inp + " flex-1"}
            style={inpStyle}
          />
          <button onClick={saveToken} disabled={!token || token === savedToken}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: "#1877F2", color: "var(--text-primary)" }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : "Conectar"}
          </button>
          {savedToken && (
            <button onClick={disconnect} className="p-2 rounded-lg border transition-colors" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; }}>
              <Unlink size={14} />
            </button>
          )}
        </div>

        {error && <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--danger)" }}><AlertCircle size={12} />{error}</p>}
      </div>

      {/* Client sync table */}
      {accounts.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--bg-surface-2)" }}>
            <p className="text-xs font-bold text-white">Sincronizar clientes</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Para cada cliente, escolha a conta de anúncios correspondente e clique em Sincronizar
            </p>
          </div>

          {clientsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin" style={{ color: "#1877F2" }} />
            </div>
          ) : activeClients.length === 0 ? (
            <div className="py-10 text-center space-y-2" style={{ color: "var(--text-quaternary)" }}>
              <p className="text-xs font-semibold text-white">Nenhum cliente cadastrado</p>
              <p className="text-[11px]">Vá para a seção <strong className="text-white">Clientes</strong> e adicione seus clientes primeiro.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
              {activeClients.map((client) => {
                const mapped = clientAccountMap[client.id] ?? client.meta_ads_account_id ?? "";
                const isSyncing = syncing[client.id];
                const result = syncResults[client.id];

                return (
                  <div key={client.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-xs font-medium text-white truncate">{client.name}</p>
                      {result === "ok" && <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: "var(--accent)" }}><Check size={10} />Sincronizado</p>}
                      {result === "fail" && <p className="text-[10px] mt-0.5" style={{ color: "var(--danger)" }}>Falhou</p>}
                    </div>
                    <select
                      value={mapped}
                      onChange={(e) => setClientAccountMap((m) => ({ ...m, [client.id]: e.target.value }))}
                      className="flex-1 rounded-lg px-3 py-2 text-xs text-white appearance-none focus:outline-none"
                      style={inpStyle}>
                      <option value="">— Selecione a conta de anúncios —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => syncClient(client.id, mapped)}
                      disabled={isSyncing || !mapped}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 flex-shrink-0"
                      style={{ backgroundColor: "#1877F222", color: "#1877F2", border: "1px solid #1877F244" }}>
                      {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Sincronizar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {profile?.role === "admin" && (
        <p className="text-[10px] text-center" style={{ color: "#222" }}>
          Para tokens permanentes, configure uma Meta App em developers.facebook.com e implemente OAuth com seu próprio App ID.
        </p>
      )}
    </div>
  );
}
