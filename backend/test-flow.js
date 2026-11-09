const cenario = (process.argv[2] || 'APROVADO').toUpperCase();

const body = {
  cliente: {
    nome: 'Cliente Teste',
    tipoPessoa: 'PF',
    cpf: '12345678900',
    rendaMensal: 15000,
    dividaTotal: 25000,
    idade: 35,
    estadoCivil: 'CASADO',
    numeroDependentes: 1,
    diasAtrasoUltimos12Meses: 0,
    limiteRotativoUtilizado: 1000,
    limiteRotativoTotal: 10000,
    mesesNoEmpregoAtual: 48,
    mesesRelacionamentoBanco: 60
  },
  imovel: { valor: 500000, entrada: 100000 },
  produtoId: 'IMOVEL-SAC',
  prazoMeses: 360,
  dataLiberacao: new Date().toISOString().slice(0, 10),
  primeiroRelacionamento: false,
  cenarioTeste: cenario === 'NEGADO' ? 'NEGADO' : cenario === 'MANUAL' ? 'MANUAL' : 'APROVADO'
};

try {
  const response = await fetch('http://localhost:3000/api/esteira/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.error('Falha no teste:', error.message);
  console.error('Confirme se "npm run local:all" está rodando em outro terminal.');
  process.exit(1);
}
