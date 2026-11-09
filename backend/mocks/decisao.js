import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

async function chamarJuros(score) {
  const response = await fetch('http://localhost:3004/simulacao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(score)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Mock Juros retornou HTTP ${response.status}`);
  return data;
}

app.post('/api/v1/decisao', async (req, res) => {
  try {
    const score = req.body || {};
    const scoreFinal = Number(score.scoreFinal);

    let status;
    if (scoreFinal >= 700) status = 'APROVADO';
    else if (scoreFinal >= 550) status = 'ANALISE_MANUAL';
    else status = 'REPROVADO';

    if (status === 'APROVADO') {
      const integracaoJuros = await chamarJuros(score);
      return res.json({
        status,
        motivo: 'Aprovado pelo serviço simulado.',
        integracaoJuros,
        mock: true
      });
    }

    return res.json({
      status,
      motivo: status === 'ANALISE_MANUAL'
        ? 'Encaminhado para revisão manual pelo serviço simulado.'
        : 'Reprovado pelo serviço simulado.',
      integracaoJuros: null,
      mock: true
    });
  } catch (error) {
    return res.status(502).json({ erro: error.message });
  }
});

app.listen(3003, '0.0.0.0', () => {
  console.log('[MOCK Decisão] http://localhost:3003/api/v1/decisao');
});
