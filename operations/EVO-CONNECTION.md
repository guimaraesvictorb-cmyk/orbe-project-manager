# EVO — cadastro de leitura

O cadastro fica em Rastreamento → cliente → Painel interno → Conexões → EVO · matrículas, CAC e LTV.
Somente administradores ativos com acesso financeiro e visibilidade do cliente podem salvar, consultar metadados ou verificar as chaves.

Cada cliente tem slots independentes (Ibes, Alecrim, Itapuã, multifilial). O nome do slot é uma organização do cadastro, não prova do escopo: a verificação retorna os nomes e IDs das filiais informadas pelo EVO. Não considerar uma chave individual como cobertura de outras unidades.

DNS e token são enviados ao próprio servidor do Studio, cifrados com AES-GCM e vínculo `evo:<client>:<slot>`. Não voltam ao navegador. A tabela e a função de gravação são exclusivas do service_role; há auditoria do responsável, sem segredos. Substituição exige versão esperada e invalida a verificação anterior. Não armazenar chaves no repositório, chat, notas ou em arquivos locais permanentes.

Verificar leitura executa cinco GETs no host fixo oficial `evo-integracao-api.w12app.com.br`: configuração de filiais, uma matrícula, dados básicos do aluno dessa matrícula, uma venda e um recebível. O endpoint de dados básicos exige `idMember`, telefone, email ou documento; a verificação usa somente o ID real retornado pela matrícula. Ausência de matrícula deixa essa leitura pendente. As amostras pessoais são descartadas e somente metadados de cobertura são retornados. Não há POST/PUT/DELETE no EVO. Não há sincronização automática, alteração de plano ou aumento do limite de consumo. A consulta pode contar no contrato de consumo da API EVO.

## Limites atuais

Cadastro e verificação de leitura são a primeira etapa. Não calculam CAC ou LTV, não importam a base e não alteram o portal público. Após todas as chaves serem verificadas: confirmar os campos e a paginação de matrículas/pagamentos reais, conciliar novos alunos únicos com os primeiros contatos, tratar compartilhamento de telefone/reativação/transferência e apurar receita recebida líquida de estornos. Contrato, venda no CRM, matrícula e recebimento são eventos diferentes.

CAC de mídia exige gasto e novos alunos atribuídos com a mesma janela e cobertura. LTV realizado exige horizonte/coorte explícitos e pagamentos conciliados; não substituir por valor de contrato nem misturar com projeção. Falta de dados deve permanecer pendência, nunca zero inventado.

Referências oficiais: https://api.abcevo.com/ e https://evohelp.w12app.com.br/pt-BR/articles/11830973-integracao-evo-api

## Conferência de contratos por unidade

A ação “Consultar contratos por unidade”, na mesma seção EVO, consulta somente os registros de contratos no período (até 31 dias), com páginas de 25 e limite de 10 páginas por chave. O máximo de 25 por página é imposto pelo EVO; não confiar no pedido de um tamanho maior. Ao atingir o limite, a resposta é recusada em vez de apresentar um total parcial. O resultado é agregado por plano e unidade, sem nomes, telefones ou IDs de alunos. O nome oficial do EVO é preservado. Chaves com escopos sobrepostos, multifilial ou pendentes de verificação bloqueiam a consulta para evitar duplicidade. Cada chave deve retornar os contratos da filial verificada. A consulta usa os filtros regulares (showVips/showAggregators/showTransfers = false). Contagem de contratos e alunos vinculados não equivale a alunos novos de marketing: inclui renovações, transferências e outros contratos.

A rotina pura `evoReconciliation.ts` já contém regras testadas para deduplicação, cronologia, histórico incompleto, receita recebida/estornos e correspondência entre janela/canal de gasto e alunos novos. Ela ainda não é alimentada por uma importação conciliada e não está ligada a números de CAC/LTV no dashboard. O adaptador de dados reais, o acompanhamento da cobertura e a sincronização econômica dentro da cota da API continuam pendentes.

Plano API Plus: documentação consultada em 01/11/2026 indica 100 chamadas/dia e 1.000/mês por filial, compartilhadas com outras integrações. Não ativar polling frequente ou importar um aluno por chamada sem orçamento de consultas/cache. Não contratar PRO nem ampliar gastos automaticamente.
