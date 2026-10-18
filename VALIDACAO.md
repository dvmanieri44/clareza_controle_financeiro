# Validação da implementação

## Itens 6 e 7 — módulos e paginação, 18/10/2026

- `npm run check` aprovado: lint sem avisos, TypeScript, **260 testes em doze arquivos** e build Node.
- Os mesmos 260 testes passaram em UTC. Build Pages e `verify:pages` aprovados (12 rotas, 404 e 224 referências a assets).
- A tela central agora seleciona dez módulos por funcionalidade. Formulários de conta/transação são reutilizados; controles e diálogos comuns ficam em `src/features/finance/`.
- A lista consulta até 25 transações por página com cursor estável por data/valor/ID. Tipo, categoria, conta e período são enviados ao Firestore. A busca por substring percorre blocos do recorte e não se limita à página visível.
- Foram removidas as assinaturas globais de `entries`, `goalMovements` e `snapshots`. Contas usam saldos cumulativos por agregação; dashboard combina recorte de seis meses com agregações anteriores ao período; cartões consultam mês e total em aberto; exportação busca todas as coleções em blocos.
- Novos testes com banco simulado verificam 77 registros empatados em múltiplas páginas, competência diferente da data da compra, transferências nos dois sentidos, pendências, ordenação por valor, cursor de documento excluído, isolamento por UID/filtro, busca além da primeira página, cancelamento, totais completos, saldos anteriores ao período, faturas pagas e exportação de 405 registros.
- O teste de combinações confere as consultas emitidas contra os **53 índices versionados**. Isso não substitui a construção e validação desses índices no Firebase real.
- Acrescentado teste das consultas reais no emulador para paginação, agregação, valor com intervalo e bloqueio entre usuários. **Não executado localmente:** a tentativa confirmou Java 17 e exigência de Java 21+.
- Cobertura continua sem medição: o provedor V8 não está instalado, e as duas tentativas de download (normal e ampliada) falharam com `EACCES`. O novo módulo puro `history.ts` entrou no escopo; as metas não foram reduzidas.
- A interface mantém snapshots até atualização ao salvar, clicar em Atualizar dados, voltar o foco ou recuperar a conexão. Não há atualização global em tempo real do histórico; gravações concorrentes podem exigir atualização para sincronizar lista e totais.
- O Git continuou bloqueando `.git/index.lock`, e a tentativa ampliada falhou no helper. A preparação dos dois patches não equivale a commits criados. Instruções em `docs/commits-6-7.md`.
- Publicar `firestore.indexes.json` e aguardar os índices prontos antes da nova interface. Nenhum registro de produção foi migrado ou alterado para esta implementação. Validação visual e integração com Firebase real continuam pendentes.

## Atualização de 18/10/2026 — importação e conta

- Implementados os itens 11 e 12: sugestões e memória opcional de categorias na importação, gerenciamento de regras, duplicatas por descrição normalizada, alteração de senha, privacidade e exclusão retomável da conta.
- `npm run lint` e `npm run typecheck` aprovados.
- `npm test`: **237 testes em dez arquivos**, aprovados. Incluem prioridade e conflito de regras, descrições normalizadas, persistência na mesma transação da importação, gerenciamento de regras, senha/reauth, exclusão em lotes, isolamento de usuários no serviço, falhas parciais, inicialização e retomada. Os testes do serviço Firebase usam mocks e não comprovam integração real.
- Build Node aprovado; build Pages e `npm run verify:pages` aprovados (12 rotas, 404 e 224 referências a assets).
- Acrescentados cinco cenários às regras do Firestore: regras de importação, login recente para exclusão, bloqueio de novas gravações, exclusão de registros imutáveis e importação de 200 compras com 200 regras em até dez categorias.
- **Regras ainda não executadas neste ambiente:** o CLI encontrou primeiro uma configuração global inacessível; com configuração isolada, confirmou Java 17, incompatível com a exigência de Java 21+. A execução ampliada falhou ao preparar o processo (`helper_unknown_error`). O CI já utiliza Java 21 e deve executar estes testes antes da publicação.
- **Cobertura não medida:** download de `@vitest/coverage-v8@5.0.5` bloqueado por `EACCES`; execução ampliada também falhou ao preparar o processo. As metas não foram afrouxadas, e o novo módulo puro `import-rules.ts` entrou no escopo.
- Publicar o novo `firestore.rules` antes de usar esta interface. Nenhum dado real foi alterado/excluído para validar o fluxo.
- Validação visual e testes no navegador/Firebase real continuam pendentes. A exclusão depende da página aberta e não é atômica entre Authentication e Firestore; interrupções exigem retomada, conforme o README.

## Registro anterior

Verificação local em 17/10/2026, com Node.js 24.18.0, npm 11.16.0, Next.js 16.4.2 e Vitest 5.0.5.

## Verificado

- `npm run check`: lint sem erros/avisos, tipos gerados pelo Next.js, TypeScript, 211 testes em sete arquivos e build aprovados.
- Os mesmos 211 testes passaram em `UTC` e `America/Sao_Paulo`, com relatórios JUnit em `reports/`.
- Os testes cobrem limites em centavos, calendário, competência, parcelamentos, saldos, recorrências, schemas, validação dos formulários, contraste em cores personalizadas, CSV e a orquestração da importação com Firestore isolado por mocks.
- `GITHUB_PAGES=true PAGES_BASE_PATH=/clareza_controle_financeiro`: validação completa e exportação estática aprovadas. `npm run verify:pages` verificou 12 rotas, `404.html` e 224 referências a arquivos CSS/JavaScript existentes no prefixo correto.
- O build normal também passou após a exportação, deixando a saída local compatível com `npm start`.
- Os YAMLs de CI e Pages foram analisados e suas dependências entre jobs conferidas. O CI cobre PRs, dois fusos horários, relatórios, regras do Firestore e builds Node/Pages; a publicação depende da aprovação dos checks.
- As cores semânticas de texto e botões foram verificadas por cálculo de contraste nos temas claro e escuro; as bordas dos campos também foram verificadas. Isso não equivale a uma auditoria completa de WCAG no navegador.
- O CSV de exemplo fornecido pelo usuário foi lido pelo parser real: 49 linhas, 46 compras, três pagamentos recebidos, nenhuma linha inválida e 49 chaves distintas. Duas compras repetidas legítimas foram preservadas. O CSV original não foi copiado para o repositório nem gravado no Firebase.
- `.env.local`, dependências, builds e relatórios estão ignorados pelo Git. A varredura dos arquivos destinados ao repositório não encontrou as chaves Firebase locais nem chaves privadas/tokens nos padrões verificados.

## Implementado na interface

Fontes em unidades relativas, textos auxiliares a partir de 14 px na escala padrão, campos de 16 px, contraste revisado, controles maiores, navegação móvel em diálogo com foco contido, fechamento por Escape, retorno de foco, indicação da página atual, atalhos para pular ao conteúdo, erros associados aos campos e tabelas alternativas aos gráficos.

A revisão de experiência inclui primeiros passos sem dados, títulos diretos, categorias filtradas pelo tipo de transação, filtros avançados recolhidos, configurações objetivas e explicações em botões de informação. A importação fica em **Cartões > Importar fatura** e exige conferência e confirmação.

## Pendente por restrições do ambiente

- **Commits e push:** a criação de `.git/index.lock` falha com `Permission denied`, mesmo na tentativa de execução ampliada. Não foi criado nenhum commit nesta etapa. Não foram alteradas ACLs nem removidos arquivos de lock como contorno.
- **Cobertura medida:** o comando e as metas estão configurados (85% linhas/instruções/funções, 80% desvios nos módulos puros). O provedor V8 não está instalado; o npm foi bloqueado por conexão/permissão e a tentativa offline falhou por ausência do pacote no cache. Nenhum percentual medido é declarado.
- **Regras do Firestore:** a suíte contém dez casos, incluindo importação em lote e bloqueio de sobrescrita. Não executou: o Firebase CLI exige Java 21+ e este ambiente possui Java 17. A primeira tentativa também encontrou uma configuração global inacessível; usar configuração local isolada confirmou o bloqueio de versão Java.
- **Navegador e teste de uso:** `npm start` não conseguiu abrir `127.0.0.1:3000` (`EACCES`). A execução ampliada falhou ao preparar o processo (`helper_unknown_error: setup refresh had errors`). Não houve revisão visual, teste de teclado/leitor de tela ou gravação pelo navegador.
- **GitHub:** a conexão via Git/CLI foi bloqueada. CI, cobertura, emulador no runner e publicação Pages ainda precisam ser observados em execução real.
- **Firebase real:** cadastro, login, recuperação de senha, importação confirmada e persistência ainda precisam ser verificados. Regras/índices e domínios autorizados seguem o checklist do README.

Build e testes isolados não comprovam publicação nem acesso ao Firebase real. OFX e PDF não fazem parte da primeira versão da importação.

## Reproduzir

```powershell
npm ci
npm run check
npm run test:coverage
# Com Java 21+:
npm run test:rules
```

Para conferir a exportação, seguir a seção GitHub Pages do README e executar `npm run verify:pages`.
