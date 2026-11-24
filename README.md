# MyGamesDiary

API REST local em NestJS para registrar jogos, acompanhar progresso e montar coleções. Sem DATABASE_URL, o SQLite fica em `data/my-games-diary.sqlite` por padrão. O arquivo e as tabelas são criados na primeira inicialização.

## Como executar

Requer Node.js 24 ou superior e npm. No PowerShell, a partir da pasta do projeto:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

A base da API é `http://127.0.0.1:3000/api`. As variáveis opcionais `PORT`, `DB_PATH` e `CORS_ORIGIN` configuram a porta, o arquivo SQLite e a origem exata do frontend, respectivamente. Para um frontend em Vite local, por exemplo, defina `$env:CORS_ORIGIN = 'http://localhost:5173'` antes de iniciar a API.

## Jogos

| Método e caminho | Entrada | Sucesso |
| --- | --- | --- |
| `POST /games` | JSON com `name` e os campos do formulário descritos abaixo | 201, jogo criado |
| `GET /games` | Query opcional com `search`, `status`, `favorite=true` ou `favorite=false` | 200, array |
| `GET /games/:id` | UUID do jogo | 200, detalhes do jogo |
| `PATCH /games/:id` | JSON com pelo menos um dos campos aceitos na criação | 200, jogo atualizado |
| `DELETE /games/:id` | UUID do jogo | 204, jogo excluído e vínculos removidos |

```json
{ "name": "Hades", "status": "playing", "progress": 40, "favorite": true }
```

`playing` é o estado padrão. `played` indica que você já jogou o título e ainda não o finalizou. `completed` indica finalização e tem progresso de 100%. Informar 100% também finaliza um jogo em `playing` ou `played`. A resposta inclui `completed` como booleano calculado a partir do estado. Para reabrir um jogo finalizado, envie `status: "playing"` ou `status: "played"`, com um progresso opcional entre 0 e 99.

## Wishlist

| Método e caminho | Entrada | Sucesso |
| --- | --- | --- |
| `POST /wishlist` | JSON com `name` e os campos de detalhes, com status fixo e progresso zero | 201, jogo cadastrado com status `wishlist` |
| `GET /wishlist` | Query `search` opcional | 200, array |
| `PUT /wishlist/:id` | UUID de um jogo cadastrado | 200, jogo movido para a wishlist com progresso zerado |
| `DELETE /wishlist/:id` | UUID de um jogo na wishlist | 204, jogo movido para `playing` com progresso de 0% |

Jogos da wishlist também aparecem em `GET /games`. Para começar um jogo da wishlist com progresso já registrado, envie `{"status":"playing","progress":10}` em `PATCH /games/:id`.

## Listas personalizadas

| Método e caminho | Entrada | Sucesso |
| --- | --- | --- |
| `POST /lists` | JSON com `name` | 201, lista criada |
| `GET /lists` | Query `search` opcional | 200, array de listas |
| `GET /lists/:id` | UUID da lista | 200, dados da lista |
| `PATCH /lists/:id` | JSON com o novo `name` | 200, lista atualizada |
| `DELETE /lists/:id` | UUID da lista | 204, lista e seus vínculos removidos |
| `GET /lists/:id/games` | Query `search` opcional | 200, array de jogos da lista |
| `POST /lists/:id/games/:gameId` | UUIDs da lista e do jogo | 201, jogo vinculado |
| `DELETE /lists/:id/games/:gameId` | UUIDs da lista e do jogo | 204, vínculo removido |

Um jogo pode pertencer a várias listas. A busca funciona por trecho do nome e ignora acentos e diferenças entre maiúsculas e minúsculas.

## Validação e erros

Nomes têm de 1 a 150 caracteres após remover espaços nas pontas. Progresso aceita números inteiros de 0 a 100. Os DTOs rejeitam campos extras, tipos incorretos e valores nulos em campos obrigatórios. As rotas com ID validam UUID v4.

| HTTP | Quando ocorre |
| --- | --- |
| 400 | Corpo, query ou UUID inválidos, ou progresso incompatível com o estado |
| 404 | Jogo, lista, vínculo ou rota ausente |
| 409 | O jogo já pertence à lista ou houve conflito de atualização |
| 413 | Capa acima de 5 MB |
| 415 | Formato de capa diferente de JPG, PNG ou WebP |
| 500 | Erro inesperado com detalhes registrados no console do servidor |

```json
{ "statusCode": 404, "error": "Not Found", "message": "Jogo não encontrado." }
```

`message` contém uma string ou um array de mensagens de validação.

## Arquitetura e testes

Em `src/games` e `src/lists`, os controllers recebem as requisições, os services implementam as regras de negócio e os models descrevem os dados do domínio. Os DTOs descrevem as entradas e as representações JSON fazem o papel de View na API. A persistência está em `src/database.ts`.

```powershell
npm.cmd test
```

Os testes dos services usam SQLite em memória. Um teste adicional executa o esquema e as consultas em PostgreSQL via PGlite. Referências oficiais do NestJS: [documentação](https://docs.nestjs.com/), [validação](https://docs.nestjs.com/techniques/validation) e [testes](https://docs.nestjs.com/fundamentals/testing).

## Campos do formulário

```json
{
  "name": "Hollow Knight",
  "platform": "PC",
  "genre": "Metroidvania",
  "status": "playing",
  "progress": 35,
  "rating": 4,
  "imageUrl": "https://example.com/capa.jpg",
  "notes": "Voltar à Cidade das Lágrimas",
  "favorite": true
}
```

- `name` é obrigatório. `platform` recebe o texto da plataforma selecionada e usa `PC` por padrão, inclusive para dados antigos.
- Os botões **Quero jogar**, **Jogando** e **Concluído** correspondem a `wishlist`, `playing` e `completed`. Envie 0% na wishlist e 100% para um jogo concluído, ou omita `progress` nesses dois casos. A API também aceita `played` para jogos já iniciados e ainda não concluídos.
- `rating` é um inteiro de 1 a 5. Para **Sem nota**, envie `null` ou omita o campo. `genre`, `imageUrl` e `notes` também aceitam `null`. Em um PATCH, enviar `null` limpa o campo e omitir mantém o valor atual.
- Para **Colar link**, envie a URL HTTP ou HTTPS em `imageUrl`. O cliente carrega a capa diretamente dessa URL.
- Para **Enviar arquivo**, cadastre o jogo para obter o ID e depois envie `PUT /api/games/:id/cover` com `multipart/form-data` e um arquivo no campo `file`. A API aceita JPG, PNG e WebP de até 5 MB e retorna o jogo com `imageUrl` relativo à origem da API. O frontend pode resolver o endereço com `new URL(game.imageUrl, apiBaseUrl)` quando houver capa. Se o upload falhar, use o ID criado para reenviar o arquivo.
- O upload substitui a capa anterior. Um PATCH com `imageUrl` troca a capa por um link ou remove a capa quando recebe `null`. Imagens enviadas por arquivo ficam no próprio banco e são excluídas junto com o jogo.

## Usar seu projeto Supabase

1. No Dashboard do seu projeto, escolha **Connect → Session pooler** e copie a URI. Substitua o marcador pela senha do banco e codifique caracteres reservados da senha para uso em URL. [Documentação do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. Copie `.env.example` para `.env` na raiz deste backend e preencha `DATABASE_URL`. A URI é uma credencial do servidor. Mantenha o arquivo fora do Git e do frontend.
3. Com o servidor parado, execute:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run db:setup
npm.cmd run db:import
npm.cmd start
```

`db:setup` cria as tabelas no esquema privado `my_games_diary`. O passo `db:import` é opcional e requer o arquivo SQLite existente. Ele copia jogos, capas, listas e vínculos em uma transação, mantendo os IDs, o arquivo de origem e os registros que já existem no destino. Sem `DATABASE_URL`, a API continua usando SQLite. A API é de uso local e continua ligada a `127.0.0.1`; conectar o banco ao Supabase não adiciona login ao diário.

## Deploy no Railway

Use Node.js 24 ou superior, `npm run build` para compilar e `npm start` para iniciar. O servidor usa o `PORT` do Railway e escuta em `0.0.0.0` quando `RAILWAY_ENVIRONMENT_ID` está presente. Fora do Railway ele escuta em `127.0.0.1`.

Em **Variables**, configure `DATABASE_URL` com a URI PostgreSQL do Supabase. O deploy exige essa variável para evitar gravar no SQLite do contêiner. Se o frontend estiver em outro domínio, configure `CORS_ORIGIN` com a origem exata dele. Para verificar a API, use `GET /api/games`.
