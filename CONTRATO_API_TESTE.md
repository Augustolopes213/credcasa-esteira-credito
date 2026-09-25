# CredCasa — Contrato de teste da esteira

> Este contrato é **provisório para teste local**. O material da disciplina define as rotas e a ordem, mas não fornece o JSON exato de cada grupo. Quando cada grupo publicar seu contrato real, ajuste os corpos enviados e as URLs no `.env`.

## API exposta pelo grupo Financiamento de Imóvel

### POST `/api/esteira/iniciar`

Entrada de teste:

```json
{
  "cliente": {
    "nome": "Cliente Teste",
    "cpf": "12345678900",
    "rendaMensal": 15000
  },
  "imovel": {
    "valor": 500000,
    "entrada": 100000
  },
  "produtoId": "IMOVEL-SAC",
  "prazoMeses": 360
}
```

Para o ambiente local de mocks, pode ser usado `"cenarioTeste": "NEGADO"` apenas para validar o encerramento na etapa 3. Esse campo não faz parte do contrato final.

## Ordem executada pelo orquestrador

1. `GET {PRODUTOS_API_URL}/produtos`
2. `POST {SCORE_API_URL}/score`
3. `POST {DECISAO_API_URL}/decisao`
4. Se a decisão for `SIM`: `POST {JUROS_API_URL}/simulacao`
5. Se a decisão for `SIM`: `POST {OPERACOES_API_URL}/operacoes`

Se a Decisão responder `NÃO`, o orquestrador encerra a esteira e não chama as etapas 4 e 5.

## Estado do pedido

O CredCasa armazena em memória, durante o teste:

- produtos retornados;
- score;
- decisão;
- simulação, quando houver;
- resposta de operações, quando houver;
- histórico de etapas.

Consultas:

- `GET /api/esteira`
- `GET /api/esteira/:id`

## URLs dos serviços

Defina em `backend/.env`:

```env
PRODUTOS_API_URL=http://localhost:3001
SCORE_API_URL=http://localhost:3002
DECISAO_API_URL=http://localhost:3003
JUROS_API_URL=http://localhost:3004
OPERACOES_API_URL=http://localhost:3005
```

No ambiente real, troque cada URL pela publicada pelo grupo correspondente.
