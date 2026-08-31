import { useState } from "react";
import { MetaAdsIntegration } from "./integracoes/MetaAdsIntegration";
import { GoogleAdsIntegration } from "./integracoes/GoogleAdsIntegration";
import { Footer } from "./Footer";

type Tab = "meta" | "google";

export function IntegracoesView() {
  const [tab, setTab] = useState<Tab>("meta");

  const tabs: Array<{ id: Tab; label: string; color: string }> = [
    { id: "meta",   label: "Meta Ads",    color: "#1877F2" },
    { id: "google", label: "Google Ads",  color: "#EA4335" },
  ];

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>Integrações</p>
          <h2 className="text-white font-bold text-lg leading-tight">Plataformas de Anúncio</h2>
          <p className="text-xs mt-1" style={{ color: "#555" }}>
            Conecte suas contas de anúncios para sincronizar métricas automaticamente nos dashboards dos clientes.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: tab === t.id ? t.color + "22" : "transparent",
                color: tab === t.id ? t.color : "#555",
                border: tab === t.id ? `1px solid ${t.color}44` : "1px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "meta"   && <MetaAdsIntegration />}
        {tab === "google" && <GoogleAdsIntegration />}
      </div>
      <Footer />
    </div>
  );
}
