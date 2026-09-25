# CredCasa — Esteira de Crédito Imobiliário

Versão frontend HTML/CSS/JavaScript com fluxo funcional de financiamento imobiliário.

## Funcionalidades
- Cadastro do cliente e validação de CPF.
- Dados do imóvel e financiamento.
- Cálculo SAC e PRICE.
- Comprometimento de renda.
- Esteira simulada e funcional de Juros → Score → Cadastro → Antifraude → Decisão.
- Decisão: APROVADA, RECUSADA ou ANÁLISE MANUAL.
- Persistência das propostas no LocalStorage.
- Histórico das últimas propostas.
- Exportação da proposta em JSON.
- Configuração das URLs de integração para conectar posteriormente os serviços reais dos times de Juros, Score e Decisão.
- Responsivo e acessível.

## Integração real
O frontend não inventa respostas de serviços externos. Por padrão usa motores locais de demonstração. Para produção, o próximo passo é colocar um backend (por exemplo Java/Spring Boot) entre este frontend e as APIs reais, evitando expor credenciais e endpoints sensíveis no navegador.


### Suporte
O botão **Falar com suporte** abre uma **janela de chat flutuante no canto da tela** (como o "Nova mensagem" do Gmail) em vez de um formulário por e-mail. Ela não bloqueia o resto da página — dá pra continuar navegando, preenchendo a simulação, etc. com o chat aberto. A janela pode ser minimizada (botão "–", ou duplo clique no cabeçalho) ou fechada (botão "×").

O usuário digita a dúvida livremente (ou clica em um dos atalhos sugeridos) e o assistente responde na hora, cobrindo temas como: cálculo SAC/PRICE, documentos necessários, comprometimento de renda, score, motivos de aprovação/recusa/análise manual, login e erros comuns na simulação.

**Dois modos de resposta:**
1. **Modo local (padrão, sem configuração nenhuma):** as respostas vêm de uma base de conhecimento local (`chatKB` em `js/app.js`), que casa palavras-chave da pergunta com a resposta mais adequada. Se nada bater, o assistente explica quais temas sabe responder — ou seja, ele sempre responde algo.
2. **Modo IA real (opcional):** clicando no ícone ⚙ no cabeçalho do chat, o usuário pode colar sua própria chave de API da Anthropic. A partir daí, as perguntas são enviadas para o modelo Claude (via chamada direta do navegador à API, usando o cabeçalho `anthropic-dangerous-direct-browser-access`), com um "system prompt" que descreve o funcionamento da CredCasa — então o bot consegue responder qualquer pergunta, não só as previstas na base local.

A chave de API fica salva **apenas no `localStorage` do próprio navegador** (`credCasaAnthropicKey`) e nunca é enviada a nenhum servidor além da própria Anthropic. Isso é aceitável para uso pessoal/demonstração, mas **não é uma prática recomendada para produção**: uma chave exposta no navegador pode ser vista por qualquer pessoa com acesso ao DevTools do navegador. Em produção, o ideal é ter um backend que guarde a chave em segredo e faça a chamada por trás, expondo só um endpoint próprio para o frontend.

O histórico da conversa é salvo em `localStorage` (`credCasaChatHistory`), só para fins de demonstração.
