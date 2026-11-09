import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

function avaliar(req, res) {
  const body = req.body || {};
  const cenario = String(req.get('X-CredCasa-Cenario-Teste') || '').toUpperCase();

  if (!['PF', 'PJ'].includes(String(body.tipoPessoa || '').toUpperCase())) {
    return res.status(400).json({ erro: 'tipoPessoa deve ser PF ou PJ' });
  }
  if (body.modalidade !== 'OUTROS_BENS') {
    return res.status(400).json({ erro: 'modalidade deve ser OUTROS_BENS' });
  }
  if (!body.identificador || !Number.isFinite(Number(body.valor)) || !Number.isInteger(Number(body.prazoMeses))) {
    return res.status(400).json({ erro: 'identificador, valor e prazoMeses são obrigatórios' });
  }

  const scoreFinal = cenario === 'NEGADO' ? 420 : cenario === 'MANUAL' ? 610 : 780;

  // O retorno preserva os seis campos que precisam seguir para Decisão/Juros.
  res.json({
    scoreFinal,
    faixaRisco: scoreFinal >= 700 ? 'BAIXO_RISCO' : scoreFinal >= 550 ? 'MEDIO_RISCO' : 'ALTO_RISCO',
    probabilidadeDefault: scoreFinal >= 700 ? 0.08 : scoreFinal >= 550 ? 0.28 : 0.67,
    identificador: body.identificador,
    valor: Number(body.valor),
    modalidade: body.modalidade,
    prazoMeses: Number(body.prazoMeses),
    dataLiberacao: body.dataLiberacao,
    primeiroRelacionamento: Boolean(body.primeiroRelacionamento),
    mock: true,
    observacao: 'Resposta simulada no contrato informado pelo grupo Score.'
  });
}

app.post('/api/v1/score/evaluate', avaliar);

app.listen(3002, '0.0.0.0', () => {
  console.log('[MOCK Score] http://localhost:3002/api/v1/score/evaluate');
});
