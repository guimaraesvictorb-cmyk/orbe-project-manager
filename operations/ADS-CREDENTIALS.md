# Cadastro protegido de anúncios

Caminho: Rastreamento → cliente → Credenciais de anúncios. Somente admin ativo com acesso ao cliente. Meta token + conta; Google clienteOAuth/importaçãoJSON + conta, refresh token e campos adicionais opcionais. Arquivo de conta de serviço é rejeitado. O JSON não equivale à autorização OAuth.

POST /api/ads-credentials autentica sessão real, exige mesma origem e papel admin. Respostas contêm só metadados. Chaves ficam apenas na memória do formulário até salvar/fechar e são limpas após sucesso. Não usar localStorage, URL, logs ou Git para os segredos.

Persistência: wa_ads_credentials server-only, RLS ativo, REVOKE de PUBLIC/anon/authenticated. AES-256-GCM usa chave do servidor já existente e AAD ads:cliente:plataforma. Nunca reutilizar um ciphertext com outro vínculo. wa_ads_save faz compare-and-set sob lock para não sobrescrever alterações concorrentes; wa_ads_credential_audit registra ator/conta/data sem segredos. Sem endpoint de leitura dos tokens.

Guardar não testa a API dos provedores. Estados saved_unverified/oauth_pending não aparecem como conexão ativa. Não há sincronização de gasto, CPL, CAC ou ROAS nesta alteração. API de leitura dos anúncios e OAuth de produção permanecem trabalho posterior.

Validação: testes/ads-credentials.test.ts cobre origem, autenticação, admin, criptografia, vínculo e respostas sem segredos; tests/ads-credentials-database.sql roda como service_role com ROLLBACK e verifica isolamento, privilégios, auditoria e concorrência usando conteúdo sintético. Nunca gravar uma chave real para testar nem inspecionar campos preenchidos pelo usuário. Conferir apenas metadados após o cadastro humano.

### Live access verification (v1.18.7)
The administrator can use **Verificar acesso aos anúncios**. Meta credentials are decrypted only inside the deployed API and used in a bearer header against the fixed Graph endpoint. A successful check requires matching account metadata and a campaign-read request; raw provider errors never reach the browser. The API rechecks the credential version before returning success. The result is for that query only and is not persisted or presented as a metrics synchronization. Google without a refresh token remains explicitly OAuth pending. No budgets, campaigns or assets are modified.

2026-11-01: Rayafit Meta account 2988254138081501 returned **CA - Rayafit Academia**, campaign read successful through the actual Studio administrator UI. Google account 3528081021 is saved but has no refresh token; account authorization and API validation remain pending. Metrics import has not been configured. No credential was exported or printed during verification.
