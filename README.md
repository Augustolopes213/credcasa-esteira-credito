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
SCORE_API_URL=http://IP-DO-SCORE:8080/api/v1/score/evaluate
DECISAO_API_URL=http://IP-DA-DECISAO:8081
```

Rotas usadas:

- Score: `POST http://IP-DO-SCORE:8080/api/v1/score/evaluate` (troque apenas `IP-DO-SCORE` pelo IP real). O CredCasa aceita essa URL completa diretamente em `SCORE_API_URL`.
- Decisão: `POST /api/v1/decisao` (porta combinada: 8081).

Veja `INTEGRACAO_SCORE_REAL.md` para detalhes.


## Interface principal integrada

A página `credit_ui/index.html` chama `POST /api/esteira/iniciar` diretamente. O formulário coleta os campos PF exigidos pelo contrato de Score e exibe o retorno real da esteira (Score, Decisão, `integracaoJuros`, Operações e etapas). As URLs de serviços externos não são configuradas no navegador; ficam no backend por variáveis de ambiente.
