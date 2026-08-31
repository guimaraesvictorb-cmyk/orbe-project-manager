import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useClients } from "../../hooks/useClients";
import {
  Check, Loader2, RefreshCw, AlertCircle, ExternalLink,
  Unlink, ChevronDown, ChevronUp,
} from "lucide-react";

const GOOGLE_STORAGE_KEY = "orbe_google_token";
const GOOGLE_DEV_TOKEN_KEY = "orbe_google_dev_token";

interface CustomerAccount {
  id: string;
  name: string;
  currency: string;
  timeZone: string;
}

interface SyncResult {
  period: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

async function fetchGoogleAccounts(token: string): Promise<CustomerAccount[]> {
  const res = await fetch("https://googleads.googleapis.com/v16/customers:listAccessibleCustomers", {
    headers: { Authorization: `Bearer ${token}`, "developer-token": localStorage.getItem(GOOGLE_DEV_TOKEN_KEY) ?? "" },
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Erro ao buscar contas");
  return (json.resourceNames ?? []).map((r: string) => ({
    id: r.replace("customers/", ""),
    name: r,
    currency: "BRL",
    timeZone: "America/Sao_Paulo",
  }));
}

async function fetchGoogleInsights(customerId: string, token: string, devToken: string, monthsBack = 3): Promise<SyncResult[]> {
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
    months.map(async ({ since, until, period }) => {
      const query = `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${until}'`;
      const res = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": devToken,
          "Content-Type": "application/json",
          "login-customer-id": customerId,
        },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (json.error) return null;

      let cost = 0, clicks = 0, impressions = 0, conversions = 0;
      for (const row of json.results ?? []) {
        cost += (row.metrics?.costMicros ?? 0) / 1_000_000;
        clicks += row.metrics?.clicks ?? 0;
        impressions += row.metrics?.impressions ?? 0;
        conversions += row.metrics?.conversions ?? 0;
      }

      return cost > 0 || clicks > 0 ? { period, cost, clicks, impressions, conversions } satisfies SyncResult : null;
    })
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<SyncResult | null> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value as SyncResult);
}

export function GoogleAdsIntegration() {
  const { clients } = useClients();
  const [token, setToken] = useState(localStorage.getItem(GOOGLE_STORAGE_KEY) ?? "");
  const [devToken, setDevToken] = useState(localStorage.getItem(GOOGLE_DEV_TOKEN_KEY) ?? "");
  const [savedToken, setSavedToken] = useState(localStorage.getItem(GOOGLE_STORAGE_KEY) ?? "");
  const [, setAccounts] = useState<CustomerAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncResults, setSyncResults] = useState<Record<string, "ok" | "fail">>({});
  const [error, setError] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientAccountMap, setClientAccountMap] = useState<Record<string, string>>({});
  const [showInstructions, setShowInstructions] = useState(false);
  const [manualAccountId, setManualAccountId] = useState<Record<string, string>>({});

  const activeClients = clients.filter((c) => c.status !== "churned");

  const loadAccounts = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchGoogleAccounts(t);
      setAccounts(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (savedToken) loadAccounts(savedToken);
  }, [savedToken, loadAccounts]);

  function saveToken() {
    localStorage.setItem(GOOGLE_STORAGE_KEY, token);
    localStorage.setItem(GOOGLE_DEV_TOKEN_KEY, devToken);
    setSavedToken(token);
  }

  function disconnect() {
    localStorage.removeItem(GOOGLE_STORAGE_KEY);
    setSavedToken("");
    setToken("");
    setAccounts([]);
  }

  async function syncClient(clientId: string, customerId: string) {
    const t = savedToken;
    const dt = localStorage.getItem(GOOGLE_DEV_TOKEN_KEY) ?? devToken;
    if (!t || !customerId) return;
    setSyncing((s) => ({ ...s, [clientId]: true }));
    try {
      const insights = await fetchGoogleInsights(customerId, t, dt, 3);
      if (insights.length === 0) throw new Error("Nenhum dado encontrado");

      await Promise.all(
        insights.map((ins) =>
          supabase.from("client_ads_metrics").upsert({
            client_id: clientId,
            platform: "google",
            period: ins.period,
            investimento: ins.cost,
            cliques: ins.clicks,
            impressoes: ins.impressions,
            conversoes: ins.conversions,
            synced_from_api: true,
          }, { onConflict: "client_id,platform,period" })
        )
      );
      await supabase.from("clients").update({ google_ads_account_id: customerId }).eq("id", clientId);
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
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Google Ads</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Conecte via OAuth para sincronizar campanhas e métricas</p>
          </div>
          {savedToken && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--accent)" }}>
              <Check size={12} />Conectado
            </span>
          )}
        </div>

        <button onClick={() => setShowInstructions(!showInstructions)} className="flex items-center gap-1.5 text-xs" style={{ color: "#EA4335" }}>
          {showInstructions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Como obter o token (Google OAuth)
        </button>

        {showInstructions && (
          <div className="rounded-xl p-4 space-y-2 text-xs" style={{ backgroundColor: "#1a0a0a", border: "1px solid #EA433522" }}>
            <p className="font-bold" style={{ color: "#EA4335" }}>Passo a passo:</p>
            <p style={{ color: "var(--text-tertiary)" }}>1. Acesse <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#EA4335" }}>Google OAuth Playground <ExternalLink size={10} className="inline" /></a></p>
            <p style={{ color: "var(--text-tertiary)" }}>2. Selecione o escopo: <strong className="text-white">https://www.googleapis.com/auth/adwords</strong></p>
            <p style={{ color: "var(--text-tertiary)" }}>3. Autorize e obtenha o <strong className="text-white">Access Token</strong></p>
            <p style={{ color: "var(--text-tertiary)" }}>4. Para o Developer Token, acesse Google Ads → Ferramentas → API Center</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-quaternary)" }}>O access token expira em 1 hora. Para uso contínuo, é necessário implementar refresh token via backend.</p>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Access Token OAuth</label>
          <div className="flex gap-2">
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="ya29...." type="password" className={inp + " flex-1"} style={inpStyle} />
            {savedToken && (
              <button onClick={disconnect} className="p-2 rounded-lg border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
                <Unlink size={14} />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Developer Token</label>
          <input value={devToken} onChange={(e) => setDevToken(e.target.value)} placeholder="Seu developer token do Google Ads API Center..." type="password" className={inp} style={inpStyle} />
        </div>

        <button onClick={saveToken} disabled={!token}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
          style={{ backgroundColor: "#EA4335", color: "var(--text-primary)" }}>
          {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Conectar Google Ads"}
        </button>

        {error && <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--danger)" }}><AlertCircle size={12} />{error}</p>}
      </div>

      {savedToken && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--bg-surface-2)" }}>
            <p className="text-xs font-bold text-white">Sincronizar clientes</p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
            {activeClients.map((client) => {
              const expanded = expandedClient === client.id;
              const accountId = clientAccountMap[client.id] ?? client.google_ads_account_id ?? manualAccountId[client.id] ?? "";
              const isSyncing = syncing[client.id];
              const result = syncResults[client.id];

              return (
                <div key={client.id}>
                  <div className="flex items-center gap-3 px-5 py-3 cursor-pointer" onClick={() => setExpandedClient(expanded ? null : client.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{client.name}</p>
                      {accountId && <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>Customer ID: {accountId}</p>}
                    </div>
                    {result === "ok" && <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--accent)" }}><Check size={11} />Sincronizado</span>}
                    {expanded ? <ChevronUp size={13} style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown size={13} style={{ color: "var(--text-tertiary)" }} />}
                  </div>

                  {expanded && (
                    <div className="px-5 pb-4 space-y-2" style={{ backgroundColor: "var(--bg-input)" }}>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest mb-1 block" style={{ color: "var(--text-quaternary)" }}>Customer ID (ex: 123-456-7890)</label>
                        <div className="flex gap-2">
                          <input
                            value={accountId}
                            onChange={(e) => {
                              setClientAccountMap((m) => ({ ...m, [client.id]: e.target.value }));
                              setManualAccountId((m) => ({ ...m, [client.id]: e.target.value }));
                            }}
                            placeholder="Digite o Customer ID..."
                            className={inp + " flex-1"}
                            style={inpStyle}
                          />
                          <button
                            onClick={() => syncClient(client.id, accountId.replace(/-/g, ""))}
                            disabled={isSyncing || !accountId}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                            style={{ backgroundColor: "#EA433522", color: "#EA4335", border: "1px solid #EA433544" }}>
                            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Sincronizar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
