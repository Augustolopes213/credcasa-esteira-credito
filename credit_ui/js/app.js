'use strict';
const $ = id => document.getElementById(id);
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const state = { page:1, proposal:null, user: JSON.parse(sessionStorage.getItem('credCasaSession')||'null') };
function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove('show'),3000); }
function cpfValid(v){const c=String(v).replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;let s=0;for(let i=0;i<9;i++)s+=+c[i]*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==+c[9])return false;s=0;for(let i=0;i<10;i++)s+=+c[i]*(11-i);d=(s*10)%11;if(d===10)d=0;return d===+c[10]}
function setPage(n){state.page=n;document.querySelectorAll('.form-step').forEach(x=>x.classList.toggle('active',+x.dataset.page===n));document.querySelectorAll('.pstep').forEach((x,i)=>x.classList.toggle('active',i<n));$('simulador').scrollIntoView({behavior:'smooth',block:'start'});}
function validate(n){
 if(n===1){
  const nums=['renda','dividaTotal','numeroDependentes','diasAtraso','limiteUtilizado','limiteTotal','mesesEmprego','mesesBanco'];
  if(!$('nome').value.trim()||!cpfValid($('cpf').value)||!$('nascimento').value||idadePorNascimento($('nascimento').value)<=0||nums.some(id=>!Number.isFinite(Number($(id).value))||Number($(id).value)<0)||+$('renda').value<=0){toast('Confira os dados do cliente e os campos exigidos pelo Score.');return false;}
  if(+$('limiteUtilizado').value>+$('limiteTotal').value&&+$('limiteTotal').value>0){toast('O limite utilizado não pode ser maior que o limite total.');return false;}
 }
 if(n===2 && (!$('endereco').value.trim()||!$('cidade').value.trim()||+$('imovel').value<=0||+$('entrada').value<0||+$('entrada').value>=+$('imovel').value)){toast('Confira endereço, cidade, valor do imóvel e entrada.');return false;}
 if(n===3 && (+$('prazo').value<=0||!$('dataLiberacao').value)){toast('Confira prazo e data de liberação.');return false;}
 return true;
}
function formatCPF(e){let v=e.target.value.replace(/\D/g,'').slice(0,11);v=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');e.target.value=v}
function formatPhone(e){let v=e.target.value.replace(/\D/g,'').slice(0,11);v=v.length>10?v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');e.target.value=v}
function idadePorNascimento(valor){
 const nasc=new Date(valor+'T00:00:00');if(Number.isNaN(nasc.getTime()))return 0;
 const hoje=new Date();let idade=hoje.getFullYear()-nasc.getFullYear();
 const m=hoje.getMonth()-nasc.getMonth();if(m<0||(m===0&&hoje.getDate()<nasc.getDate()))idade--;
 return idade;
}
function dataHoje(){return new Date().toISOString().slice(0,10);}
function produtoPorSistema(sistema){return sistema==='PRICE'?'IMOVEL-PRICE':'IMOVEL-SAC';}
function decisaoVisual(status){
 if(status==='FINALIZADO')return {texto:'APROVADO',classe:'approved',mensagem:'A proposta foi aprovada e a operação foi finalizada.'};
 if(status==='REPROVADO')return {texto:'REPROVADO',classe:'rejected',mensagem:'A proposta foi reprovada pelo serviço de Decisão.'};
 if(status==='PENDENTE_ANALISE_MANUAL')return {texto:'ANÁLISE MANUAL',classe:'manual',mensagem:'A proposta aguarda revisão manual.'};
 return {texto:status||'ERRO',classe:'rejected',mensagem:'A esteira não foi concluída.'};
}
async function createProposal(){
 const principal=+$('imovel').value-+$('entrada').value;
 const prazo=+$('prazo').value,sistema=$('sistema').value,renda=+$('renda').value;
 if(principal<=0||prazo<=0){toast('Confira os valores do financiamento.');return;}
 const payload={
  cliente:{
   nome:$('nome').value.trim(),tipoPessoa:'PF',cpf:$('cpf').value.replace(/\D/g,''),rendaMensal:renda,
   dividaTotal:+$('dividaTotal').value,idade:idadePorNascimento($('nascimento').value),estadoCivil:$('estadoCivil').value,
   numeroDependentes:+$('numeroDependentes').value,diasAtrasoUltimos12Meses:+$('diasAtraso').value,
   limiteRotativoUtilizado:+$('limiteUtilizado').value,limiteRotativoTotal:+$('limiteTotal').value,
   mesesNoEmpregoAtual:+$('mesesEmprego').value,mesesRelacionamentoBanco:+$('mesesBanco').value
  },
  imovel:{valor:+$('imovel').value,entrada:+$('entrada').value},
  produtoId:produtoPorSistema(sistema),prazoMeses:prazo,dataLiberacao:$('dataLiberacao').value||dataHoje(),
  primeiroRelacionamento:$('primeiroRelacionamento').value==='true'
 };
 const temp={id:'PROCESSANDO',cliente:payload.cliente.nome,principal,status:'EM_ANDAMENTO'};
 renderProcessing(temp);
 try{
  const response=await fetch('/api/esteira/iniciar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({ok:false,erro:'Resposta inválida do servidor.'}));
  if(!response.ok && response.status!==202){const detalhes=Array.isArray(data.detalhes)?' '+data.detalhes.join(' | '):'';throw new Error((data.erro||data.mensagem||`HTTP ${response.status}`)+detalhes);}
  const pedido=data.pedido||{};
  const p={
   id:data.idFinanciamento||pedido.idFinanciamento||crypto.randomUUID(),createdAt:pedido.criadoEm||new Date().toISOString(),
   ownerEmail:state.user?state.user.email:null,cliente:payload.cliente.nome,cpf:payload.cliente.cpf,renda,
   principal,status:data.status||pedido.status,produtoId:payload.produtoId,sistema,prazo,
   score:pedido.score?.scoreFinal??null,faixaRisco:pedido.score?.faixaRisco??null,probabilidadeDefault:pedido.score?.probabilidadeDefault??null,
   decisao:pedido.decisao?.status??pedido.status,motivo:pedido.decisao?.motivo||data.mensagem||'',
   integracaoJuros:pedido.integracaoJuros||null,operacao:pedido.operacao||null,etapas:pedido.etapas||[],rawResponse:data
  };
  state.proposal=p;saveProposal(p);renderResult(p);toast(data.status==='PENDENTE_ANALISE_MANUAL'?'Proposta enviada para análise manual.':'Esteira concluída.');
 }catch(err){
  $('result').classList.remove('hidden');
  $('result').innerHTML=`<div class="result-card"><div class="decision rejected"><b>ERRO DE INTEGRAÇÃO</b><span>${String(err.message||err)}</span></div><h2>Não foi possível concluir a esteira</h2><p class="subtitle">Confira se o backend e os serviços configurados estão acessíveis e tente novamente.</p><div class="actions"><button class="btn primary" id="newProposal">Tentar novamente</button></div></div>`;
  $('newProposal').onclick=()=>setPage(3);toast('Falha ao concluir a esteira.');
 }
}
function renderProcessing(p){$('result').classList.remove('hidden');$('result').innerHTML=`<div class="result-card"><div class="status">⏳ Proposta em processamento...</div><h2>Esteira real de crédito imobiliário</h2><div class="integration-live"><div>✓ Dados validados</div><div>↻ Consultando Produtos</div><div>↻ Chamando Score</div><div>↻ Chamando Decisão</div><div>↻ Aguardando Juros via Decisão</div><div>↻ Operações, se aprovada</div></div></div>`;$('result').scrollIntoView({behavior:'smooth'});}
function saveProposal(p){const list=JSON.parse(localStorage.getItem('credCasaProposals')||'[]');const i=list.findIndex(x=>x.id===p.id);if(i>=0)list[i]=p;else list.unshift(p);localStorage.setItem('credCasaProposals',JSON.stringify(list.slice(0,20)));}
function renderResult(p){
 const dv=decisaoVisual(p.status),juros=p.integracaoJuros||{},parcelas=juros.parcelas||{};
 const taxa=juros.taxaMensalPercentual??juros.taxaMensal??juros.taxa??null;
 const prob=p.probabilidadeDefault==null?'—':`${(Number(p.probabilidadeDefault)*100).toFixed(1).replace('.',',')}%`;
 const score=p.score==null?'—':String(p.score);const protocolo=p.operacao?.protocolo||'—';
 const etapas=(p.etapas||[]).map(x=>`<div><span>${x.status==='CONCLUIDA'||x.status==='FINALIZADA'||x.status==='RECEBIDA_VIA_DECISAO'?'✓':'•'} ${x.etapa}</span><small>${x.status}${x.detalhe?' · '+x.detalhe:''}</small></div>`).join('');
 $('result').classList.remove('hidden');
 $('result').innerHTML=`<div class="result-card"><div class="decision ${dv.classe}"><b>${dv.texto}</b><span>${dv.mensagem}</span></div><h2>Proposta ${String(p.id).toUpperCase()}</h2><div class="metrics"><div class="metric"><small>Valor financiado</small><strong>${money(p.principal)}</strong></div><div class="metric"><small>Score</small><strong>${score}</strong></div><div class="metric"><small>Primeira parcela</small><strong>${parcelas.primeira!=null?money(parcelas.primeira):'—'}</strong></div><div class="metric"><small>Taxa mensal</small><strong>${taxa!=null?Number(taxa).toFixed(2).replace('.',',')+'%':'—'}</strong></div></div><div class="decision-grid"><div><b>Faixa de risco</b><strong>${p.faixaRisco||'—'}</strong></div><div><b>Prob. de default</b><strong>${prob}</strong></div><div><b>Decisão</b><strong>${p.decisao||'—'}</strong></div><div><b>Protocolo Operações</b><strong>${protocolo}</strong></div></div>${p.motivo?`<div class="notice"><b>Motivo</b><span>${p.motivo}</span></div>`:''}<h3>Etapas executadas pela API</h3><div class="integration-list">${etapas||'<div><span>Sem etapas retornadas.</span></div>'}</div><div class="notice"><b>Arquitetura integrada</b><span>CredCasa chama Produtos → Score → Decisão. Quando APROVADO, Juros vem em integracaoJuros dentro da resposta da Decisão; só então o CredCasa chama Operações.</span></div><div class="actions"><button class="btn secondary" id="newProposal">Nova proposta</button><button class="btn primary" id="copyId">Copiar ID</button><button class="btn secondary" id="downloadJson">Exportar resposta JSON</button></div></div>`;
 $('copyId').onclick=()=>navigator.clipboard?.writeText(p.id).then(()=>toast('ID copiado.'));$('downloadJson').onclick=()=>downloadJSON(p.rawResponse||p);$('newProposal').onclick=resetForm;$('result').scrollIntoView({behavior:'smooth'});
}
function downloadJSON(p){const id=p.idFinanciamento||p.id||'credcasa';const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`proposta-${id}.json`;a.click();URL.revokeObjectURL(a.href);}
function resetForm(){$('proposalForm').reset();$('prazo').value=240;$('sistema').value='SAC';$('dataLiberacao').value=dataHoje();$('primeiroRelacionamento').value='false';$('dividaTotal').value=0;$('numeroDependentes').value=0;$('diasAtraso').value=0;$('limiteUtilizado').value=0;$('limiteTotal').value=0;$('mesesEmprego').value=12;$('mesesBanco').value=12;$('result').classList.add('hidden');setPage(1);toast('Nova proposta pronta.');}
function showHistory(){const list=JSON.parse(localStorage.getItem('credCasaProposals')||'[]');if(!list.length){toast('Nenhuma proposta salva neste navegador.');return;}$('result').classList.remove('hidden');$('result').innerHTML=`<div class="result-card"><h2>Minhas propostas</h2>${list.map(p=>`<button class="history-item" data-id="${p.id}"><b>${String(p.id).slice(0,12).toUpperCase()}</b><span>${p.cliente}</span><span>${p.status}</span><strong>${money(p.principal)}</strong></button>`).join('')}<div class="actions"><button class="btn secondary" id="closeHistory">Fechar</button></div></div>`;document.querySelectorAll('.history-item').forEach(b=>b.onclick=()=>{const p=list.find(x=>x.id===b.dataset.id);state.proposal=p;renderResult(p);});$('closeHistory').onclick=()=>$('result').classList.add('hidden');$('result').scrollIntoView({behavior:'smooth'});}
/* ---------- Autenticação (demo local, sem backend) ---------- */
async function hashPassword(pass){const enc=new TextEncoder().encode('credcasa::'+pass);const buf=await crypto.subtle.digest('SHA-256',enc);return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function getUsers(){return JSON.parse(localStorage.getItem('credCasaUsers')||'[]');}
function saveUsers(list){localStorage.setItem('credCasaUsers',JSON.stringify(list));}
function setSession(user){state.user=user;if(user)sessionStorage.setItem('credCasaSession',JSON.stringify(user));else sessionStorage.removeItem('credCasaSession');updateAuthUI();}
function updateAuthUI(){
 const btn=$('loginBtn');
 if(state.user){btn.textContent=`👤 ${state.user.nome.split(' ')[0]}`;btn.classList.add('is-authed');btn.title='Ver meu perfil';}
 else{btn.textContent='♙ Entrar';btn.classList.remove('is-authed');btn.title='';}
}
function openAuthModal(tab){$('authModal').classList.remove('hidden');switchAuthTab(tab||'login');$('loginError').classList.remove('show');$('registerError').classList.remove('show');}
function closeAuthModal(){$('authModal').classList.add('hidden');$('loginForm').reset();$('registerForm').reset();}
function switchAuthTab(tab){document.querySelectorAll('.modal-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.modal-form').forEach(f=>f.classList.toggle('active',f.id===tab+'Form'));}
async function handleRegister(e){
 e.preventDefault();
 const nome=$('regNome').value.trim(),email=$('regEmail').value.trim().toLowerCase(),pass=$('regPassword').value,pass2=$('regPassword2').value;
 const err=$('registerError');err.classList.remove('show');
 if(!nome||!email||pass.length<6){err.textContent='Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.';err.classList.add('show');return;}
 if(pass!==pass2){err.textContent='As senhas não coincidem.';err.classList.add('show');return;}
 const users=getUsers();
 if(users.some(u=>u.email===email)){err.textContent='Já existe uma conta com este e-mail. Tente entrar.';err.classList.add('show');return;}
 const passwordHash=await hashPassword(pass);
 const user={id:crypto.randomUUID(),nome,email,passwordHash,createdAt:new Date().toISOString()};
 users.push(user);saveUsers(users);
 setSession({id:user.id,nome:user.nome,email:user.email});
 closeAuthModal();toast(`Conta criada! Bem-vindo(a), ${nome.split(' ')[0]}.`);
}
async function handleLogin(e){
 e.preventDefault();
 const email=$('loginEmail').value.trim().toLowerCase(),pass=$('loginPassword').value;
 const err=$('loginError');err.classList.remove('show');
 const users=getUsers();const user=users.find(u=>u.email===email);
 if(!user){err.textContent='Não encontramos uma conta com este e-mail.';err.classList.add('show');return;}
 const passwordHash=await hashPassword(pass);
 if(passwordHash!==user.passwordHash){err.textContent='Senha incorreta. Tente novamente.';err.classList.add('show');return;}
 setSession({id:user.id,nome:user.nome,email:user.email});
 closeAuthModal();toast(`Bem-vindo(a) de volta, ${user.nome.split(' ')[0]}!`);
}
function logout(){setSession(null);$('result').classList.add('hidden');toast('Você saiu da sua conta.');}
function showProfile(){
 const list=JSON.parse(localStorage.getItem('credCasaProposals')||'[]').filter(p=>p.ownerEmail===state.user.email);
 $('result').classList.remove('hidden');
 $('result').innerHTML=`<div class="result-card">
  <div class="profile-header"><div class="profile-avatar">${state.user.nome.trim()[0].toUpperCase()}</div><div class="profile-meta"><b>${state.user.nome}</b><span>${state.user.email}</span></div></div>
  <h2>Minhas propostas</h2>
  ${list.length?list.map(p=>`<button class="history-item" data-id="${p.id}"><b>${p.id.slice(0,8).toUpperCase()}</b><span>${p.cliente}</span><span>${p.status}</span><strong>${money(p.principal)}</strong></button>`).join(''):'<p class="subtitle">Nenhuma proposta vinculada a esta conta ainda. Suas próximas simulações aparecerão aqui.</p>'}
  <div class="actions"><button class="btn secondary" id="logoutBtn">Sair da conta</button><button class="btn primary" id="closeProfile">Fechar</button></div>
 </div>`;
 document.querySelectorAll('.history-item').forEach(b=>b.onclick=()=>{const p=list.find(x=>x.id===b.dataset.id);state.proposal=p;renderResult(p);});
 $('logoutBtn').onclick=logout;$('closeProfile').onclick=()=>$('result').classList.add('hidden');
 $('result').scrollIntoView({behavior:'smooth'});
}
async function showSettings(){
 $('result').classList.remove('hidden');$('result').innerHTML=`<div class="result-card"><h2>Integrações do backend</h2><p class="subtitle">As URLs de Score e Decisão são configuradas no servidor por variáveis de ambiente. O navegador não altera esses endereços.</p><div class="integration-live" id="healthBox"><div>↻ Consultando /api/health...</div></div><div class="notice"><b>No dia da integração</b><span>Configure SCORE_API_URL e DECISAO_API_URL no backend com os IPs da rede da faculdade e reinicie o CredCasa.</span></div></div>`;$('result').scrollIntoView({behavior:'smooth'});
 try{const r=await fetch('/api/health');const h=await r.json();const i=h.integracoes||{};$('healthBox').innerHTML=`<div>✓ Backend: ${h.ok?'online':'indisponível'}</div><div>Score: ${i.score||'—'}</div><div>Decisão: ${i.decisao||'—'}</div><div>Operações: ${i.operacoes||'—'}</div><div>Juros: ${i.juros||'via Decisão'}</div>`;}catch(e){$('healthBox').innerHTML='<div>Não foi possível consultar o backend.</div>';}
}

document.querySelectorAll('.next').forEach(b=>b.onclick=()=>{if(validate(state.page))setPage(Math.min(3,state.page+1));});document.querySelectorAll('.prev').forEach(b=>b.onclick=()=>setPage(Math.max(1,state.page-1)));$('cpf').addEventListener('input',formatCPF);$('telefone').addEventListener('input',formatPhone);$('proposalForm').addEventListener('submit',e=>{e.preventDefault();if(validate(1)&&validate(2)&&validate(3))createProposal();});$('accessBtn').onclick=()=>{document.body.classList.toggle('accessible');toast(document.body.classList.contains('accessible')?'Acessibilidade ativada.':'Acessibilidade desativada.');};
$('loginBtn').onclick=()=>{state.user?showProfile():openAuthModal('login');};
if($('dataLiberacao'))$('dataLiberacao').value=dataHoje();
/* ===== Assistente de suporte (chat) ===== */
const CHAT_SITE_CONTEXT=`Você é o assistente de suporte do site CredCasa, um protótipo acadêmico de esteira de crédito imobiliário integrado ao backend orquestrador CredCasa. Responda sempre em português do Brasil, de forma curta, direta e simpática (no máximo um parágrafo curto, ou uma lista curta quando fizer sentido).

Como o site funciona, para você responder com precisão:
- Fluxo: o usuário preenche Cadastro do cliente (com validação de CPF), Dados do imóvel, Dados do financiamento (valor, prazo, sistema de amortização) e envia. Isso chama POST /api/esteira/iniciar. O fluxo é Produtos → Score → Decisão; quando APROVADO, a Decisão integra Juros e devolve integracaoJuros; então o CredCasa chama Operações.
- Sistemas de amortização: SAC (parcelas decrescentes, amortização constante) e PRICE (parcelas fixas, amortização crescente).
- Comprometimento de renda: percentual da renda mensal comprometido com a parcela; há um limite configurável (padrão 30%) em "Configurações".
- Decisão final: APROVADO, REPROVADO ou ANALISE_MANUAL, conforme a resposta do serviço de Decisão.
- O usuário pode criar conta/entrar (botão "Entrar"), ver histórico de propostas, exportar a proposta em JSON, ativar modo de acessibilidade e consultar em "Configurações" os endpoints que o backend está usando. As URLs são definidas por variáveis de ambiente no servidor.
- O histórico visual fica no navegador, enquanto a esteira é executada pelo backend; o armazenamento da API é em memória para fins acadêmicos.

Se o usuário perguntar algo sem relação com o site, responda normalmente como assistente geral, mas sempre volte a se colocar à disposição para dúvidas sobre a CredCasa.`;

const chatKB=[
  {kws:['sac','price','tabela','amortiza'],a:'No SAC as parcelas começam mais altas e diminuem com o tempo, porque a amortização do saldo devedor é sempre igual e os juros caem a cada parcela. No PRICE as parcelas são fixas do início ao fim, com a amortização crescendo aos poucos e os juros diminuindo. Você pode simular os dois na etapa de financiamento e comparar o valor da primeira e da última parcela antes de decidir.'},
  {kws:['documento','documentacao','preciso levar','o que preciso'],a:'Para dar entrada na simulação, tenha em mãos: CPF e RG do(s) proponente(s), comprovante de renda atualizado, comprovante de residência e os dados do imóvel (valor, localização e se é novo ou usado). Em produção, o backend real solicitaria também documentos comprobatórios digitalizados nesta etapa.'},
  {kws:['comprometimento de renda','comprometimento','renda comprometida'],a:'Comprometimento de renda é o percentual da renda mensal destinado à parcela. No projeto integrado, a decisão final vem do serviço de Decisão, com base nos dados e no Score recebidos.'},
  {kws:['analise manual','análise manual','foi para analise','ficou em analise'],a:'ANALISE_MANUAL é um dos três retornos previstos da API de Decisão. Nesse caso o CredCasa deixa a operação pendente e não chama Operações até haver revisão.'},
  {kws:['recusad','reprovad','negad'],a:'Quando a Decisão retorna REPROVADO, o CredCasa encerra a esteira e não chama Operações.'},
  {kws:['aprovad'],a:'Quando a Decisão retorna APROVADO, ela também devolve o resultado de Juros em integracaoJuros; então o CredCasa chama Operações e finaliza a esteira.'},
  {kws:['score'],a:'O score é obtido pelo serviço de Score chamado pelo backend CredCasa e representa o risco de crédito do cliente. Quanto maior o score, melhor a condição de aprovação. Ele é um dos fatores usados junto com o comprometimento de renda e a checagem de antifraude.'},
  {kws:['cpf invalido','cpf inválido','erro no cpf','cpf'],a:'O campo de CPF é validado automaticamente enquanto você digita. Se aparecer erro, confira se digitou os 11 dígitos corretos — o sistema calcula os dígitos verificadores para garantir que o CPF é válido antes de liberar o avanço no formulário.'},
  {kws:['login','senha','entrar','criar conta','cadastro de usuario','esqueci'],a:'Para entrar ou criar conta, use o botão "Entrar" no topo da página. Se tiver esquecido a senha, nesta demonstração é necessário criar uma nova conta, já que os dados ficam salvos localmente no navegador (não há recuperação de senha por e-mail neste protótipo).'},
  {kws:['erro','bug','travou','nao funciona','não funciona','deu problema'],a:'Sinto muito pelo transtorno! Tente recarregar a página e refazer a simulação — como é um protótipo acadêmico, os dados ficam salvos no navegador (localStorage) e podem ser perdidos se o histórico for limpo. Se o erro persistir, me conte em qual etapa (Cadastro, Imóvel, Financiamento ou Resultado) ele aparece que eu te ajudo a contornar.'},
  {kws:['taxa','juros'],a:'O CredCasa não chama Juros diretamente: quando a Decisão aprova, ela integra com Juros e devolve o resultado no campo integracaoJuros.'},
  {kws:['prazo'],a:'O prazo do financiamento é definido por você na etapa de Financiamento e influencia diretamente o valor das parcelas nos sistemas SAC e PRICE — prazos maiores reduzem o valor de cada parcela, mas aumentam o total de juros pagos.'},
  {kws:['exportar','json','baixar proposta'],a:'Depois que a esteira gerar o resultado, você encontra um botão para exportar a proposta em JSON na tela de resultado — útil para guardar um registro da simulação ou anexar em outro sistema.'},
  {kws:['humano','atendente','pessoa de verdade','falar com alguem','falar com alguém'],a:'Neste protótipo não há um atendente humano conectado — eu sou o assistente que responde às dúvidas sobre a esteira de crédito. Me diga o que você precisa (financiamento, score, decisão, cadastro, etc.) que eu te explico como funciona.'},
  {kws:['oi','ola','olá','bom dia','boa tarde','boa noite'],a:'Olá! 👋 Sou o assistente da CredCasa. Posso te explicar como funciona a simulação, o cálculo das parcelas (SAC/PRICE), o score, o comprometimento de renda e os motivos de aprovação, análise manual ou recusa. O que você gostaria de saber?'},
  {kws:['obrigad','valeu','agradec'],a:'Por nada! Se surgir outra dúvida sobre a simulação ou a esteira de crédito, é só perguntar por aqui. 🙂'}
];
function chatFallback(){
  return 'Ainda não tenho uma resposta pronta para isso na base local. Posso te ajudar com temas como: cálculo SAC/PRICE, documentos necessários, comprometimento de renda, score, motivos de aprovação/recusa/análise manual, login e erros na simulação — tente reformular usando um desses termos. Dica: em ⚙ dá pra ligar o modo IA real, que entende qualquer pergunta.';
}
function chatAnswerLocal(text){
  const t=text.toLowerCase();
  const hit=chatKB.find(item=>item.kws.some(k=>t.includes(k)));
  return hit?hit.a:chatFallback();
}

function chatHistoryKey(){return 'credCasaChatHistory';}
function getChatHistory(){return JSON.parse(localStorage.getItem(chatHistoryKey())||'[]');}
function saveChatMessage(who,text){
  const hist=getChatHistory();
  hist.push({who,text,at:new Date().toISOString()});
  localStorage.setItem(chatHistoryKey(),JSON.stringify(hist.slice(-100)));
}

async function chatAnswerAI(question){
  const history=getChatHistory().slice(-12).map(m=>({role:m.who==='user'?'user':'assistant',content:m.text}));
  const proposalContext = {
    user: state.user ? {name: state.user.name || ''} : null,
    simulation: state.proposal || state.simulation || null
  };
  const response=await fetch('/api/chat',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({question,history,context:proposalContext})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||('Erro '+response.status));
  if(!data.answer) throw new Error('Resposta vazia da IA');
  return data.answer.trim();
}

function addChatBubble(text,who){
  const box=$('chatMessages');
  const b=document.createElement('div');
  b.className='chat-bubble '+who;
  b.textContent=text;
  box.appendChild(b);
  box.scrollTop=box.scrollHeight;
  return b;
}
async function askBot(question){
  addChatBubble(question,'user');
  saveChatMessage('user',question);
  const typing=document.createElement('div');
  typing.className='chat-bubble bot typing';
  typing.innerHTML='<span></span><span></span><span></span>';
  const box=$('chatMessages');
  box.appendChild(typing);
  box.scrollTop=box.scrollHeight;

  let answer;
  try{
    answer=await chatAnswerAI(question);
  }catch(error){
    console.error('Falha na IA, usando base local:',error);
    await new Promise(r=>setTimeout(r,350));
    answer=chatAnswerLocal(question)+'\n\n⚠️ O servidor de IA não está disponível no momento. Inicie o backend conforme o README para ativar o chat com IA.';
  }
  typing.remove();
  addChatBubble(answer,'bot');
  saveChatMessage('bot',answer);
}

function refreshChatKeyUI(){
  $('chatKeyStatus').textContent='Assistente configurado para usar o servidor de IA. A chave fica protegida no backend.';
  $('chatKeyStatus').classList.remove('error');
}
function openSupport(){
  const win=$('supportModal');
  if(!win)return;
  win.classList.remove('hidden');
  win.classList.remove('minimized');
  refreshChatKeyUI();
  const box=$('chatMessages');
  if(!box.dataset.started){
    box.dataset.started='1';
    addChatBubble('Olá! 👋 Sou o assistente da CredCasa. Posso tirar dúvidas sobre a simulação, o cálculo das parcelas, o score e os motivos de aprovação, análise manual ou recusa. Como posso ajudar?','bot');
  }
  setTimeout(()=>$('chatInput').focus(),50);
}
function closeSupport(){
  const win=$('supportModal');
  if(win)win.classList.add('hidden');
}
function toggleMinimize(){
  const win=$('supportModal');
  if(win)win.classList.toggle('minimized');
}
$('helpBtn').onclick=openSupport;
$('supportClose').onclick=closeSupport;
$('supportMinimize').onclick=toggleMinimize;
$('chatDragHandle').addEventListener('dblclick',toggleMinimize);
$('chatSettingsBtn').onclick=()=>{$('chatSettings').classList.toggle('hidden');};
/* As chaves da IA ficam somente no backend; não são armazenadas no navegador. */
/* Legacy key controls intentionally removed. */
$('chatForm').addEventListener('submit',e=>{
  e.preventDefault();
  const input=$('chatInput');
  const q=input.value.trim();
  if(!q)return;
  input.value='';
  askBot(q);
});
document.querySelectorAll('.chip').forEach(chip=>chip.addEventListener('click',()=>askBot(chip.dataset.q)));
$('mobileMenu').onclick=()=>document.querySelector('.nav-items').classList.toggle('mobile-open');
document.querySelectorAll('a[href="#esteira"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();state.user?showProfile():showHistory();}));

/* modal de autenticação */
$('authClose').onclick=closeAuthModal;
$('authModal').addEventListener('click',e=>{if(e.target.id==='authModal')closeAuthModal();});
document.querySelectorAll('.modal-tab').forEach(b=>b.onclick=()=>switchAuthTab(b.dataset.tab));
document.querySelectorAll('.modal-hint a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();switchAuthTab(a.dataset.tab);}));
$('loginForm').addEventListener('submit',handleLogin);
$('registerForm').addEventListener('submit',handleRegister);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAuthModal();});
updateAuthUI();

window.CredCasa={createProposal,showHistory,showSettings,showProfile,resetForm,logout,openSupport,closeSupport,toggleMinimize,askBot};
