# Backlog do produto (Orbe OS)

## Menu principal recolhível ao entrar em um cliente

**Pedido de Victor em 02/11/2026 — na fila, ainda não implementado.**

Ao abrir um cliente, recolher o menu principal da plataforma (Dashboard,
Orbe AI e demais áreas) para dar mais espaço à visão do projeto. Manter
um botão visível para abrir e fechar esse menu manualmente, sem perder
o cliente selecionado, a aba ou os filtros. O controle deve funcionar
também pelo teclado e indicar se o menu está aberto ou recolhido.

O pedido se refere ao menu principal da plataforma; a navegação entre
as áreas do cliente continua acessível.

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

## Comece por aqui — orientação de novos usuários

**Pedido de Victor em 02/11/2026 — para uma próxima etapa.**

Criar ou ampliar a orientação inicial para quem entrar na plataforma: explicar
o menu, como escolher um cliente, encontrar tarefas e cronogramas, consultar
conhecimento, usar a IA e preparar relatórios. Adaptar a explicação ao papel
e às permissões; nenhuma orientação deve revelar clientes ou finanças sem acesso.
Distinguir esse guia do onboarding comercial de um cliente.

Campanhas não deve aparecer como entrada no menu principal da Orbe. As visões
de tráfego pago e orgânico/analytics ficam dentro de cada cliente.
