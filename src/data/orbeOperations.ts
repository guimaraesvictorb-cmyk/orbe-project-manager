export type PhaseCategory = "venda" | "operacao" | "saida";

export interface Phase {
  id: number;
  label: string;
  name: string;
  meta: string;
  why: string;
  items: string[];
  category: PhaseCategory;
  highlight: boolean;
}

export interface Ritual {
  name: string;
  when: string;
  desc: string;
}

export interface AISkill {
  name: string;
  phases: string;
  isNew: boolean;
}

export interface NextAction {
  label: string;
}

export const PHASES: Phase[] = [
  {
    id: 0,
    label: "FASE 0",
    name: "Pré-Venda & Qualificação",
    meta: "Filtro · D-7 a D0",
    why: "Cliente errado mata margem e moral. A primeira venda da Orbe é dizer NÃO pra quem não cabe.",
    items: [
      "Formulário de qualificação (faturamento, vertical, maturidade digital, verba)",
      "Critério de ICP Orbe: faturamento mínimo, orçamento mínimo, disposição para recorrência",
      "Lista de 'não atendemos': setores tóxicos e clientes-problema",
      "Pré-research: site, redes, anúncios ativos (Meta Ads Library, SimilarWeb)",
      "Briefing rápido com decisão GO ou NO-GO",
    ],
    category: "venda",
    highlight: false,
  },
  {
    id: 1,
    label: "FASE 1",
    name: "Call 1 — Diagnóstico",
    meta: "45-60 min · Zero pitch",
    why: "Não vende nada. Só escuta, mapeia e qualifica a dor. Quem fala mais nessa call é o cliente.",
    items: [
      "Roteiro SPIN: situação, problema, implicação, necessidade",
      "Mapear faturamento, CAC, LTV, ticket médio, dores reais",
      "O que já tentou? Com quem? Por que não deu certo?",
      "Identificar dor emocional do dono (perda, medo, urgência)",
      "Encerrar marcando Call 2 com data fixa em 7 dias",
    ],
    category: "venda",
    highlight: false,
  },
  {
    id: 2,
    label: "FASE 2",
    name: "7 Dias de Radiografia",
    meta: "Coração da operação",
    why: "É o que separa a Orbe das outras agências. Aqui você chega na Call 2 sabendo mais do mercado do cliente do que ele mesmo.",
    items: [
      "D1-2: ICP B2B/B2C + análise de top players nacionais e locais",
      "D3: Estudo regulatório do setor (leis, multas, riscos)",
      "D4: Auditoria das operações atuais (gastos, gaps, oportunidades)",
      "D5-6: Ativos tangíveis — mockup de LP, funil, criativos, ebook",
      "D7: Montagem da apresentação + ensaio do pitch",
    ],
    category: "venda",
    highlight: true,
  },
  {
    id: 3,
    label: "FASE 3",
    name: "Call 2 — Demonstração",
    meta: "60-90 min · O 'uau'",
    why: "Não é apresentação de proposta. É demonstração de domínio absoluto sobre o negócio do cliente.",
    items: [
      "Mostrar quanto o cliente deixa na mesa em R$ concretos",
      "O que a concorrência faz que ele não faz",
      "Apresentar a Máquina Orbe (infraestrutura 360º)",
      "Entregar ativos prontos personalizados pra ele",
      "Demo ao vivo de IA — autoridade instantânea",
    ],
    category: "venda",
    highlight: false,
  },
  {
    id: 4,
    label: "FASE 4",
    name: "Proposta Comercial",
    meta: "D+1 a D+3 da Call 2",
    why: "Preço com critério, não feeling. Três opções porque a do meio é a que mais vende.",
    items: [
      "Régua de precificação por escopo (tráfego / LP / pontual / recorrente)",
      "3 opções de pacote: anchor + ideal + premium",
      "Contrato + termo de uso de dados + LGPD",
      "Follow-up ativo em 48h e em 5 dias",
      "SLA de resposta da proposta definido",
    ],
    category: "venda",
    highlight: false,
  },
  // ─── Operational pipeline ────────────────────────────────────────────────────
  {
    id: 5,
    label: "FASE 5",
    name: "Onboarding do Cliente",
    meta: "D+0 a D+3 · Pós-assinatura",
    why: "Antes do técnico, vem o humano. O cliente precisa sentir que tomou a decisão certa antes do primeiro entregável. Onboarding mal feito gera ansiedade, micro-gerenciamento e churn precoce.",
    items: [
      "Kit de boas-vindas: e-mail personalizado + PDF com equipe, cronograma e SLAs",
      "Apresentação da equipe responsável e papéis de cada membro",
      "Definição e setup do canal principal de comunicação (WhatsApp Business ou Slack)",
      "Envio do questionário de briefing pré-kick-off (marca, tom de voz, histórico)",
      "Acesso ao painel de aprovações e área do cliente configurado",
    ],
    category: "operacao",
    highlight: false,
  },
  {
    id: 6,
    label: "FASE 6",
    name: "Kick-Off & Setup",
    meta: "D+3 a D+10 do contrato",
    why: "Os primeiros 10 dias determinam os próximos 12 meses. Kick-off ruim = expectativa errada = churn.",
    items: [
      "Checklist de acessos: BM, Ads, GA4, GTM, CRM, site",
      "Briefing estratégico profundo em call de 3 horas",
      "Definição de KPIs, metas e janelas de avaliação",
      "Cronograma 30/60/90 dias compartilhado com o cliente",
      "Setup do canal de comunicação + SLA de resposta definido",
    ],
    category: "operacao",
    highlight: false,
  },
  {
    id: 7,
    label: "FASE 7",
    name: "Operação Recorrente",
    meta: "Mensal · Rituais fixos",
    why: "Cadência é o que faz cliente perceber valor. Sem ritual, ele esquece que existe agência.",
    items: [
      "Otimização semanal interna (squad) — toda sexta",
      "Fecha Mês — até D+5 útil do mês",
      "C.O.R.E quinzenal — dia 15 a 20",
      "DRE trimestral — clientes com 6 meses ou mais",
      "Ata e PDF após toda reunião com o cliente",
    ],
    category: "operacao",
    highlight: false,
  },
  {
    id: 8,
    label: "FASE 8",
    name: "Crise + SLA + Offboarding",
    meta: "Reativo / Saída",
    why: "Cliente que sai bem volta ou indica. Cliente que sai mal queima reputação em rede.",
    items: [
      "Protocolo para queda de campanha, BM bloqueado, pixel quebrado",
      "SLA de resposta por severidade — P0 (1h), P1 (4h), P2 (24h)",
      "Offboarding com passagem de bastão organizada e documentação",
      "NPS final + carta de agradecimento personalizada",
      "Porta giratória: oferta de retorno com desconto em 90 dias",
    ],
    category: "saida",
    highlight: false,
  },
];

export const OPERATIONAL_PHASES = PHASES.filter((p) => p.category === "operacao");

export const RITUAIS: Ritual[] = [
  { name: "Daily Squad", when: "Diário · 15 min", desc: "Ontem, hoje, bloqueios." },
  { name: "Weekly Internal", when: "Sexta · 1h", desc: "Otimização por cliente. Decisões de criativo, verba, públicos." },
  { name: "C.O.R.E Quinzenal", when: "Dia 15-20", desc: "Conquistas · Oportunidades · Resultados · Estratégia. PDF + ata." },
  { name: "Fecha Mês", when: "Até D+5 útil", desc: "Resultado consolidado, storytelling do mês, plano do próximo." },
  { name: "DRE / Escala", when: "Trimestral · 6m+", desc: "Plano de escala: nova verba, novos canais, novos produtos." },
];

export const AI_STACK: AISkill[] = [
  { name: "Prompt Architect", phases: "F0 a F8", isNew: false },
  { name: "Meta Ads Analyst", phases: "F2, F6, F7", isNew: false },
  { name: "Google Ads Analyst", phases: "F2, F6, F7", isNew: false },
  { name: "Neuro-Copywriter", phases: "F2, F3, F7", isNew: false },
  { name: "Conversion Designer", phases: "F2, F3, F6", isNew: false },
  { name: "Social Media Manager", phases: "F2, F7", isNew: false },
  { name: "Social Media Orbe", phases: "F3, F7 (carrosséis)", isNew: false },
  { name: "WhatsApp Bom Dia", phases: "F7 (cadência)", isNew: false },
  { name: "Diagnóstico Pré-Venda", phases: "F2 — automatiza 7 dias em 2h", isNew: true },
  { name: "C.O.R.E Generator", phases: "F7 — gera PDF + ata", isNew: true },
];

export const NEXT_ACTIONS: NextAction[] = [
  { label: "Construir skill Diagnóstico Pré-Venda" },
  { label: "Detalhar template da Call 2" },
  { label: "Régua de precificação" },
  { label: "Template do C.O.R.E" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  venda: "Venda",
  operacao: "Operação",
  saida: "Saída",
};
