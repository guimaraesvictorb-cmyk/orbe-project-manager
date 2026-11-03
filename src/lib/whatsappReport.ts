export type AdsReportSource = { platform:string; status:string; currency?:string; totals?:{spend:number;impressions:number;clicks:number}; checked_at?:string }
export function buildWhatsAppReport(name:string,start:string,end:string,sources:AdsReportSource[],tasks:{total:number;done:number},financialAllowed:boolean) {
 const messages=[`*${name} · Relatório de resultados*`,`Período: ${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}`,'']
 const missing:Record<string,string>={oauth_pending:'autorização Google pendente',not_configured:'conta não cadastrada',developer_token_required:'developer token pendente'}
 for(const source of sources) {
  const label=source.platform==='meta'?'Meta Ads':'Google Ads'
  messages.push(`*${label}*`)
  if(source.status==='ready'&&source.totals){
   const currency=/^[A-Z]{3}$/.test(source.currency??'')?source.currency:null
   const spend=currency?source.totals.spend.toLocaleString('pt-BR',{style:'currency',currency}):`${source.totals.spend.toLocaleString('pt-BR')} (moeda não informada)`
   messages.push(`• Investimento: ${spend}`,`• Impressões: ${source.totals.impressions.toLocaleString('pt-BR')}`,`• Cliques: ${source.totals.clicks.toLocaleString('pt-BR')}`)
  }else messages.push(`• Dados indisponíveis: ${missing[source.status]??'consulta não concluída; conferir conexão'}.`)
  messages.push('')
 }
 if(!financialAllowed)messages.push('Dados de investimento: restritos para este perfil.','')
 messages.push('*Operação*',`• ${tasks.total} tarefa(s) com prazo no período; ${tasks.done} estão concluídas atualmente.`,'O estado das tarefas é o de hoje; não reconstrói o fechamento histórico.','','*Pontos de atenção*','• Matrículas, vendas, receita, CAC e LTV ainda não conciliados neste relatório. Cliques não representam vendas.','• Fontes indisponíveis não foram contadas como zero. Os canais são apresentados separadamente, sem somar moedas distintas.','','*Próximos passos*','• Conferir a fonte oficial de conversão e a atribuição por canal.',...(sources.some(source=>source.status!=='ready')?['• Concluir a conexão das fontes pendentes.']:[]),'• Revisar as tarefas em aberto e o plano do próximo período.')
 return messages.join('\n')
}
