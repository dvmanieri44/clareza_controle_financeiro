# Clareza · Organizador Financeiro

Aplicativo pessoal em português brasileiro: Next.js App Router, TypeScript, Tailwind CSS, componentes locais no padrão shadcn/ui (Radix + CVA), Lucide, Firebase Auth/Firestore, React Hook Form, Zod, Recharts e date-fns. Dados financeiros vêm do Firestore, sem movimentações fictícias.

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
npm run build
npm start
npm run test:rules
```

`npm run check` reúne lint, tipos, testes unitários e build.

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

   Também pode publicar `firestore.rules` pela aba Regras do console. Não são necessários índices compostos nesta versão; `firestore.indexes.json` é intencionalmente vazio.
6. Reinicie, crie sua conta e cadastre uma conta financeira. O primeiro login cria somente categorias padrão e o perfil, sem valores fictícios.
7. Registre receita/despesa, recarregue e confirme a persistência. Confira o e-mail de recuperação de senha.

Não depende de Functions, Storage, integração bancária ou APIs de cotação. Confira as cotas do seu Firebase. Hospedagem não é provisionada: execute localmente ou em host Next.js/Node.

## Funcionalidades implementadas

- Autenticação completa com sessão persistida, recuperação de senha e rotas protegidas.
- Dashboard com seis indicadores, três gráficos, últimas transações, vencimentos, metas e alertas.
- CRUD de transações, confirmação de pendências, notas, vencimentos, busca, ordenação e filtros por mês, intervalo, tipo, categoria e conta.
- Contas com tipo/cor/saldo inicial e transferências atômicas sem gerar receita ou despesa.
- Cartões, compras em até **12 parcelas**, faturas por competência, pagamento integral sem duplicar despesas e exclusão de compras cujas faturas ainda não foram pagas.
- Orçamentos mensais por categoria, progresso e alertas de 80% e 100%.
- Metas, aportes, retiradas e histórico transacional.
- Investimentos manuais com resultado nominal e histórico de atualizações.
- Categorias com ícones/cores; arquivamento e restauração de registros mestres para preservar referências.
- Recorrências mensais com início/fim, pausa e geração explícita sem duplicação.
- Tema claro/escuro, layout responsivo, estados vazios, erros e exportação JSON.

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
src/features/        autenticação, dashboard e módulos
src/lib/domain/      tipos, schemas Zod e cálculos puros
src/lib/firebase/    inicialização e repositório transacional
tests/               regras financeiras e de segurança
```

Todo dado fica sob `users/{uid}`. O perfil possui createdAt/version. Todos os documentos incluem createdAt.

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

- Coleções pessoais são carregadas em tempo real e filtradas no navegador. Históricos grandes exigirão paginação.
- Recorrências são geradas pelo usuário, sem agendador, até 120 ocorrências por regra. Ocorrências podem ser editadas, mas não excluídas. Para mudar próximos valores, pause a regra e crie outra.
- Até 12 parcelas por compra para respeitar limites das regras. Não há edição de compras; exclua/recrie antes de pagar faturas relacionadas.
- Faturas com pagamento integral apenas, sem estorno, pagamento parcial, rotativo, juros ou antecipação.
- Limite de cartão é informativo e não bloqueia registro de compras acima dele.
- Sem fila offline, integração bancária, push, importação JSON, conta compartilhada ou exclusão completa de conta pela interface.
- Navegação protegida no cliente; autorização efetiva pelas regras, sem sessão de servidor por cookie.
- Credenciais reais e implantação devem ser verificadas no seu Firebase. Testes locais não significam publicação em produção.

Referências: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions), [regras](https://firebase.google.com/docs/firestore/security/rules-conditions), [testes locais](https://firebase.google.com/docs/rules/unit-tests).
