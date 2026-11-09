# Integração real — Score e Decisão

Fluxo alinhado entre os grupos:

1. CredCasa chama Score em `POST /api/v1/score/evaluate`.
2. CredCasa armazena a resposta do Score.
3. CredCasa envia a resposta inteira do Score, sem alteração, para `POST /api/v1/decisao`.
4. A Decisão retorna `APROVADO`, `REPROVADO` ou `ANALISE_MANUAL`.
5. Quando `APROVADO`, a própria Decisão chama Juros e devolve o resultado em `integracaoJuros`.
6. O CredCasa **não chama Juros diretamente**.
7. Quando `APROVADO`, o CredCasa chama Operações com os dados completos e `integracaoJuros`.
8. Quando `REPROVADO`, a esteira encerra.
9. Quando `ANALISE_MANUAL`, a esteira fica `PENDENTE_ANALISE_MANUAL` aguardando revisão.

## URLs configuráveis

No dia do teste, crie/edite `backend/.env`:

```env
SCORE_API_URL=http://IP_DO_SCORE:8080
SCORE_API_PATH=/api/v1/score/evaluate

DECISAO_API_URL=http://IP_DA_DECISAO:8081
DECISAO_API_PATH=/api/v1/decisao
```

Nenhuma alteração de código é necessária para trocar os IPs.

## Score

O CredCasa envia `modalidade=OUTROS_BENS` e `valor` igual ao valor financiado (`valor do imóvel - entrada`).

## Decisão

O corpo enviado para a Decisão é exatamente o JSON retornado pelo Score, sem envelope e sem modificação.

## Render x rede local

O Render não alcança IP privado/localhost da máquina do Score/Decisão na faculdade. Para integração em rede local, rode o CredCasa localmente e configure os IPs das máquinas na mesma rede. Para integração pelo Render, Score e Decisão precisam estar publicados em URLs públicas.
