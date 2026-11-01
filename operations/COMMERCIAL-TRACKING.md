# Atendimento e vendas no rastreamento

Fluxo: cliente → Dashboard (resumo por origem) ou Atendimento e vendas (revisão de cada contato). Dados isolados pelas mesmas conexões autorizadas do rastreamento.

- Os primeiros contatos são os da primeira mensagem observada e respeitam os filtros de período/origem. Os resultados exibem a situação atual desses contatos.
- Incoming continua alimentando leads/UTMs/GA4. Outgoing é gravado separadamente e não vira clique, mensagem recebida, lead nem conversão GA4. IDs tornam reentregas idempotentes.
- Kommo: assinatura add_message + add_outgoing_message no webhook existente; demais eventos e assinaturas preservados. Verificar conexão ativa a assinatura e registra início da cobertura. Autor interno com user_id identifica atendimento; autor explicitamente bot/salesbot é automático; demais exigem revisão.
- QR: mensagens enviadas pelo aparelho têm autoria desconhecida; mostrar Revisar autoria, permitindo confirmar atendimento. Não inferir humano a partir de fromMe. Grupo/histórico/media bruta/chaves descartados. Filtro do piloto LK permanece aplicado aos dois sentidos.
- A espera é computada desde a primeira mensagem pendente dentro da cobertura, em calendário semanal configurável (Brasília UTC-03, padrão seg–sex 08–18 e prazo15min; feriados não automáticos). Histórico anterior permanece parcial.
- Indício de venda é uma regra textual conservadora com evidência, nunca confirmação. Sem serviço externo de IA nesta versão.
- Confirmar venda/atendimento/perda e reabrir exige justificativa; ator/data são carimbados no banco; histórico só pode ser lido pelo cliente autorizado e não pode ser editado/excluído pela interface. Alteração concorrente exige nova revisão.
- Sem valores financeiros, receita, CRM-writeback, sincronização de estágios de venda ou planilhas nesta versão. Não contar esses recursos como entregues.

Validação: npm run test:tracking; python3 tests/qr-worker.test.py; testes SQL comerciais com ROLLBACK; browser real com conta autorizada; verificar add_outgoing_message e uma resposta real antes de declarar o caminho produtivo validado.

Migração: supabase/changes/20261031_whatsapp_commercial.sql, aprovada via ensaio integral + testes de RLS com rollback antes da aplicação. Não reexecutar depois de aplicada. Reverter publicação não exige apagar tabelas: estrutura aditiva mantém dados originais; reverter worker para backup anterior e remover apenas add_outgoing_message da assinatura própria se necessário, preservando demais eventos.
