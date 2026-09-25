# CredCasa — Orquestrador da Esteira de Crédito

Projeto de teste do grupo **Financiamento de Imóvel**.

O CredCasa é o orquestrador da esteira e chama, nesta ordem:

1. Produtos Financeiros — `GET /produtos`
2. Score — `POST /score`
3. Decisão — `POST /decisao`
4. Cálculo de Juros — `POST /simulacao` (somente se a decisão for SIM)
5. Operações Financeiras — `POST /operacoes` (somente se a decisão for SIM)

## Teste local completo

Abra um terminal na pasta `backend`:

```powershell
npm.cmd install
npm.cmd run local:all
```

Isso inicia:

- CredCasa: `http://localhost:3000`
- Produtos mock: porta `3001`
- Score mock: porta `3002`
- Decisão mock: porta `3003`
- Juros mock: porta `3004`
- Operações mock: porta `3005`

Depois abra no navegador:

`http://localhost:3000/teste-api.html`

Use os botões **Testar cenário SIM** e **Testar cenário NÃO**.

Também é possível testar em um segundo terminal:

```powershell
npm.cmd run test:aprovado
```

ou:

```powershell
npm.cmd run test:negado
```

## Importante

A pasta `backend/mocks` existe **somente para teste local**. Ela simula as APIs dos outros grupos e deve ser substituída pelas URLs reais quando os demais microsserviços estiverem publicados.

Copie `backend/.env.example` para `backend/.env` e troque as URLs quando receber os contratos reais.

Veja `CONTRATO_API_TESTE.md` para o contrato provisório usado no teste.
