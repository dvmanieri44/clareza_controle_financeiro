# Melhorias solicitadas

Solicitações de 17/10/2026. Os checks abaixo distinguem implementação local de publicação. Commits devem usar Conventional Commits, a identidade Git do usuário e nenhuma coautoria do assistente.

## Implementado localmente

- [x] Ajuste do Pages: exportação estática, prefixo do repositório, validação das rotas/assets e workflow de publicação após CI.
- [x] Item 1: fontes maiores em unidades relativas, controles confortáveis e ajustes de responsividade.
- [x] Item 2: 211 testes unitários e comando/configuração de cobertura com metas e relatórios. A medição está pendente da instalação do provedor V8.
- [x] Item 11: contraste, teclado, foco, menu móvel, formulários, nomes acessíveis e alternativas aos gráficos.
- [x] Item 6: CI em pull requests e main, UTC/São Paulo, regras no emulador com Java 21, builds Node/Pages, relatórios e check consolidado.
- [x] Importação Nubank **CSV**: cartão e competência, envio/arraste, prévia editável, categorias, seleção e confirmação antes de gravar. IDs estáveis evitam reimportação e preservam repetições legítimas. Pagamentos/créditos não viram compras; parcelas futuras não são geradas. O exemplo de 49 linhas foi validado sem copiar o arquivo para o projeto.
- [x] **Revisão realizada por último: experiência para iniciantes.** Títulos e ações diretos, primeiros passos, menos explicações permanentes, filtros avançados recolhidos e botões de informação acessíveis por clique e teclado. As instruções necessárias para decisões financeiras e confirmação da importação permanecem visíveis.

## Ainda pendente

- [ ] Criar os commits e enviar ao GitHub. `git add` continua falhando ao criar `.git/index.lock`, inclusive com execução ampliada.
- [ ] Executar a cobertura com o provedor V8 instalado e conferir as metas.
- [ ] Executar os dez testes das regras com Java 21+.
- [ ] Revisar visualmente desktop/celular, zoom e fluxo por teclado/leitor de tela no navegador.
- [ ] Conferir o fluxo de importação com Firestore real ou emulador e os cenários de reenvio e fatura paga.
- [ ] Observar o CI no GitHub e concluir a publicação Pages com as seis variáveis Firebase e a origem GitHub Actions configuradas.
- [ ] OFX/PDF somente se solicitados como extensão da primeira versão CSV.

## Restrições verificadas

A gravação no Git e a conexão ao npm/GitHub falharam neste ambiente. A preparação da execução ampliada também retornou `helper_unknown_error: setup refresh had errors`. Java disponível: 17. A abertura do servidor local foi negada com `EACCES`.

Não modificar ACLs nem remover locks como contorno. Preservar as alterações e retomar commits, verificações e publicação quando o ambiente permitir. Evidências completas em `VALIDACAO.md`.
