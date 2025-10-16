"use strict";

/* ==========================================================
   HOTSPOTS PREDEFINIDOS — edite conforme o modelo 3D
   ========================================================== */
const pecasPreDefinidas = [
  { id:'capo',            label:'Capô',                   pos:{ x: 1.70, y: 1.00, z: 0.00 },  norm:{ x: 0.00, y: 1.00, z: 0.00 } },
  { id:'porta-malas',     label:'Porta-malas',            pos:{ x:-2.05, y: 1.20, z: 0.00 },  norm:{ x: 0.00, y: 1.00, z: 0.00 } },
  { id:'porta-tras-dir',  label:'Porta Traseira Dir.',    pos:{ x:-0.60, y: 0.65, z: 1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'porta-diant-dir', label:'Porta Dianteira Dir.',   pos:{ x: 0.30, y: 0.65, z: 1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'porta-diant-esq', label:'Porta Dianteira Esq.',   pos:{ x: 0.30, y: 0.65, z:-1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
  { id:'porta-tras-esq',  label:'Porta Traseira Esq.',    pos:{ x:-0.60, y: 0.65, z:-1.00 },  norm:{ x: 0.00, y: 0.00, z: 0.00 } },
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
   BOOTSTRAP DA PÁGINA
   ========================================================== */
(function iniciarApp(){
  const { jsPDF } = window.jspdf;

  // Shortcuts de seleção
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

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

  const botaoCancelarAvaria= $('#cancel-damage');
  const botaoGerarPdf      = $('#generate-pdf');
  const botaoGerarJson     = $('#generate-json');

  // Estado das avarias
  /** @type {{pos3d:{x:number,y:number,z:number}, norm3d:{x:number,y:number,z:number}, type:string, part:string, notes:string, photo?:string, timestamp:number}[]} */
  let avarias = [];
  let indiceEdicao = null;

  /* ---------- Utilitários ---------- */
  const normalizarOuCima = (v)=>{
    const L = Math.hypot(v?.x||0, v?.y||0, v?.z||0);
    return L ? { x:v.x/L, y:v.y/L, z:v.z/L } : { x:0, y:1, z:0 };
  };
  const setarStatus = (chave, texto)=>{
    statusModelo.className = 'badge ' + (chave==='ok' ? 'badge-ok' : chave==='err' ? 'badge-err' : 'badge-warn');
    statusModelo.textContent = texto;
  };
  const pegarValorInput = (id)=> (document.getElementById(id)?.value ?? '').trim();

  // Preencher data/hora inicial
  $('#entry_datetime').value = new Date().toISOString().slice(0,16);

  /* ==========================================================
     CHECKLIST (itens padrão)
     ========================================================== */
  (function construirChecklist(){
    const itens = [
      'Extintor de Incêndio','Tapetes','Rádio/CD/DVD','Alarme','Acendedor de Cigarro',
      'Para-brisa','Palhetas Dianteiras','Faróis Dianteiros','Faróis de Neblina','Tanque de Combustível',
      'Palheta Traseira','Lanternas Traseiras','Estepe','Triângulo','Chave de Roda',
      'Macaco','Antena','Documento do Veículo','Retirada de Pertences'
    ];
    const container = $('#items-checklist');
    itens.forEach(item=>{
      const linha = document.createElement('div');
      linha.className = 'flex items-center justify-between bg-white/70 border border-slate-200 rounded-xl px-3 py-2 shadow-sm';
      linha.innerHTML = `
        <span class="text-sm text-slate-700">${item}</span>
        <div class="select-wrap w-40">
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
     ASSINATURAS
     ========================================================== */
  (function configurarAssinaturas(){
    const configurarCanvas = (id)=>{
      const canvas = $('#'+id);
      const ctx = canvas.getContext('2d');
      let desenhando = false;

      const ratio = Math.max(window.devicePixelRatio||1,1);
      canvas.width  = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      ctx.scale(ratio, ratio);

      ctx.lineWidth = 2;
      ctx.lineCap   = 'round';
      ctx.strokeStyle = '#0f172a';

      const pos = (e)=>{
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : null;
        return { x: (t?t.clientX:e.clientX)-r.left, y: (t?t.clientY:e.clientY)-r.top };
      };
      const iniciar = (e)=>{ e.preventDefault(); desenhando = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      const desenhar = (e)=>{ if(!desenhando) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      const parar = ()=>{ desenhando = false; ctx.closePath(); };

      canvas.addEventListener('mousedown', iniciar);
      canvas.addEventListener('mousemove', desenhar);
      canvas.addEventListener('mouseup', parar);
      canvas.addEventListener('mouseout', parar);
      canvas.addEventListener('touchstart', iniciar);
      canvas.addEventListener('touchmove', desenhar);
      canvas.addEventListener('touchend', parar);
    };

    configurarCanvas('customer-signature');
    configurarCanvas('inspector-signature');

    // Expor função global para botão "Limpar"
    window.clearSignature = (id)=>{
      const canvas = document.getElementById(id);
      const ctx = canvas.getContext('2d');
      const r = Math.max(window.devicePixelRatio||1,1);
      ctx.clearRect(0, 0, canvas.width/r, canvas.height/r);
    };
  })();

  /* ==========================================================
     STATUS DO MODELO 3D
     ========================================================== */
  modelo3d.addEventListener('load', ()=> setarStatus('ok', 'Modelo carregado.'));
  modelo3d.addEventListener('error',()=> setarStatus('err','Erro ao carregar GLB.'));

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

  botaoCancelarAvaria.addEventListener('click', ()=> modalAvaria.close());

  entradaFoto.addEventListener('change', (e)=>{
    const arquivo = e.target.files?.[0];
    if(!arquivo) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      previsualizacaoFoto.src = ev.target.result;
      previsualizacaoFoto.classList.remove('hidden');
    };
    reader.readAsDataURL(arquivo);
  });

  formularioAvaria.addEventListener('submit', (e)=>{
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
    const ratio = Math.max(window.devicePixelRatio||1,1);
    const w = canvas.width/ratio, h = canvas.height/ratio;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(canvas, 0, 0, w, h);
    return tmp.toDataURL('image/png');
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
    return {
      assinaturaClienteBase64:  c1 ? canvasParaBase64(c1) : null,
      assinaturaResponsavelBase64: c2 ? canvasParaBase64(c2) : null
    };
  }

  async function coletarCapturas(){
    const carro = await elementoParaBase64(modelo3d);
    const pagina = await elementoParaBase64(document.querySelector('.max-w-5xl'));
    return { capturaCarroBase64: carro, capturaPaginaBase64: pagina };
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
        km:    pegarValorInput('veic_km')
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

    return {
      meta: {
        geradoEmIso: new Date().toISOString(),
        app: 'Checklist Entrada Veículo 3D',
        versao: '1.0.0'
      },
      cabecalho,
      combustivel,
      checklist,
      avarias: coletarAvarias(),
      assinaturas,
      capturas,
      pecasPreDefinidas
    };
  }

  // Botão: Gerar JSON
  botaoGerarJson?.addEventListener('click', async ()=>{
    try{
      botaoGerarJson.textContent = 'Gerando...';
      botaoGerarJson.disabled = true;

      const dados = await montarChecklistJson();
      console.log('Checklist JSON:', dados);

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

  // Helpers de formatação
  function formatarDataBR(isoOuMs) {
    try { return new Date(isoOuMs).toLocaleString('pt-BR'); } catch { return isoOuMs || ''; }
  }
  function numeroOuVazio(n) {
    const x = Number(n);
    return isNaN(x) ? '' : x.toString();
  }
  function moedaBR(n) {
    const x = Number(n);
    if (isNaN(x)) return '';
    return x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Gera o PDF com base no payload (sem print da tela)
  async function gerarPdfComDados(payload) {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const margem = 12;
    let y = margem;

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Checklist de Entrada de Veículo – 3D', margem, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Gerado em: ${formatarDataBR(payload.meta?.geradoEmIso)}`, 210 - margem, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(200);
    doc.line(margem, y, 210 - margem, y);
    y += 6;

    // Identificação
    const cab = payload.cabecalho || {};
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Identificação', margem, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`O.S Interna: ${cab.osInterna || '-'}`, margem, y);
    doc.text(`Data/Hora Entrada: ${cab.dataHoraEntrada ? formatarDataBR(cab.dataHoraEntrada) : '-'}`, 110, y);
    y += 6;

    doc.text(`Cliente: ${cab.cliente?.nome || '-'}`, margem, y);
    doc.text(`Doc: ${cab.cliente?.doc || '-'}`, 110, y);
    y += 6;

    doc.text(`Telefone: ${cab.cliente?.tel || '-'}`, margem, y);
    doc.text(`Endereço: ${cab.cliente?.end || '-'}`, 110, y);
    y += 6;

    doc.text(`Veículo: ${cab.veiculo?.nome || '-'}`, margem, y);
    doc.text(`Placa: ${cab.veiculo?.placa || '-'}`, 110, y);
    y += 6;

    doc.text(`Cor: ${cab.veiculo?.cor || '-'}`, margem, y);
    doc.text(`KM: ${numeroOuVazio(cab.veiculo?.km) || '-'}`, 110, y);
    y += 8;

    // Combustível
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Nível de Combustível', margem, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Percentual: ${payload.combustivel?.combustivelPercentual ?? 0}%`, margem, y);
    y += 8;

    // Checklist (tabela)
    const linhasChecklist = (payload.checklist || []).map(i => [i.item || '', i.status || '']);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Checklist de Itens', margem, y); y += 2;
    doc.autoTable({
      head: [['Item', 'Status']],
      body: linhasChecklist,
      startY: y + 4,
      margin: { left: margem, right: margem },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });
    y = doc.lastAutoTable.finalY + 8;

    // Avarias (tabela)
    const linhasAvarias = (payload.avarias || []).map(d => [
      d.peca || '',
      d.tipo || '',
      d.observacoes || '',
      d.posicao3d ? `x:${d.posicao3d.x?.toFixed?.(2) ?? d.posicao3d.x} y:${d.posicao3d.y?.toFixed?.(2) ?? d.posicao3d.y} z:${d.posicao3d.z?.toFixed?.(2) ?? d.posicao3d.z}` : '',
      d.normal3d ? `x:${d.normal3d.x?.toFixed?.(2) ?? d.normal3d.x} y:${d.normal3d.y?.toFixed?.(2) ?? d.normal3d.y} z:${d.normal3d.z?.toFixed?.(2) ?? d.normal3d.z}` : '',
      d.timestamp ? formatarDataBR(d.timestamp) : ''
    ]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Avarias Registradas', margem, y); y += 2;
    doc.autoTable({
      head: [['Peça', 'Tipo', 'Observações', 'Posição 3D', 'Normal 3D', 'Registro']],
      body: linhasAvarias,
      startY: y + 4,
      margin: { left: margem, right: margem },
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
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });
    y = doc.lastAutoTable.finalY + 8;

    // Observações
    if (payload.cabecalho?.observacoes) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('Observações', margem, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);

      const obs = doc.splitTextToSize(payload.cabecalho.observacoes, 210 - margem * 2);
      doc.text(obs, margem, y);
      y += (obs.length * 5) + 6;
    }

    // Assinaturas
    const ass = payload.assinaturas || {};
    const wAss = 80, hAss = 30;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Assinaturas', margem, y); y += 6;

    if (ass.assinaturaClienteBase64) {
      doc.addImage(ass.assinaturaClienteBase64, 'PNG', margem, y, wAss, hAss);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Cliente', margem + wAss / 2, y + hAss + 6, { align: 'center' });
    }
    if (ass.assinaturaResponsavelBase64) {
      doc.addImage(ass.assinaturaResponsavelBase64, 'PNG', 210 - margem - wAss, y, wAss, hAss);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Responsável', 210 - margem - (wAss / 2), y + hAss + 6, { align: 'center' });
    }
    y += hAss + 14;

    // Rodapé com paginação
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Página ${i} de ${total}`, 210 - margem, 297 - 8, { align: 'right' });
    }

    // Nome do arquivo
    const placa = document.getElementById('veic_placa')?.value || 'veiculo';
    const dataBR = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    doc.save(`checklist-${placa}-${dataBR}.pdf`);
  }

  // Botão: Gerar PDF (AGORA via dados, não print da tela)
  botaoGerarPdf.addEventListener('click', async ()=>{
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

  // Start
  renderizarHotspots();
  renderizarListaAvarias();
})();
