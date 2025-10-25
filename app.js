"use strict";

/* ========== Helpers de seleção DOM ========== */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ========== Config API (mesma origem via proxy) ========== */
const API_URL = "https://intranetbackend.acacessorios.local/oficina/checklists";

/* ===== Helpers de tamanho/compactação ===== */
function approxByteLength(value) {
  try { return new Blob([typeof value === 'string' ? value : JSON.stringify(value)]).size; }
  catch { return (value && value.length) ? value.length : 0; }
}

function dataURLToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Compacta um dataURL (PNG/JPEG) para JPEG com qualidade/limite de dimensão.
 * Retorna o próprio dataURL se pequeno (<200KB) ou inválido.
 */
async function compressDataUrl(dataUrl, maxW = 1280, maxH = 1280, quality = 0.65) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;

  const bytes = approxByteLength(dataUrl);
  if (bytes < 200 * 1024) return dataUrl; // já é pequeno

  const img = await dataURLToImage(dataUrl);
  if (!img) return dataUrl;

  let { width, height } = img;
  const ratio = Math.min(maxW / width, maxH / height, 1);
  const targetW = Math.max(1, Math.floor(width * ratio));
  const targetH = Math.max(1, Math.floor(height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Re-exporta como JPEG
  const out = canvas.toDataURL('image/jpeg', quality);
  return out;
}

/* ==========================================================
   WIZARD (4 telas)
   ========================================================== */
const totalTelas = 4;
let telaAtual = 1;

function atualizarWizardUI() {
  // Mostra/oculta telas
  $$('.tela').forEach(sec=>{
    const n = Number(sec.dataset.tela);
    sec.classList.toggle('hidden', n !== telaAtual);
  });
  // Stepper ativo
  $$('.wizard-steps li').forEach(li=>{
    li.classList.toggle('ativo', Number(li.dataset.step) === telaAtual);
  });
  // Índice e botões
  $('#wizard-indice').textContent = String(telaAtual);
  $('#btn-prev').disabled = (telaAtual === 1);
  $('#btn-next').textContent = (telaAtual === totalTelas) ? 'Finalizar' : 'Próximo →';

  // >>> IMPORTANTE: quando chegar na Tela 4, prepare/redimensione as assinaturas
  if (telaAtual === 4) {
    ensureSignaturesReady();
  }
}

function irParaTela(n) {
  telaAtual = Math.max(1, Math.min(totalTelas, n));
  atualizarWizardUI();
}

function proximaTela() {
  if (telaAtual < totalTelas) irParaTela(telaAtual + 1);
  else window.scrollTo({ top: 0, behavior: 'smooth' }); // Finalizar
}
function telaAnterior() { irParaTela(telaAtual - 1); }

document.addEventListener('DOMContentLoaded', ()=>{
  $('#btn-prev')?.addEventListener('click', telaAnterior);
  $('#btn-next')?.addEventListener('click', proximaTela);
  $$('.wizard-steps li').forEach(li=>{
    li.addEventListener('click', ()=> irParaTela(Number(li.dataset.step)));
  });
  atualizarWizardUI();
});

/* ==========================================================
   HOTSPOTS PREDEFINIDOS — edite conforme o modelo 3D
   ========================================================== */
const pecasPreDefinidas = [
  { id:'capo',            label:'Capô',                   pos:{ x: 1.70, y: 1.00, z: 0.00 },  norm:{ x: 0.00, y: 1.00, z: 0.00 } },
  { id:'porta-malas',     label:'Porta-malas',            pos:{ x:-2.05, y: 1.20, z: 0.00 },  norm:{ x: 0.00, y: 1.00, z: 0.00 } },
  { id:'porta-tras-dir',  label:'Porta Traseira Dir.',    pos:{ x:-0.60, y: 0.65, z: 1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'porta-diant-dir', label:'Porta Dianteira Dir.',   pos:{ x: 0.30, y: 0.65, z: 1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'porta-diant-esq', label:'Porta Dianteira Esq.',  pos:{ x: 0.30, y: 0.65, z:-1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'porta-tras-esq',  label:'Porta Traseira Esq.',   pos:{ x:-0.60, y: 0.65, z:-1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'janela-tras-esq', label:'Janela Traseira Esq.',   pos:{ x:-0.60, y: 1.25, z:-0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'janela-diant-esq',label:'Janela Dianteira Esq.',  pos:{ x: 0.15, y: 1.25, z:-0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'janela-tras-dir', label:'Janela Traseira Dir.',   pos:{ x:-0.60, y: 1.25, z: 0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'janela-diant-dir',label:'Janela Dianteira Dir.',  pos:{ x: 0.15, y: 1.25, z: 0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'pneu-diant-dir',  label:'Pneu Dianteiro Dir.',    pos:{ x: 1.50, y: 0.50, z: 0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'pneu-tras-dir',   label:'Pneu Traseiro Dir.',     pos:{ x:-1.50, y: 0.50, z: 0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'pneu-diant-esq',  label:'Pneu Dianteiro Esq.',    pos:{ x: 1.50, y: 0.50, z:-0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'pneu-tras-esq',   label:'Pneu Traseiro Esq.',     pos:{ x:-1.50, y: 0.50, z:-0.90 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'farol-diant-dir', label:'Farol Dianteiro Dir.',   pos:{ x: 2.00, y: 0.50, z: 0.60 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'farol-diant-esq', label:'Farol Dianteiro Esq.',   pos:{ x: 2.00, y: 0.50, z:-0.60 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'farol-tras-dir',  label:'Farol Traseiro Dir.',    pos:{ x:-2.30, y: 0.70, z: 0.60 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'farol-tras-esq',  label:'Farol Traseiro Esq.',    pos:{ x:-2.30, y: 0.70, z:-0.60 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } }
];

/* ==========================================================
   APP MAIN
   ========================================================== */
(function iniciarApp(){
  const { jsPDF } = window.jspdf;

  /* ---------- Cache de elementos ---------- */
  const modelo3d           = $('#car3d');
  const statusModelo       = $('#model-status');
  const listaAvarias       = $('#damages-list');

  const modalAvaria        = $('#damage-modal');
  const formularioAvaria   = $('#damage-form');
  const entradaPosicao3d   = $('#damage-3d-pos');
  const entradaNormal3d    = $('#damage-3d-norm');
  const entradaPeca        = $('#damage-part');
  const entradaObservacoes = $('#damage-notes');
  const entradaFoto        = $('#damage-photo');
  const previsualizacaoFoto= $('#photo-preview');

  const botaoGerarPdf      = $('#generate-pdf');
  const botaoGerarJson     = $('#generate-json');

  // Botões e status opcionais para API (adicione no HTML se quiser)
  const botaoSendApi       = $('#send-api');       // <button id="send-api">
  const statusPost         = $('#post-status');    // <div id="post-status">

  // Estado das avarias
  /** @type {{pos3d:{x:number,y:number,z:number}, norm3d:{x:number,y:number,z:number}, type:string, part:string, notes:string, photo?:string, timestamp:number}[]} */
  let avarias = [];
  let indiceEdicao = null;

  /* ---------- Utils ---------- */
  const normalizarOuCima = (v)=>{
    const L = Math.hypot(v?.x||0, v?.y||0, v?.z||0);
    return L ? { x:v.x/L, y:v.y/L, z:v.z/L } : { x:0, y:1, z:0 };
  };
  const setarStatus = (chave, texto)=>{
    statusModelo.className = 'badge ' + (chave==='ok' ? 'badge-ok' : chave==='err' ? 'badge-err' : 'badge-warn');
    statusModelo.textContent = texto;
  };
  const pegarValorInput = (id)=> (document.getElementById(id)?.value ?? '').trim();

  // Converte string/number para int ou null
  function toIntOrNull(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'string') {
      const s = v.toString().trim();
      if (s === '') return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    if (typeof v === 'number') {
      return Number.isFinite(v) ? Math.trunc(v) : null;
    }
    return null;
  }

  // Preencher data/hora inicial
  const entryDt = $('#entry_datetime');
  if (entryDt) entryDt.value = new Date().toISOString().slice(0,16);

  /* ==========================================================
     BUILD CHECKLIST ITENS
     ========================================================== */
  (function construirChecklist(){
    const itens = [
      'Extintor de Incêndio','Tapetes','Rádio/CD/DVD','Alarme','Acendedor de Cigarro',
      'Palhetas Dianteiras','Tanque de Combustível',
      'Palheta Traseira','Estepe','Triângulo','Chave de Roda',
      'Macaco','Antena','Documento do Veículo','Retirada de Pertences'
    ];
    const container = $('#items-checklist');
    if (!container) return;
    itens.forEach(item=>{
      const linha = document.createElement('div');
      linha.className = 'flex items-center justify-between bg-white/70 border border-slate-200 rounded-xl px-3 py-2 shadow-sm';
      linha.innerHTML = `
        <span class="text-sm text-slate-700">${item}</span>
        <div class="select-wrap">
          <select class="nice-select pr-8">
            <option>OK</option><option>Avariado</option><option>Faltante</option><option>N/A</option>
          </select>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="text-slate-400">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;
      container.appendChild(linha);
    });
  })();

/* ==========================================================
   ASSINATURAS (canvas)
   ========================================================== */
(function configurarAssinaturas(){
  function sizeCanvas(canvas) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    canvas.width  = Math.max(1, Math.floor(rect.width  * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);

    ctx.lineWidth = 3;
    ctx.lineCap   = 'round';
    ctx.strokeStyle = '#0f172a';

    canvas.dataset.inited = '1';
  }

  function attachDrawHandlers(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let desenhando = false;

    const pos = (e)=>{
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : null;
      return { x: (t?t.clientX:e.clientX)-r.left, y: (t?t.clientY:e.clientY)-r.top };
    };
    const iniciar = (e)=>{ e.preventDefault(); desenhando = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const desenhar = (e)=>{ if(!desenhando) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const parar = ()=>{ desenhando = false; try{ ctx.closePath(); }catch{} };

    canvas.addEventListener('mousedown', iniciar);
    canvas.addEventListener('mousemove', desenhar);
    canvas.addEventListener('mouseup', parar);
    canvas.addEventListener('mouseout', parar);
    canvas.addEventListener('touchstart', iniciar, { passive: false });
    canvas.addEventListener('touchmove', desenhar, { passive: false });
    canvas.addEventListener('touchend', parar);
  }

  attachDrawHandlers('customer-signature');
  attachDrawHandlers('inspector-signature');

  window.clearSignature = (id)=>{
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
  };

  window.ensureSignaturesReady = ()=>{
    sizeCanvas(document.getElementById('customer-signature'));
    sizeCanvas(document.getElementById('inspector-signature'));
  };

  if (telaAtual === 4) ensureSignaturesReady();
  window.addEventListener('resize', ()=> {
    if (telaAtual === 4) ensureSignaturesReady();
  });
})();


  /* ==========================================================
     STATUS DO MODELO 3D
     ========================================================== */
  if (modelo3d) {
    modelo3d.addEventListener('load', ()=> setarStatus('ok', 'Modelo carregado.'));
    modelo3d.addEventListener('error',()=> setarStatus('err','Erro ao carregar GLB.'));
  }

  /* ==========================================================
     HOTSPOTS
     ========================================================== */
  function criarBotaoHotspot(preset, idx){
    const botao = document.createElement('button');
    botao.className = 'mv-pin';
    botao.textContent = '●';
    botao.setAttribute('slot', `hotspot-${preset.id || ('p'+idx)}`);

    const n = normalizarOuCima(preset.norm || { x:0, y:1, z:0 });
    botao.dataset.position = `${preset.pos.x} ${preset.pos.y} ${preset.pos.z}`;
    botao.dataset.normal   = `${n.x} ${n.y} ${n.z}`;
    botao.setAttribute('aria-label', preset.label || `Peça ${idx+1}`);

    const dica = document.createElement('span');
    dica.className = 'tooltip';
    dica.textContent = preset.label || `Peça ${idx+1}`;
    botao.appendChild(dica);

    botao.addEventListener('click', (e)=>{
      e.stopPropagation();
      abrirModalParaNova(preset.pos, n, preset.label);
    });
    return botao;
  }

  function renderizarHotspots(){
    if (!modelo3d) return;
    $$('button[slot^="hotspot-"]', modelo3d).forEach(b=>b.remove());
    pecasPreDefinidas.forEach((p, i)=> modelo3d.appendChild(criarBotaoHotspot(p, i)));
  }

  /* ==========================================================
     MODAL DE AVARIA (criar/editar)
     ========================================================== */
  function abrirModalParaNova(pos, norm, peca=''){
    indiceEdicao = null;
    formularioAvaria.reset();
    previsualizacaoFoto.classList.add('hidden');
    $('#modal-title').textContent = 'Adicionar Avaria';

    entradaPosicao3d.value = JSON.stringify(pos);
    entradaNormal3d.value  = JSON.stringify(norm);
    entradaPeca.value      = peca || '';

    modalAvaria.showModal();
  }

  function abrirModalParaEdicao(i){
    indiceEdicao = i;
    const d = avarias[i];
    $('#modal-title').textContent = 'Editar Avaria';

    entradaPosicao3d.value = JSON.stringify(d.pos3d);
    entradaNormal3d.value  = JSON.stringify(d.norm3d);
    $$('input[name="damage-type"]').forEach(r=> r.checked = (r.value === d.type));
    entradaPeca.value        = d.part   || '';
    entradaObservacoes.value = d.notes  || '';

    if (d.photo){
      previsualizacaoFoto.src = d.photo;
      previsualizacaoFoto.classList.remove('hidden');
    } else {
      previsualizacaoFoto.classList.add('hidden');
    }
    modalAvaria.showModal();
  }

  $('#cancel-damage')?.addEventListener('click', ()=> modalAvaria.close());

  entradaFoto?.addEventListener('change', (e)=>{
    const arquivo = e.target.files?.[0];
    if(!arquivo) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      previsualizacaoFoto.src = ev.target.result;
      previsualizacaoFoto.classList.remove('hidden');
    };
    reader.readAsDataURL(arquivo);
  });

  /* ==========================================================
     CÂMERA (getUserMedia) — botão "Tirar foto"
     ========================================================== */
  const btnOpenCam   = $('#open-camera');
  const modalCam     = $('#camera-modal');
  const btnCloseCam  = $('#close-camera');
  const btnTakePhoto = $('#take-photo');
  const btnSwitch    = $('#switch-facing');
  const video        = $('#camera-video');

  let camStream = null;
  let facingMode = 'environment'; // traseira por padrão

  async function startCamera() {
    stopCamera();
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
      video.srcObject = camStream;
    } catch (e) {
      alert('Não foi possível acessar a câmera: ' + (e?.message || e));
      stopCamera();
      modalCam?.close?.();
    }
  }

  function stopCamera() {
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    if (video) video.srcObject = null;
  }

  btnOpenCam?.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      // fallback: abre o seletor de arquivo
      entradaFoto?.click?.();
      return;
    }
    modalCam?.showModal?.();
    await startCamera();
  });

  btnCloseCam?.addEventListener('click', () => {
    stopCamera();
    modalCam?.close?.();
  });

  btnSwitch?.addEventListener('click', async () => {
    facingMode = (facingMode === 'environment') ? 'user' : 'environment';
    await startCamera();
  });

  btnTakePhoto?.addEventListener('click', async () => {
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // JPEG (melhor tamanho)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // preview
    if (previsualizacaoFoto) {
      previsualizacaoFoto.src = dataUrl;
      previsualizacaoFoto.classList.remove('hidden');
    }

    // cria File e injeta no input[type=file]
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `avaria-${Date.now()}.jpg`, { type: 'image/jpeg' });

    const dt = new DataTransfer();
    dt.items.add(file);
    if (entradaFoto) entradaFoto.files = dt.files;

    stopCamera();
    modalCam?.close?.();
  });

  /* ==========================================================
     SUBMIT do formulário de AVARIA
     ========================================================== */
  formularioAvaria?.addEventListener('submit', (e)=>{
    e.preventDefault();

    const pos   = JSON.parse(entradaPosicao3d.value||'{}');
    const norm  = JSON.parse(entradaNormal3d.value||'{}');
    const tipo  = ($('input[name="damage-type"]:checked')?.value) || 'Não especificado';
    const peca  = entradaPeca.value?.trim()   || '';
    const notas = entradaObservacoes.value     || '';
    const foto  = (previsualizacaoFoto.src||'').startsWith('data:image') ? previsualizacaoFoto.src : undefined;

    const registro = { pos3d: pos, norm3d: norm, type: tipo, part: peca, notes: notas, photo: foto, timestamp: Date.now() };

    if (indiceEdicao !== null) {
      avarias[indiceEdicao] = { ...avarias[indiceEdicao], ...registro };
    } else {
      avarias.push(registro);
    }
    renderizarListaAvarias();
    modalAvaria.close();
  });

  function renderizarListaAvarias(){
    if (!listaAvarias) return;
    listaAvarias.innerHTML = '';
    if(!avarias.length){
      listaAvarias.innerHTML = '<p class="text-center text-slate-500 text-sm">Nenhuma avaria registrada.</p>';
      return;
    }
    avarias.forEach((d, i)=>{
      const coords = d.pos3d ? ` (x:${d.pos3d.x.toFixed(2)}, y:${d.pos3d.y.toFixed(2)}, z:${d.pos3d.z.toFixed(2)})` : '';
      const linha = document.createElement('div');
      linha.className = 'bg-white/70 border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex justify-between items-center';
      linha.innerHTML = `
        <div>
          <p class="font-semibold text-slate-800">${i+1}. <span class="font-medium">${d.part || 'Peça'}</span> – ${d.type}${coords}</p>
          <p class="text-sm text-slate-500">${d.notes || 'Sem observações.'}</p>
        </div>
        <div class="flex items-center gap-3">
          <button class="editar text-blue-600 hover:text-blue-800 text-sm">Editar</button>
          <button class="excluir text-rose-600 hover:text-rose-700 font-bold text-xl">&times;</button>
        </div>`;
      linha.querySelector('.editar').onclick = ()=> abrirModalParaEdicao(i);
      linha.querySelector('.excluir').onclick= ()=>{ avarias.splice(i,1); renderizarListaAvarias(); };
      listaAvarias.appendChild(linha);
    });
  }

  /* ==========================================================
     GAUGE DE COMBUSTÍVEL
     ========================================================== */
  (function configurarGauge(){
    const controleRange = $('#fuel-range');
    const rotuloPercent = $('#fuel-percent');
    const ponteiro      = $('#needle');
    const trilhaArc     = $('#arc-track');
    const preenchArc    = $('#arc-fill');
    const marcasTicks   = $('#ticks');

    if (!controleRange || !rotuloPercent || !trilhaArc || !preenchArc || !ponteiro) return;

    const comprimentoArc = trilhaArc.getTotalLength();
    preenchArc.style.strokeDasharray = `${comprimentoArc} ${comprimentoArc}`;

    if (marcasTicks && !marcasTicks.hasChildNodes()){
      const cx=130, cy=120, raioExterno=100, raioInternoMaior=85, raioInternoMenor=92;
      for (let i=0; i<=10; i++){
        const t=i/10, ang=(-Math.PI/2) + (Math.PI*t);
        const cos=Math.cos(ang), sin=Math.sin(ang);
        const rIn=(i%5===0)?raioInternoMaior:raioInternoMenor;
        const x1=cx + rIn*cos,  y1=cy + rIn*sin;
        const x2=cx + raioExterno*cos, y2=cy + raioExterno*sin;
        const linha=document.createElementNS('http://www.w3.org/2000/svg','line');
        linha.setAttribute('x1',x1); linha.setAttribute('y1',y1);
        linha.setAttribute('x2',x2); linha.setAttribute('y2',y2);
        marcasTicks.appendChild(linha);
      }
    }

    function setarCombustivel(valor){
      const v = Math.max(0, Math.min(100, Number(valor)||0));
      rotuloPercent.textContent = `${v}%`;
      const graus = -90 + (v * 180 / 100);
      ponteiro.setAttribute('transform', `rotate(${graus},130,120)`);
      const preenchido = comprimentoArc * (v / 100);
      preenchArc.style.strokeDashoffset = (comprimentoArc - preenchido).toString();
    }

    setarCombustivel(controleRange.value);
    controleRange.addEventListener('input', (e)=> setarCombustivel(e.target.value));
  })();

  /* ==========================================================
     COLETORES / EXPORTADORES (JSON + PDF)
     ========================================================== */
  function canvasParaBase64(canvas){
    try { return canvas.toDataURL('image/png'); } catch { return null; }
  }

  function canvasVazio(canvas){
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0,0,width,height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return false;
    }
    return true;
  }

  async function elementoParaBase64(el){
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    return canvas.toDataURL('image/png');
  }

  function baixarJson(obj, nomeArquivo){
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function coletarChecklist(){
    const linhas = $$('#items-checklist > div');
    return linhas.map(l=>{
      const nomeItem = l.querySelector('span')?.textContent?.trim() || '';
      const select   = l.querySelector('select');
      const status   = select ? (select.value || select.options[select.selectedIndex]?.text || '') : '';
      return { item: nomeItem, status };
    });
  }

  function coletarAssinaturas(){
    const c1 = document.getElementById('customer-signature');
    const c2 = document.getElementById('inspector-signature');

    const cliente = (c1 && !canvasVazio(c1)) ? canvasParaBase64(c1) : null;
    const responsavel = (c2 && !canvasVazio(c2)) ? canvasParaBase64(c2) : null;

    return {
      assinaturaClienteBase64: cliente,
      assinaturaResponsavelBase64: responsavel
    };
  }

  // >>>>>>> CAPTURA ROBUSTA do <model-viewer> + fallback
  async function coletarCapturas(){
    let capturaCarroBase64 = null;
    try {
      if (modelo3d && modelo3d.shadowRoot) {
        const glCanvas = modelo3d.shadowRoot.querySelector('canvas');
        if (glCanvas) {
          capturaCarroBase64 = glCanvas.toDataURL('image/png'); // base64 direto do WebGL
        }
      }
      if (!capturaCarroBase64) {
        const canvasFallback = await html2canvas(modelo3d, { scale: 2, useCORS: true });
        capturaCarroBase64 = canvasFallback.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Falha ao capturar modelo 3D:', e);
    }

    let capturaPaginaBase64 = null;
    try {
      const canvasPagina = await html2canvas(document.querySelector('.max-w-5xl'), { scale: 2, useCORS: true });
      capturaPaginaBase64 = canvasPagina.toDataURL('image/png');
    } catch (e) {
      console.warn('Falha ao capturar página:', e);
    }

    return { capturaCarroBase64, capturaPaginaBase64 };
  }

  function coletarCabecalho(){
    return {
      osInterna: pegarValorInput('os_interna'),
      cliente: {
        nome: pegarValorInput('cli_nome'),
        doc:  pegarValorInput('cli_doc'),
        tel:  pegarValorInput('cli_tel'),
        end:  pegarValorInput('cli_end')
      },
      veiculo: {
        nome:  pegarValorInput('veic_nome'),
        placa: pegarValorInput('veic_placa'),
        cor:   pegarValorInput('veic_cor'),
        km:    toIntOrNull(pegarValorInput('veic_km')) // <<< número ou null
      },
      dataHoraEntrada: pegarValorInput('entry_datetime'),
      observacoes:     pegarValorInput('obs')
    };
  }

  function coletarCombustivel(){
    const txt = ($('#fuel-percent')?.textContent || '0%').replace('%','');
    const val = Number(document.getElementById('fuel-range')?.value || txt || 0);
    const n   = Number(txt || val || 0);
    return { combustivelPercentual: isNaN(n) ? 0 : n };
  }

  function coletarAvarias(){
    return avarias.map(d => ({
      tipo: d.type,
      peca: d.part,
      observacoes: d.notes,
      posicao3d: d.pos3d,
      normal3d:  d.norm3d,
      fotoBase64: d.photo || null,
      timestamp: d.timestamp
    }));
  }

  async function montarChecklistJson(){
    const cabecalho   = coletarCabecalho();
    const combustivel = coletarCombustivel();
    const checklist   = coletarChecklist();
    const assinaturas = coletarAssinaturas();
    const capturas    = await coletarCapturas();
    const avariasJson = coletarAvarias();

    // Campo agregador para facilitar consumo (mantendo os campos originais)
    const imagens = {
      assinaturas: {
        clienteBase64: assinaturas.assinaturaClienteBase64 || null,
        responsavelBase64: assinaturas.assinaturaResponsavelBase64 || null
      },
      capturas, // { capturaCarroBase64, capturaPaginaBase64 }
      avariasBase64: avariasJson.map(a => a.fotoBase64).filter(Boolean)
    };

    return {
      meta: {
        geradoEmIso: new Date().toISOString(),
        app: 'Checklist Entrada Veículo 3D',
        versao: '1.0.0'
      },
      cabecalho,
      combustivel,
      checklist,
      avarias: avariasJson,
      assinaturas,
      capturas,
      pecasPreDefinidas,
      imagens // agregado
    };
  }

  /* ==========================================================
     PAYLOAD PARA API (sem pecasPreDefinidas) + COMPACTAÇÃO
     ========================================================== */
  async function montarPayloadParaApi() {
    const dados = await montarChecklistJson();

    // remove pecasPreDefinidas do que vai para API (se existir na estrutura)
    const { pecasPreDefinidas: _remove, ...payload } = dados;

    const cab = payload.cabecalho || {};
    const cli = cab.cliente || {};
    const vei = cab.veiculo || {};

    // normaliza KM para número ou null
    const kmVal = (Number.isFinite(vei.km) ? vei.km : null);

    // normaliza data para ISO com 'Z' (UTC) se vier no formato do input datetime-local
    function toIsoZ(s) {
      if (!s) return null;
      if (/Z$/i.test(s)) return s;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    const bodyApi = {
      // ---- campos de topo (flat), exatamente como a API te mostrou ----
      osInterna: cab.osInterna || null,
      dataHoraEntrada: toIsoZ(cab.dataHoraEntrada) || null,
      observacoes: cab.observacoes || null,
      combustivelPercentual: (payload.combustivel?.combustivelPercentual ?? 0),

      clienteNome: cli.nome || null,
      clienteDoc:  cli.doc  || null,
      clienteTel:  cli.tel  || null,
      clienteEnd:  cli.end  || null,

      veiculoNome:  vei.nome  || null,
      veiculoPlaca: vei.placa || null,
      veiculoCor:   vei.cor   || null,
      veiculoKm:    kmVal, // número ou null

      checklist: (payload.checklist || []).map(i => ({
        item:   i.item || '',
        status: i.status || ''
      })),

      avarias: (payload.avarias || []).map(a => ({
        tipo: a.tipo,
        peca: a.peca,
        observacoes: a.observacoes,
        posX: a.posicao3d?.x,
        posY: a.posicao3d?.y,
        posZ: a.posicao3d?.z,
        normX: a.normal3d?.x,
        normY: a.normal3d?.y,
        normZ: a.normal3d?.z,
        fotoBase64: a.fotoBase64 || null,
        timestamp: a.timestamp
      })),

      // >>> nomes das assinaturas exatamente como a API pediu <<<
      assinaturasclienteBase64: payload.assinaturas?.assinaturaClienteBase64 || null,
      assinaturasresponsavelBase64: payload.assinaturas?.assinaturaResponsavelBase64 || null,
    };

    // ====== COMPACTAÇÃO DE IMAGENS ======
    // Assinaturas
    if (bodyApi.assinaturasclienteBase64) {
      bodyApi.assinaturasclienteBase64 =
        await compressDataUrl(bodyApi.assinaturasclienteBase64, 1000, 400, 0.7);
    }
    if (bodyApi.assinaturasresponsavelBase64) {
      bodyApi.assinaturasresponsavelBase64 =
        await compressDataUrl(bodyApi.assinaturasresponsavelBase64, 1000, 400, 0.7);
    }

    // Fotos das avarias
    for (const a of bodyApi.avarias) {
      if (a.fotoBase64) {
        a.fotoBase64 = await compressDataUrl(a.fotoBase64, 1280, 1280, 0.65);
      }
    }

    // ====== LIMITE DE TAMANHO (soft cap) ======
    const MAX_BYTES_SOFT = 8 * 1024 * 1024; // ~8MB
    let bodyStr = JSON.stringify(bodyApi);
    if (approxByteLength(bodyStr) > MAX_BYTES_SOFT) {
      // primeiro tira fotos das avarias
      bodyApi.avarias.forEach(a => delete a.fotoBase64);
      bodyStr = JSON.stringify(bodyApi);
    }

    return bodyApi;
  }

  /* ==========================================================
     Botão: Gerar JSON (download local)
     ========================================================== */
  botaoGerarJson?.addEventListener('click', async ()=>{
    try{
      botaoGerarJson.textContent = 'Gerando...';
      botaoGerarJson.disabled = true;

      const dados = await montarChecklistJson();
      const placa = pegarValorInput('veic_placa') || 'veiculo';
      const dataBR = new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
      baixarJson(dados, `checklist-${placa}-${dataBR}.json`);
    } catch(err){
      console.error(err);
      alert('Falha ao gerar JSON.');
    } finally {
      botaoGerarJson.textContent = 'Gerar JSON';
      botaoGerarJson.disabled = false;
    }
  });

  /* ==========================================================
     PDF ESTRUTURADO POR DADOS (jsPDF + AutoTable)
     ========================================================== */
  async function gerarPdfComDados(payload) {
    const doc = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margem = 12;
    const contentTop = margem;
    const contentBottom = pageH - margem;
    let y = margem;

    function addPageIfNeeded(needed = 0) {
      if (y + needed <= contentBottom) return;
      doc.addPage();
      y = contentTop;
    }
    function textLine(str, x, opt = {}) {
      const lineH = opt.lineH ?? 5;
      addPageIfNeeded(lineH);
      doc.text(str, x ?? margem, y, opt.textOpt ?? {});
      y += lineH;
    }
    function hr() {
      addPageIfNeeded(2);
      doc.setDrawColor(200);
      doc.line(margem, y, pageW - margem, y);
      y += 2;
    }
    function sectionTitle(t) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      textLine(t, margem, { lineH: 6 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    }
    function addWrappedText(str, maxWidth) {
      if (!str) return;
      const lines = doc.splitTextToSize(str, maxWidth);
      const lineH = 5;
      for (const line of lines) {
        addPageIfNeeded(lineH);
        doc.text(line, margem, y);
        y += lineH;
      }
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    textLine('Checklist de Entrada de Veículo – 3D', margem, { lineH: 6 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);

    const headerDate = `Gerado em: ${(() => { try { return new Date(payload.meta?.geradoEmIso).toLocaleString('pt-BR'); } catch { return ''; } })()}`;
    doc.text(headerDate, pageW - margem, y - 6, { align: 'right' });
    hr();
    y += 4;

    const cab = payload.cabecalho || {};
    sectionTitle('Identificação');

    const linhaH = 6;
    function twoCols(left, right) {
      addPageIfNeeded(linhaH);
      doc.text(left, margem, y);
      doc.text(right, margem + 100, y);
      y += linhaH;
    }

    twoCols(`O.S Interna: ${cab.osInterna || '-'}`, `Data/Hora Entrada: ${cab.dataHoraEntrada ? new Date(cab.dataHoraEntrada).toLocaleString('pt-BR') : '-'}`);
    twoCols(`Cliente: ${cab.cliente?.nome || '-'}`, `Doc: ${cab.cliente?.doc || '-'}`);
    twoCols(`Telefone: ${cab.cliente?.tel || '-'}`, `Endereço: ${cab.cliente?.end || '-'}`);
    twoCols(`Veículo: ${cab.veiculo?.nome || '-'}`, `Placa: ${cab.veiculo?.placa || '-'}`);
    twoCols(`Cor: ${cab.veiculo?.cor || '-'}`, `KM: ${Number.isFinite(cab.veiculo?.km) ? String(cab.veiculo.km) : '-'}`);
    y += 2;

    sectionTitle('Nível de Combustível');
    textLine(`Percentual: ${payload.combustivel?.combustivelPercentual ?? 0}%`, margem, { lineH: 6 });
    y += 2;

    sectionTitle('Checklist de Itens');
    const itens = (payload.checklist || []).map(i => [i.item || '', i.status || '']);
    const linhasEmPares = [];
    for (let i = 0; i < itens.length; i += 2) {
      const [itemA, statusA] = itens[i] || ['', ''];
      const [itemB, statusB] = itens[i + 1] || ['', ''];
      linhasEmPares.push([itemA, statusA, itemB, statusB]);
    }

    doc.autoTable({
      head: [['Item', 'Status', 'Item', 'Status']],
      body: linhasEmPares,
      startY: Math.max(y + 2, contentTop),
      margin: { left: margem, right: margem, top: contentTop, bottom: margem },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 25 },
        2: { cellWidth: 70 },
        3: { cellWidth: 25 },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      pageBreak: 'auto'
    });
    y = doc.lastAutoTable.finalY + 8;

    sectionTitle('Avarias Registradas');

    const linhasAvarias = (payload.avarias || []).map(d => [
      d.peca || '',
      d.tipo || '',
      d.observacoes || '',
      d.posicao3d ? `x:${d.posicao3d.x?.toFixed?.(2) ?? d.posicao3d.x} y:${d.posicao3d.y?.toFixed?.(2) ?? d.posicao3d.y} z:${d.posicao3d.z?.toFixed?.(2) ?? d.posicao3d.z}` : '',
      d.normal3d ? `x:${d.normal3d.x?.toFixed?.(2) ?? d.normal3d.x} y:${d.normal3d.y?.toFixed?.(2) ?? d.normal3d.y} z:${d.normal3d.z?.toFixed?.(2) ?? d.normal3d.z}` : '',
      d.timestamp ? new Date(d.timestamp).toLocaleString('pt-BR') : ''
    ]);

    doc.autoTable({
      head: [['Peça', 'Tipo', 'Observações', 'Posição 3D', 'Normal 3D', 'Registro']],
      body: linhasAvarias,
      startY: Math.max(y + 2, contentTop),
      margin: { left: margem, right: margem, top: contentTop, bottom: margem },
      styles: { fontSize: 8, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: [2, 6, 23], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 18 },
        2: { cellWidth: 60 },
        3: { cellWidth: 34 },
        4: { cellWidth: 34 },
        5: { cellWidth: 22 }
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      pageBreak: 'auto'
    });
    y = doc.lastAutoTable.finalY + 8;

    if (cab?.observacoes) {
      sectionTitle('Observações');
      addWrappedText(cab.observacoes, pageW - margem * 2);
      y += 4;
    }

    sectionTitle('Assinaturas');
    const ass = payload.assinaturas || {};
    const wAss = 80, hAss = 30, gap = 10;
    const blockH = hAss + 14;

    addPageIfNeeded(blockH);

    doc.setFillColor(255,255,255);
    doc.rect(margem, y, wAss, hAss, 'F');
    doc.rect(pageW - margem - wAss, y, wAss, hAss, 'F');

    if (ass.assinaturaClienteBase64) {
      doc.addImage(ass.assinaturaClienteBase64, 'PNG', margem, y, wAss, hAss);
    }
    if (ass.assinaturaResponsavelBase64) {
      doc.addImage(ass.assinaturaResponsavelBase64, 'PNG', pageW - margem - wAss, y, wAss, hAss);
    }

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Cliente', margem + wAss / 2, y + hAss + 6, { align: 'center' });
    doc.text('Responsável', pageW - margem - (wAss / 2), y + hAss + 6, { align: 'center' });

    y += blockH + gap;

    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Página ${i} de ${total}`, pageW - margem, pageH - 8, { align: 'right' });
    }

    const placa = document.getElementById('veic_placa')?.value || 'veiculo';
    const dataBR = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    doc.save(`checklist-${placa}-${dataBR}.pdf`);
  }

  // Botão: Gerar PDF (via dados)
  botaoGerarPdf?.addEventListener('click', async ()=>{
    try{
      botaoGerarPdf.textContent = 'Gerando...';
      botaoGerarPdf.disabled = true;

      const dados = await montarChecklistJson();
      await gerarPdfComDados(dados);
    } catch(err){
      console.error(err);
      alert('Falha ao gerar PDF.');
    } finally {
      botaoGerarPdf.textContent = 'Salvar e Gerar PDF';
      botaoGerarPdf.disabled = false;
    }
  });

  /* ==========================================================
     Helper de POST com timeout e erro legível (mobile friendly)
     ========================================================== */
  async function postJson(url, body, { timeoutMs = 20000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} – ${text || resp.statusText}`);
      }
      return await resp.json().catch(() => ({}));
    } catch (err) {
      const online = navigator.onLine;
      const httpsPage = location.protocol === 'https:';
      const httpsApi  = url.startsWith('https://');

      let dica = '';
      if (!online) {
        dica = 'Sem conexão com a internet.';
      } else if (err.name === 'AbortError') {
        dica = 'Conexão lenta ou servidor não respondeu (timeout).';
      } else if (httpsPage && !httpsApi) {
        dica = 'Bloqueio por conteúdo não seguro (API em HTTP).';
      } else if (url.includes('.local')) {
        dica = 'Host .local não resolvido no celular (DNS/mDNS).';
      } else {
        dica = 'Possível CORS ou certificado TLS não confiável.';
      }

      throw new Error(`Falha no fetch: ${dica} (${err.message})`);
    } finally {
      clearTimeout(t);
    }
  }

  /* ==========================================================
     POST para a API (se existir o botão #send-api)
     ========================================================== */
  botaoSendApi?.addEventListener('click', async ()=>{
    try {
      botaoSendApi.disabled = true;
      const labelOrig = botaoSendApi.textContent;
      botaoSendApi.textContent = 'Enviando...';
      if (statusPost) statusPost.textContent = '';

      const body = await montarPayloadParaApi();
      await postJson(API_URL, body, { timeoutMs: 20000 });

      if (statusPost) statusPost.textContent = 'Checklist salvo com sucesso!';
      botaoSendApi.textContent = 'Salvo ✅';
      setTimeout(()=> botaoSendApi.textContent = labelOrig, 2000);
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (statusPost) statusPost.textContent = msg;
      alert(msg);
      botaoSendApi.textContent = 'Salvar no Sistema';
    } finally {
      botaoSendApi.disabled = false;
    }
  });

  // Start
  renderizarHotspots();
  renderizarListaAvarias();
})();
