# EVO — cadastro de leitura

O cadastro fica em Rastreamento → cliente → Painel interno → Conexões → EVO · matrículas, CAC e LTV.
Somente administradores ativos com acesso financeiro e visibilidade do cliente podem salvar, consultar metadados ou verificar as chaves.

O cadastro da Rayafit tem slots independentes (Ibes, Alecrim, Itapuã, multifilial). O nome do slot é uma organização do cadastro, não prova do escopo: a verificação retorna os nomes e IDs das filiais informadas pelo EVO. Não considerar uma chave individual como cobertura de outras unidades.

DNS e token são enviados ao próprio servidor do Studio, cifrados com AES-GCM e vínculo `evo:<client>:<slot>`. Não voltam ao navegador. A tabela e a função de gravação são exclusivas do service_role; há auditoria do responsável, sem segredos. Substituição exige versão esperada e invalida a verificação anterior. Não armazenar chaves no repositório, chat, notas ou em arquivos locais permanentes.

Verificar leitura executa cinco GETs no host fixo oficial `evo-integracao-api.w12app.com.br`: configuração de filiais, uma matrícula, dados básicos do aluno dessa matrícula, uma venda e um recebível. O endpoint de dados básicos exige `idMember`, telefone, email ou documento; a verificação usa somente o ID real retornado pela matrícula. Ausência de matrícula deixa essa leitura pendente. As amostras pessoais são descartadas e somente metadados de cobertura são retornados. Não há POST/PUT/DELETE no EVO. Não há sincronização automática, alteração de plano ou aumento do limite de consumo. A consulta pode contar no contrato de consumo da API EVO.

## Limites atuais

As três unidades da Rayafit têm leitura validada. O dashboard interno oferece conciliação sob demanda, com atualização salva, CAC de mídia Meta observado e LTV realizado condicionais à qualidade dos dados. Google depende da confirmação do gasto. Histórico anterior ao rastreamento, telefones compartilhados e movimentos financeiros não comprovados permanecem pendentes. O portal público não recebe estes novos dados. Contrato, venda no CRM, matrícula e recebimento são eventos diferentes.

CAC de mídia exige gasto e novos alunos atribuídos com a mesma janela e cobertura. LTV realizado exige horizonte/coorte explícitos e pagamentos conciliados; não substituir por valor de contrato nem misturar com projeção. Falta de dados deve permanecer pendência, nunca zero inventado.

Referências oficiais: https://api.abcevo.com/ e https://evohelp.w12app.com.br/pt-BR/articles/11830973-integracao-evo-api

## Conferência de vendas de planos por unidade

A ação “Consultar contratos por unidade” usa `GET /api/v2/sales`, data de venda e os filtros `onlyMembership=true`, `atLeastMonthly=true`. São páginas de 100 (máximo documentado), até 10 por chave; atingir o limite sem provar o fim bloqueia os totais. O resultado agrupa planos, vínculos e vendas, sem nomes, telefones ou IDs pessoais. Chaves sobrepostas/multifilial/não verificadas e retornos de outra filial bloqueiam a consulta. Primeira matrícula usa evidência `member.idFirstMemberMembership` igual ao `saleItens.idMemberMembership`, sem marca de renovação/recorrência/migração nem venda removida. Dados incompletos ficam em revisão. A origem exige o cruzamento com os primeiros contatos, descrito abaixo.

Para vendas e renovação, a fonte é Sales, que identifica o tipo de registro e a primeira matrícula. MemberMembership participa somente da verificação inicial da chave. Uma referência de conferência no EVO é Gerencial → Contratos → Contratos recorrentes/renovações automáticas; ela inclui recorrências e não equivale a alunos novos. Não comparar seus totais diretamente com primeiras matrículas.

Plano API Plus: documentação consultada em 01/11/2026 indica 100 chamadas/dia e 1.000/mês por filial, compartilhadas com outras integrações. Não ativar polling frequente ou importar um aluno por chamada sem orçamento de consultas/cache. Não contratar PRO nem ampliar gastos automaticamente.

## Dashboard interno de matrículas e origem

`EvoEnrollmentDashboard` lê resultados agregados salvos para cliente/período/unidade. Abrir ou alternar o dashboard não chama EVO: a atualização é manual, com data de conferência. `wa_evo_snapshots` é exclusiva do servidor, com RLS ativa e sem SELECT/WRITE para anon/authenticated; API exige admin ativo com acesso financeiro e visibilidade do cliente. Não há novos dados no portal público. Credenciais continuam em Conexões, não no dashboard.

A origem cruza apenas o primeiro contato observado, normaliza o telefone e exige que o contato seja anterior à venda. Telefones compartilhados entre novas matrículas de unidades distintas ficam em revisão. Um vínculo sem origem confirmada permanece sem origem; ele não é promovido a Meta/Google por suposição. Não retornam nomes, telefones, documentos, IDs de alunos nem texto de mensagens.

CAC de mídia Meta observado: gasto real Meta em BRL/fuso compatível do mesmo período, dividido por primeiras matrículas com vínculo Meta confirmado; disponível apenas para todas as unidades, desde o início do histórico observado. Não inclui fee da agência, custos comerciais ou gasto Google. Vínculos desconhecidos podem elevar o indicador observado. Google aguarda confirmação da leitura do gasto (OAuth/API ainda pendente).

LTV realizado observado: recebimentos confirmados acumulados até a conferência dos novos alunos com origem identificada, dividido pela quantidade dessa coorte. Consulta Receivables por membro, até 3 páginas de 100, com limite de 8 alunos por conferência para preservar a cota. Status2 e tipos de pagamento em dinheiro bancário/cartão/Pix confirmados; créditos de venda e gift cards não geram novo recebimento. Cópias conflitantes, pagador/filial sem comprovação, créditos/estornos ou retorno truncado suspendem o valor. É receita observada, não previsão de permanência, margem ou lucro. Coortes maiores ficam pendentes, não parcialmente calculadas.

A rotina `evoReconciliation.ts` também contém regras conservadoras gerais de deduplicação, cronologia e cobertura. O dashboard usa `evoAttribution` e `evoMemberRevenue` para os dados reais. Os números são atualizados sob demanda; não existe polling automático no EVO nem upgrade de plano autorizado.
