import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const services = {
  produtos: process.env.PRODUTOS_API_URL || 'http://localhost:3001',
  score: process.env.SCORE_API_URL || 'http://localhost:3002',
  decisao: process.env.DECISAO_API_URL || 'http://localhost:3003',
  juros: process.env.JUROS_API_URL || 'http://localhost:3004',
  operacoes: process.env.OPERACOES_API_URL || 'http://localhost:3005'
};

const pedidos = new Map();

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, '..', 'credit_ui')));

const instructions = `Você é o Assistente CredCasa, um chatbot de suporte de um projeto acadêmico de financiamento imobiliário.
Responda em português do Brasil, de forma clara, educada e curta, como um atendente de suporte.
Você pode explicar conceitos de financiamento, entrada, valor financiado, juros, SAC, PRICE, prazo, comprometimento de renda, documentação e funcionamento da simulação.
Não invente taxas, regras bancárias, aprovação, valores ou documentos específicos quando eles não estiverem no contexto. Quando uma informação depender do banco ou contrato, diga que pode variar e recomende conferir as condições oficiais.
Não diga que é humano. Não peça senha, token, chave de API ou dados bancários.
Quando o usuário fornecer dados da simulação no contexto, use-os para explicar cálculos, mas deixe claro quando um valor for apenas estimativo.
Se a pergunta não tiver relação com o CredCasa, responda brevemente e ofereça ajuda com o financiamento.`;

function novoId() {
  return `FIN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function registrarEtapa(pedido, etapa, status, detalhe = null) {
  pedido.etapas.push({
    etapa,
    status,
    detalhe,
    em: new Date().toISOString()
  });
  pedido.atualizadoEm = new Date().toISOString();
}

async function chamarJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 8000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status} ao chamar ${url}`);
      err.status = response.status;
      err.remoteBody = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function validarEntrada(body) {
  const erros = [];
  if (!body || typeof body !== 'object') erros.push('corpo JSON é obrigatório');
  if (!body?.cliente?.nome) erros.push('cliente.nome é obrigatório');
  if (!body?.cliente?.cpf) erros.push('cliente.cpf é obrigatório');
  if (!Number.isFinite(Number(body?.cliente?.rendaMensal)) || Number(body?.cliente?.rendaMensal) <= 0) {
    erros.push('cliente.rendaMensal deve ser maior que zero');
  }
  if (!Number.isFinite(Number(body?.imovel?.valor)) || Number(body?.imovel?.valor) <= 0) {
    erros.push('imovel.valor deve ser maior que zero');
  }
  if (!Number.isFinite(Number(body?.imovel?.entrada)) || Number(body?.imovel?.entrada) < 0) {
    erros.push('imovel.entrada deve ser zero ou maior');
  }
  if (Number(body?.imovel?.entrada) >= Number(body?.imovel?.valor)) {
    erros.push('imovel.entrada deve ser menor que imovel.valor');
  }
  if (!body?.produtoId) erros.push('produtoId é obrigatório');
  if (!Number.isInteger(Number(body?.prazoMeses)) || Number(body?.prazoMeses) <= 0) {
    erros.push('prazoMeses deve ser um inteiro maior que zero');
  }
  return erros;
}

function normalizarDecisao(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    servico: 'Financiamento de Imóvel - Orquestrador',
    aiConfigured: Boolean(openai),
    integracoes: services
  });
});

app.get('/api/esteira', (_req, res) => {
  res.json({
    ok: true,
    quantidade: pedidos.size,
    pedidos: Array.from(pedidos.values())
  });
});

app.get('/api/esteira/:id', (req, res) => {
  const pedido = pedidos.get(req.params.id);
  if (!pedido) {
    return res.status(404).json({ ok: false, erro: 'Financiamento não encontrado.' });
  }
  res.json({ ok: true, pedido });
});

app.post('/api/esteira/iniciar', async (req, res) => {
  const erros = validarEntrada(req.body);
  if (erros.length) {
    return res.status(400).json({ ok: false, erro: 'Dados inválidos.', detalhes: erros });
  }

  const idFinanciamento = novoId();
  const entrada = req.body;
  const pedido = {
    idFinanciamento,
    status: 'EM_ANDAMENTO',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    entrada,
    produtos: null,
    produtoEscolhido: null,
    score: null,
    decisao: null,
    simulacao: null,
    operacao: null,
    etapas: []
  };
  pedidos.set(idFinanciamento, pedido);

  try {
    // 1. Produtos Financeiros
    registrarEtapa(pedido, 'PRODUTOS', 'INICIADA');
    const produtos = await chamarJson(`${services.produtos}/produtos`, { method: 'GET' });
    pedido.produtos = produtos;
    const listaProdutos = Array.isArray(produtos) ? produtos : (produtos?.produtos || []);
    pedido.produtoEscolhido = listaProdutos.find(p => String(p.id) === String(entrada.produtoId)) || null;
    registrarEtapa(pedido, 'PRODUTOS', 'CONCLUIDA');

    // 2. Score
    registrarEtapa(pedido, 'SCORE', 'INICIADA');
    const score = await chamarJson(`${services.score}/score`, {
      method: 'POST',
      body: JSON.stringify({
        idFinanciamento,
        cliente: entrada.cliente,
        imovel: entrada.imovel,
        produtoId: entrada.produtoId,
        prazoMeses: entrada.prazoMeses,
        cenarioTeste: entrada.cenarioTeste
      })
    });
    pedido.score = score;
    registrarEtapa(pedido, 'SCORE', 'CONCLUIDA');

    // 3. Decisão
    registrarEtapa(pedido, 'DECISAO', 'INICIADA');
    const decisao = await chamarJson(`${services.decisao}/decisao`, {
      method: 'POST',
      body: JSON.stringify({
        idFinanciamento,
        cliente: entrada.cliente,
        imovel: entrada.imovel,
        produtoId: entrada.produtoId,
        prazoMeses: entrada.prazoMeses,
        score,
        cenarioTeste: entrada.cenarioTeste
      })
    });
    pedido.decisao = decisao;
    registrarEtapa(pedido, 'DECISAO', 'CONCLUIDA');

    const respostaDecisao = normalizarDecisao(decisao?.decisao ?? decisao?.resultado);
    if (respostaDecisao !== 'SIM') {
      pedido.status = 'ENCERRADO_DECISAO_NAO';
      registrarEtapa(pedido, 'ESTEIRA', 'ENCERRADA', 'Decisão respondeu NÃO. Simulação e Operações não foram acionadas.');
      return res.json({
        ok: true,
        idFinanciamento,
        status: pedido.status,
        mensagem: 'Esteira encerrada após a decisão.',
        pedido
      });
    }

    // 4. Cálculo de Juros / Simulação
    registrarEtapa(pedido, 'SIMULACAO', 'INICIADA');
    const simulacao = await chamarJson(`${services.juros}/simulacao`, {
      method: 'POST',
      body: JSON.stringify({
        idFinanciamento,
        cliente: entrada.cliente,
        produtoId: entrada.produtoId,
        produto: pedido.produtoEscolhido,
        valorImovel: Number(entrada.imovel.valor),
        entrada: Number(entrada.imovel.entrada),
        valorFinanciado: Number(entrada.imovel.valor) - Number(entrada.imovel.entrada),
        prazoMeses: Number(entrada.prazoMeses),
        score,
        decisao
      })
    });
    pedido.simulacao = simulacao;
    registrarEtapa(pedido, 'SIMULACAO', 'CONCLUIDA');

    // 5. Operações Financeiras
    registrarEtapa(pedido, 'OPERACOES', 'INICIADA');
    const operacao = await chamarJson(`${services.operacoes}/operacoes`, {
      method: 'POST',
      body: JSON.stringify({
        idFinanciamento,
        cliente: entrada.cliente,
        imovel: entrada.imovel,
        produtoId: entrada.produtoId,
        produto: pedido.produtoEscolhido,
        prazoMeses: entrada.prazoMeses,
        score,
        decisao,
        simulacao
      })
    });
    pedido.operacao = operacao;
    pedido.status = 'FINALIZADO';
    registrarEtapa(pedido, 'OPERACOES', 'CONCLUIDA');
    registrarEtapa(pedido, 'ESTEIRA', 'FINALIZADA');

    return res.json({
      ok: true,
      idFinanciamento,
      status: pedido.status,
      mensagem: 'Esteira finalizada com sucesso.',
      pedido
    });
  } catch (error) {
    pedido.status = 'ERRO_INTEGRACAO';
    registrarEtapa(pedido, 'ESTEIRA', 'ERRO', error.message);
    console.error('Erro na esteira:', error);
    return res.status(502).json({
      ok: false,
      idFinanciamento,
      status: pedido.status,
      erro: 'Falha ao chamar um dos microsserviços da esteira.',
      detalhe: error.message,
      retornoRemoto: error.remoteBody || null,
      pedido
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'OPENAI_API_KEY não configurada no backend.' });
    }

    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Pergunta vazia.' });

    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
    const context = req.body?.context || {};
    const contextText = `Contexto atual do site (pode estar vazio):\n${JSON.stringify(context).slice(0, 8000)}`;
    const input = [
      { role: 'developer', content: instructions },
      { role: 'developer', content: contextText },
      ...history.filter(m => ['user', 'assistant'].includes(m?.role)).map(m => ({
        role: m.role,
        content: String(m.content || '').slice(0, 3000)
      })),
      { role: 'user', content: question.slice(0, 4000) }
    ];

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      input,
      max_output_tokens: 500
    });

    res.json({ answer: response.output_text || 'Não consegui gerar uma resposta agora.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível consultar a IA agora.' });
  }
});

app.get('*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'credit_ui', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log(`CredCasa / Orquestrador: http://localhost:${port}`);
  console.log(`POST http://localhost:${port}/api/esteira/iniciar`);
  console.log(`GET  http://localhost:${port}/api/esteira`);
  console.log(`GET  http://localhost:${port}/api/health`);
  console.log(`Página de teste: http://localhost:${port}/teste-api.html`);
  console.log(openai ? 'IA configurada.' : 'IA não configurada (não impede a esteira).');
  console.log('');
});
