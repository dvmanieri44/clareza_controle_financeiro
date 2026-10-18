# Validação da implementação

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
