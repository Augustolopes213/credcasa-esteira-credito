import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/operacoes', (req, res) => {
  res.json({
    mock: true,
    status: 'FINALIZADA',
    protocolo: `OP-${Date.now()}`,
    idFinanciamento: req.body?.idFinanciamento,
    observacao: 'Finalização simulada para teste local.'
  });
});

app.listen(3005, '0.0.0.0', () => console.log('[MOCK Operações] http://localhost:3005/operacoes'));
