# CredCasa — Financiamento de Imóvel / Orquestrador

O CredCasa é o microsserviço de Financiamento de Imóvel e orquestra a esteira de crédito por HTTP REST.

## Fluxo atual integrado

```text
Produtos
  ↓
Score
  ↓
Decisão
  ├─ REPROVADO → encerra
  ├─ ANALISE_MANUAL → fica pendente
  └─ APROVADO → Decisão chama Juros e devolve integracaoJuros
                         ↓
                      Operações
                         ↓
                     FINALIZADO
```

O CredCasa não chama Juros diretamente para evitar duplicidade.

## Teste local

```powershell
cd backend
npm.cmd install
npm.cmd run local:all
```

Abra:

`http://localhost:3000/teste-api.html`

A página possui testes para APROVADO, REPROVADO e ANÁLISE MANUAL.

## Integração real na rede da faculdade

Crie `backend/.env` a partir de `.env.example` e ajuste apenas os IPs:

```env
SCORE_API_URL=http://IP_DO_SCORE:8080
DECISAO_API_URL=http://IP_DA_DECISAO:8081
```

Rotas usadas:

- `POST /api/v1/score/evaluate`
- `POST /api/v1/decisao`

Veja `INTEGRACAO_SCORE_REAL.md` para detalhes.
