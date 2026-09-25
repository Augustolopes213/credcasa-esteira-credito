'use strict';
const $ = id => document.getElementById(id);
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const state = { page:1, proposal:null, settings: JSON.parse(localStorage.getItem('credCasaSettings')||'{}'), user: JSON.parse(sessionStorage.getItem('credCasaSession')||'null') };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove('show'),3000); }
function cpfValid(v){const c=String(v).replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;let s=0;for(let i=0;i<9;i++)s+=+c[i]*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==+c[9])return false;s=0;for(let i=0;i<10;i++)s+=+c[i]*(11-i);d=(s*10)%11;if(d===10)d=0;return d===+c[10]}
function setPage(n){state.page=n;document.querySelectorAll('.form-step').forEach(x=>x.classList.toggle('active',+x.dataset.page===n));document.querySelectorAll('.pstep').forEach((x,i)=>x.classList.toggle('active',i<n));$('simulador').scrollIntoView({behavior:'smooth',block:'start'});}
function validate(n){
 if(n===1 && (!$('nome').value.trim()||!cpfValid($('cpf').value)||!$('nascimento').value||+$('renda').value<=0)){toast('Preencha nome, CPF, nascimento e renda corretamente.');return false;}
 if(n===2 && (!$('endereco').value.trim()||!$('cidade').value.trim()||+$('imovel').value<=0||+$('entrada').value<0||+$('entrada').value>=+$('imovel').value)){toast('Confira endereço, cidade, valor do imóvel e entrada.');return false;}
 return true;
}
function formatCPF(e){let v=e.target.value.replace(/\D/g,'').slice(0,11);v=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');e.target.value=v}
function formatPhone(e){let v=e.target.value.replace(/\D/g,'').slice(0,11);v=v.length>10?v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');e.target.value=v}
function calculateSchedule(principal,prazo,taxaPct,sistema){let saldo=principal,taxa=taxaPct/100,totalJuros=0,primeira=0,ultima=0,rows=[];if(sistema==='SAC'){const amort=principal/prazo;for(let i=1;i<=prazo;i++){const juros=saldo*taxa,pag=amort+juros;saldo=Math.max(0,saldo-amort);totalJuros+=juros;if(i===1)primeira=pag;if(i===prazo)ultima=pag;if(i<=24)rows.push([i,pag,juros,amort,saldo]);}}else{const pmt=taxa===0?principal/prazo:principal*(taxa*Math.pow(1+taxa,prazo))/(Math.pow(1+taxa,prazo)-1);primeira=pmt;for(let i=1;i<=prazo;i++){const juros=saldo*taxa;let amort=pmt-juros;if(i===prazo)amort=saldo;const pag=amort+juros;saldo=Math.max(0,saldo-amort);totalJuros+=juros;if(i===prazo)ultima=pag;if(i<=24)rows.push([i,pag,juros,amort,saldo]);}}return {primeira,ultima,totalJuros,totalPago:principal+totalJuros,rows};}
function localScore(renda,comp,entradaPct){let score=500;if(comp<=20)score+=180;else if(comp<=30)score+=120;else if(comp<=40)score+=40;else score-=100;if(entradaPct>=30)score+=100;else if(entradaPct>=20)score+=60;else if(entradaPct>=10)score+=20;if(renda>=10000)score+=70;else if(renda>=5000)score+=40;return Math.max(0,Math.min(1000,score));}
async function integration(name,fn){const start=performance.now();await sleep(450+Math.random()*450);const result=fn();return {name,result,latency:Math.round(performance.now()-start),status:'CONCLUÍDO'};}
async function runDecision(p){
 const entries=[];
 entries.push(await integration('Motor de juros',()=>({taxaMensal:p.taxa, sistema:p.sistema, prazo:p.prazo})));
 entries.push(await integration('Motor de score',()=>({score:localScore(p.renda,p.comprometimento,p.entrada/p.imovel*100), faixa:p.comprometimento<=30?'BAIXO':'MÉDIO'})));
 entries.push(await integration('Validação cadastral',()=>({cpfValido:true, dadosCompletos:true})));
 entries.push(await integration('Antifraude',()=>({risco:'BAIXO', sinais:0})));
 const score=entries[1].result.score;let decisao='ANÁLISE MANUAL';let motivo=[];
 if(p.comprometimento>40){decisao='RECUSADA';motivo.push('Comprometimento acima de 40% da renda.');}
 else if(score>=700&&p.comprometimento<=30){decisao='APROVADA';}
 else if(score<600){decisao='RECUSADA';motivo.push('Score abaixo da faixa mínima configurada.');}
 else motivo.push('Necessária análise complementar.');
 p.integracoes=entries;p.score=score;p.decisao=decisao;p.motivos=motivo;p.status=decisao==='APROVADA'?'APROVADA':decisao==='RECUSADA'?'RECUSADA':'ANÁLISE MANUAL';p.politicaVersao='DEMO-2026.09';
 return p;
}
async function createProposal(){
 const principal=+$('imovel').value-+$('entrada').value,prazo=+$('prazo').value,taxa=+$('taxa').value,sistema=$('sistema').value,renda=+$('renda').value;
 if(principal<=0||prazo<=0||taxa<0){toast('Confira os valores do financiamento.');return;}
 const calc=calculateSchedule(principal,prazo,taxa,sistema),comp=calc.primeira/renda*100;
 const p={id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:'PROCESSANDO',ownerEmail:state.user?state.user.email:null,cliente:$('nome').value.trim(),cpf:$('cpf').value, nascimento:$('nascimento').value,renda,telefone:$('telefone').value,email:$('email').value,endereco:$('endereco').value,tipo:$('tipo').value,cidade:$('cidade').value,estado:$('estado').value,imovel:+$('imovel').value,entrada:+$('entrada').value,principal,prazo,taxa,sistema,comprometimento:comp,...calc};
 state.proposal=p;renderProcessing(p);await runDecision(p);saveProposal(p);renderResult(p);toast('Análise concluída.');
}
function renderProcessing(p){$('result').classList.remove('hidden');$('result').innerHTML=`<div class="result-card"><div class="status">⏳ Proposta ${p.id.slice(0,8).toUpperCase()} em processamento...</div><h2>Esteira de crédito imobiliário</h2><div class="integration-live"><div>✓ Proposta criada</div><div>↻ Consultando juros</div><div>↻ Calculando score</div><div>↻ Executando decisão</div></div></div>`;$('result').scrollIntoView({behavior:'smooth'});}
function saveProposal(p){const list=JSON.parse(localStorage.getItem('credCasaProposals')||'[]');const i=list.findIndex(x=>x.id===p.id);if(i>=0)list[i]=p;else list.unshift(p);localStorage.setItem('credCasaProposals',JSON.stringify(list.slice(0,20)));}
function renderResult(p){const decisionClass=p.decisao==='APROVADA'?'approved':p.decisao==='RECUSADA'?'rejected':'manual';const masked=p.cpf.replace(/\D/g,'').slice(-2);$('result').innerHTML=`<div class="result-card"><div class="decision ${decisionClass}"><b>${p.decisao}</b><span>${p.decisao==='APROVADA'?'A proposta passou pelos critérios da simulação.':p.decisao==='RECUSADA'?'A proposta não atende aos critérios configurados.':'A proposta foi encaminhada para análise manual.'}</span></div><h2>Proposta ${p.id.slice(0,8).toUpperCase()}</h2><div class="metrics"><div class="metric"><small>Valor financiado</small><strong>${money(p.principal)}</strong></div><div class="metric"><small>Primeira parcela</small><strong>${money(p.primeira)}</strong></div><div class="metric"><small>Juros estimados</small><strong>${money(p.totalJuros)}</strong></div><div class="metric"><small>Comprometimento</small><strong>${p.comprometimento.toFixed(1).replace('.',',')}%</strong></div></div><div class="decision-grid"><div><b>Score</b><strong>${p.score}/1000</strong></div><div><b>Faixa</b><strong>${p.comprometimento<=30?'Baixo':'Médio'}</strong></div><div><b>Política</b><strong>${p.politicaVersao}</strong></div><div><b>Cliente</b><strong>${p.cliente} • ***-${masked}</strong></div></div><h3>Integrações</h3><div class="integration-list">${p.integracoes.map(x=>`<div><span>✓ ${x.name}</span><small>${x.status} · ${x.latency} ms</small></div>`).join('')}</div>${p.motivos?.length?`<div class="notice"><b>Motivo</b><span>${p.motivos.join(' ')}</span></div>`:''}<h3>Primeiras 24 parcelas</h3><div style="overflow:auto"><table><thead><tr><th>Parcela</th><th>Pagamento</th><th>Juros</th><th>Amortização</th><th>Saldo</th></tr></thead><tbody>${p.rows.map(r=>`<tr><td>${r[0]}</td><td>${money(r[1])}</td><td>${money(r[2])}</td><td>${money(r[3])}</td><td>${money(r[4])}</td></tr>`).join('')}</tbody></table></div><div class="actions"><button class="btn secondary" id="newProposal">Nova proposta</button><button class="btn primary" id="copyId">Copiar ID</button><button class="btn secondary" id="downloadJson">Exportar proposta</button></div></div>`;$('copyId').onclick=()=>navigator.clipboard?.writeText(p.id).then(()=>toast('ID copiado.'));$('downloadJson').onclick=()=>downloadJSON(p);$('newProposal').onclick=resetForm;}
function downloadJSON(p){const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`proposta-${p.id}.json`;a.click();URL.revokeObjectURL(a.href);}
function resetForm(){$('proposalForm').reset();$('prazo').value=240;$('taxa').value=.80;$('sistema').value='SAC';$('result').classList.add('hidden');setPage(1);toast('Nova proposta pronta.');}
function showHistory(){const list=JSON.parse(localStorage.getItem('credCasaProposals')||'[]');if(!list.length){toast('Nenhuma proposta salva neste navegador.');return;}$('result').classList.remove('hidden');$('result').innerHTML=`<div class="result-card"><h2>Minhas propostas</h2>${list.map(p=>`<button class="history-item" data-id="${p.id}"><b>${p.id.slice(0,8).toUpperCase()}</b><span>${p.cliente}</span><span>${p.status}</span><strong>${money(p.principal)}</strong></button>`).join('')}<div class="actions"><button class="btn secondary" id="closeHistory">Fechar</button></div></div>`;document.querySelectorAll('.history-item').forEach(b=>b.onclick=()=>{const p=list.find(x=>x.id===b.dataset.id);state.proposal=p;renderResult(p);});$('closeHistory').onclick=()=>$('result').classList.add('hidden');$('result').scrollIntoView({behavior:'smooth'});}
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
function showSettings(){const apiJ=state.settings.juros||'',apiS=state.settings.score||'',apiD=state.settings.decisao||'';$('result').classList.remove('hidden');$('result').innerHTML=`<div class="result-card"><h2>Configurações de integração</h2><p class="subtitle">Deixe vazio para usar os motores locais de demonstração. Ao conectar o backend real, informe as URLs dos serviços da equipe.</p><div class="grid two"><label>API de juros<input id="cfgJuros" value="${apiJ}" placeholder="https://.../juros"></label><label>API de score<input id="cfgScore" value="${apiS}" placeholder="https://.../score"></label><label>API de decisão<input id="cfgDecisao" value="${apiD}" placeholder="https://.../decisao"></label><label>Limite de comprometimento (%)<input id="cfgComp" type="number" value="${state.settings.comp||30}"></label></div><div class="actions"><button class="btn primary" id="saveSettings">Salvar configurações</button></div></div>`;$('saveSettings').onclick=()=>{state.settings={juros:$('cfgJuros').value,score:$('cfgScore').value,decisao:$('cfgDecisao').value,comp:+$('cfgComp').value||30};localStorage.setItem('credCasaSettings',JSON.stringify(state.settings));toast('Configurações salvas.');$('result').classList.add('hidden');};$('result').scrollIntoView({behavior:'smooth'});}

document.querySelectorAll('.next').forEach(b=>b.onclick=()=>{if(validate(state.page))setPage(Math.min(3,state.page+1));});document.querySelectorAll('.prev').forEach(b=>b.onclick=()=>setPage(Math.max(1,state.page-1)));$('cpf').addEventListener('input',formatCPF);$('telefone').addEventListener('input',formatPhone);$('proposalForm').addEventListener('submit',e=>{e.preventDefault();if(validate(1)&&validate(2))createProposal();});$('accessBtn').onclick=()=>{document.body.classList.toggle('accessible');toast(document.body.classList.contains('accessible')?'Acessibilidade ativada.':'Acessibilidade desativada.');};
$('loginBtn').onclick=()=>{state.user?showProfile():openAuthModal('login');};
/* ===== Assistente de suporte (chat) ===== */
const CHAT_SITE_CONTEXT=`Você é o assistente de suporte do site CredCasa, um protótipo acadêmico de esteira de crédito imobiliário (frontend HTML/CSS/JS, sem backend real). Responda sempre em português do Brasil, de forma curta, direta e simpática (no máximo um parágrafo curto, ou uma lista curta quando fizer sentido).

Como o site funciona, para você responder com precisão:
- Fluxo: o usuário preenche Cadastro do cliente (com validação de CPF), Dados do imóvel, Dados do financiamento (valor, prazo, sistema de amortização) e envia. Isso aciona uma "esteira" simulada com as etapas: Juros → Score → Cadastro → Antifraude → Decisão.
- Sistemas de amortização: SAC (parcelas decrescentes, amortização constante) e PRICE (parcelas fixas, amortização crescente).
- Comprometimento de renda: percentual da renda mensal comprometido com a parcela; há um limite configurável (padrão 30%) em "Configurações".
- Decisão final: APROVADA, RECUSADA ou ANÁLISE MANUAL, dependendo do score, do comprometimento de renda e do resultado do antifraude.
- O usuário pode criar conta/entrar (botão "Entrar"), ver histórico de propostas, exportar a proposta em JSON, ativar modo de acessibilidade e configurar URLs de APIs reais (Juros, Score, Decisão) em "Configurações" — por padrão usa motores locais de demonstração.
- Todos os dados (contas, propostas, chamados) ficam salvos no localStorage do navegador, pois é um protótipo sem servidor.

Se o usuário perguntar algo sem relação com o site, responda normalmente como assistente geral, mas sempre volte a se colocar à disposição para dúvidas sobre a CredCasa.`;

const chatKB=[
  {kws:['sac','price','tabela','amortiza'],a:'No SAC as parcelas começam mais altas e diminuem com o tempo, porque a amortização do saldo devedor é sempre igual e os juros caem a cada parcela. No PRICE as parcelas são fixas do início ao fim, com a amortização crescendo aos poucos e os juros diminuindo. Você pode simular os dois na etapa de financiamento e comparar o valor da primeira e da última parcela antes de decidir.'},
  {kws:['documento','documentacao','preciso levar','o que preciso'],a:'Para dar entrada na simulação, tenha em mãos: CPF e RG do(s) proponente(s), comprovante de renda atualizado, comprovante de residência e os dados do imóvel (valor, localização e se é novo ou usado). Em produção, o backend real solicitaria também documentos comprobatórios digitalizados nesta etapa.'},
  {kws:['comprometimento de renda','comprometimento','renda comprometida'],a:'Comprometimento de renda é o percentual da sua renda mensal que será usado para pagar a parcela do financiamento. A esteira usa um limite (por padrão 30%, ajustável em Configurações) — se a parcela ultrapassar esse percentual da renda informada, a proposta tende a ir para ANÁLISE MANUAL ou ser RECUSADA.'},
  {kws:['analise manual','análise manual','foi para analise','ficou em analise'],a:'A proposta vai para ANÁLISE MANUAL quando algum critério fica no limite: score na faixa intermediária, comprometimento de renda próximo do teto, ou uma inconsistência leve identificada pelo motor de antifraude. Não significa recusa — um analista revisaria o caso manualmente na versão real do produto.'},
  {kws:['recusad','reprovad','negad'],a:'A proposta é RECUSADA quando o score fica abaixo do mínimo aceito, o comprometimento de renda ultrapassa muito o limite configurado, ou o antifraude aponta uma inconsistência grave (por exemplo, CPF inválido). Você pode ajustar os dados e simular novamente para ver como cada fator pesa na decisão.'},
  {kws:['aprovad'],a:'A proposta é APROVADA quando passa por todas as etapas da esteira (Juros → Score → Cadastro → Antifraude → Decisão) dentro dos parâmetros configurados: bom score, comprometimento de renda dentro do limite e cadastro sem inconsistências.'},
  {kws:['score'],a:'O score é calculado por um motor de demonstração (ou pela API real, se configurada em Configurações) e representa o risco de crédito do cliente. Quanto maior o score, melhor a condição de aprovação. Ele é um dos fatores usados junto com o comprometimento de renda e a checagem de antifraude.'},
  {kws:['cpf invalido','cpf inválido','erro no cpf','cpf'],a:'O campo de CPF é validado automaticamente enquanto você digita. Se aparecer erro, confira se digitou os 11 dígitos corretos — o sistema calcula os dígitos verificadores para garantir que o CPF é válido antes de liberar o avanço no formulário.'},
  {kws:['login','senha','entrar','criar conta','cadastro de usuario','esqueci'],a:'Para entrar ou criar conta, use o botão "Entrar" no topo da página. Se tiver esquecido a senha, nesta demonstração é necessário criar uma nova conta, já que os dados ficam salvos localmente no navegador (não há recuperação de senha por e-mail neste protótipo).'},
  {kws:['erro','bug','travou','nao funciona','não funciona','deu problema'],a:'Sinto muito pelo transtorno! Tente recarregar a página e refazer a simulação — como é um protótipo acadêmico, os dados ficam salvos no navegador (localStorage) e podem ser perdidos se o histórico for limpo. Se o erro persistir, me conte em qual etapa (Cadastro, Imóvel, Financiamento ou Resultado) ele aparece que eu te ajudo a contornar.'},
  {kws:['taxa','juros'],a:'A taxa de juros usada na simulação vem do motor local de demonstração por padrão, mas pode ser substituída por uma API real de juros na tela de Configurações, assim que o backend da equipe estiver disponível.'},
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
