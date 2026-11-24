# 日本語 — app de estudo de japonês

App web pessoal para revisar as aulas de japonês no celular, inclusive sem internet. HTML, CSS e JavaScript puro, sem build.

## Instalar no celular

1. Abra o endereço do app no celular (Safari no iPhone, Chrome no Android).
2. iPhone: botão Compartilhar › **Adicionar à Tela de Início**. Android: menu ⋮ › **Instalar app**.
3. Abra o app uma vez com internet. Depois ele funciona offline.

Para ouvir o áudio, o aparelho precisa de uma voz japonesa instalada (o app explica como, se faltar). É a voz sintética do aparelho, não a de um falante nativo.

## Adicionar uma aula nova

Cada aula é um arquivo `data/aulas/aula-NN.json` (formato 1).

**Pelo repositório (fica em todos os aparelhos):**

1. Salve o arquivo em `data/aulas/`, por exemplo `aula-02.json`.
2. Acrescente o nome dele em `data/aulas/index.json`: `["aula-01.json", "aula-02.json"]`.
3. Faça commit e push. Em 1 ou 2 minutos o GitHub Pages atualiza; abra o app com internet para ele baixar a aula.

**Pelo app (só neste aparelho):** Ajustes › Importar aula › escolha o arquivo ou cole o JSON.

Se a mesma aula existir no repositório e importada, vale a do repositório. O progresso fica ligado ao `id` de cada item, então corrigir ou reimportar uma aula não apaga o histórico.

## Backup

Ajustes › Exportar progresso gera um arquivo `.json`. Guarde em algum lugar seguro (iCloud, Drive). O app lembra de exportar a cada 2 semanas.

## Para quem for editar o código

- `js/data.js`: carrega e valida as aulas, monta os cards, acha as partículas das frases.
- `js/srs.js`: repetição espaçada (SM-2 com etapas de aprendizado).
- `js/review.js`: sessão de revisão. `js/views.js` e `js/browse.js`: demais telas.
- `sw.js`: cache offline. **Ao mudar arquivos do app, aumente `VERSION`** para os celulares pegarem a versão nova.
- Para testar localmente: `python3 -m http.server 8765` e abra `http://localhost:8765`.
