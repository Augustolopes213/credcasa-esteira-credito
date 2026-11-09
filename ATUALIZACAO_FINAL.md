# Atualização final antes da entrega

Esta versão mantém o backend já validado e corrige a interface principal para usar a esteira real.

## Alterações

- `credit_ui/index.html` agora coleta os campos PF exigidos pelo Score.
- `credit_ui/js/app.js` chama `POST /api/esteira/iniciar` em vez de calcular Score/Decisão/Juros no navegador.
- O resultado da tela principal usa Score, Decisão, `integracaoJuros`, Operações e etapas devolvidos pela API.
- `produtoId` inexistente encerra com erro de validação.
- `APROVADO` sem `integracaoJuros` não segue para Operações.
- `SCORE_API_URL` aceita tanto URL base quanto o endpoint completo fornecido pelo grupo, por exemplo:
  `http://IP-DO-SCORE:8080/api/v1/score/evaluate`.

## No dia da integração

No `backend/.env`, troque `IP-DO-SCORE` pelo IP real da máquina do grupo Score.
A Decisão continua configurável por `DECISAO_API_URL` (porta combinada: 8081).
