import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/simulacao', (req, res) => {
  const valor = Number(req.body?.valor || 0);
  const prazo = Number(req.body?.prazoMeses || 1);
  const taxaMensalPercentual = 0.85;
  const taxa = taxaMensalPercentual / 100;
  const amortizacao = valor / prazo;
  const primeiraParcela = amortizacao + valor * taxa;
  const ultimaParcela = amortizacao + amortizacao * taxa;

  res.json({
    mock: true,
    origem: 'JUROS_VIA_DECISAO',
    taxaMensalPercentual,
    prazoMeses: prazo,
    valorFinanciado: valor,
    parcelas: {
      primeira: Number(primeiraParcela.toFixed(2)),
      ultima: Number(ultimaParcela.toFixed(2))
    },
    observacao: 'Mock de Juros chamado pela Decisão; o CredCasa não chama Juros diretamente.'
  });
});

app.listen(3004, '0.0.0.0', () => console.log('[MOCK Juros] http://localhost:3004/simulacao (chamado pela Decisão)'));
