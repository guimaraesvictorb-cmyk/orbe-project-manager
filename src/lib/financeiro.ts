import type { Contract } from './database.types'

// A Mensalidade em Clientes e o Valor em Contratos acabam sendo a mesma
// informação na cabeça de quem usa a plataforma — mas nem sempre as duas são
// preenchidas. Quando falta a Mensalidade, usamos a soma dos contratos de
// cliente ainda vigentes (ou em renovação) como o valor efetivo, em vez de
// tratar o cliente como se pagasse zero — é o que alimenta "Gerar
// mensalidades" e a Rentabilidade por cliente.
export function effectiveMonthlyFee(client: { id: string; monthly_fee: number | null }, contracts: Contract[]): number {
  if (client.monthly_fee && client.monthly_fee > 0) return client.monthly_fee
  return contracts
    .filter((c) => c.party_type === 'cliente' && c.client_id === client.id && c.status !== 'encerrado' && c.value)
    .reduce((s, c) => s + (c.value ?? 0), 0)
}
