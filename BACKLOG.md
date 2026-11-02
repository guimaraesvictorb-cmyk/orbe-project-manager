# Backlog do produto (Orbe OS)

Pendências reais, pedidas por Victor, registradas aqui — não implementadas
ainda, sem prazo nem responsável inventados. Quando o item virar trabalho
real, mover para uma tarefa de verdade (no To-do Orbe interno, quando esse
escopo existir, ou em `client_assignments`/`tasks` quando for por cliente).

## Acesso de colaboradores externos por cliente/projeto

Pessoas fora da Orbe com responsabilidades dentro do time de um projeto
precisam de acesso ao Studio, mas só ao que for delas:

- Permissões escopadas por cliente/projeto (não acesso geral).
- Atribuição de tarefas dentro desse escopo.
- Convite revogável (remover o acesso sem deixar rastro de conta órfã).
- Sem acesso aos outros clientes nem a Financeiro/dados da agência.

**Por que não entrou direto em `tasks`:** `tasks.client_id` é `NOT NULL`
hoje — não existe "tarefa interna Orbe" sem cliente associado. Registrar
isso como uma tarefa exigiria inventar um cliente falso para satisfazer o
schema, o que não é aceitável. Fica aqui até o To-do Orbe (escopo interno,
sem cliente) existir — aí sim isso vira uma tarefa de verdade, e este item
sai daqui.

**Também depende de (não resolvido ainda):** como seriam cadastrados esses
colaboradores externos (role novo? tabela própria distinta de `profiles`?)
e como fica o controle de quem pode convidar/revogar.
