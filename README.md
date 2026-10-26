# FINMEI · Organizador Financeiro

Aplicativo pessoal em português brasileiro: Next.js App Router, TypeScript, Tailwind CSS, componentes locais no padrão shadcn/ui (Radix + CVA), Lucide, Firebase Auth/Firestore, React Hook Form, Zod, Recharts e date-fns. Dados financeiros vêm do Firestore, sem movimentações fictícias.

O nome do produto é **FINMEI**. Os endereços do repositório e do GitHub Pages e os identificadores internos de armazenamento mantêm os valores anteriores para preservar os links e os dados já salvos.

## Instalação e comandos

Requisitos: Node.js 24 LTS e npm; para testar regras, Java 21+ e emulador Firestore.

```powershell
git clone https://github.com/dvmanieri44/clareza_controle_financeiro.git
cd clareza_controle_financeiro
npm ci
Copy-Item .env.example .env.local
# Preencha as seis variáveis do seu app Web Firebase.
npm run dev
```

Abra http://localhost:3000. Sem credenciais, o app exibe instruções. Reinicie após alterar `.env.local` e refaça o build em produção.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm start
npm run test:rules
```

`npm run check` reúne lint, tipos, testes unitários e build.

## Testes e integração contínua

- Os testes unitários cobrem dinheiro, datas, schemas, formulários, contraste de cores, leitura do CSV e a transação de importação com banco isolado por mocks.
- `npm run test:coverage` prepara o provedor V8 na mesma versão do Vitest instalado pelo lockfile. Essa ferramenta opcional requer acesso ao npm na primeira execução; `--no-save` mantém `package.json` e `package-lock.json`. O relatório fica em `coverage/index.html`.
- A cobertura exigida é de 85% em linhas, instruções e funções e 80% em desvios, somente nos módulos puros de regras financeiras, validação, importação e contraste. Não representa cobertura da interface nem do Firebase real.
- `.github/workflows/ci.yml` executa lint, tipagem, testes/cobertura em `UTC` e `America/Sao_Paulo`, as regras no emulador Firestore com Java 21 e builds Node.js e Pages. Os relatórios JUnit e de cobertura ficam nos artefatos da execução por 14 dias.
- O check **CI aprovado** só passa se todas essas verificações passarem. Em `main`, a publicação no Pages ocorre depois desse check. Pull requests não publicam o site.

As validações não usam credenciais de produção. Os testes das regras usam exclusivamente o projeto local `demo-financeiro`. A importação real no navegador só grava depois da confirmação do usuário.

O `.env.local` fica somente na sua máquina e não é versionado. Em outro computador ou na hospedagem, preencha as seis variáveis conforme `.env.example`.

## Checklist Firebase

1. Crie um projeto no [console Firebase](https://console.firebase.google.com/) e registre um aplicativo **Web**.
2. Copie apiKey, authDomain, projectId, storageBucket, messagingSenderId e appId para as seis variáveis de `.env.local`. Não use JSON de conta de serviço ou chaves privadas.
3. Habilite **E-mail/senha** em Authentication. Em Domínios autorizados, adicione `localhost` e seu domínio de produção.
4. Crie o Cloud Firestore **Standard / Native**, banco `(default)`, em modo de produção, na região desejada.
5. Publique regras e índices:

   ```powershell
   npx firebase login
   npx firebase deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
   ```

   As consultas do histórico e as agregações agora exigem os índices compostos de `firestore.indexes.json`. Publique-os e aguarde ficarem prontos no console antes de publicar esta interface. O comando `npm run indexes:generate` reproduz os 53 índices das combinações suportadas de filtros, ordenação e resumos. Não altera registros financeiros.
6. Reinicie, crie sua conta e cadastre uma conta financeira. O primeiro login cria somente categorias padrão e o perfil, sem valores fictícios.
7. Registre receita/despesa, recarregue e confirme a persistência. Confira o e-mail de recuperação de senha.

Não depende de Functions, Storage, integração bancária ou APIs de cotação. Confira as cotas do seu Firebase. Execute localmente, em host Next.js/Node ou use o fluxo abaixo para o GitHub Pages.

## Publicação no GitHub Pages

O Pages precisa receber o aplicativo compilado. Publicar a raiz do código por uma branch pode exibir o README em vez do site. Após a aprovação do CI, o workflow reutilizável `.github/workflows/pages.yml` exporta HTML/CSS/JavaScript para `out`, verifica as rotas e assets e publica essa pasta.

1. Em **Settings > Pages > Build and deployment > Source**, selecione **GitHub Actions**.
2. Em **Settings > Secrets and variables > Actions > Variables**, crie as seis variáveis `NEXT_PUBLIC_FIREBASE_*` listadas em `.env.example`, com os valores do seu app Web Firebase. Elas são configurações públicas do cliente; não use chaves privadas ou uma conta de serviço. O arquivo `.env.local` continua fora do Git e não é enviado ao workflow.
3. No Firebase Authentication, inclua `dvmanieri44.github.io` em **Settings > Authorized domains** e confira o checklist Firebase acima.
4. Envie as alterações para `main`. Para executar manualmente, use **Actions > CI > Run workflow**, selecionando `main`. As verificações serão executadas antes de publicar.
5. Após a execução concluir, abra https://dvmanieri44.github.io/clareza_controle_financeiro/ e teste login e persistência.

O deploy é interrompido se faltar alguma variável ou se lint, tipagem, testes ou build falharem. O caminho do repositório é obtido do Pages durante o build, inclusive se um domínio próprio for configurado.

Para gerar a mesma exportação localmente no PowerShell:

```powershell
$env:GITHUB_PAGES = "true"
$env:PAGES_BASE_PATH = "/clareza_controle_financeiro"
npm run check
npm run verify:pages
Remove-Item Env:GITHUB_PAGES
Remove-Item Env:PAGES_BASE_PATH
```

Os arquivos gerados ficam em `out`. Para desenvolvimento ou hospedagem Node.js, use os comandos normais sem `GITHUB_PAGES=true`. O Pages hospeda a interface estática; autenticação e dados continuam no Firebase.

## Funcionalidades implementadas

- Autenticação completa com sessão persistida, recuperação de senha e rotas protegidas.
- Dashboard com seis indicadores, três gráficos, últimas transações, vencimentos, metas e alertas.
- CRUD de transações, confirmação de pendências, notas, vencimentos, busca, ordenação e filtros por mês, intervalo, tipo, categoria e conta.
- Contas com tipo/cor/saldo inicial e transferências atômicas sem gerar receita ou despesa.
- Cartões, compras em até **12 parcelas**, faturas por competência, pagamento integral sem duplicar despesas e exclusão de compras cujas faturas ainda não foram pagas.
- Importação local de fatura Nubank em CSV, com prévia editável, seleção de categorias e compras, confirmação e proteção contra reimportação.
- Sugestões de categorias por descrição, regras gerenciáveis nas configurações e memória opcional das escolhas confirmadas na importação.
- Alteração de senha com confirmação da senha atual e exclusão da conta com remoção dos registros, confirmação explícita e retomada em caso de interrupção.
- Orçamentos mensais por categoria, progresso e alertas de 80% e 100%.
- Metas, aportes, retiradas e histórico transacional.
- Investimentos manuais com resultado nominal e histórico de atualizações.
- Categorias com ícones/cores; arquivamento e restauração de registros mestres para preservar referências.
- Recorrências mensais com início/fim, pausa e geração explícita sem duplicação.
- Tema claro/escuro, layout responsivo, estados vazios, erros e exportação JSON.
- Fontes em unidades relativas, contraste revisado nos temas claro/escuro, menu móvel com foco contido, navegação por teclado, atalhos para pular ao conteúdo, erros associados aos campos e alternativas em tabela para os gráficos.
- Fluxo inicial simplificado, filtros avançados recolhidos e explicações detalhadas em botões de informação.

## Importar fatura Nubank

Em **Cartões > Importar fatura**, escolha o cartão e o mês de vencimento, selecione ou arraste o CSV e clique em **Conferir lançamentos**. O leitor aceita o formato `date,title,amount`, valores como `"11,95"` ou `11.95` e também arquivos com cabeçalhos Data/Descrição/Valor e separação por ponto e vírgula.

Na prévia, confira datas, descrições e valores, selecione as compras e aplique uma categoria de despesa. A categoria também pode ser alterada por linha. Somente **Confirmar compras** inicia a gravação no Firestore; cancelar a prévia não altera seus registros. O arquivo original é processado no navegador e não é enviado ao banco.

Cada linha representa somente o valor lançado naquela fatura, inclusive quando a descrição contém uma parcela: a importação não multiplica o valor nem gera parcelas futuras. O mês é escolhido explicitamente porque o CSV não informa a competência em uma coluna própria. Compras iguais no mesmo arquivo são preservadas e destacadas para conferência. Reenviar as mesmas linhas para o mesmo cartão e competência mantém identificadores estáveis e não cria duplicatas; compras semelhantes já cadastradas manualmente ficam desmarcadas inicialmente.

Valores negativos e zerados são exibidos, mas não são importados como compras. Eles podem representar pagamentos ou créditos; esta versão não aplica estornos automaticamente. No exemplo fornecido pelo usuário, as três linhas negativas eram **Pagamento recebido**. Não use a soma das compras como total líquido de uma fatura que contenha estornos sem conferir os créditos separadamente.

Limites: CSV de até 2 MB e 500 linhas, com até 200 compras e 10 categorias em uma confirmação. Para arquivos maiores que uma seleção, envie novamente o mesmo CSV após a primeira importação e selecione as linhas restantes. A seleção é gravada atomicamente e uma fatura paga não aceita novas compras. OFX e PDF não estão incluídos nesta primeira versão.

### Categorias sugeridas e compras semelhantes

Em **Configurações > Categorias na importação**, salve uma descrição, a comparação por descrição inteira ou palavras contidas e uma categoria de despesa ativa. A comparação ignora acentos, caixa e pontuação; palavras contidas devem estar completas. Descrição inteira tem preferência, seguida pela regra mais específica. Empates com categorias diferentes ficam sem sugestão. Para atualizar uma regra, salve a mesma descrição/comparação com a nova categoria; excluir uma regra não altera compras existentes.

Na prévia, as sugestões estão identificadas e podem ser alteradas. **Lembrar as categorias destas descrições** é opcional e começa desmarcado. Ao confirmar, as regras de descrição inteira são salvas na mesma transação das compras novas. Descrições com categorias conflitantes não são lembradas. Abrir a prévia, voltar ou cancelar não grava compras nem regras.

Compras já registradas com o mesmo cartão, competência, data, valor e descrição normalizada começam desmarcadas e recebem um aviso; o usuário pode selecionar uma repetição legítima. Repetições no arquivo também são destacadas. O ID original continua garantindo que o mesmo lançamento importado não seja sobrescrito.

## Conta e privacidade

Em **Configurações**, a seção de segurança permite trocar a senha informando a atual, a nova (mínimo de oito caracteres e diferente da atual) e a confirmação. O SDK reautentica o usuário e atualiza o token antes da operação. Senhas não são gravadas no Firestore, no armazenamento local nem nos relatórios.

A seção de privacidade descreve os dados no Firebase Authentication/Firestore, o processamento local do CSV, a exportação e o armazenamento de tema e retomada no navegador. Não representa uma auditoria de conformidade legal.

Para excluir a conta, exporte seus dados antes, confirme a senha atual e digite **EXCLUIR**. O aplicativo marca o perfil em exclusão e bloqueia novas gravações pelas regras, inclusive em outras sessões. Exclui as onze subcoleções conhecidas em lotes de até 200 documentos, depois o perfil e, por último, o usuário no Authentication. Faturas pagas e históricos imutáveis só podem ser removidos nesse fluxo com login recente (menos de cinco minutos).

A operação ocorre no navegador e requer conexão e a página aberta. Ela não é atômica entre Firestore e Authentication: em uma falha, parte dos dados pode já estar removida. A marca no perfil e uma marca local por UID permitem retomar; se a remoção do Authentication falhar após remover o perfil, o aplicativo tenta restaurar a marca no servidor. Uma nova tentativa confirma novamente a senha e continua sem recriar categorias quando houver marca de retomada. Para volumes grandes ou garantia de execução após fechar o navegador, será necessário um serviço de exclusão no servidor. Cópias JSON já baixadas permanecem sob controle do usuário.

**Antes de publicar esta versão**, publique o novo `firestore.rules` conforme o checklist Firebase. Ele adiciona `importRules` e as permissões específicas de exclusão; apenas atualizar o site não atualiza as regras. Os testes de segurança exigem Java 21+ e usam apenas o projeto `demo-financeiro`.

## Regras financeiras

Valores são inteiros em **centavos**, limitados a 9 trilhões de centavos por campo. Digite `1.234,56` ou `1234,56`. Parcelas preservam o total: R$ 100,00 em três vezes = R$ 33,34 + R$ 33,33 + R$ 33,33.

Saldo = saldo inicial + receitas recebidas − despesas pagas − pagamentos de fatura ± transferências, até a data de hoje. Contas arquivadas permanecem no saldo total. O saldo inicial vale desde o início do histórico e não pode ser editado: use movimentações para ajustá-lo.

Receitas/despesas comuns usam regime de caixa. Compras de cartão usam a competência do vencimento. **Pagamento de fatura reduz a conta sem contar nova despesa.** Despesas pendentes entram no orçamento ao serem pagas; parcelas de cartão entram na competência.

Compras no dia do fechamento ou depois entram no próximo ciclo. Vencimento menor ou igual ao fechamento ocorre no mês seguinte ao fechamento. Exemplo: fecha 5, vence 15; compra 4/10 vence em outubro, compra 5/10 vence em novembro. Alterações no cartão não modificam parcelas históricas.

Compras, exclusões e pagamentos atualizam uma revisão do cartão em transação. Pagamentos têm ID único por cartão/mês. O repositório verifica a revisão para serializar concorrência e impedir pagamentos duplicados ou de totais desatualizados. Faturas pagas são imutáveis e bloqueiam compras retroativas.

Metas e investimentos são acompanhamento; não criam receitas/despesas nem movimentam contas. Registre o caixa real separadamente. Investimentos não são somados ao saldo em um patrimônio total, pois podem representar recursos também registrados em contas. Resultado nominal não ajusta aportes, tempo, impostos ou inflação.

Datas de negócio são dias locais `YYYY-MM-DD`, sem conversão UTC. `createdAt` é ISO UTC para ordenação. O cliente valida dias reais de 1900 a 2199. Dia 31 de recorrências/vencimentos é ajustado ao último dia do mês.

## Arquitetura e coleções

```text
src/app/             páginas, layouts, estilos e limites de erro
src/components/ui/   componentes locais Radix/shadcn
src/components/      sessão/dados, layout e formulários
src/features/finance-screen.tsx   seleção da tela pela rota
src/features/finance/             controles comuns, diálogos e consultas assíncronas
src/features/transactions/        histórico paginado, filtros e formulário de transação
src/features/accounts/            contas, transferências e formulário de conta
src/features/{cards,budgets,goals,investments,categories,recurrences,settings,overview}/
                                 telas e ações de cada funcionalidade
src/lib/domain/      tipos, schemas Zod e cálculos puros
src/lib/firebase/    sessão, repositório transacional, histórico e consultas financeiras
tests/               regras financeiras e de segurança
```

Todo dado fica sob `users/{uid}`. O perfil possui createdAt/version. Todos os documentos incluem createdAt.

### Histórico, saldos e atualização

O provider mantém somente os cadastros em tempo real. Não assina a coleção inteira de transações nem os históricos de metas e investimentos. Cada funcionalidade consulta seus dados: transações por cursor, cartões e orçamentos pelo mês, dashboard pelos seis meses exibidos; históricos de metas/investimentos são buscados somente nessas telas. A exportação busca explicitamente todas as coleções em blocos de 200, incluindo registros que não estejam na tela.

O histórico mostra **25 transações por página**, com Anterior/Próxima. Mês, tipo, categoria, conta e datas são aplicados no Firestore antes da paginação. O mês das compras usa a competência da fatura; as datas explícitas continuam usando a data da compra. As consultas separadas por tipo são mescladas com ordenação estável por data/valor e ID. Trocar filtros, usuário ou atualizar os dados reinicia os cursores. Não há migração ou regravação dos documentos existentes.

Os indicadores do histórico somam todo o filtro, independentemente da página. Sem busca textual, usam `count`/`sum` no servidor. A busca por descrição preserva substring e caixa indiferente; como o Firestore não fornece esse operador, percorre os resultados do período em blocos, sem reter toda a coleção. Pode fazer muitas leituras em “Todos os meses”; restrinja mês e filtros. Consultas de busca obsoletas deixam de iniciar novos blocos quando os filtros mudam.

Saldos atuais e evolução usam agregações cumulativas, incluindo movimentações anteriores aos seis meses visíveis e contas arquivadas. Transferências cancelam no saldo total e são computadas como origem/destino nos saldos por conta. Pagamentos de fatura reduzem saldo, sem contar como nova despesa. O limite em aberto do cartão usa compras menos pagamentos integrais; o pagamento consulta apenas a soma das compras da fatura e mantém a verificação transacional de revisão.

Histórico e resumos são snapshots consultados ao abrir a tela, concluir uma operação, clicar em Atualizar dados, voltar o foco à janela ou recuperar a conexão. Não possuem uma assinatura global em tempo real: alterações de outro dispositivo aparecem após atualização. Respostas de usuários/filtros anteriores não são exibidas, e erros não são apresentados como totais zerados. A lista e os resumos usam consultas independentes; uma gravação concorrente pode exigir atualizar para sincronizá-los.

| Subcoleção | Campos principais |
| --- | --- |
| accounts | name, type, initialBalance, color, archived |
| categories | name, type, color, icon, archived |
| entries | kind, description, amount, date, dueDate, status, referências, competência, grupo e parcelas |
| cards | name, limit, closingDay, dueDay, color, revision, archived |
| budgets | categoryId, month, amount; ID categoryId_month |
| goals | name, target, current, deadline, archived |
| goalMovements | goalId, amount com sinal, date, notes |
| investments | name, type, institution, invested, current, date, archived |
| snapshots | investmentId, invested, current, date |
| recurrences | description, kind, amount, accountId, categoryId, startDate, endDate, notes, archived |
| importRules | pattern normalizado, match (exact/contains), categoryId, createdAt; ID hash da comparação e descrição |

Tipos de entries: income, expense, transfer, purchase, invoicePayment. Transferências usam accountId/toAccountId; compras usam cardId/invoiceMonth/groupId/installment/installments. Pagamentos usam `invoice_{cardId}_{month}`; ocorrências, `rec_{ruleId}_{month}`.

Regras isolam usuários por UID, validam campos, valores, referências e formatos, impedem exclusão de mestres e exigem atualização atômica de cartões. O cliente valida calendário e cálculos. Regras não agregam coleções: o repositório calcula e serializa o total da fatura. O proprietário controla seus dados; este projeto não é um sistema contábil compartilhado com usuários não confiáveis.

## Emuladores

```powershell
npm run test:rules
npx firebase emulators:start --only auth,firestore --project demo-financeiro
```

A suíte usa somente o projeto local `demo-financeiro`, Firestore em `127.0.0.1:8080`. Testa isolamento, campos, referências, transferências, imutabilidade e operações atômicas.

Para verificar o aplicativo localmente, configure `.env.local` para o emulador: projectId `demo-financeiro`, authDomain `demo-financeiro.firebaseapp.com`, storageBucket `demo-financeiro.firebasestorage.app`, apiKey `demo-local-key`, messagingSenderId `1234567890`, appId `1:1234567890:web:local` e `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`. Execute `npm run dev`. São identificadores locais, sem acesso a produção, e não são inseridos automaticamente.

## Limitações explícitas

- A lista de transações é paginada no Firestore. O dashboard ainda carrega os documentos dos seis meses exibidos, e os históricos de metas/investimentos são carregados ao abrir suas telas; volumes grandes nesses recortes podem exigir uma próxima etapa de agregação/paginação. A busca por substring pode percorrer todo o período filtrado.
- Recorrências são geradas pelo usuário, sem agendador, até 120 ocorrências por regra. Ocorrências podem ser editadas, mas não excluídas. Para mudar próximos valores, pause a regra e crie outra.
- Até 12 parcelas por compra para respeitar limites das regras. Não há edição de compras; exclua/recrie antes de pagar faturas relacionadas.
- Faturas com pagamento integral apenas, sem estorno, pagamento parcial, rotativo, juros ou antecipação.
- Limite de cartão é informativo e não bloqueia registro de compras acima dele.
- Sem fila offline, integração bancária, push, importação JSON ou conta compartilhada. A exclusão de conta exige a página aberta e pode precisar ser retomada após falhas.
- Navegação protegida no cliente; autorização efetiva pelas regras, sem sessão de servidor por cookie.
- Credenciais reais e implantação devem ser verificadas no seu Firebase. Testes locais não significam publicação em produção.

Referências: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [regras](https://firebase.google.com/docs/firestore/security/rules-conditions), [testes locais](https://firebase.google.com/docs/rules/unit-tests).
