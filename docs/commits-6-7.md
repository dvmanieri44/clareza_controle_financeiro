# Commits dos itens 6 e 7

As mudanças foram separadas em dois patches, ambos relativos à raiz do repositório:

1. `artifacts/commits/01-refactor.patch`: telas por funcionalidade e formulários compartilhados, preservando o carregamento anterior.
2. `artifacts/commits/02-pagination.patch`: paginação, consultas por recorte, agregações, índices, regressões e documentação.

Os patches ficam na pasta ignorada `artifacts`. Não criam um histórico Git por conta própria. A criação dos commits neste ambiente foi bloqueada por `Permission denied` em `.git/index.lock`; a tentativa ampliada falhou em `helper_unknown_error`.

## Criar os dois commits

Na raiz do projeto, com o índice sem outras alterações preparadas:

```powershell
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw "Há outras alterações preparadas. Confira git status antes de continuar." }

git apply --cached --check artifacts/commits/01-refactor.patch
if ($LASTEXITCODE -ne 0) { throw "O primeiro patch não corresponde ao índice atual." }
git apply --cached artifacts/commits/01-refactor.patch
if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar a refatoração." }
git commit -m "refactor: separa telas financeiras por funcionalidade"
if ($LASTEXITCODE -ne 0) { throw "O primeiro commit não foi criado." }

git apply --cached --check artifacts/commits/02-pagination.patch
if ($LASTEXITCODE -ne 0) { throw "O segundo patch não corresponde ao índice atual." }
git apply --cached artifacts/commits/02-pagination.patch
if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar a paginação." }
git commit -m "feat: pagina histórico e consulta resumos financeiros no Firestore"
if ($LASTEXITCODE -ne 0) { throw "O segundo commit não foi criado." }
git status --short
git log -2 --oneline
```

`--cached` prepara cada versão no índice sem substituir os arquivos de trabalho, que já contêm a implementação final. Os commits usam a identidade Git configurada pelo usuário e não adicionam coautoria. Não execute um `git add .` entre os dois commits, pois isso juntaria as etapas. Se o histórico/índice mudou desde a preparação, pare e revise os patches.

## Antes da publicação

```powershell
npx firebase deploy --only firestore:indexes --project listademercado-s7j0hh
```

Aguarde a construção dos índices no Firebase. Depois de validar os commits, `git push origin main` aciona o CI e o Pages. Push e publicação não foram executados automaticamente.
