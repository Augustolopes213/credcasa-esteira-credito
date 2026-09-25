import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/simulacao', (req, res) => {
  const valor = Number(req.body?.valorFinanciado || 0);
  const prazo = Number(req.body?.prazoMeses || 1);
  const sistema = req.body?.produto?.sistema || 'SAC';
  const taxaMensalPercentual = 0.85;
  const taxa = taxaMensalPercentual / 100;

  let primeiraParcela = null;
  let ultimaParcela = null;

  if (sistema === 'PRICE') {
    const parcela = taxa === 0
      ? valor / prazo
      : valor * (taxa / (1 - Math.pow(1 + taxa, -prazo)));
    primeiraParcela = parcela;
    ultimaParcela = parcela;
  } else {
    const amortizacao = valor / prazo;
    primeiraParcela = amortizacao + valor * taxa;
    ultimaParcela = amortizacao + amortizacao * taxa;
  }

  res.json({
    mock: true,
    sistema,
    taxaMensalPercentual,
    prazoMeses: prazo,
    valorFinanciado: valor,
    parcelas: {
      primeira: Number(primeiraParcela.toFixed(2)),
      ultima: Number(ultimaParcela.toFixed(2))
    },
    observacao: 'Cálculo simulado para teste local; substitua pela API real do grupo Cálculo de Juros.'
  });
});

app.listen(3004, '0.0.0.0', () => console.log('[MOCK Juros] http://localhost:3004/simulacao'));
