import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/score', (req, res) => {
  const cenario = String(req.body?.cenarioTeste || '').toUpperCase();
  const score = cenario === 'NEGADO' ? 420 : 780;
  res.json({
    mock: true,
    score,
    faixa: score >= 700 ? 'ALTO' : 'BAIXO',
    observacao: 'Resposta simulada apenas para teste local.'
  });
});

app.listen(3002, '0.0.0.0', () => console.log('[MOCK Score] http://localhost:3002/score'));
