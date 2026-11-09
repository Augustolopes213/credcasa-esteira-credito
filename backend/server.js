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
  operacoes: process.env.OPERACOES_API_URL || 'http://localhost:3005'
};

const paths = {
  produtos: process.env.PRODUTOS_API_PATH || '/produtos',
  score: process.env.SCORE_API_PATH || '/api/v1/score/evaluate',
  decisao: process.env.DECISAO_API_PATH || '/api/v1/decisao',
  operacoes: process.env.OPERACOES_API_PATH || '/operacoes'
};

// Aceita tanto URL base (http://host:porta) quanto endpoint completo
// (http://host:porta/api/v1/...). Isso facilita a troca de IP no dia da integração.
function montarEndpoint(base, rota) {
  const b = String(base || '').replace(/\/+$/, '');
  const r = String(rota || '');
  try {
    const u = new URL(b);
    if (u.pathname && u.pathname !== '/') return b;
  } catch {
    // Se não for URL absoluta, mantém a concatenação simples abaixo.
  }
  return `${b}${r.startsWith('/') ? '' : '/'}${r}`;
}

const endpoints = {
  produtos: montarEndpoint(services.produtos, paths.produtos),
  score: montarEndpoint(services.score, paths.score),
  decisao: montarEndpoint(services.decisao, paths.decisao),
  operacoes: montarEndpoint(services.operacoes, paths.operacoes)
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

function numeroValido(valor, { inteiro = false, minimo = 0 } = {}) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < minimo) return false;
  return !inteiro || Number.isInteger(n);
}

function validarEntrada(body) {
  const erros = [];
  if (!body || typeof body !== 'object') return ['corpo JSON é obrigatório'];

  const cliente = body.cliente || {};
  const tipoPessoa = String(cliente.tipoPessoa || 'PF').trim().toUpperCase();

  if (!cliente.nome) erros.push('cliente.nome é obrigatório');
  if (!['PF', 'PJ'].includes(tipoPessoa)) erros.push('cliente.tipoPessoa deve ser PF ou PJ');

  if (tipoPessoa === 'PF') {
    if (!/^\d{11}$/.test(String(cliente.cpf || ''))) erros.push('cliente.cpf deve conter 11 números, sem pontuação');
    if (!numeroValido(cliente.rendaMensal, { minimo: 0.01 })) erros.push('cliente.rendaMensal deve ser maior que zero');
    if (!numeroValido(cliente.dividaTotal)) erros.push('cliente.dividaTotal deve ser um número zero ou maior');
    if (!numeroValido(cliente.idade, { inteiro: true, minimo: 1 })) erros.push('cliente.idade deve ser um inteiro maior que zero');
    if (!String(cliente.estadoCivil || '').trim()) erros.push('cliente.estadoCivil é obrigatório');
    if (!numeroValido(cliente.numeroDependentes, { inteiro: true })) erros.push('cliente.numeroDependentes deve ser um inteiro zero ou maior');
    if (!numeroValido(cliente.diasAtrasoUltimos12Meses, { inteiro: true })) erros.push('cliente.diasAtrasoUltimos12Meses deve ser um inteiro zero ou maior');
    if (!numeroValido(cliente.limiteRotativoUtilizado)) erros.push('cliente.limiteRotativoUtilizado deve ser um número zero ou maior');
    if (!numeroValido(cliente.limiteRotativoTotal)) erros.push('cliente.limiteRotativoTotal deve ser um número zero ou maior');
    if (!numeroValido(cliente.mesesNoEmpregoAtual, { inteiro: true })) erros.push('cliente.mesesNoEmpregoAtual deve ser um inteiro zero ou maior');
    if (!numeroValido(cliente.mesesRelacionamentoBanco, { inteiro: true })) erros.push('cliente.mesesRelacionamentoBanco deve ser um inteiro zero ou maior');
  }

  if (tipoPessoa === 'PJ') {
    if (!/^\d{14}$/.test(String(cliente.cnpj || ''))) erros.push('cliente.cnpj deve conter 14 números, sem pontuação');
    if (!String(cliente.razaoSocial || '').trim()) erros.push('cliente.razaoSocial é obrigatório');
    if (!numeroValido(cliente.faturamentoMensal)) erros.push('cliente.faturamentoMensal deve ser um número zero ou maior');
    if (!numeroValido(cliente.despesasOperacionaisMensais)) erros.push('cliente.despesasOperacionaisMensais deve ser um número zero ou maior');
    if (!numeroValido(cliente.passivoTotalBancario)) erros.push('cliente.passivoTotalBancario deve ser um número zero ou maior');
    if (!numeroValido(cliente.faturamentoBrutoAnual)) erros.push('cliente.faturamentoBrutoAnual deve ser um número zero ou maior');
    if (!numeroValido(cliente.diasAtrasoUltimos12Meses, { inteiro: true })) erros.push('cliente.diasAtrasoUltimos12Meses deve ser um inteiro zero ou maior');
    if (!numeroValido(cliente.mesesConstituicao, { inteiro: true })) erros.push('cliente.mesesConstituicao deve ser um inteiro zero ou maior');
    if (!String(cliente.setorAtuacao || '').trim()) erros.push('cliente.setorAtuacao é obrigatório');
  }

  if (!numeroValido(body?.imovel?.valor, { minimo: 0.01 })) erros.push('imovel.valor deve ser maior que zero');
  if (!numeroValido(body?.imovel?.entrada)) erros.push('imovel.entrada deve ser zero ou maior');
  if (Number(body?.imovel?.entrada) >= Number(body?.imovel?.valor)) erros.push('imovel.entrada deve ser menor que imovel.valor');
  if (!body?.produtoId) erros.push('produtoId é obrigatório');
  if (!numeroValido(body?.prazoMeses, { inteiro: true, minimo: 1 })) erros.push('prazoMeses deve ser um inteiro maior que zero');
  if (body?.dataLiberacao && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.dataLiberacao))) erros.push('dataLiberacao deve estar no formato AAAA-MM-DD');
  if (body?.primeiroRelacionamento !== undefined && typeof body.primeiroRelacionamento !== 'boolean') erros.push('primeiroRelacionamento deve ser true ou false');

  return erros;
}

function montarPayloadScore(entrada, idFinanciamento) {
  const cliente = entrada.cliente || {};
  const tipoPessoa = String(cliente.tipoPessoa || 'PF').trim().toUpperCase();
  const valorFinanciado = Number(entrada.imovel.valor) - Number(entrada.imovel.entrada);

  const payload = {
    tipoPessoa,
    identificador: idFinanciamento,
    valor: valorFinanciado,
    modalidade: 'OUTROS_BENS',
    prazoMeses: Number(entrada.prazoMeses),
    dataLiberacao: entrada.dataLiberacao || new Date().toISOString().slice(0, 10),
    primeiroRelacionamento: entrada.primeiroRelacionamento ?? false
  };

  if (tipoPessoa === 'PF') {
    payload.perfilPF = {
      cpf: String(cliente.cpf),
      rendaMensal: Number(cliente.rendaMensal),
      dividaTotal: Number(cliente.dividaTotal),
      idade: Number(cliente.idade),
      estadoCivil: String(cliente.estadoCivil),
      numeroDependentes: Number(cliente.numeroDependentes),
      diasAtrasoUltimos12Meses: Number(cliente.diasAtrasoUltimos12Meses),
      limiteRotativoUtilizado: Number(cliente.limiteRotativoUtilizado),
      limiteRotativoTotal: Number(cliente.limiteRotativoTotal),
      mesesNoEmpregoAtual: Number(cliente.mesesNoEmpregoAtual),
      mesesRelacionamentoBanco: Number(cliente.mesesRelacionamentoBanco)
    };
  } else {
    payload.perfilPJ = {
      cnpj: String(cliente.cnpj),
      razaoSocial: String(cliente.razaoSocial),
      faturamentoMensal: Number(cliente.faturamentoMensal),
      despesasOperacionaisMensais: Number(cliente.despesasOperacionaisMensais),
      passivoTotalBancario: Number(cliente.passivoTotalBancario),
      faturamentoBrutoAnual: Number(cliente.faturamentoBrutoAnual),
      diasAtrasoUltimos12Meses: Number(cliente.diasAtrasoUltimos12Meses),
      mesesConstituicao: Number(cliente.mesesConstituicao),
      setorAtuacao: String(cliente.setorAtuacao)
    };
  }

  return payload;
}

function normalizarStatusDecisao(decisao) {
  const valor = decisao?.status ?? decisao?.decisao ?? decisao?.resultado;
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
    integracoes: {
      produtos: endpoints.produtos,
      score: endpoints.score,
      decisao: endpoints.decisao,
      operacoes: endpoints.operacoes,
      juros: 'encadeado pela Decisão; CredCasa não chama diretamente'
    },
    regras: {
      modalidadeScore: 'OUTROS_BENS',
      decisao: ['APROVADO', 'REPROVADO', 'ANALISE_MANUAL']
    }
  });
});

app.get('/api/esteira', (_req, res) => {
  res.json({
    ok: true,
    quantidade: pedidos.size,
    pedidos: Array.from(pedidos.values())
  });
});

app.get('/api/esteira/iniciar', (_req, res) => {
  return res.status(405).json({
    ok: false,
    erro: 'Este endpoint aceita POST, não GET.',
    metodo: 'POST',
    endpoint: '/api/esteira/iniciar',
    dica: 'Envie um corpo JSON conforme o contrato do CredCasa.'
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
    scoreSolicitacao: null,
    score: null,
    decisao: null,
    integracaoJuros: null,
    simulacao: null,
    operacao: null,
    etapas: []
  };
  pedidos.set(idFinanciamento, pedido);

  try {
    // 1. Produtos Financeiros
    registrarEtapa(pedido, 'PRODUTOS', 'INICIADA');
    const produtos = await chamarJson(endpoints.produtos, { method: 'GET' });
    pedido.produtos = produtos;
    const listaProdutos = Array.isArray(produtos) ? produtos : (produtos?.produtos || []);
    pedido.produtoEscolhido = listaProdutos.find(p => String(p.id) === String(entrada.produtoId)) || null;
    if (!pedido.produtoEscolhido) {
      pedido.status = 'ERRO_VALIDACAO';
      registrarEtapa(pedido, 'PRODUTOS', 'ERRO', `Produto não encontrado: ${entrada.produtoId}`);
      return res.status(400).json({
        ok: false,
        erro: 'produtoId não foi encontrado no serviço de Produtos.',
        idFinanciamento,
        pedido
      });
    }
    registrarEtapa(pedido, 'PRODUTOS', 'CONCLUIDA');

    // 2. Score — contrato real informado pelo grupo Score
    registrarEtapa(pedido, 'SCORE', 'INICIADA');
    const scorePayload = montarPayloadScore(entrada, idFinanciamento);
    pedido.scoreSolicitacao = scorePayload;

    const score = await chamarJson(endpoints.score, {
      method: 'POST',
      headers: entrada.cenarioTeste ? { 'X-CredCasa-Cenario-Teste': String(entrada.cenarioTeste) } : {},
      body: JSON.stringify(scorePayload)
    });
    pedido.score = score;
    registrarEtapa(pedido, 'SCORE', 'CONCLUIDA');

    // 3. Decisão — recebe EXATAMENTE a resposta do Score, sem envelope nem alteração.
    registrarEtapa(pedido, 'DECISAO', 'INICIADA');
    const decisao = await chamarJson(endpoints.decisao, {
      method: 'POST',
      body: JSON.stringify(score)
    });
    pedido.decisao = decisao;
    pedido.integracaoJuros = decisao?.integracaoJuros ?? null;
    pedido.simulacao = pedido.integracaoJuros;
    registrarEtapa(pedido, 'DECISAO', 'CONCLUIDA');

    const statusDecisao = normalizarStatusDecisao(decisao);

    if (statusDecisao === 'REPROVADO') {
      pedido.status = 'REPROVADO';
      registrarEtapa(
        pedido,
        'ESTEIRA',
        'ENCERRADA',
        'Decisão respondeu REPROVADO. Operações não foram acionadas.'
      );
      return res.json({
        ok: true,
        idFinanciamento,
        status: pedido.status,
        mensagem: 'Financiamento reprovado pela Decisão.',
        pedido
      });
    }

    if (statusDecisao === 'ANALISE_MANUAL') {
      pedido.status = 'PENDENTE_ANALISE_MANUAL';
      registrarEtapa(
        pedido,
        'ESTEIRA',
        'PENDENTE',
        'Decisão solicitou ANÁLISE MANUAL. Operação aguarda revisão.'
      );
      return res.status(202).json({
        ok: true,
        idFinanciamento,
        status: pedido.status,
        mensagem: 'Financiamento pendente de análise manual.',
        pedido
      });
    }

    if (statusDecisao !== 'APROVADO') {
      throw new Error(`Status inesperado retornado pela Decisão: ${statusDecisao || '(vazio)'}`);
    }

    // Juros não é chamado diretamente: a Decisão já realizou essa integração.
    if (!pedido.integracaoJuros) {
      throw new Error('Decisão retornou APROVADO sem o campo integracaoJuros. Operações não serão acionadas.');
    }
    registrarEtapa(
      pedido,
      'SIMULACAO',
      'RECEBIDA_VIA_DECISAO',
      'Resultado de Juros recebido no campo integracaoJuros da Decisão.'
    );

    // 4. Operações Financeiras — somente após APROVADO.
    registrarEtapa(pedido, 'OPERACOES', 'INICIADA');
    const operacao = await chamarJson(endpoints.operacoes, {
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
        integracaoJuros: pedido.integracaoJuros
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
  console.log('Fluxo: Produtos -> Score -> Decisão (que integra Juros) -> Operações');
  console.log(openai ? 'IA configurada.' : 'IA não configurada (não impede a esteira).');
  console.log('');
});
