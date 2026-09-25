import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/produtos', (_req, res) => {
  res.json({
    mock: true,
    produtos: [
      { id: 'IMOVEL-SAC', nome: 'Financiamento Imobiliário SAC', sistema: 'SAC' },
      { id: 'IMOVEL-PRICE', nome: 'Financiamento Imobiliário PRICE', sistema: 'PRICE' }
    ]
  });
});

app.listen(3001, '0.0.0.0', () => console.log('[MOCK Produtos] http://localhost:3001/produtos'));
