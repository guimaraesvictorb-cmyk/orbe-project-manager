# Cadastro protegido de anúncios

Caminho: Rastreamento → cliente → Credenciais de anúncios. Somente admin ativo com acesso ao cliente. Meta token + conta; Google clienteOAuth/importaçãoJSON + conta, refresh token e campos adicionais opcionais. Arquivo de conta de serviço é rejeitado. O JSON não equivale à autorização OAuth.

POST /api/ads-credentials autentica sessão real, exige mesma origem e papel admin. Respostas contêm só metadados. Chaves ficam apenas na memória do formulário até salvar/fechar e são limpas após sucesso. Não usar localStorage, URL, logs ou Git para os segredos.

Persistência: wa_ads_credentials server-only, RLS ativo, REVOKE de PUBLIC/anon/authenticated. AES-256-GCM usa chave do servidor já existente e AAD ads:cliente:plataforma. Nunca reutilizar um ciphertext com outro vínculo. wa_ads_save faz compare-and-set sob lock para não sobrescrever alterações concorrentes; wa_ads_credential_audit registra ator/conta/data sem segredos. Sem endpoint de leitura dos tokens.

Guardar não testa a API dos provedores. Estados saved_unverified/oauth_pending não aparecem como conexão ativa. Não há sincronização de gasto, CPL, CAC ou ROAS nesta alteração. API de leitura dos anúncios e OAuth de produção permanecem trabalho posterior.

Validação: testes/ads-credentials.test.ts cobre origem, autenticação, admin, criptografia, vínculo e respostas sem segredos; tests/ads-credentials-database.sql roda como service_role com ROLLBACK e verifica isolamento, privilégios, auditoria e concorrência usando conteúdo sintético. Nunca gravar uma chave real para testar nem inspecionar campos preenchidos pelo usuário. Conferir apenas metadados após o cadastro humano.
