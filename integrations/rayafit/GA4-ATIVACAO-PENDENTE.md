# GA4: preparação local, ainda não ativada

29/10/2026. O controle do Chrome foi recuperado em nova tentativa. A estrutura SQL foi aplicada com sucesso após testes transacionais com rollback. O envio GA4 ainda não está ativado.

## Preparado

- Evento `whatsapp_message_received`, separado do clique, somente para mensagem recebida com referência vinculada à sessão real do site.
- Configuração por conexão, segredo criptografado no servidor, acesso de proprietário e tabelas exclusivas de service_role.
- Fila com reivindicação atômica e prevenção de reenvio automático quando a entrega for incerta. HTTP 2xx significa enviado, não validação no GA4.
- Ponte de consentimento para GTM: usa IDs existentes do Google; remove-os dos links ao revogar consentimento e ignora retornos atrasados.
- 33 testes locais passaram; build e lint dos arquivos TypeScript alterados passaram.

## Antes de publicar/ativar

1. Concluído: testes transacionais passaram e SQL aplicado no projeto pkncvfssrbjjpgwstelo. Nenhuma chave ou fluxo foi cadastrado.
2. Conferir política de consentimento dos dois sites e os domínios finais (www/sem www). O cadastro atual aceita um hostname por fluxo; resolver aliases explicitamente antes de ativar.
3. Obter confirmação específica para criar as chaves Measurement Protocol dos dois fluxos GA4 e armazená-las criptografadas no Orbe. Não criar ou inserir credenciais antes dessa confirmação.
4. Configurar G-W7XWP0QP8Q (LP) e G-0609LXW8FD (institucional) com seus domínios verificados.
5. Publicar código com incremento de versão, validar deploy e instalar o modelo GTM em workspaces isolados, preservando mudanças alheias. O arquivo ga4-consent-template.js é código de modelo sandboxed, não Custom HTML.
6. Validar payload no endpoint de depuração do GA4 e depois mensagem real autorizada: clique, referência, fila e evento visível no GA4. Não produzir lead sintético em produção.
7. Conferir aprovação do recurso nativo de mensagem Google Ads e validar o fluxo real. Saldo da conta e revisão do Google podem impedir teste real; não realizar pagamento.

O portal de eventos continua pendente por escolha do usuário. Não tratar Meta/Google nativos sem sessão do site como visitas fictícias ao GA4. Não declarar 100% de atribuição: entradas sem referência comprovável continuam sem origem identificada.
