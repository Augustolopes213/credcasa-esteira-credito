import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scripts = [
  ['Produtos', 'mocks/produtos.js'],
  ['Score', 'mocks/score.js'],
  ['Decisão', 'mocks/decisao.js'],
  ['Juros', 'mocks/juros.js'],
  ['Operações', 'mocks/operacoes.js'],
  ['CredCasa', 'server.js']
];

const children = scripts.map(([nome, script]) => {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', code => {
    if (code && code !== 0) console.error(`[${nome}] encerrou com código ${code}`);
  });
  return child;
});

function encerrar() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
