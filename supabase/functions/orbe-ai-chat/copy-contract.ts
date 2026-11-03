export const COPY_PLATFORMS = {
  meta: {
    label: "Meta Ads",
    fields: [
      "Headline (título)",
      "Texto principal",
      "Descrição",
      "Call to Action",
    ],
  },
  google: {
    label: "Google Ads",
    fields: [
      "Headline 1",
      "Headline 2",
      "Headline 3",
      "Descrição 1",
      "Descrição 2",
    ],
  },
  instagram: {
    label: "Instagram",
    fields: ["Legenda", "Stories copy", "CTA do stories"],
  },
  whatsapp: {
    label: "WhatsApp",
    fields: ["Mensagem de abordagem", "Follow-up", "Mensagem de conversão"],
  },
} as const;
export type CopyPlatform = keyof typeof COPY_PLATFORMS;
export const BRIEF_LABELS = {
  theme: "Tema da campanha",
  period: "Período da campanha",
  product: "Produto ou serviço",
  offer: "Resumo da oferta e condições",
  objective: "Objetivo",
  persona: "Persona",
  audience: "Público-alvo",
  differentials: "Diferenciais e provas",
  cta: "Próximo passo / destino do CTA",
} as const;
export type CopyBrief = Record<keyof typeof BRIEF_LABELS, string>;
export type CopySource = { id: string; title: string; url: string | null };
export type CopyCampaign = {
  id: string;
  label: string;
  path: string;
  documentCount: number;
  historical: boolean;
};
export type CopyCatalog = {
  campaigns: CopyCampaign[];
  configured: boolean;
  syncedAt: string | null;
};
export type CopyBriefResponse = {
  brief: CopyBrief;
  offers: Array<{ label: string; offer: string; product: string }>;
  warnings: string[];
  sources: CopySource[];
  campaignId: string;
};
export type CopyOutput = {
  fields: Record<string, string>;
  warnings: string[];
  sources: CopySource[];
  platform: CopyPlatform;
};
