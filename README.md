# 🟢 Orbe Operating System

> O sistema operacional interno da Orbe Marketing — uma plataforma centralizada que substitui Notion, planilhas e WhatsApp na gestão diária da agência.

---

## O que é o Orbe OS?

O Orbe OS é o hub de operações da Orbe Marketing. Em vez de informações espalhadas entre Notion, Google Sheets, WhatsApp e e-mail, tudo vive em um único lugar: clientes, tarefas, financeiro, pipeline comercial e inteligência artificial.

A plataforma foi construída do zero para a realidade de uma agência de marketing digital — com os fluxos, nomenclaturas e metodologia da Orbe.

---

## Para quem é?

| Quem | O que faz no Orbe OS |
|------|-------------------|
| **Sócio / Admin** | Visão total — clientes, financeiro, time, pipeline |
| **Coordenador** | Gerencia operação, clientes e tarefas do time |
| **Gestor de Tráfego (GT)** | Acessa seus clientes e tarefas atribuídas |
| **Gestor de Projetos (GP)** | Acessa seus clientes e tarefas atribuídas |

---

## O que a plataforma faz

### 🏠 Home — Assistente Orbe AI
Assistente de IA integrado (Llama 3.3 via Groq) disponível direto na tela inicial. Responde dúvidas, ajuda a redigir textos, analisa situações — tudo no contexto de uma agência de marketing.

### 📊 Dashboard
Visão executiva em tempo real:
- Clientes ativos e em risco
- MRR total e pendente
- Tarefas atrasadas
- Leads em negociação

### ✅ Tarefas
Gestão completa de tarefas da agência:
- Status: Backlog → Em andamento → Em revisão → Concluído
- Prioridade: Baixa / Média / Alta / Urgente
- Responsável, prazo e horas estimadas
- Filtros por cliente, status e prioridade

### 👥 Clientes
Carteira completa de clientes com:
- Health flag (Verde / Amarelo / Vermelho) para indicar saúde do cliente
- Status do contrato (Ativo / Pausado / Em risco / Offboarding / Churned)
- **Página de detalhe por cliente** com três áreas:
  - **Visão Geral** — dados de contato, mensalidade, contrato
  - **Base de Conhecimento** — informações validadas sobre o cliente (produto, público, histórico)
  - **IA do Cliente** — assistente de IA treinado exclusivamente com os dados daquele cliente

### 💰 Financeiro
Controle de MRR da agência:
- Lançamento de mensalidades por cliente
- Status de pagamento: Pago / Pendente / Atrasado
- Geração automática de mensalidades mensais
- Resumo: total faturado, recebido, pendente e atrasado

### 📈 Pipeline Comercial
CRM em kanban para controle de oportunidades:
- Etapas: Qualificação → Call 1 → Proposta Enviada → Negociação → Fechado / Perdido
- MRR potencial por lead
- Probabilidade de fechamento e MRR ponderado

### 📋 Playbook
Templates de tarefas para processos recorrentes da agência (onboarding, início de quarter, fechamento mensal).

### 🧠 Central
Repositório de processos e rituais internos da Orbe.

---

## Acesso

**URL de produção:** https://studio.agenciaorbe.co

O acesso é feito com e-mail e senha cadastrados pelo administrador. Novos usuários são criados diretamente pelo painel do Supabase e recebem a role adequada.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + Row Level Security) |
| IA | Groq API — `llama-3.3-70b-versatile` |
| Deploy | Vercel (auto-deploy via GitHub push na `main`) |

---

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar localmente
npm run dev

# Build de produção
npm run build
```

**Variáveis de ambiente** (`.env.local`):
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GROQ_API_KEY=
```

**Deploy:** qualquer `git push` na branch `main` publica automaticamente via Vercel.

---

## Banco de Dados

Schema completo em `supabase/schema.sql`. Para novo ambiente:
1. Rodar `supabase/setup_safe.sql` no SQL Editor do Supabase
2. Configurar o primeiro admin:
```sql
UPDATE profiles SET role = 'admin', display_name = 'Seu Nome'
WHERE email = 'seu@email.com';
```

---

## Roadmap

- [ ] Integração Meta Ads API (métricas de campanhas por cliente)
- [ ] Integração Google Ads API
- [ ] Notificações por e-mail / WhatsApp
- [ ] App mobile (PWA)
- [ ] Relatórios automáticos por cliente
- [ ] Módulo de aprovação de criativos
