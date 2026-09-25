import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/decisao', (req, res) => {
  const cenario = String(req.body?.cenarioTeste || '').toUpperCase();
  const decisao = cenario === 'NEGADO' ? 'NÃO' : 'SIM';
  res.json({
    mock: true,
    decisao,
    motivo: decisao === 'SIM'
      ? 'Aprovado pelo serviço simulado para teste.'
      : 'Negado pelo serviço simulado para testar o encerramento da esteira.'
  });
});

app.listen(3003, '0.0.0.0', () => console.log('[MOCK Decisão] http://localhost:3003/decisao'));
