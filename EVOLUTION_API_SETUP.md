# Evolution API + WhatsApp no Docker

## URLs do ambiente

- Backend dentro do Docker chama a Evolution em `http://evolution:8080`
- Evolution chama o webhook do backend em `http://backend:3000/whatsapp/webhook`
- Voce opera a Evolution pelo host em `http://localhost:8080`

## 1. Preencher o `.env`

Configure pelo menos estas variaveis:

```env
EVOLUTION_API_URL=http://evolution:8080
EVOLUTION_HOST_URL=http://localhost:8080
EVOLUTION_API_KEY=troque-por-uma-chave-forte
EVOLUTION_INSTANCE_NAME=kontavo
EVOLUTION_WEBHOOK_URL=http://backend:3000/whatsapp/webhook
WHATSAPP_WEBHOOK_TOKEN=
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
WHATSAPP_IMAGE_CACHE_TTL_SECONDS=604800
```

Observacoes:

- `EVOLUTION_API_URL` e usada pelo backend dentro da rede Docker
- `EVOLUTION_HOST_URL` e usada pelos scripts rodados da sua maquina
- `EVOLUTION_WEBHOOK_URL` deve continuar apontando para `backend` (a chamada vem de outro container)
- `WHATSAPP_WEBHOOK_TOKEN` e opcional; se preenchido, a Evolution envia o header `x-webhook-token`
- `OPENAI_API_KEY` habilita parsing de imagem no WhatsApp
- `OPENAI_MODEL` deve permanecer `gpt-4o` para esse fluxo
- `WHATSAPP_IMAGE_CACHE_TTL_SECONDS` define TTL do cache Redis por hash da imagem

## 2. Subir o stack

```bash
docker compose up --build
```

Servicos esperados:

- Backend: `http://localhost:3000`
- Evolution API: `http://localhost:8080`
- Postgres app: `localhost:5432`
- Postgres Evolution: `localhost:5434`
- Redis: `localhost:6379`

Importante:

- apos subir/reiniciar o stack, execute `pnpm evolution:webhook:sync`
- em `NODE_ENV=production`, o backend valida `webhook/find` no startup e falha se estiver invalido

## 3. Criar e conectar instancia

```bash
node ./scripts/evolution-api.mjs create-instance
node ./scripts/evolution-api.mjs connect-instance
node ./scripts/evolution-api.mjs connection-state
```

Se preferir, use os atalhos em `package.json`:

```bash
pnpm evolution:instance:create
pnpm evolution:instance:connect
pnpm evolution:instance:state
```

## 4. Configurar webhook da instancia

### Fluxo recomendado (obrigatorio)

```bash
pnpm evolution:webhook:sync
```

Esse comando executa:

1. `set-webhook`
2. `check-webhook` (falha se estiver nulo ou fora do padrao esperado)

### Fluxo manual equivalente

```bash
pnpm evolution:webhook:set
pnpm evolution:webhook:find
pnpm evolution:webhook:check
```

Checklist de sucesso:

- `find-webhook` **nao** retorna `null`
- `url` = `http://backend:3000/whatsapp/webhook`
- `enabled` = `true`
- `events` contem `MESSAGES_UPSERT`

## 5. Requisitos para criar transacao

- O usuario precisa existir no backend
- `User.phone` precisa bater com o numero do WhatsApp (normalizacao remove caracteres nao numericos)

## 6. Mensagens aceitas no parser

Exemplos:

- `gasto 50 pizza`
- `recebi 1000 cliente`
- `gasto 1.000,50 aluguel`
- `recebi 1200.90 projeto`

Imagens:

- ao receber imagem, o backend compacta com `sharp`, usa hash SHA-256 para cache Redis e envia para a OpenAI
- retorno esperado da IA: `amount`, `type`, `description`, `date` (JSON)

## 7. Fluxo esperado ponta a ponta

1. Evolution envia `MESSAGES_UPSERT` para `POST /whatsapp/webhook`
2. Backend salva inbound em `whatsapp_messages`
3. Parser interpreta a mensagem
4. Backend cria `Transaction` com `source = WHATSAPP`
5. Fila BullMQ (`whatsapp-outbound`) envia resposta pela Evolution
6. Backend salva outbound em `whatsapp_messages`

Resposta de sucesso:

- `✅ Gasto de R$50 registrado`
- `✅ Receita de R$1000 registrada`

## 8. Casos de fallback

- Formato invalido:
  - resposta: `⚠️ Nao entendi. Exemplo: "gasto 50 pizza"`
- Usuario nao encontrado por telefone:
  - salva inbound e loga aviso
  - nao cria transacao
  - nao envia resposta
- Limite do plano FREE:
  - resposta: `⚠️ Limite atingido para o seu plano atual.`

## 9. Smoke test rapido do endpoint

```bash
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "MESSAGES_UPSERT",
    "data": {
      "messages": [
        {
          "key": {
            "id": "TEST-MSG-001",
            "remoteJid": "5511999999999@s.whatsapp.net",
            "fromMe": false
          },
          "message": {
            "extendedTextMessage": {
              "text": "gasto 50 pizza"
            }
          }
        }
      ]
    }
  }'
```

Resposta HTTP esperada:

```json
{"received": true}
```

## 10. Troubleshooting

- `find-webhook` retorna `null`:
  - rode `pnpm evolution:webhook:sync`
- webhook nao chega no backend:
  - valide URL `http://backend:3000/whatsapp/webhook`
  - confirme backend saudavel em `GET /health`
- mensagem chega mas nao cria transacao:
  - confirme `User.phone` do usuario
  - confirme formato da mensagem
  - verifique logs do backend
