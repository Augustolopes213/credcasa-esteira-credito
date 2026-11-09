# CredCasa — Contrato atualizado para integração

## API exposta pelo Financiamento

### POST `/api/esteira/iniciar`

Exemplo PF:

```json
{
  "cliente": {
    "nome": "Cliente Teste",
    "tipoPessoa": "PF",
    "cpf": "12345678900",
    "rendaMensal": 15000,
    "dividaTotal": 25000,
    "idade": 35,
    "estadoCivil": "CASADO",
    "numeroDependentes": 1,
    "diasAtrasoUltimos12Meses": 0,
    "limiteRotativoUtilizado": 1000,
    "limiteRotativoTotal": 10000,
    "mesesNoEmpregoAtual": 48,
    "mesesRelacionamentoBanco": 60
  },
  "imovel": {
    "valor": 500000,
    "entrada": 100000
  },
  "produtoId": "IMOVEL-SAC",
  "prazoMeses": 360,
  "dataLiberacao": "2026-11-08",
  "primeiroRelacionamento": false
}
```

O `idFinanciamento` é gerado pelo CredCasa no formato `FIN-...`.

## Chamada do Score

O CredCasa transforma os dados recebidos e chama:

`POST {SCORE_API_URL}/api/v1/score/evaluate`

com `modalidade = OUTROS_BENS` e `valor = valor do imóvel - entrada`.

A resposta é armazenada integralmente em `pedido.score`.

## Fluxo padrão

1. Produtos
2. Score
3. Decisão
4. Simulação/Juros se SIM
5. Operações se SIM

O modo alternativo `SCORE_ENCADEIA_DECISAO_JUROS=true` existe apenas para compatibilidade caso seja confirmado que Score chama Decisão e Decisão chama Juros. Nesse modo o CredCasa para após Score para evitar duplicidade; ainda será necessário definir como os resultados downstream retornam ao Financiamento.

## Configuração

```env
PRODUTOS_API_URL=http://localhost:3001
SCORE_API_URL=http://localhost:3002
SCORE_API_PATH=/api/v1/score/evaluate
DECISAO_API_URL=http://localhost:3003
JUROS_API_URL=http://localhost:3004
OPERACOES_API_URL=http://localhost:3005
SCORE_ENCADEIA_DECISAO_JUROS=false
```
