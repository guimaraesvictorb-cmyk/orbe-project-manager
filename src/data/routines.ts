export interface CheckItem {
  text: string;
  subItems?: string[];
}

export interface RoutineBlock {
  frequency: string; // "Diariamente" | "Semanalmente" | etc.
  freqColor: string;
  items: CheckItem[];
}

export interface GoalRow {
  indicator: string;
  target: string;
}

export interface Routine {
  id: string;
  role: string;
  shortRole: string;
  color: string;
  description: string;
  objective?: string;
  blocks: RoutineBlock[];
  goals?: GoalRow[];
  notes?: string[];
}

export const ROUTINES: Routine[] = [
  // ── Designer ───────────────────────────────────────────────────────────────
  {
    id: "designer",
    role: "Designer",
    shortRole: "DES",
    color: "#7C3AED",
    description: "TO DO's essenciais do Designer além das demandas pontuais diárias.",
    objective: "Seguir tais ações ao longo da semana é essencial para garantir que o básico seja BEM FEITO.",
    blocks: [
      {
        frequency: "Diariamente",
        freqColor: "#60A5FA",
        items: [
          {
            text: "Revisão da Agenda e Prioridades",
            subItems: [
              "Checar e-mails e mensagens internas (WhatsApp, Slack, e-mail)",
              "Revisar o calendário de projetos e tarefas no Ekyte",
              "Participar da Daily para alinhar as prioridades do dia",
            ],
          },
          {
            text: "Desenvolvimento de Artes",
            subItems: [
              "Seguir os briefings definidos pelo gestor de projetos ou Head do Squad",
              "Utilizar softwares de design (Adobe Creative Suite, Figma) para criar e editar peças",
              "Utilizar o Unbounce para construir Landing Pages",
            ],
          },
          {
            text: "Revisão e Ajustes de Design",
            subItems: [
              "Revisar feedbacks recebidos do time interno e dos clientes",
              "Fazer ajustes necessários conforme as revisões",
              "Garantir que todas as alterações sejam documentadas e comunicadas",
            ],
          },
          {
            text: "Promover Entregas no Grupo do Cliente",
            subItems: [
              "Sempre PROMOVER as entregas, ao invés de comunicar",
              "Estimular o cliente a entender o ponto de vista e estratégia de elaboração",
            ],
          },
        ],
      },
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "Reunião de Designers",
            subItems: [
              "Participar de reuniões de revisão de design para trazer melhorias",
              "Colaborar com outros departamentos para alinhar expectativas",
            ],
          },
          {
            text: "Reunião de Estratégia — WOR",
            subItems: [
              "Participar de reuniões de estratégia com a equipe para identificar melhorias",
              "Foco em métricas: como melhorar TX de Conversão, CTR, etc.",
            ],
          },
          {
            text: "Participar da Reunião Semanal (Weekly) para alinhar prioridades",
          },
          {
            text: "Participar da Retrospectiva para revisitar vitórias e aprendizados da semana",
          },
        ],
      },
      {
        frequency: "Mensalmente",
        freqColor: "#F59E0B",
        items: [
          {
            text: "Revisão Mensal de Performance",
            subItems: [
              "Garantir que o GP traga os principais criativos vencedores do mês",
              "Documentar no Drive (Pasta por ano/mês) de cada cliente",
            ],
          },
        ],
      },
      {
        frequency: "PDI Contínuo",
        freqColor: "#A78BFA",
        items: [
          { text: "Participar de treinamentos internos e externos" },
          { text: "Participar de webinars e workshops" },
          { text: "Avançar de STEP dentro do modelo de PDI" },
        ],
      },
    ],
  },

  // ── Copywriter ─────────────────────────────────────────────────────────────
  {
    id: "copywriter",
    role: "Copywriter",
    shortRole: "COPY",
    color: "#2563EB",
    description: "TO DO's essenciais do(a) Copywriter além das demandas pontuais diárias.",
    blocks: [
      {
        frequency: "Diariamente",
        freqColor: "#60A5FA",
        items: [
          {
            text: "Revisão da Agenda e Prioridades",
            subItems: [
              "Checar e-mails e mensagens internas (WhatsApp, Slack, e-mail)",
              "Revisar calendário de projetos e tarefas no Ekyte",
              "Participar da Daily para alinhar as prioridades do dia",
            ],
          },
          {
            text: "Criação de Copies para Anúncios",
            subItems: [
              "Redigir textos para anúncios em diferentes plataformas (Google Ads, Meta Ads, etc.)",
              "Garantir que os textos sejam persuasivos e otimizados para conversão",
              "Testar diferentes variações de headlines e CTAs",
            ],
          },
          {
            text: "Criação de Textos para Landing Pages e Análise",
            subItems: [
              "Redigir textos persuasivos e otimizados para as LPs",
              "Garantir conteúdo claro, envolvente e focado em conversão",
              "Analisar Taxa de Conversão atual × ideal. Fazer benchmark com o mercado",
            ],
          },
          {
            text: "Promover Entregas no Grupo do Cliente",
            subItems: [
              "Sempre PROMOVER as entregas, ao invés de comunicar",
            ],
          },
        ],
      },
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "Reunião de Estratégia — WOR",
            subItems: [
              "Foco em métricas: como melhorar TX de Conversão, CTR, etc.",
              "Construir estratégias para Email Marketing, fluxos e automações",
              "Construir estratégias para Inside Sales e E-commerce (carrinho abandonado)",
            ],
          },
          {
            text: "Revisão e Otimização de Conteúdo",
            subItems: [
              "Revisar e editar textos criados para garantir clareza e impacto",
              "Fazer ajustes baseados em feedbacks e métricas de desempenho",
            ],
          },
          { text: "Participar da Reunião Semanal (Weekly) e da Retrospectiva" },
        ],
      },
      {
        frequency: "Mensalmente",
        freqColor: "#F59E0B",
        items: [
          {
            text: "Revisão Mensal de Performance",
            subItems: [
              "Garantir que o GP traga os principais criativos vencedores do mês",
              "Documentar no Drive (Pasta por ano/mês) de cada cliente",
            ],
          },
        ],
      },
      {
        frequency: "PDI Contínuo",
        freqColor: "#A78BFA",
        items: [
          { text: "Participar de treinamentos internos e externos" },
          { text: "Avançar de STEP dentro do modelo de PDI" },
        ],
      },
    ],
  },

  // ── Gestor de Tráfego ──────────────────────────────────────────────────────
  {
    id: "gt",
    role: "Gestor de Tráfego",
    shortRole: "GT",
    color: "#DC2626",
    description: "TO DO's essenciais do Gestor de Tráfego. A execução consistente garante que o básico seja BEM FEITO e que a performance esteja sempre orientada ao resultado.",
    objective: "Garantir tracking funcional, saldo de mídia, otimizações diárias e registro de todas as atividades no Ekyte.",
    blocks: [
      {
        frequency: "Diariamente",
        freqColor: "#60A5FA",
        items: [
          {
            text: "Acessar TODAS as contas de anúncios de cada cliente",
            subItems: [
              "Verificar saldo disponível e budget investido vs. planejamento mensal",
              "Conferir se todos os eventos estão funcionando (Meta, GAds, GTM, GA4)",
              "Estrutura mínima META: mínimo 2 conjuntos/campanha e 2 anúncios/conjunto",
              "Pontuação de Otimização GADS: garantir 100% de score",
              "Otimização de palavras-chave GADS: obrigatório diariamente",
              "Atualizar planilha de métricas diárias (impressões, cliques, CTR, CPA, ROAS)",
            ],
          },
          {
            text: "Registro de atividades no Ekyte",
            subItems: [
              "Registrar TODAS as atividades realizadas com tempo gasto (horas/minutos)",
              "Manter tasks atualizadas com prazos, responsáveis e status claros",
            ],
          },
          { text: "Organizar e priorizar os TO DO's do dia" },
          { text: "Solicitar direcionamento ao Coordenador quando necessário" },
        ],
      },
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "Acessar o B.I. de cada cliente pelo menos 4x por semana",
            subItems: [
              "Validar coerência de dados",
              "Identificar desvios de performance",
            ],
          },
          {
            text: "Acompanhamento de metas semanais",
            subItems: [
              "Identificar clientes fora da meta",
              "Criar planos de ação com foco em ROI, ROAS, MMF e objetivos SMART",
            ],
          },
          {
            text: "Relatório de Canais Vencedores",
            subItems: ["Enviar relatório semanal ou quinzenal sugerindo redistribuição de verba"],
          },
          { text: "Realizar 1:1 com a dupla de execução, alinhando entregas e bloqueios" },
        ],
      },
      {
        frequency: "Quinzenalmente",
        freqColor: "#F59E0B",
        items: [
          {
            text: "Otimização de públicos e criativos com base em",
            subItems: ["Frequência", "CTR", "CPA", "Outros indicadores relevantes por canal"],
          },
        ],
      },
      {
        frequency: "Mensalmente",
        freqColor: "#A78BFA",
        items: [
          { text: "Análise de oportunidade de testes em novos canais" },
          { text: "Documentar aprendizados, hipóteses e sugestões de novas estratégias" },
        ],
      },
    ],
    goals: [
      { indicator: "Churn da carteira", target: "Máx. 4,5%" },
      { indicator: "MMF (Meta Média por Funil)", target: "2" },
      { indicator: "Life Time (média)", target: "8 meses" },
      { indicator: "ROI médio", target: "2" },
      { indicator: "NPS", target: "Mín. 50" },
      { indicator: "Taxa de resposta dos clientes", target: "Mín. 80%" },
      { indicator: "Monetização mensal da carteira", target: "R$ 12.500" },
    ],
  },

  // ── Gestor de Projetos ─────────────────────────────────────────────────────
  {
    id: "gp",
    role: "Gestor de Projetos",
    shortRole: "GP",
    color: "#059669",
    description: "Ações necessárias, frequência e prioridade para garantir a performance dos clientes e a excelência na gestão dos projetos.",
    objective: "Padronizar e orientar as atividades semanais e diárias do Gestor de Projetos.",
    blocks: [
      {
        frequency: "Diariamente",
        freqColor: "#60A5FA",
        items: [
          { text: "Check-in nos grupos de WhatsApp até às 10h" },
          {
            text: "Acessar o Ekyte para",
            subItems: [
              "Garantir execução das tarefas planejadas",
              "Validar aprovações pendentes com agilidade",
              "Registrar as horas trabalhadas em cada tarefa",
            ],
          },
          { text: "Organizar e revisar os To Do's do dia" },
          { text: "Documentar o que foi realizado ao final do expediente" },
          { text: "Solicitar direcionamento ao coordenador se houver dúvidas sobre prioridades" },
          { text: "Acessar o B.I. de cada cliente (mínimo 3x por semana)" },
        ],
      },
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "Atualizar o Drive dos clientes com",
            subItems: ["Gravações de reuniões", "Apresentações (PPTs)", "Relatórios", "Atas"],
          },
          {
            text: "Atualizar o Notion dos clientes com",
            subItems: ["Informações relevantes do projeto", "Registro completo das atas das reuniões"],
          },
          {
            text: "Acompanhar os resultados dos clientes",
            subItems: ["ROI, ROAS, CPV, Faturamento semanal"],
          },
          { text: "Acessar as contas de anúncios para garantir aderência à estratégia" },
          { text: "Solicitar Follow-up ou relatório de tráfego com 24h de antecedência" },
          { text: "Realizar 1:1 com a dupla de operação para acompanhar execução e travas" },
          { text: "Planning: montar atividades da semana e enviar no grupo do cliente" },
          { text: "Review: enviar atividades realizadas no grupo do cliente ao final da semana" },
        ],
      },
      {
        frequency: "Quinzenalmente",
        freqColor: "#F59E0B",
        items: [
          {
            text: "Check-in Quinzenal",
            subItems: [
              "Montar e apresentar o PPT de resultados quinzenal",
              "Seguir POP do PPT de check-in quinzenal",
            ],
          },
        ],
      },
      {
        frequency: "Mensalmente",
        freqColor: "#A78BFA",
        items: [
          {
            text: "Fechamento de Mês",
            subItems: ["Montar e apresentar o PPT de fechamento mensal do cliente"],
          },
        ],
      },
      {
        frequency: "Trimestral",
        freqColor: "#EC4899",
        items: [
          {
            text: "Fechamento de Quarter",
            subItems: [
              "Fechamento a cada 3 meses com foco em replanejamento",
              "Montar e apresentar o PPT de fechamento de quarter",
            ],
          },
        ],
      },
    ],
    goals: [
      { indicator: "Churn da carteira", target: "Máx. 5%" },
      { indicator: "MMF (Meta Média por Funil)", target: "2" },
      { indicator: "Life Time (média)", target: "8 meses" },
      { indicator: "NPS", target: "Mín. 50" },
      { indicator: "Taxa de resposta dos clientes", target: "Mín. 80%" },
      { indicator: "Monetização mensal da carteira", target: "R$ 12.500" },
    ],
    notes: [
      "Todos os registros devem estar centralizados no Notion e Drive do cliente.",
      "O GP é o guardião do projeto: deve antecipar problemas e buscar soluções proativas.",
      "Em caso de dúvidas sobre priorização, sempre buscar alinhamento com o coordenador.",
    ],
  },

  // ── Coordenador ────────────────────────────────────────────────────────────
  {
    id: "coordenador",
    role: "Coordenador",
    shortRole: "COORD",
    color: "#D97706",
    description: "Garantir que as entregas sejam realizadas com excelência, dentro dos prazos, seguindo os processos definidos e sempre com foco em geração de valor para os clientes.",
    objective: "O Coordenador é líder integrador: traduz os objetivos da empresa em ações claras para o time, promove alinhamento entre áreas e desenvolve continuamente cada player do squad.",
    blocks: [
      {
        frequency: "Diariamente",
        freqColor: "#60A5FA",
        items: [
          {
            text: "Daily Padrão com o Time",
            subItems: [
              "Levantamento do que foi feito no dia anterior e o que ficou pendente",
              "Alinhamento das prioridades do dia para cada player",
              "Registro obrigatório por cada membro das entregas no Ekyte",
            ],
          },
          {
            text: "Conferência de Check-ins nos Grupos",
            subItems: [
              "Conferir até 10h30 se os GPs mandaram mensagens nos grupos",
              "Verificar ao final do dia (até 17h) se fomos os últimos a enviar",
            ],
          },
        ],
      },
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "WOR de Estratégias — Weekly/Quinzenal",
            subItems: [
              "Participação ativa nas reuniões com duplas para analisar e redirecionar estratégias",
              "Foco especial em clientes com flag Danger",
            ],
          },
          {
            text: "Auditoria de Processos & Atendimento",
            subItems: [
              "Verificação no Ekyte de tarefas em dia",
              "Verificação do avanço do playbook pelo Ekyte",
              "Acompanhamento da evolução do plano de mídia",
              "Verificar ATA e otimizações no Notion",
              "Garantir que o Notion do cliente está 100% preenchido",
              "Verificação do Drive: check-ins, B.I, apresentações",
              "Assistir pelo menos 1 check-in gravado do GP",
            ],
          },
          {
            text: "Auditoria de Tráfego",
            subItems: [
              "Verificar saldo de mídia (Google & Meta)",
              "Verificar rastreamento da conta (Google & Meta)",
              "Verificar estrutura de campanhas (Google & Meta)",
              "Verificar última otimização na conta (Google & Meta)",
              "Registrar todos os pontos em documento com evidências",
              "Enviar documento via Ekyte para o GT executar com data definida",
            ],
          },
          {
            text: "Atualização de FLAGS — Quality Control (toda sexta-feira)",
            subItems: [
              "GPs preenchem planilha com justificativas de flags",
              "Coordenador valida e cria plano de ação para cada flag",
            ],
          },
          {
            text: "Weekly com o Squad (agenda fixa)",
            subItems: [
              "Time envia planejamento semanal para o cliente no grupo",
              "Validação e alinhamento com prioridades estratégicas (máx. 2h)",
            ],
          },
          {
            text: "Review com o Squad (agenda fixa)",
            subItems: [
              "Time apresenta entregas da semana para o cliente",
              "Análise de performance e ajustes necessários",
            ],
          },
          {
            text: "Resumo Semanal — toda sexta-feira",
            subItems: [
              "Enviar por e-mail relatório de contas otimizadas e o que foi otimizado",
              "Enviar parcial do churn atual do squad",
              "Enviar parcial da monetização atual do squad",
              "Sinalizar risco eminente de churn (pós Quality Control)",
              "Copiar o gerente no e-mail",
            ],
          },
        ],
      },
      {
        frequency: "Quinzenalmente",
        freqColor: "#F59E0B",
        items: [
          { text: "Treinamentos com o Time — cronograma baseado em gaps de performance e cultura" },
          { text: "1:1 com cada Player (agenda fixa — semanal para onboard/red flag)" },
        ],
      },
      {
        frequency: "Mensalmente",
        freqColor: "#A78BFA",
        items: [
          {
            text: "Atualizações de Planilhas — Economics e Capacity",
          },
          {
            text: "One-on-One com Clientes (agenda fixa)",
            subItems: [
              "Reunião estratégica com cliente",
              "Entender satisfação sobre entregas, resultados e atendimento",
              "Documentar por e-mail o que foi alinhado e registrar no Notion",
              "Enviar link do Notion via Ekyte para o gerente analisar",
            ],
          },
        ],
      },
    ],
    goals: [
      { indicator: "Churn", target: "≤ 5%" },
      { indicator: "NRR", target: "108%" },
      { indicator: "MMF Médio Squad", target: "2" },
      { indicator: "Margem de Contribuição dos Clientes", target: "70%" },
      { indicator: "Margem de Contribuição do Squad", target: "60%" },
      { indicator: "RPC-O (Receita por Cabeça Operacional)", target: "R$ 20.000" },
      { indicator: "CSP (Custo Operacional)", target: "≤ 25%" },
      { indicator: "Health Score Green flag", target: "70%" },
      { indicator: "Health Score Yellow flag", target: "20%" },
      { indicator: "Health Score Red flag", target: "10%" },
      { indicator: "1:1 Com cliente", target: "100% Realizada" },
      { indicator: "Auditoria", target: "100% Realizada no mês" },
    ],
  },

  // ── CS ─────────────────────────────────────────────────────────────────────
  {
    id: "cs",
    role: "Customer Success",
    shortRole: "CS",
    color: "#0891B2",
    description: "Camada de controle focada exclusivamente em retenção. O CS não executa operação — gerencia a jornada do cliente e antecipa churn.",
    objective: "Redução de churn, previsibilidade, retenção sustentável e menor pressão de aquisição para bater meta.",
    blocks: [
      {
        frequency: "Diariamente",
        freqColor: "#60A5FA",
        items: [
          {
            text: "Daily com Gerente — Reportar",
            subItems: [
              "Status da jornada do cliente",
              "Tratativas abertas e resolvidas",
              "Riscos de atraso no onboarding",
              "Possíveis ameaças à retenção",
            ],
          },
        ],
      },
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "Quality Control — Reunião com cada Coordenador",
            subItems: [
              "Analisar clientes Red e Yellow",
              "Definir plano claro com prazo, responsável e evidência de ação",
            ],
          },
          {
            text: "Health Score — Monitorar evolução dos clientes",
            subItems: [
              "Reportar variações na Weekly com gerente",
              "Sinalizar clientes que migraram para Red ou Yellow",
              "Antecipar risco antes do churn formal",
            ],
          },
          {
            text: "Review com Gerente — Reportar",
            subItems: [
              "Evolução do Health Score",
              "Movimento Red/Yellow",
              "Status do NPS",
              "Tendência de churn",
            ],
          },
        ],
      },
      {
        frequency: "Conforme necessidade",
        freqColor: "#F59E0B",
        items: [
          {
            text: "Onboarding — Acompanhamento de Ponta a Ponta",
            subItems: [
              "Monitorar todo novo cliente",
              "Garantir que o kickoff aconteça no prazo",
              "Garantir que a estrutura técnica seja organizada",
              "Garantir que a primeira campanha esteja no ar dentro do SLA",
              "Em caso de risco: escalar ao coordenador e reportar ao gerente",
            ],
          },
          {
            text: "Growthclass (Alinhamento Estratégico)",
            subItems: [
              "Clientes de Assessoria de Performance e Social Media",
              "Alinhar expectativas, definir objetivos claros, reforçar responsabilidades da parceria",
            ],
          },
          {
            text: "Gestão de Tratativas",
            subItems: [
              "Entrar no fluxo quando coordenador abre card de tratativa",
              "Acompanhar até reversão ou confirmação de churn",
              "Garantir prazo, resposta, documentação e plano claro",
            ],
          },
          {
            text: "NPS",
            subItems: [
              "Acompanhar todos os NPS enviados",
              "Garantir taxa mínima de resposta de 70% da base ativa",
              "Monitorar promotores, neutros e detratores",
              "Apoiar planos de recuperação",
            ],
          },
          {
            text: "Offboarding do Cliente",
            subItems: [
              "Garantir cumprimento de aviso prévio e boa comunicação",
              "Evitar conflito ou risco jurídico",
              "Processo oficial: e-mail de formalização pelo cliente",
            ],
          },
        ],
      },
    ],
    goals: [
      { indicator: "Churn", target: "≤ 4%" },
      { indicator: "NRR", target: "108%" },
      { indicator: "Health Score Green flag", target: "70%" },
      { indicator: "Health Score Yellow flag", target: "20%" },
      { indicator: "Health Score Red flag", target: "10%" },
      { indicator: "1:1 Com cliente", target: "≥ 80%" },
      { indicator: "NPS", target: "≥ 40" },
      { indicator: "Taxa de resposta NPS", target: "≥ 70%" },
    ],
    notes: [
      "O CS NÃO executa operação. Não faz gestão de campanhas, tráfego, criativos ou estratégias ao cliente.",
      "Essas responsabilidades pertencem ao Coordenador, GP e GT.",
    ],
  },

  // ── Gerente ────────────────────────────────────────────────────────────────
  {
    id: "gerente",
    role: "Gerente",
    shortRole: "GER",
    color: "#B45309",
    description: "Liderar estrategicamente Coordenadores para atingir metas de eficiência, qualidade e satisfação do cliente.",
    objective: "Supervisionar, planejar, monitorar e otimizar KPIs do Squad com visão analítica e comunicação assertiva.",
    blocks: [
      {
        frequency: "Semanalmente",
        freqColor: "#7B61FF",
        items: [
          {
            text: "Weekly com Coordenadores",
            subItems: [
              "Revisar documentação e relatórios semanais",
              "Cobrar compilados de tarefas realizadas/não realizadas",
            ],
          },
          { text: "Auditoria Estratégica — verificar PPTs de check-ins, Ekyte e Drive" },
          { text: "Planejamento de Prioridades — atualizar metas e identificar clientes críticos" },
          { text: "Acompanhamento de Treinamentos — garantir que treinamentos sejam realizados" },
          {
            text: "Apoio a Clientes Estratégicos",
            subItems: ["Participar de WORs ou reuniões de clientes em DANGER"],
          },
          { text: "Auditoria Ekyte e Processos — garantir que playbooks e tarefas estejam atualizados" },
          { text: "Atualização do DRE — revisar planilha junto aos Coordenadores" },
        ],
      },
      {
        frequency: "Quinzenalmente",
        freqColor: "#F59E0B",
        items: [
          { text: "1:1 com Coordenadores — revisar performance, desafios e planos de ação" },
          { text: "1:1 com Diretoria — atualizar status de clientes e demandas estratégicas" },
        ],
      },
      {
        frequency: "Mensalmente",
        freqColor: "#A78BFA",
        items: [
          { text: "Revisão Mensal de KPIs do Squad — consolidar indicadores e propor ações corretivas" },
          { text: "Treinamento Estratégico em liderança e performance" },
          { text: "Reunião de Estratégia com Diretoria — apresentar resultados e propor melhorias" },
        ],
      },
    ],
    goals: [
      { indicator: "Meta MRR", target: "R$ 450.000" },
      { indicator: "Churn", target: "≤ 5%" },
      { indicator: "NRR", target: "≥ 108%" },
      { indicator: "Satisfação dos Clientes (NPS)", target: "≥ 50" },
      { indicator: "Taxa de Respostas NPS", target: "≥ 70%" },
      { indicator: "E-NPS", target: "≥ 85" },
    ],
  },
];

export function getRoutineById(id: string): Routine | undefined {
  return ROUTINES.find((r) => r.id === id);
}
