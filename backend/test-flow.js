const cenario = (process.argv[2] || 'APROVADO').toUpperCase();

const body = {
  cliente: {
    nome: 'Cliente Teste',
    cpf: '12345678900',
    rendaMensal: 15000
  },
  imovel: {
    valor: 500000,
    entrada: 100000
  },
  produtoId: 'IMOVEL-SAC',
  prazoMeses: 360,
  cenarioTeste: cenario === 'NEGADO' ? 'NEGADO' : 'APROVADO'
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
