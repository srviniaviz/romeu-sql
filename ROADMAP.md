# Roadmap do Romeu SQL

Este documento registra as melhorias planejadas para transformar o Romeu SQL em um workspace SQL consistente para uso diario. A ordem prioriza fundacao de produto, seguranca e desempenho antes de adicionar novas telas.

## Legenda

| Campo | Valores |
| --- | --- |
| Status | `Planejado`, `Em andamento`, `Bloqueado`, `Concluido` |
| Impacto | `Muito alto`, `Alto`, `Medio`, `Baixo` |
| Esforco | `P`, `M`, `G` |

## Backlog priorizado

| ID | Prioridade | Iniciativa | Resultado esperado | Impacto | Esforco | Status |
| --- | ---: | --- | --- | --- | --- | --- |
| RM-01 | 1 | Abas com estado independente | Duas abas da mesma tabela mantem filtros, pagina, consulta e resultados separados | Muito alto | M | Concluido |
| RM-02 | 2 | Persistencia do workspace | Restaurar conexao, banco, abas, filtros e consultas ao reabrir o app | Muito alto | M | Planejado |
| RM-03 | 3 | Configuracoes conectadas ao comportamento | Eliminar opcoes que salvam mas nao produzem efeito real | Muito alto | M | Planejado |
| RM-04 | 4 | Cancelamento real de consultas | Interromper operacoes no banco, alem do timeout existente | Muito alto | G | Planejado |
| RM-05 | 5 | Protecao contra operacoes destrutivas | Confirmar comandos perigosos e oferecer modo somente leitura | Muito alto | M | Planejado |
| RM-06 | 6 | Suporte a multiplos schemas | Navegar e operar fora do schema PostgreSQL `public` | Alto | G | Planejado |
| RM-07 | 7 | Diagrama focado por relacionamento | Explorar bancos grandes sem renderizar todo o grafo por padrao | Alto | M | Em andamento |
| RM-08 | 8 | Workspace SQL completo | Abas de consulta, selecao executavel, resultados e historico persistente | Alto | G | Planejado |
| RM-09 | 9 | Command palette e atalhos | Abrir tabelas e executar comandos sem depender do mouse | Medio | M | Planejado |
| RM-10 | 10 | Monitor de banco | Visualizar queries ativas, sessoes e locks | Medio | G | Planejado |
| RM-11 | 11 | Identificacao de ambientes | Destacar conexoes de desenvolvimento, homologacao e producao | Alto | P | Planejado |

## Detalhamento

### RM-01 - Abas com estado independente

Cada aba deve representar uma sessao completa, e nao apenas um nome de tabela.

- [x] Manter a tabela e o tipo da sessao na aba; conexao, banco e schema entram no RM-06.
- [x] Manter pagina, limite, filtro, ordenacao e projecao por aba.
- [x] Manter modo de visualizacao e subaba ativa por aba.
- [x] Manter SQL e resultados por aba.
- [x] Permitir duas ou mais abas da mesma tabela sem compartilhar estado.
- [x] Preparar um modelo discriminado para futuros tipos de aba.

### RM-02 - Persistencia do workspace

- [ ] Restaurar a ultima conexao e banco usados.
- [ ] Restaurar abas abertas e aba ativa.
- [ ] Restaurar estado relevante de cada aba.
- [ ] Persistir historico SQL por conexao e banco.
- [ ] Respeitar a configuracao `rememberLastWorkspace`.
- [ ] Evitar persistir senhas ou outros segredos no workspace.

### RM-03 - Configuracoes conectadas ao comportamento

Implementar ou remover temporariamente controles que hoje existem apenas na tela de configuracoes.

| Configuracao | Comportamento esperado |
| --- | --- |
| `autoConnect` | Reconectar automaticamente ao workspace salvo |
| `rememberLastWorkspace` | Restaurar conexao, banco e abas |
| `schemaCache` | Ativar ou desativar o cache de metadados |
| `refreshMetadataOnConnect` | Forcar sincronizacao ao conectar |
| `cancelOnNavigate` | Cancelar operacoes ao trocar de contexto |
| `confirmDestructiveActions` | Controlar confirmacoes de SQL perigoso |
| `density` | Alterar densidade global dos componentes |
| `appearance.fontSize` | Alterar escala tipografica global |
| `debugLogs` | Controlar logs de diagnostico sem expor segredos |

### RM-04 - Cancelamento real de consultas

- [ ] Atribuir um identificador a cada operacao em execucao.
- [ ] Exibir acao de cancelamento no status inferior.
- [ ] Cancelar a operacao no backend e no banco quando suportado.
- [ ] Diferenciar cancelamento, timeout e falha.
- [ ] Exibir duracao e quantidade de linhas retornadas ou afetadas.

### RM-05 - Protecao contra operacoes destrutivas

- [ ] Detectar `DROP`, `TRUNCATE`, `DELETE` sem filtro e comandos equivalentes.
- [ ] Respeitar `confirmDestructiveActions`.
- [ ] Oferecer modo somente leitura por conexao.
- [ ] Oferecer execucao transacional com `Commit` e `Rollback`.
- [ ] Priorizar chave primaria ou indice unico em edicao e exclusao de linhas.
- [ ] Informar claramente a quantidade de linhas afetadas.

### RM-06 - Suporte a multiplos schemas

- [ ] Listar schemas de usuario.
- [ ] Agrupar tabelas, views, funcoes, sequencias e tipos por schema.
- [ ] Usar identificadores qualificados em todas as operacoes.
- [ ] Incluir o schema nas chaves do React Query e caches de metadados.
- [ ] Permitir selecionar um schema padrao por conexao.
- [ ] Remover dependencias fixas do schema `public`.

### RM-07 - Diagrama focado por relacionamento

- [ ] Abrir focado na tabela selecionada.
- [ ] Mostrar relacoes de primeiro ou segundo nivel.
- [ ] Adicionar acao explicita para mostrar o banco inteiro.
- [ ] Permitir ocultar tabelas sem relacionamento.
- [ ] Agrupar tabelas por schema.
- [ ] Destacar o caminho entre duas tabelas.
- [ ] Adicionar minimapa.
- [ ] Salvar posicoes manuais do usuario.
- [ ] Manter pan e zoom fluidos em bancos grandes.

### RM-08 - Workspace SQL completo

- [ ] Criar abas de consulta independentes.
- [ ] Executar somente a selecao do editor.
- [ ] Adicionar atalho `Ctrl+Enter` para executar.
- [ ] Suportar multiplos conjuntos de resultados.
- [ ] Persistir e pesquisar o historico.
- [ ] Salvar consultas favoritas e snippets.
- [ ] Adicionar `EXPLAIN` e `EXPLAIN ANALYZE`.
- [ ] Melhorar autocomplete com schemas, tabelas e colunas.
- [ ] Exibir tempo, quantidade de linhas e linhas afetadas.
- [ ] Exportar diretamente cada resultado.

### RM-09 - Command palette e atalhos

- [ ] `Ctrl+P`: buscar conexao, banco, tabela ou comando.
- [ ] `Ctrl+T`: abrir nova consulta.
- [ ] `Ctrl+W`: fechar aba ativa.
- [ ] Reordenar e fixar abas.
- [ ] Fechar outras abas ou abas a direita.
- [ ] Exibir atalhos nos menus e tooltips.

### RM-10 - Monitor de banco

- [ ] Listar sessoes e queries ativas.
- [ ] Mostrar duracao, usuario, banco e estado.
- [ ] Visualizar locks e bloqueios entre sessoes.
- [ ] Permitir cancelar uma query com confirmacao.
- [ ] Restringir recursos conforme as permissoes do usuario conectado.

### RM-11 - Identificacao de ambientes

- [ ] Permitir classificar a conexao como `DEV`, `STAGING` ou `PROD`.
- [ ] Exibir badge e cor consistente na sidebar e no header.
- [ ] Reforcar confirmacoes destrutivas em producao.
- [ ] Evitar usar verde como cor primaria da interface.

## Ordem de execucao sugerida

1. RM-01, RM-02 e RM-03: consolidar o modelo de workspace.
2. RM-04 e RM-05: tornar consultas e alteracoes seguras.
3. RM-06 e RM-07: melhorar navegacao e compreensao do schema.
4. RM-08 e RM-09: evoluir produtividade no editor.
5. RM-10 e RM-11: adicionar operacao e contexto de ambiente.

## Regra de manutencao

Ao iniciar uma iniciativa, alterar seu status para `Em andamento`. Ao concluir, marcar os criterios correspondentes e registrar o commit ou release que entregou a mudanca.
