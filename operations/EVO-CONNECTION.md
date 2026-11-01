# EVO — cadastro de leitura

O cadastro fica em Rastreamento → cliente → Painel interno → EVO · matrículas, CAC e LTV.
Somente administradores ativos com acesso financeiro e visibilidade do cliente podem salvar, consultar metadados ou verificar as chaves.

Cada cliente tem slots independentes (Ibes, Alecrim, Itapuã, multifilial). O nome do slot é uma organização do cadastro, não prova do escopo: a verificação retorna os nomes e IDs das filiais informadas pelo EVO. Não considerar uma chave individual como cobertura de outras unidades.

DNS e token são enviados ao próprio servidor do Studio, cifrados com AES-GCM e vínculo `evo:<client>:<slot>`. Não voltam ao navegador. A tabela e a função de gravação são exclusivas do service_role; há auditoria do responsável, sem segredos. Substituição exige versão esperada e invalida a verificação anterior. Não armazenar chaves no repositório, chat, notas ou em arquivos locais permanentes.

Verificar leitura executa cinco GETs no host fixo oficial `evo-integracao-api.w12app.com.br`: configuração de filiais, uma matrícula, dados básicos do aluno dessa matrícula, uma venda e um recebível. O endpoint de dados básicos exige `idMember`, telefone, email ou documento; a verificação usa somente o ID real retornado pela matrícula. Ausência de matrícula deixa essa leitura pendente. As amostras pessoais são descartadas e somente metadados de cobertura são retornados. Não há POST/PUT/DELETE no EVO. Não há sincronização automática, alteração de plano ou aumento do limite de consumo. A consulta pode contar no contrato de consumo da API EVO.

## Limites atuais

Cadastro e verificação de leitura são a primeira etapa. Não calculam CAC ou LTV, não importam a base e não alteram o portal público. Após todas as chaves serem verificadas: confirmar os campos e a paginação de matrículas/pagamentos reais, conciliar novos alunos únicos com os primeiros contatos, tratar compartilhamento de telefone/reativação/transferência e apurar receita recebida líquida de estornos. Contrato, venda no CRM, matrícula e recebimento são eventos diferentes.

CAC de mídia exige gasto e novos alunos atribuídos com a mesma janela e cobertura. LTV realizado exige horizonte/coorte explícitos e pagamentos conciliados; não substituir por valor de contrato nem misturar com projeção. Falta de dados deve permanecer pendência, nunca zero inventado.

Referências oficiais: https://api.abcevo.com/ e https://evohelp.w12app.com.br/pt-BR/articles/11830973-integracao-evo-api
