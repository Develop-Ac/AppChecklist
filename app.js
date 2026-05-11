"use strict";

/* ========== Helpers de seleção DOM ========== */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ========== Config API (sobrescrevível via window.APP_CONFIG) ========== */
const DEFAULT_APP_CONFIG = {
  API_BASE: 'http://oficina-service.acacessorios.local/oficina',
  INTRANET_API_BASE: 'http://intranetbackend.acacessorios.local/oficina',
};

const APP_CONFIG = {
  ...DEFAULT_APP_CONFIG,
  ...(window.APP_CONFIG || {}),
};

const API_BASE = APP_CONFIG.API_BASE;
const INTRANET_API_BASE = APP_CONFIG.INTRANET_API_BASE;

const API_URL = `${API_BASE}/checklists`;
const IMG_API_URL = `${API_BASE}/img`;
const UPLOADS_BASE_URL = `${API_BASE}/uploads`;
const INTRANET_CHECKLISTS_URL = `${INTRANET_API_BASE}/checklists`;
const ORDEM_SERVICO_BASE_URL = `${API_BASE}/ordens-servico`;
const CHECKLIST_DRAFT_KEY = 'oficina-checklist-draft-v1';

function formatDateTimeForCuiaba(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Cuiaba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const map = Object.create(null);
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  } catch {
    const fallback = new Date(date.getTime() - (4 * 60 * 60 * 1000));
    return fallback.toISOString().slice(0, 16);
  }
}

const FOTOS_360_GUIADAS = [
  {
    ordem: 1,
    chave: 'frente',
    titulo: 'Frente do veiculo',
    instrucao: 'Tire uma foto centralizada da frente do veiculo.',
  },
  {
    ordem: 2,
    chave: 'frente_lateral_direita',
    titulo: 'Frente + lateral direita',
    instrucao: 'Posicione-se na diagonal dianteira direita, mostrando a frente e a lateral direita.',
  },
  {
    ordem: 3,
    chave: 'lateral_direita',
    titulo: 'Lateral direita',
    instrucao: 'Tire uma foto da lateral direita completa do veiculo.',
  },
  {
    ordem: 4,
    chave: 'lateral_direita_traseira',
    titulo: 'Lateral direita + traseira',
    instrucao: 'Posicione-se na diagonal traseira direita, mostrando a lateral direita e a traseira.',
  },
  {
    ordem: 5,
    chave: 'traseira',
    titulo: 'Traseira',
    instrucao: 'Tire uma foto centralizada da traseira do veiculo.',
  },
  {
    ordem: 6,
    chave: 'traseira_lateral_esquerda',
    titulo: 'Traseira + lateral esquerda',
    instrucao: 'Posicione-se na diagonal traseira esquerda, mostrando a traseira e a lateral esquerda.',
  },
  {
    ordem: 7,
    chave: 'lateral_esquerda',
    titulo: 'Lateral esquerda',
    instrucao: 'Tire uma foto da lateral esquerda completa do veiculo.',
  },
  {
    ordem: 8,
    chave: 'lateral_esquerda_frente',
    titulo: 'Lateral esquerda + frente do veiculo',
    instrucao: 'Posicione-se na diagonal dianteira esquerda, mostrando a lateral esquerda e a frente.',
  },
];

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

async function fileToDataURL(file) {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/**
 * Compacta um dataURL (PNG/JPEG) para JPEG com qualidade/limite de dimensão.
 * Retorna o próprio dataURL se pequeno (<200KB) ou inválido.
 */
async function compressDataUrl(dataUrl, maxW = 1280, maxH = 1280, quality = 0.65) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;

  const bytes = approxByteLength(dataUrl);
  if (bytes < 200 * 1024) return dataUrl;

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

  const out = canvas.toDataURL('image/jpeg', quality);
  return out;
}

/* ==========================================================
   WIZARD (4 telas)
   ========================================================== */

const totalTelas = 5;
let telaAtual = 0; // Começa na tela inicial (listagem)

function atualizarWizardUI() {
  $$('.tela').forEach(sec=>{
    const n = Number(sec.dataset.tela);
    sec.classList.toggle('hidden', n !== telaAtual);
  });
  $$('.wizard-steps li').forEach(li=>{
    li.classList.toggle('ativo', Number(li.dataset.step) === telaAtual);
  });
  const wizardHeader = document.getElementById('wizard-header');
  if (wizardHeader) {
    wizardHeader.style.display = (telaAtual === 0) ? 'none' : '';
  }
  const wizardNav = document.getElementById('wizard-nav');
  if (wizardNav) {
    wizardNav.style.display = (telaAtual === 0) ? 'none' : '';
  }
  $('#wizard-indice').textContent = String(telaAtual);
  $('#btn-prev').disabled = (telaAtual === 1);
  $('#btn-next').textContent = (telaAtual === totalTelas) ? 'Finalizar' : 'Próximo →';

  if (telaAtual === 5) {
    window.ensureSignaturesReady?.();
    window.renderResumo?.();
  }
}

function irParaTela(n) {
  telaAtual = Math.max(0, Math.min(totalTelas, n));
  atualizarWizardUI();
  window.persistChecklistDraft?.();
}

async function finalizarChecklist() {
  try {
    travarTela('Salvando checklist... Aguarde.');
    
    const body = await montarPayloadParaApi();
    const resp = await postJson(API_URL, body, { timeoutMs: 20000 });
    
    if (!resp) throw new Error('Erro ao salvar o checklist.');
    
    // Sucesso: resetar e voltar para listagem
    resetChecklistUI({ goToList: true, silent: true });
    irParaTela(0);
    
    if (statusPost) statusPost.textContent = 'Checklist salvo com sucesso!';
  } catch (err) {
    console.error('[FINALIZAR CHECKLIST]', err);
    const msg = String(err?.message || err);
    if (statusPost) statusPost.textContent = msg;
    alert(`Erro ao salvar checklist: ${msg}`);
    // Manter na tela 4 (não redireciona)
  } finally {
    destravarTela();
  }
}

function proximaTela() {
  if (telaAtual < totalTelas) {
    irParaTela(telaAtual + 1);
  } else {
    finalizarChecklist();
  }
}

function telaAnterior() { irParaTela(telaAtual - 1); }

// Estado da paginação/filtro
let paginaAtual = 1;
let totalPaginas = 1;
let filtroPlaca = '';
const ITENS_POR_PAGINA = 20;
let checklistEntregaAtual = null;
let deliveryPhotosFlat = [];
let deliveryLightboxIndex = 0;

function formatarDataHora(valor) {
  if (!valor) return '-';
  try {
    return new Date(valor).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function sanitizeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizarStatusChecklist(status) {
  return String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function obterDataHoraEntrega(item) {
  return (
    item?.dataHoraEntrega ||
    item?.data_hora_entrega ||
    item?.datahoraentrega ||
    item?.data_entrega ||
    item?.dtEntrega ||
    null
  );
}

function possuiDataHoraEntrega(item) {
  const valor = obterDataHoraEntrega(item);
  if (!valor) return false;

  if (valor instanceof Date) {
    return !Number.isNaN(valor.getTime());
  }

  const parsed = new Date(valor);
  return !Number.isNaN(parsed.getTime());
}

function checklistEntregue(item) {
  const status = normalizarStatusChecklist(item?.status);
  return Boolean(
    possuiDataHoraEntrega(item) ||
    status === 'ENTREGUE' ||
    status === 'ENTREGE' ||
    status === 'VEICULO ENTREGUE' ||
    status === 'VEICULO ENTREGE' ||
    item?.assinaturaRetiradaBase64,
  );
}

function checklistFinalizado(item) {
  const status = normalizarStatusChecklist(item?.status);
  return !status || status.includes('FINAL') || status === 'CONCLUIDO';
}

async function resolverUrlFoto(tipo, key) {
  if (!key) return null;
  if (String(key).startsWith('data:image')) return key;

  const endpoints = tipo === 'avaria'
    ? [`${UPLOADS_BASE_URL}/avarias/url`]
    : [`${UPLOADS_BASE_URL}/fotos/url`, `${UPLOADS_BASE_URL}/avarias/url`];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`);
      if (!resp.ok) continue;
      const json = await resp.json();
      if (json?.url) return json.url;
    } catch {
      // tenta o proximo endpoint
    }
  }

  return null;
}

function atualizarLightboxEntrega() {
  if (!deliveryPhotosFlat.length) return;
  const foto = deliveryPhotosFlat[deliveryLightboxIndex];
  const img = document.getElementById('delivery-lightbox-image');
  const caption = document.getElementById('delivery-lightbox-caption');
  if (img) img.src = foto.url;
  if (caption) {
    caption.textContent = `${foto.titulo} | ${formatarDataHora(foto.timestamp)}`;
  }
}

function extrairMetaFoto360(origem, idx = 0) {
  const raw = origem?.foto ?? origem?.key ?? origem?.fileName ?? null;
  const tipoFotoRaw = origem?.tipo_foto ?? null;
  let parsed = null;
  let parsedTipoFoto = null;

  if (raw && typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw;
  }

  if (tipoFotoRaw && typeof tipoFotoRaw === 'string') {
    try {
      parsedTipoFoto = JSON.parse(tipoFotoRaw);
    } catch {
      parsedTipoFoto = null;
    }
  } else if (tipoFotoRaw && typeof tipoFotoRaw === 'object') {
    parsedTipoFoto = tipoFotoRaw;
  }

  const key = typeof origem?.key === 'string' && origem.key.trim()
    ? origem.key.trim()
    : typeof parsed?.foto === 'string' && parsed.foto.trim()
      ? parsed.foto.trim()
      : typeof parsed?.key === 'string' && parsed.key.trim()
        ? parsed.key.trim()
        : typeof parsed?.fileName === 'string' && parsed.fileName.trim()
          ? parsed.fileName.trim()
          : typeof raw === 'string' && raw.trim() && !raw.trim().startsWith('{')
            ? raw.trim()
            : '';

  return {
    id: origem?.id,
    key,
    tipo: origem?.tipo || parsedTipoFoto?.tipo || parsed?.tipo || 'foto_360',
    posicao: origem?.posicao || parsedTipoFoto?.posicao || parsed?.posicao || null,
    ordem: origem?.ordem || parsedTipoFoto?.ordem || parsed?.ordem || idx + 1,
    descricao: origem?.descricao || parsedTipoFoto?.descricao || parsed?.descricao || null,
    timestamp: origem?.timestamp || null,
  };
}

function normalizarFotos360Entrega(payload) {
  if (Array.isArray(payload?.fotos360) && payload.fotos360.length) {
    return payload.fotos360.map((foto, idx) => extrairMetaFoto360(foto, idx)).filter((foto) => !!foto.key);
  }

  if (Array.isArray(payload?.ofi_checklists_fotos) && payload.ofi_checklists_fotos.length) {
    return payload.ofi_checklists_fotos.map((foto, idx) => extrairMetaFoto360(foto, idx)).filter((foto) => !!foto.key);
  }

  return [];
}

async function abrirTelaEntregaVeiculo(item) {
  if (!item?.id) return;

  const modalDetalhe = document.getElementById('checklist-detail-modal');
  const modalEntrega = document.getElementById('delivery-modal');
  const wrap = document.getElementById('delivery-content');
  const status = document.getElementById('delivery-status');
  const submit = document.getElementById('delivery-submit');
  if (!modalEntrega || !wrap) return;

  if (status) status.textContent = '';
  if (submit) submit.disabled = true;
  wrap.innerHTML = '<p class="text-sm text-slate-500">Carregando dados da entrega...</p>';

  modalDetalhe?.close();
  modalEntrega.showModal();

  try {
    let resp = await fetch(`${API_URL}/${encodeURIComponent(item.id)}/entrega`);
    let data = null;

    if (resp.ok) {
      data = await resp.json();
    } else if (item?.osInterna) {
      // Fallback para ambientes onde a rota nova ainda nao foi publicada corretamente.
      const fallbackResp = await fetch(`${API_URL}/${encodeURIComponent(item.osInterna)}`);
      if (!fallbackResp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(txt || `Falha ao carregar detalhes da entrega (${resp.status}).`);
      }
      const fallbackData = await fallbackResp.json();
      data = {
        id: fallbackData.id,
        osInterna: fallbackData.osInterna,
        dataHoraEntrada: fallbackData.dataHoraEntrada,
        dataHoraEntrega: fallbackData.dataHoraEntrega,
        clienteNome: fallbackData.clienteNome,
        veiculoNome: fallbackData.veiculoNome,
        veiculoPlaca: fallbackData.veiculoPlaca,
        combustivelPercentual: fallbackData.combustivelPercentual,
        checklistItems: fallbackData.ofi_checklists_items || [],
        avarias: fallbackData.ofi_checklists_avarias || [],
        fotosAvarias: (fallbackData.ofi_checklists_avarias || []).filter((a) => !!a.fotoBase64).map((a) => ({
          id: a.id,
          key: a.fotoBase64,
          peca: a.peca,
          tipo: a.tipo,
          observacoes: a.observacoes,
          timestamp: a.timestamp,
        })),
        fotos360: normalizarFotos360Entrega(fallbackData),
      };
    } else {
      const txt = await resp.text().catch(() => '');
      throw new Error(txt || `Falha ao carregar detalhes da entrega (${resp.status}).`);
    }

    checklistEntregaAtual = data;

    try {
      const fotosResp = await fetch(`${IMG_API_URL}/${encodeURIComponent(data.id)}`);
      if (fotosResp.ok) {
        const fotosJson = await fotosResp.json();
        if (Array.isArray(fotosJson?.fotos)) {
          data.ofi_checklists_fotos = fotosJson.fotos;
        }
      }
    } catch {
      // Mantem fallback para o payload atual de entrega.
    }

    const fotosAvarias = await Promise.all((data.fotosAvarias || []).map(async (f, idx) => ({
      tipo: 'avaria',
      titulo: `${f.peca || 'Avaria'} ${idx + 1}`,
      subtitulo: f.tipo || '',
      timestamp: f.timestamp,
      key: f.key,
      url: await resolverUrlFoto('avaria', f.key),
    })));

    const fotos360Base = normalizarFotos360Entrega(data);

    const fotos360 = await Promise.all(fotos360Base.map(async (f, idx) => ({
      tipo: 'foto360',
      titulo: f.descricao || f.posicao || `Foto 360 ${idx + 1}`,
      subtitulo: f.posicao || '',
      timestamp: f.timestamp,
      key: f.key,
      url: await resolverUrlFoto('foto360', f.key),
    })));

    const itensHtml = (data.checklistItems || []).map((i) => `
      <div class="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white/70">
        <span class="text-sm text-slate-700">${sanitizeHtml(i.item || '-')}</span>
        <span class="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">${sanitizeHtml(i.status || '-')}</span>
      </div>
    `).join('');

    const montarFotos = (fotos, secao) => {
      if (!fotos.length) return '<p class="text-sm text-slate-500">Nenhuma foto disponível.</p>';
      return `<div class="delivery-grid">${fotos.map((f, idx) => `
        <article class="delivery-thumb">
          <button type="button" class="delivery-thumb-button" data-delivery-photo="${sanitizeHtml(secao)}:${idx}" ${f.url ? '' : 'disabled'}>
            ${f.url
              ? `<img src="${sanitizeHtml(f.url)}" alt="${sanitizeHtml(f.titulo)}">`
              : '<div class="h-full w-full flex items-center justify-center text-xs text-slate-500">Imagem indisponível</div>'}
          </button>
          <div class="delivery-thumb-meta">
            <p class="font-semibold">${sanitizeHtml(f.titulo)}</p>
            <p>${sanitizeHtml(f.subtitulo || '-')}</p>
            <p>${sanitizeHtml(formatarDataHora(f.timestamp))}</p>
          </div>
        </article>
      `).join('')}</div>`;
    };

    wrap.innerHTML = `
      <section class="delivery-section">
        <h4 class="delivery-section-title">Identificação</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span class="font-semibold text-slate-700">OS:</span> ${sanitizeHtml(data.osInterna || '-')}</div>
          <div><span class="font-semibold text-slate-700">Placa:</span> ${sanitizeHtml(data.veiculoPlaca || '-')}</div>
          <div><span class="font-semibold text-slate-700">Cliente:</span> ${sanitizeHtml(data.clienteNome || '-')}</div>
          <div><span class="font-semibold text-slate-700">Entrada:</span> ${sanitizeHtml(formatarDataHora(data.dataHoraEntrada))}</div>
        </div>
      </section>
      <section class="delivery-section">
        <h4 class="delivery-section-title">Itens do Checklist</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${itensHtml || '<p class="text-sm text-slate-500">Sem itens.</p>'}</div>
      </section>
      <section class="delivery-section">
        <h4 class="delivery-section-title">Fotos de Avaria</h4>
        ${montarFotos(fotosAvarias, 'avaria')}
      </section>
      <section class="delivery-section">
        <h4 class="delivery-section-title">Fotos 360</h4>
        ${montarFotos(fotos360, 'foto360')}
      </section>
    `;

    deliveryPhotosFlat = [...fotosAvarias, ...fotos360].filter((f) => !!f.url);
    if (submit) submit.disabled = false;

    requestAnimationFrame(() => {
      window.ensureSingleSignatureReady?.('delivery-signature');
      window.clearSignature?.('delivery-signature');
    });
  } catch (err) {
    const mensagem = String(err?.message || err || 'Erro desconhecido ao abrir entrega.');
    wrap.innerHTML = `<p class="text-sm text-rose-600">Falha ao abrir tela de entrega.</p><p class="text-xs text-slate-500 mt-2">${sanitizeHtml(mensagem)}</p>`;
    if (status) status.textContent = mensagem;
  }
}

function assinaturaCanvasVazio(canvas) {
  if (typeof window.canvasVazio === 'function') {
    return window.canvasVazio(canvas);
  }

  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return true;

  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false;
  }
  return true;
}

function assinaturaCanvasParaBase64(canvas) {
  if (typeof window.canvasParaBase64 === 'function') {
    return window.canvasParaBase64(canvas);
  }

  try {
    return canvas?.toDataURL?.('image/png') || null;
  } catch {
    return null;
  }
}

async function concluirEntregaVeiculo() {
  const assinatura = document.getElementById('delivery-signature');
  const status = document.getElementById('delivery-status');
  const submit = document.getElementById('delivery-submit');
  const overlay = document.getElementById('global-loading-overlay');
  const msg = document.getElementById('global-loading-message');
  if (!checklistEntregaAtual?.id || !assinatura) return;

  // Reusa o mesmo criterio de validação da assinatura do checklist.
  if (assinaturaCanvasVazio(assinatura)) {
    if (status) status.textContent = 'Assine a retirada do cliente antes de concluir.';
    return;
  }

  // Mantém o mesmo formato base (PNG dataURL) e compressão das assinaturas do checklist.
  let assinaturaBase64 = assinaturaCanvasParaBase64(assinatura);
  assinaturaBase64 = await compressDataUrl(assinaturaBase64, 1000, 400, 0.7);
  if (submit) submit.disabled = true;
  if (status) status.textContent = '';
  if (msg) msg.textContent = 'Salvando entrega do veículo... Aguarde.';
  if (overlay) overlay.classList.remove('hidden');

  try {
    const resp = await fetch(`${API_URL}/${encodeURIComponent(checklistEntregaAtual.id)}/entregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assinaturaRetiradaBase64: assinaturaBase64 }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(txt || 'Falha ao concluir entrega.');
    }

    document.getElementById('delivery-modal')?.close();
    await carregarChecklists({ pagina: paginaAtual, placa: filtroPlaca });
    alert('Entrega do veículo concluída com sucesso.');
  } catch (err) {
    if (status) status.textContent = String(err?.message || err);
  } finally {
    if (submit) submit.disabled = false;
    if (overlay) overlay.classList.add('hidden');
  }
}

async function buscarListaChecklists(pagina, placaBusca) {
  const params = new URLSearchParams({
    page: String(pagina),
    pageSize: String(ITENS_POR_PAGINA),
  });
  if (placaBusca) params.set('search', placaBusca);

  const urlOficina = `${API_URL}?${params.toString()}`;
  const respOficina = await fetch(urlOficina);
  if (respOficina.ok) {
    return respOficina.json();
  }

  const urlIntranet = `${INTRANET_CHECKLISTS_URL}?page=${encodeURIComponent(String(pagina))}&perPage=${encodeURIComponent(String(ITENS_POR_PAGINA))}${placaBusca ? `&search=${encodeURIComponent(placaBusca)}` : ''}`;
  const respIntranet = await fetch(urlIntranet);
  if (!respIntranet.ok) {
    throw new Error('Erro ao buscar checklists');
  }
  return respIntranet.json();
}

// Função para buscar e exibir checklists com paginação e filtro
async function carregarChecklists({pagina, placa} = {}) { console.log('carregarChecklists', {pagina, placa});
  const tbody = document.getElementById('checklists-tbody');
  const paginacaoInfo = document.getElementById('paginacao-info');
  const btnAnterior = document.getElementById('btn-pag-anterior');
  const btnProxima = document.getElementById('btn-pag-proxima');
  const filtroInput = document.getElementById('filtro-placa');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-6">Carregando...</td></tr>`;
  paginaAtual = pagina || paginaAtual || 1;
  // Sempre pega o valor atual do input, se existir
  let placaBusca = (typeof placa === 'string') ? placa : (filtroInput ? filtroInput.value.trim().toUpperCase() : '');
  filtroPlaca = placaBusca;

  try {
    const json = await buscarListaChecklists(paginaAtual, placaBusca);
    totalPaginas = json.totalPages || 1;
    if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-6">Nenhum checklist encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = json.data.map(item => `
        <tr class="hover:bg-blue-50 transition cursor-pointer" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
          <td class="px-4 py-2 font-mono text-xs">${item.osInterna || '-'}</td>
          <td class="px-4 py-2">${item.clienteNome || '-'}</td>
          <td class="px-4 py-2">${item.veiculoNome || '-'}</td>
          <td class="px-4 py-2">${item.veiculoPlaca || '-'}</td>
          <td class="px-4 py-2">${item.dataHoraEntrada ? new Date(item.dataHoraEntrada).toLocaleString('pt-BR') : '-'}</td>
          <td class="px-4 py-2">${item.combustivelPercentual != null ? item.combustivelPercentual + '%' : '-'}</td>
          <td class="px-4 py-2">${checklistEntregue(item) ? '<span class="text-emerald-700 text-xs font-semibold">Veiculo entregue</span>' : ''}</td>
        </tr>
      `).join('');
      // Delega clique nas linhas
      tbody.querySelectorAll('tr[data-item]').forEach(tr => {
        tr.addEventListener('click', () => {
          try { abrirDetalheChecklist(JSON.parse(tr.dataset.item)); } catch(err) { console.error(err); }
        });
      });
    }
    // Atualiza paginação
    if (paginacaoInfo) paginacaoInfo.textContent = `Página ${paginaAtual}/${totalPaginas}`;
    if (btnAnterior) btnAnterior.disabled = paginaAtual <= 1;
    if (btnProxima) btnProxima.disabled = paginaAtual >= totalPaginas;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-400 py-6">Erro ao carregar checklists</td></tr>`;
    if (paginacaoInfo) paginacaoInfo.textContent = '';
    if (btnAnterior) btnAnterior.disabled = true;
    if (btnProxima) btnProxima.disabled = true;
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Botão Novo (tela inicial)
  const btnNovo = document.getElementById('btn-novo-checklist');
  if (btnNovo) {
    btnNovo.addEventListener('click', () => {
      window.clearChecklistDraft?.();
      window.resetChecklistUI?.({ silent: true, goToList: false });
      telaAtual = 1;
      atualizarWizardUI();
      window.persistChecklistDraft?.();
    });
  }

  const btnVoltarListagem = document.getElementById('btn-voltar-listagem');
  const modalConfirmExit = document.getElementById('confirm-exit-modal');
  const btnContinuarChecklist = document.getElementById('btn-continuar-checklist');
  const btnSairChecklist = document.getElementById('btn-sair-checklist');

  btnVoltarListagem?.addEventListener('click', () => {
    if (!modalConfirmExit) {
      window.resetChecklistUI?.({ goToList: true });
      return;
    }
    modalConfirmExit.showModal();
  });

  btnContinuarChecklist?.addEventListener('click', () => {
    modalConfirmExit?.close();
  });

  btnSairChecklist?.addEventListener('click', () => {
    modalConfirmExit?.close();
    window.resetChecklistUI?.({ goToList: true });
  });

  // Filtro por placa
  const filtroForm = document.getElementById('filtro-form');
  const filtroInput = document.getElementById('filtro-placa');
  if (filtroForm && filtroInput) {
    filtroForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const placaBusca = filtroInput.value.trim().toUpperCase();
      paginaAtual = 1;
      filtroPlaca = placaBusca;
      console.log('Filtrando por placa:', placaBusca);  
      await carregarChecklists({pagina: 1, placa: placaBusca});
    });
    filtroInput.addEventListener('input', (e) => {
      filtroInput.value = filtroInput.value.toUpperCase();
    });
  }

  // Paginação
  const btnAnterior = document.getElementById('btn-pag-anterior');
  const btnProxima = document.getElementById('btn-pag-proxima');
  if (btnAnterior) { console.log('Adicionando evento ao btnAnterior');
    btnAnterior.addEventListener('click', () => { console.log('Clique em Anterior, página atual:', paginaAtual);
      paginaAtual = paginaAtual - 1;
      carregarChecklists({pagina: paginaAtual});
    });
  }
  if (btnProxima) { console.log('Adicionando evento ao btnProxima');
    btnProxima.addEventListener('click', () => { console.log('Clique em Próxima, página atual:', paginaAtual, 'total páginas:', totalPaginas);
      paginaAtual = paginaAtual + 1;
      carregarChecklists({pagina: paginaAtual });
    });
  }

  // Preview da foto no modal de detalhe
  document.addEventListener('change', (e) => {
    if (e.target.id === 'detail-foto-input') {
      const preview = document.getElementById('detail-foto-preview');
      if (preview && e.target.files && e.target.files[0]) {
        preview.src = URL.createObjectURL(e.target.files[0]);
        preview.classList.remove('hidden');
      }
    }
  });

  // Carregar checklists ao abrir
  if (document.querySelector('[data-tela="0"]')) {
    carregarChecklists({pagina: 1});
  }

  document.getElementById('delivery-close')?.addEventListener('click', () => {
    document.getElementById('delivery-modal')?.close();
  });
  document.getElementById('delivery-submit')?.addEventListener('click', concluirEntregaVeiculo);

  const deliveryWrap = document.getElementById('delivery-content');
  deliveryWrap?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-delivery-photo]');
    if (!target) return;
    const [secao, idxRaw] = String(target.dataset.deliveryPhoto || '').split(':');
    const idx = Number(idxRaw);
    if (!Number.isFinite(idx)) return;

    const lista = deliveryPhotosFlat.filter((f) => f.tipo === secao || (secao === 'foto360' && f.tipo === 'foto360'));
    if (!lista[idx]?.url) return;
    deliveryPhotosFlat = lista;
    deliveryLightboxIndex = idx;
    atualizarLightboxEntrega();
    document.getElementById('delivery-photo-lightbox')?.showModal();
  });

  document.getElementById('delivery-lightbox-close')?.addEventListener('click', () => {
    document.getElementById('delivery-photo-lightbox')?.close();
  });
  document.getElementById('delivery-lightbox-prev')?.addEventListener('click', () => {
    if (!deliveryPhotosFlat.length) return;
    deliveryLightboxIndex = (deliveryLightboxIndex - 1 + deliveryPhotosFlat.length) % deliveryPhotosFlat.length;
    atualizarLightboxEntrega();
  });
  document.getElementById('delivery-lightbox-next')?.addEventListener('click', () => {
    if (!deliveryPhotosFlat.length) return;
    deliveryLightboxIndex = (deliveryLightboxIndex + 1) % deliveryPhotosFlat.length;
    atualizarLightboxEntrega();
  });

  $('#btn-prev')?.addEventListener('click', telaAnterior);
  $('#btn-next')?.addEventListener('click', proximaTela);
  $$('.wizard-steps li').forEach(li=>{
    li.addEventListener('click', ()=> irParaTela(Number(li.dataset.step)));
  });

  const restored = window.restoreChecklistDraft?.() === true;
  if (!restored) {
    atualizarWizardUI();
  }
});

/* ==========================================================
   DETALHE DO CHECKLIST + UPLOAD DE FOTO
   ========================================================== */

async function abrirDetalheChecklist(item) {
  const modal = document.getElementById('checklist-detail-modal');
  if (!modal) return;

  document.getElementById('detail-os').textContent       = item.osInterna    || '-';
  document.getElementById('detail-cliente').textContent  = item.clienteNome  || '-';
  document.getElementById('detail-veiculo').textContent  = item.veiculoNome  || '-';
  document.getElementById('detail-placa').textContent    = item.veiculoPlaca || '-';
  document.getElementById('detail-entrada').textContent  = item.dataHoraEntrada
    ? new Date(item.dataHoraEntrada).toLocaleString('pt-BR') : '-';
  document.getElementById('detail-combustivel').textContent =
    item.combustivelPercentual != null ? item.combustivelPercentual + '%' : '-';

  // Guarda o id do checklist no modal para uso no upload
  modal.dataset.checklistId = item.id;

  // Limpa estado anterior
  const fotoInput  = document.getElementById('detail-foto-input');
  const fotoStatus = document.getElementById('detail-foto-status');
  const fotoPreview = document.getElementById('detail-foto-preview');
  const btnEntrega = document.getElementById('detail-btn-entregar');
  if (fotoInput)  fotoInput.value  = '';
  if (fotoStatus) fotoStatus.textContent = '';
  if (fotoPreview) { fotoPreview.src = ''; fotoPreview.classList.add('hidden'); }

  if (btnEntrega) {
    let dadosAtualizados = item;
    if (item?.id) {
      try {
        const respEntrega = await fetch(`${API_URL}/${encodeURIComponent(item.id)}/entrega`);
        if (respEntrega.ok) {
          const payloadEntrega = await respEntrega.json();
          dadosAtualizados = {
            ...item,
            dataHoraEntrega: payloadEntrega.dataHoraEntrega || item.dataHoraEntrega,
            assinaturaRetiradaBase64: payloadEntrega.assinaturaRetiradaBase64 || item.assinaturaRetiradaBase64,
          };
        }
      } catch {
        // Se falhar atualização de status, mantém os dados da listagem.
      }
    }

    const entregue = checklistEntregue(dadosAtualizados);
    const finalizado = checklistFinalizado(dadosAtualizados);
    btnEntrega.classList.toggle('hidden', entregue || !finalizado);
    btnEntrega.onclick = () => abrirTelaEntregaVeiculo(item);
  }

  modal.showModal();
}

async function enviarFotoChecklist() {
  const modal      = document.getElementById('checklist-detail-modal');
  const fotoInput  = document.getElementById('detail-foto-input');
  const fotoStatus = document.getElementById('detail-foto-status');
  const btnEnviar  = document.getElementById('detail-btn-foto');

  const checklistId = modal?.dataset?.checklistId;
  if (!checklistId) { fotoStatus.textContent = 'ID do checklist não encontrado.'; return; }
  if (!fotoInput?.files?.length) { fotoStatus.textContent = 'Selecione uma foto primeiro.'; return; }

  btnEnviar.disabled = true;
  fotoStatus.textContent = 'Enviando...';
  fotoStatus.className = 'text-sm text-slate-500 mt-2';

  try {
    // 1. Faz upload do arquivo
    const formData = new FormData();
    formData.append('file', fotoInput.files[0], fotoInput.files[0].name);
    const uploadResp = await fetch(`${UPLOADS_BASE_URL}/checklist`, {
      method: 'POST',
      body: formData,
    });
    if (!uploadResp.ok) throw new Error(`Falha ao fazer upload da foto (${uploadResp.status})`);
    const uploadJson = await uploadResp.json();
    const fileName = uploadJson.fileName || uploadJson.key;
    if (!fileName) throw new Error('Nome do arquivo não retornado');

    // 2. Associa a foto ao checklist
    // Usa o número da OS em vez do checklistId para associar a foto, pois o serviço de fotos espera isso
    const fotoResp = await fetch(`${API_URL}/${checklistId}/fotos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto: fileName }),
    });
    if (!fotoResp.ok) throw new Error('Falha ao associar foto ao checklist');

    fotoStatus.textContent = 'Foto enviada com sucesso!';
    fotoStatus.className = 'text-sm text-emerald-600 mt-2 font-semibold';
    fotoInput.value = '';
    const fotoPreview = document.getElementById('detail-foto-preview');
    if (fotoPreview) { fotoPreview.src = ''; fotoPreview.classList.add('hidden'); }
  } catch (e) {
    fotoStatus.textContent = 'Erro: ' + e.message;
    fotoStatus.className = 'text-sm text-red-500 mt-2';
    console.error(e);
  } finally {
    btnEnviar.disabled = false;
  }
}

/* ==========================================================
   HOTSPOTS PREDEFINIDOS
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

  /* ---------- Cache de elementos (UMA única vez) ---------- */
  const statusModelo       = $('#model-status');
  const listaAvarias       = $('#damages-list');

  const modalAvaria        = $('#damage-modal');
  const formularioAvaria   = $('#damage-form');
  const botaoSalvarAvaria  = $('#save-damage');
  const entradaPosicao3d   = $('#damage-3d-pos');
  const entradaNormal3d    = $('#damage-3d-norm');
  const entradaPeca        = $('#damage-part');
  const entradaObservacoes = $('#damage-notes');
  const entradaFoto        = $('#damage-photo');
  const previsualizacaoFoto= $('#photo-preview');
  const loadingOverlay     = $('#global-loading-overlay');
  const loadingMessage     = $('#global-loading-message');

  const botaoGerarPdf      = $('#generate-pdf');
  const botaoGerarJson     = $('#generate-json');

  const botaoSendApi       = $('#send-api');
  const statusPost         = $('#post-status');

  // Estado das avarias
  /** @type {{pos3d:{x:number,y:number,z:number}, norm3d:{x:number,y:number,z:number}, type:string, part:string, notes:string, fotoBase64?:string, timestamp:number}[]} */
  let avarias = [];
  let indiceEdicao = null;
  let lockTelaContador = 0;
  let uploadAvariaEmAndamento = false;
  let uploadFoto360EmAndamento = false;

  function travarTela(msg = 'Enviando foto... Aguarde.') {
    lockTelaContador += 1;
    if (loadingMessage) loadingMessage.textContent = msg;
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  }

  function destravarTela() {
    lockTelaContador = Math.max(0, lockTelaContador - 1);
    if (lockTelaContador === 0 && loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  function telaTravada() {
    return lockTelaContador > 0;
  }

  // Estado das fotos 360 guiadas
  const foto360GuidedInput = $('#foto360-guided-input');
  const fotos360Grid = $('#fotos360-grid');
  const fotos360Status = $('#foto360-guided-status');
  const fotos360Progresso = $('#fotos360-progresso');
  const fotos360ProgressBar = $('#fotos360-progress-bar');
  const fotos360AtualIndice = $('#fotos360-atual-indice');
  const fotos360AtualTitulo = $('#fotos360-atual-titulo');
  const fotos360AtualInstrucao = $('#fotos360-atual-instrucao');

  let foto360TargetKey = null;
  let fotos360State = FOTOS_360_GUIADAS.reduce((acc, p) => {
    acc[p.chave] = {
      ...p,
      foto: null,
      status: 'pendente',
      previewUrl: null,
    };
    return acc;
  }, {});

  function fotos360Pendentes() {
    return FOTOS_360_GUIADAS.filter((p) => !fotos360State[p.chave]?.foto);
  }

  function fotos360Capturadas() {
    return FOTOS_360_GUIADAS.filter((p) => !!fotos360State[p.chave]?.foto).length;
  }

  function montarFotos360Payload() {
    return FOTOS_360_GUIADAS
      .map((p) => {
        const st = fotos360State[p.chave];
        if (!st?.foto) return null;
        return {
          tipo: 'foto_360',
          posicao: p.chave,
          ordem: p.ordem,
          descricao: p.titulo,
          foto: st.foto,
        };
      })
      .filter(Boolean);
  }

  function atualizarCardFotoAtual() {
    if (!fotos360AtualIndice || !fotos360AtualTitulo || !fotos360AtualInstrucao) return;
    const pendente = fotos360Pendentes()[0] || FOTOS_360_GUIADAS[FOTOS_360_GUIADAS.length - 1];
    fotos360AtualIndice.textContent = `Foto ${pendente.ordem} de 8`;
    fotos360AtualTitulo.textContent = pendente.titulo;
    fotos360AtualInstrucao.textContent = pendente.instrucao;
  }

  function badgeStatus(st) {
    if (st === 'capturada') return '<span class="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">capturada</span>';
    if (st === 'refeita') return '<span class="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">refeita</span>';
    return '<span class="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">pendente</span>';
  }

  function renderizarFotos360Guiadas() {
    if (!fotos360Grid) return;

    const capturadas = fotos360Capturadas();
    const percentual = Math.round((capturadas / FOTOS_360_GUIADAS.length) * 100);
    if (fotos360Progresso) fotos360Progresso.textContent = `${capturadas}/8 capturadas`;
    if (fotos360ProgressBar) fotos360ProgressBar.style.width = `${percentual}%`;

    fotos360Grid.innerHTML = FOTOS_360_GUIADAS.map((p) => {
      const st = fotos360State[p.chave];
      const temFoto = !!st?.foto;
      const preview = st?.previewUrl
        ? `<img src="${st.previewUrl}" class="rounded-lg border border-slate-200 max-h-24 w-auto" alt="Preview ${p.titulo}">`
        : '<div class="text-xs text-slate-400">Sem foto</div>';

      return `
        <article class="rounded-xl border border-slate-200 bg-white/70 p-3 space-y-2" data-foto360-item="${p.chave}">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-semibold text-slate-500">Foto ${p.ordem} de 8</p>
              <p class="text-sm font-bold text-slate-800">${p.titulo}</p>
              <p class="text-xs text-slate-600">${p.instrucao}</p>
            </div>
            ${badgeStatus(st?.status || 'pendente')}
          </div>
          <div>${preview}</div>
          <button type="button" class="foto360-capturar inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold" data-foto360-key="${p.chave}">
            ${temFoto ? 'Refazer foto' : 'Capturar foto'}
          </button>
        </article>
      `;
    }).join('');

    atualizarCardFotoAtual();
  }

  async function uploadFoto360(file) {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(`${UPLOADS_BASE_URL}/checklist`, {
      method: 'POST',
      body: form,
    });
    if (!resp.ok) throw new Error('Falha ao enviar foto 360.');
    const data = await resp.json();
    if (!data?.ok || !data?.key) {
      throw new Error('Resposta invalida no upload da foto 360.');
    }
    return data.key;
  }

  fotos360Grid?.addEventListener('click', (e) => {
    if (telaTravada() || uploadFoto360EmAndamento) return;
    const botao = e.target.closest('.foto360-capturar');
    if (!botao) return;
    foto360TargetKey = botao.dataset.foto360Key;
    foto360GuidedInput?.click();
  });

  foto360GuidedInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !foto360TargetKey) return;
    if (uploadFoto360EmAndamento || telaTravada()) {
      foto360GuidedInput.value = '';
      foto360TargetKey = null;
      return;
    }

    const current = fotos360State[foto360TargetKey];
    if (!current) return;
    uploadFoto360EmAndamento = true;

    try {
      travarTela('Enviando foto... Aguarde.');
      if (fotos360Status) fotos360Status.textContent = `Enviando foto da posicao: ${current.titulo}...`;
      const key = await uploadFoto360(file);

      if (current.previewUrl) {
        try { URL.revokeObjectURL(current.previewUrl); } catch {}
      }

      const eraCapturada = !!current.foto;
      current.foto = key;
      current.previewUrl = URL.createObjectURL(file);
      current.status = eraCapturada ? 'refeita' : 'capturada';

      if (fotos360Status) {
        fotos360Status.textContent = `Foto salva para ${current.titulo}.`;
      }
      renderizarFotos360Guiadas();
    } catch (err) {
      console.error(err);
      if (fotos360Status) fotos360Status.textContent = 'Erro ao enviar foto 360. Tente novamente.';
    } finally {
      uploadFoto360EmAndamento = false;
      destravarTela();
      foto360GuidedInput.value = '';
      foto360TargetKey = null;
    }
  });

  function limparFotos360State() {
    FOTOS_360_GUIADAS.forEach((p) => {
      const st = fotos360State[p.chave];
      if (st?.previewUrl) {
        try { URL.revokeObjectURL(st.previewUrl); } catch {}
      }
      fotos360State[p.chave] = {
        ...p,
        foto: null,
        status: 'pendente',
        previewUrl: null,
      };
    });

    if (fotos360Status) fotos360Status.textContent = '';
    if (foto360GuidedInput) foto360GuidedInput.value = '';
    foto360TargetKey = null;
    renderizarFotos360Guiadas();
  }

  window.getFotos360Payload = montarFotos360Payload;
  window.hasFotos360Incompletas = () => fotos360Pendentes().length > 0;
  window.getFotos360MissingTitles = () => fotos360Pendentes().map((p) => `Foto ${p.ordem}: ${p.titulo}`);
  window.resetFotos360State = limparFotos360State;

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

  // Preencher data/hora inicial com fuso de Cuiaba (UTC-4)
  const entryDt = $('#entry_datetime');
  if (entryDt) entryDt.value = formatDateTimeForCuiaba();

  /* ==========================================================
     AUTO-PREENCHER PELOS DADOS DA O.S
     ========================================================== */
  const osInput   = document.getElementById('os_interna');
  const cliNome   = document.getElementById('cli_nome');
  const cliDoc    = document.getElementById('cli_doc');
  const cliTel    = document.getElementById('cli_tel');
  const cliEnd    = document.getElementById('cli_end');

  async function fetchOrdemServico(osNum) {
    const osSan = String(osNum || '').trim();
    if (!osSan) return null;

    const url = `${ORDEM_SERVICO_BASE_URL}/${encodeURIComponent(osSan)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);

    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} – ${resp.statusText}`);
      return await resp.json();
    } catch (e) {
      console.warn('Falha ao buscar OS:', e?.message || e);
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  function somenteDigitos(str, maxLen) {
    const out = String(str || '').replace(/\D/g, '');
    return typeof maxLen === 'number' ? out.slice(0, maxLen) : out;
  }

  async function preencherPorOS() {
    const valorOS = osInput?.value;
    const data = await fetchOrdemServico(valorOS);
    if (!data) return;

    if (cliNome) cliNome.value = data.cli_nome || '';
    if (cliDoc)  cliDoc.value  = somenteDigitos(data.cpf_cnpj, 14);
    if (cliTel)  cliTel.value  = somenteDigitos(data.fone, 20);
    if (cliEnd)  cliEnd.value  = data.endereco_completo || '';
  }

  if (osInput) {
    osInput.addEventListener('blur', preencherPorOS);
    osInput.addEventListener('change', preencherPorOS);
    osInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        preencherPorOS();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target?.id === 'btn-next' || e.target?.closest?.('.wizard-steps li')) {
      if (osInput?.value && (!cliNome?.value || !cliDoc?.value || !cliTel?.value || !cliEnd?.value)) {
        preencherPorOS();
      }
    }
  });

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
  attachDrawHandlers('delivery-signature');

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

  window.ensureSingleSignatureReady = (id)=> {
    sizeCanvas(document.getElementById(id));
  };

  if (telaAtual === 5) window.ensureSignaturesReady();
  window.addEventListener('resize', ()=> {
    if (telaAtual === 5) window.ensureSignaturesReady();
  });
})();


  /* ==========================================================
     STATUS DO MODELO 3D
     ========================================================== */
  const modelo3d = $('#car3d');
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

    if (d.fotoBase64){
      previsualizacaoFoto.src = d.fotoBase64.startsWith('data:image') ? d.fotoBase64 : d.fotoBase64;
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
    const objectUrl = URL.createObjectURL(arquivo);
    previsualizacaoFoto.src = objectUrl;          // preview rápido
    previsualizacaoFoto.classList.remove('hidden');
  });

  /* ==========================================================
     CÂMERA (getUserMedia) — ALTA QUALIDADE
     ========================================================== */
  const btnOpenCam      = $('#open-camera');
  const btnOpenCamDetalhe = $('#detail-btn-camera');
  const modalCam     = $('#camera-modal');
  const btnCloseCam  = $('#close-camera');
  const btnTakePhoto = $('#take-photo');
  const btnSwitch    = $('#switch-facing');
  const video        = $('#camera-video');

  let camStream = null;
  let facingMode = 'environment';
  let lastObjectURL = null;

  const HIGH_CONSTRAINTS = {
    video: {
      facingMode,
      width:  { ideal: 4032, min: 1280 },
      height: { ideal: 3024, min: 720  },
      frameRate: { ideal: 30, max: 60 },
      advanced: [{ focusMode: 'continuous' }, { exposureMode: 'continuous' }]
    },
    audio: false
  };

  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      modalCam?.close?.();
      return;
    }
    try {
      HIGH_CONSTRAINTS.video.facingMode = facingMode;

      camStream = await navigator.mediaDevices.getUserMedia(HIGH_CONSTRAINTS).catch(async () => {
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
      });

      video.srcObject = camStream;
      const track = camStream.getVideoTracks()[0];
      const settings = track.getSettings?.() || {};
      if (settings.width && settings.height) {
        video.width = settings.width;
        video.height = settings.height;
      }
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

  async function takeHighResPhotoBlob() {
    const track = camStream?.getVideoTracks?.()[0];
    if (!track) return null;

    if (window.ImageCapture) {
      try {
        const imageCapture = new ImageCapture(track);
        try {
          return await imageCapture.takePhoto();
        } catch {
          const bitmap = await imageCapture.grabFrame();
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.98));
        }
      } catch (err) {
        console.warn('ImageCapture falhou; usando fallback:', err?.message || err);
      }
    }

    if (video && video.videoWidth) {
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.98));
    }
    return null;
  }

  let camModoDetalhe = false;

  window.abrirCameraDetalhe = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      document.getElementById('detail-foto-input')?.click();
      return;
    }
    camModoDetalhe = true;
    modalCam?.showModal?.();
    await startCamera();
  };

  btnOpenCamDetalhe?.addEventListener('click', () => {
    document.getElementById('detail-foto-input')?.click();
  });

  btnOpenCam?.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      entradaFoto?.click?.();
      return;
    }
    camModoDetalhe = false;
    modalCam?.showModal?.();
    await startCamera();
  });

  btnCloseCam?.addEventListener('click', () => {
    stopCamera();
    camModoDetalhe = false;
    modalCam?.close?.();
  });

  btnSwitch?.addEventListener('click', async () => {
    facingMode = (facingMode === 'environment') ? 'user' : 'environment';
    await startCamera();
  });

  btnTakePhoto?.addEventListener('click', async () => {
    const blob = await takeHighResPhotoBlob();
    if (!blob) return;

    if (lastObjectURL) URL.revokeObjectURL(lastObjectURL);
    const objectUrl = URL.createObjectURL(blob);
    lastObjectURL = objectUrl;

    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);

    if (camModoDetalhe) {
      // Modo detalhe: coloca no input do modal de detalhe e mostra preview
      const detailInput   = document.getElementById('detail-foto-input');
      const detailPreview = document.getElementById('detail-foto-preview');
      if (detailInput)  detailInput.files = dt.files;
      if (detailPreview) { detailPreview.src = objectUrl; detailPreview.classList.remove('hidden'); }
    } else {
      // Modo avaria normal
      previsualizacaoFoto.src = objectUrl;
      previsualizacaoFoto.classList.remove('hidden');
      if (entradaFoto) entradaFoto.files = dt.files;
    }

    camModoDetalhe = false;
    stopCamera();
    modalCam?.close?.();
  });

  /* ==========================================================
     SUBMIT do formulário de AVARIA — FLUXO COM UPLOAD + fotoBase64=key
     ========================================================== */
  async function salvarAvaria(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (uploadAvariaEmAndamento || telaTravada()) return;
    uploadAvariaEmAndamento = true;

    const pos   = JSON.parse(entradaPosicao3d.value||'{}');
    const norm  = JSON.parse(entradaNormal3d.value||'{}');
    const tipo  = ($('input[name="damage-type"]:checked')?.value) || 'Não especificado';
    const peca  = entradaPeca.value?.trim()   || '';
    const notas = entradaObservacoes.value     || '';

    let fotoKeyFromUpload = null;
    let fotoPreviewUrl = null;

    // Fechar modal ANTES de fazer upload (assim o loading overlay fica visível)
    modalAvaria.close();

    try {
      // Se houver arquivo selecionado ou foto capturada, fazemos upload para o backend de uploads,
      // que trata a compressão e sobe no MinIO, retornando a `key`.
      if (entradaFoto?.files?.[0]) {
        try {
          travarTela('Enviando foto... Aguarde.');
          const form = new FormData();
          if (!entradaFoto.files || entradaFoto.files.length === 0) {
            console.error('Nenhuma imagem selecionada!');
            alert('Selecione uma imagem antes de enviar.');
            return;
          }
          const arquivo = entradaFoto.files[0];
          fotoPreviewUrl = URL.createObjectURL(arquivo);
          console.log('Arquivo selecionado:', arquivo);
          form.append('file', arquivo);

          for (let pair of form.entries()) {
            console.log(pair[0]+ ':', pair[1]);
          }

          const resp = await fetch(`${UPLOADS_BASE_URL}/avarias`, {
            method: 'POST',
            body: form,
          });
          if (!resp.ok) {
            const t = await resp.text().catch(()=> '');
            throw new Error(`HTTP ${resp.status} – ${t || resp.statusText}`);
          }

          const data = await resp.json();
          console.log('[UPLOAD /avarias] response:', data);
          const key = data?.key || data?.fileName || null;
          console.log('[UPLOAD /avarias] key escolhida:', key);
          fotoKeyFromUpload = key;
        } catch (err) {
          console.error('[UPLOAD /avarias] falha no upload:', err);
          if (fotoPreviewUrl) {
            try { URL.revokeObjectURL(fotoPreviewUrl); } catch {}
          }
          alert('Falha ao enviar a foto da avaria. Tente novamente.');
          return;
        } finally {
          destravarTela();
        }
      }

      const registro = {
        pos3d: pos,
        norm3d: norm,
        type: tipo,
        part: peca,
        notes: notas,
        fotoBase64: fotoKeyFromUpload || null,
        fotoPreviewUrl,
        timestamp: Date.now()
      };

      if (indiceEdicao !== null) {
        if (avarias[indiceEdicao]?.fotoPreviewUrl && avarias[indiceEdicao].fotoPreviewUrl !== fotoPreviewUrl) {
          try { URL.revokeObjectURL(avarias[indiceEdicao].fotoPreviewUrl); } catch {}
        }
        avarias[indiceEdicao] = { ...avarias[indiceEdicao], ...registro };
      } else {
        avarias.push(registro);
      }

      console.log('[AVARIA - registro inserido]', registro);
      renderizarListaAvarias();
    } finally {
      uploadAvariaEmAndamento = false;
    }
  }

  formularioAvaria?.addEventListener('submit', salvarAvaria);
  botaoSalvarAvaria?.addEventListener('click', salvarAvaria);

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
          ${d.fotoBase64 ? `<p class="text-xs text-slate-400 break-all">fotoBase64 (key): ${d.fotoBase64}</p>` : ''}
          ${d.fotoPreviewUrl ? `<img src="${d.fotoPreviewUrl}" alt="Foto da avaria ${i+1}" class="mt-2 rounded-lg border border-slate-200 max-h-32 w-auto">` : ''}
        </div>
        <div class="flex items-center gap-3">
          <button class="editar text-blue-600 hover:text-blue-800 text-sm">Editar</button>
          <button class="excluir text-rose-600 hover:text-rose-700 font-bold text-xl">&times;</button>
        </div>`;
      linha.querySelector('.editar').onclick = ()=> abrirModalParaEdicao(i);
      linha.querySelector('.excluir').onclick= ()=>{
        if (avarias[i]?.fotoPreviewUrl) {
          try { URL.revokeObjectURL(avarias[i].fotoPreviewUrl); } catch {}
        }
        avarias.splice(i,1);
        renderizarListaAvarias();
      };
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

  function getChecklistDraft() {
    try {
      const raw = sessionStorage.getItem(CHECKLIST_DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      console.warn('[CHECKLIST DRAFT] Falha ao ler rascunho:', err);
      return null;
    }
  }

  function clearChecklistDraft() {
    try {
      sessionStorage.removeItem(CHECKLIST_DRAFT_KEY);
    } catch (err) {
      console.warn('[CHECKLIST DRAFT] Falha ao limpar rascunho:', err);
    }
  }

  function drawSignatureFromBase64(canvasId, dataUrl) {
    if (!dataUrl) return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    window.ensureSingleSignatureReady?.(canvasId);
    const ctx = canvas.getContext('2d');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);

    const img = new Image();
    img.onload = () => {
      const w = canvas.width / ratio;
      const h = canvas.height / ratio;
      ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = dataUrl;
  }

  function collectDraftSnapshot() {
    if (telaAtual <= 0) return null;

    const idsTexto = [
      'os_interna','entry_datetime','cli_nome','cli_doc','cli_tel','cli_end',
      'veic_nome','veic_placa','veic_cor','veic_km','obs'
    ];

    const campos = {};
    idsTexto.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      campos[id] = el.value ?? '';
    });

    const checklist = $$('#items-checklist select').map((sel) => sel.value || '');
    const fuelRange = document.getElementById('fuel-range');
    const combustivel = Number(fuelRange?.value ?? 50);

    const avariasSerializadas = avarias.map((d) => ({
      pos3d: d.pos3d,
      norm3d: d.norm3d,
      type: d.type,
      part: d.part,
      notes: d.notes,
      fotoBase64: d.fotoBase64 || null,
      timestamp: d.timestamp,
    }));

    const fotos360 = FOTOS_360_GUIADAS.map((p) => {
      const st = fotos360State[p.chave] || {};
      return {
        chave: p.chave,
        foto: st.foto || null,
        status: st.status || (st.foto ? 'capturada' : 'pendente'),
      };
    });

    const assinaturaClienteCanvas = document.getElementById('customer-signature');
    const assinaturaResponsavelCanvas = document.getElementById('inspector-signature');

    const assinaturas = {
      cliente: assinaturaClienteCanvas && !canvasVazio(assinaturaClienteCanvas)
        ? canvasParaBase64(assinaturaClienteCanvas)
        : null,
      responsavel: assinaturaResponsavelCanvas && !canvasVazio(assinaturaResponsavelCanvas)
        ? canvasParaBase64(assinaturaResponsavelCanvas)
        : null,
    };

    return {
      versao: 1,
      telaAtual,
      campos,
      checklist,
      combustivel,
      avarias: avariasSerializadas,
      fotos360,
      assinaturas,
      atualizadoEm: Date.now(),
    };
  }

  function persistChecklistDraft() {
    const snapshot = collectDraftSnapshot();
    if (!snapshot) return;

    try {
      sessionStorage.setItem(CHECKLIST_DRAFT_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn('[CHECKLIST DRAFT] Falha ao salvar rascunho:', err);
    }
  }

  function restoreChecklistDraft() {
    const draft = getChecklistDraft();
    if (!draft || !draft.campos || Number(draft.telaAtual) <= 0) return false;

    Object.entries(draft.campos).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value ?? '';
    });

    if (!draft.campos.entry_datetime) {
      const entry = document.getElementById('entry_datetime');
      if (entry) entry.value = formatDateTimeForCuiaba();
    }

    const fuelRange = document.getElementById('fuel-range');
    if (fuelRange && Number.isFinite(Number(draft.combustivel))) {
      fuelRange.value = String(Number(draft.combustivel));
      fuelRange.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (Array.isArray(draft.checklist)) {
      $$('#items-checklist select').forEach((sel, idx) => {
        if (typeof draft.checklist[idx] === 'string') {
          sel.value = draft.checklist[idx];
        }
      });
    }

    avarias = Array.isArray(draft.avarias)
      ? draft.avarias.map((d) => ({ ...d, fotoPreviewUrl: null }))
      : [];
    renderizarListaAvarias();

    if (Array.isArray(draft.fotos360)) {
      draft.fotos360.forEach((item) => {
        const st = fotos360State[item?.chave];
        if (!st) return;
        st.foto = item?.foto || null;
        st.status = item?.status || (st.foto ? 'capturada' : 'pendente');
        st.previewUrl = null;
      });
      renderizarFotos360Guiadas();
    }

    window.ensureSignaturesReady?.();
    drawSignatureFromBase64('customer-signature', draft.assinaturas?.cliente || null);
    drawSignatureFromBase64('inspector-signature', draft.assinaturas?.responsavel || null);

    irParaTela(Number(draft.telaAtual));
    return true;
  }

  let draftSaveTimer = null;
  function schedulePersistChecklistDraft() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      persistChecklistDraft();
      draftSaveTimer = null;
    }, 200);
  }

  document.addEventListener('input', () => {
    if (telaAtual <= 0) return;
    schedulePersistChecklistDraft();
  });

  document.addEventListener('change', () => {
    if (telaAtual <= 0) return;
    schedulePersistChecklistDraft();
  });

  window.addEventListener('beforeunload', () => {
    if (telaAtual <= 0) return;
    persistChecklistDraft();
  });

  window.persistChecklistDraft = persistChecklistDraft;
  window.restoreChecklistDraft = restoreChecklistDraft;
  window.clearChecklistDraft = clearChecklistDraft;

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

  async function coletarCapturas(){
    let capturaCarroBase64 = null;
    try {
      if (modelo3d && modelo3d.shadowRoot) {
        const glCanvas = modelo3d.shadowRoot.querySelector('canvas');
        if (glCanvas) {
          capturaCarroBase64 = glCanvas.toDataURL('image/png');
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
        km:    toIntOrNull(pegarValorInput('veic_km'))
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
      fotoBase64: d.fotoBase64 || null, // <<< compatível com o backend
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

    const imagens = {
      assinaturas: {
        clienteBase64: assinaturas.assinaturaClienteBase64 || null,
        responsavelBase64: assinaturas.assinaturaResponsavelBase64 || null
      },
      capturas,
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
      imagens
    };
  }

  /* ==========================================================
     RESUMO (Tela 4)
     ========================================================== */
  function renderResumo(){
    const wrap = $('#summary-content');
    if (!wrap) return;

    const cab = coletarCabecalho();
    const comb = coletarCombustivel();
    const itens = coletarChecklist();
    const avs = coletarAvarias();

    const resumoChecklist =
      itens.length
        ? itens.map(i => `
            <div class="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white/70">
              <span class="text-sm text-slate-700">${i.item}</span>
              <span class="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">${i.status || '-'}</span>
            </div>`).join('')
        : '<p class="text-sm text-slate-500">Sem itens marcados.</p>';

    const resumoAvarias =
      avs.length
        ? avs.map((d, idx) => `
            <div class="border border-slate-200 rounded-lg p-3 bg-white/70">
              <p class="text-sm font-semibold text-slate-800">${idx+1}. ${d.peca || 'Peça'} – ${d.tipo || '-'}</p>
              <p class="text-xs text-slate-600">${d.observacoes || 'Sem observações.'}</p>
              ${d.fotoBase64 ? `<p class="text-[10px] text-slate-400 break-all mt-1">fotoBase64 (key): ${d.fotoBase64}</p>` : ''}
            </div>`).join('')
        : '<p class="text-sm text-slate-500">Nenhuma avaria registrada.</p>';

    wrap.innerHTML = `
      <section class="rounded-xl border border-slate-200 bg-white/60 p-4">
        <h3 class="text-base font-semibold text-slate-800 mb-3">1) Identificação</h3>
        <div class="grid sm:grid-cols-2 gap-y-2 text-sm">
          <div><span class="font-medium text-slate-700">O.S Interna:</span> ${cab.osInterna || '-'}</div>
          <div><span class="font-medium text-slate-700">Entrada:</span> ${cab.dataHoraEntrada ? new Date(cab.dataHoraEntrada).toLocaleString('pt-BR') : '-'}</div>
          <div class="sm:col-span-2 h-px bg-slate-200 my-2"></div>
          <div><span class="font-medium text-slate-700">Cliente:</span> ${cab.cliente?.nome || '-'}</div>
          <div><span class="font-medium text-slate-700">Doc:</span> ${cab.cliente?.doc || '-'}</div>
          <div><span class="font-medium text-slate-700">Telefone:</span> ${cab.cliente?.tel || '-'}</div>
          <div><span class="font-medium text-slate-700">Endereço:</span> ${cab.cliente?.end || '-'}</div>
          <div class="sm:col-span-2 h-px bg-slate-200 my-2"></div>
          <div><span class="font-medium text-slate-700">Veículo:</span> ${cab.veiculo?.nome || '-'}</div>
          <div><span class="font-medium text-slate-700">Placa:</span> ${cab.veiculo?.placa || '-'}</div>
          <div><span class="font-medium text-slate-700">Cor:</span> ${cab.veiculo?.cor || '-'}</div>
          <div><span class="font-medium text-slate-700">KM:</span> ${Number.isFinite(cab.veiculo?.km) ? cab.veiculo.km : '-'}</div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white/60 p-4">
        <h3 class="text-base font-semibold text-slate-800 mb-3">2) Inspeção</h3>
        <p class="text-sm mb-3"><span class="font-medium text-slate-700">Nível de combustível:</span> ${comb.combustivelPercentual ?? 0}%</p>
        <div class="space-y-2">
          <p class="text-sm font-medium text-slate-700">Avarias registradas</p>
          <div class="grid sm:grid-cols-2 gap-2">
            ${resumoAvarias}
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white/60 p-4">
        <h3 class="text-base font-semibold text-slate-800 mb-3">3) Checklist</h3>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          ${resumoChecklist}
        </div>
        <div class="mt-4">
          <p class="text-sm font-medium text-slate-700 mb-1">Observações</p>
          <div class="text-sm whitespace-pre-line p-3 rounded-lg border border-slate-200 bg-white/70">${cab.observacoes || '—'}</div>
        </div>
      </section>

      <p class="text-xs text-slate-500">Revise atentamente as informações acima. Ao assinar, você declara estar ciente do estado do veículo na entrada.</p>
    `;
  }
  window.renderResumo = renderResumo;

  /* ==========================================================
     PAYLOAD PARA API (sem pecasPreDefinidas) + COMPACTAÇÃO
     ========================================================== */
  async function montarPayloadParaApi() {
    const dados = await montarChecklistJson();
    const { pecasPreDefinidas: _remove, ...payload } = dados;

    const cab = payload.cabecalho || {};
    const cli = cab.cliente || {};
    const vei = cab.veiculo || {};

    const kmVal = (Number.isFinite(vei.km) ? vei.km : null);

    function toIsoZ(s) {
      if (!s) return null;
      if (/Z$/i.test(s)) return s;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    const bodyApi = {
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
      veiculoKm:    kmVal,

      checklist: (payload.checklist || []).map(i => ({
        item:   i.item || '',
        status: i.status || ''
      })),

      // >>> avarias compatível com o backend (espera fotoBase64)
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
        fotoBase64: a.fotoBase64 || null, // aqui vai a KEY como string
        timestamp: a.timestamp
      })),

      assinaturasclienteBase64: payload.assinaturas?.assinaturaClienteBase64 || null,
      assinaturasresponsavelBase64: payload.assinaturas?.assinaturaResponsavelBase64 || null,

      // Fotos 360 guiadas com metadados de posicao
      fotos360: Array.isArray(window.getFotos360Payload?.()) ? window.getFotos360Payload() : [],
    };

    // Se as assinaturas forem base64 reais, compacta:
    if (bodyApi.assinaturasclienteBase64) {
      bodyApi.assinaturasclienteBase64 =
        await compressDataUrl(bodyApi.assinaturasclienteBase64, 1000, 400, 0.7);
    }
    if (bodyApi.assinaturasresponsavelBase64) {
      bodyApi.assinaturasresponsavelBase64 =
        await compressDataUrl(bodyApi.assinaturasresponsavelBase64, 1000, 400, 0.7);
    }

    // Se houver fotoBase64 em avarias que seja dataURL, compacta; se for apenas a key (string simples), a função mantém como está.
    for (const a of bodyApi.avarias) {
      if (a.fotoBase64) {
        a.fotoBase64 = await compressDataUrl(a.fotoBase64, 1280, 1280, 0.65);
      }
    }

    // Limite de payload: se exceder, remove imagens das avarias (não deve ocorrer, pois agora mandamos key)
    const MAX_BYTES_SOFT = 8 * 1024 * 1024;
    let bodyStr = JSON.stringify(bodyApi);
    if (approxByteLength(bodyStr) > MAX_BYTES_SOFT) {
      bodyApi.avarias.forEach(a => delete a.fotoBase64);
      bodyStr = JSON.stringify(bodyApi);
    }

    console.log('[POST /checklists] body:', bodyApi);
    return bodyApi;
  }

  /* ==========================================================
     RESET GERAL
     ========================================================== */
  function resetChecklistUI({ goToList = false, silent = false } = {}) {
    const idsTexto = [
      'os_interna','cli_nome','cli_doc','cli_tel','cli_end',
      'veic_nome','veic_placa','veic_cor','veic_km','obs'
    ];
    idsTexto.forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
    });

    const entryDt = document.getElementById('entry_datetime');
    if (entryDt) entryDt.value = formatDateTimeForCuiaba();

    const fuelRange = document.getElementById('fuel-range');
    if (fuelRange) {
      fuelRange.value = 50;
      const ev = new Event('input', { bubbles: true });
      fuelRange.dispatchEvent(ev);
    }

    $$('#items-checklist select').forEach(sel=>{
      const ok = Array.from(sel.options).find(o => o.text === 'OK' || o.value === 'OK');
      sel.value = ok ? ok.value : sel.options[0]?.value;
    });

    avarias.forEach((d) => {
      if (d?.fotoPreviewUrl) {
        try { URL.revokeObjectURL(d.fotoPreviewUrl); } catch {}
      }
    });
    avarias = [];
    renderizarListaAvarias();
    window.resetFotos360State?.();

    window.clearSignature?.('customer-signature');
    window.clearSignature?.('inspector-signature');

    if (previsualizacaoFoto) {
      previsualizacaoFoto.src = '';
      previsualizacaoFoto.classList.add('hidden');
    }
    if (entradaFoto) entradaFoto.value = '';

    const wrap = document.getElementById('summary-content');
    if (wrap) wrap.innerHTML = '';

    telaAtual = goToList ? 0 : 1;
    atualizarWizardUI();

    if (goToList) {
      clearChecklistDraft();
    } else {
      persistChecklistDraft();
    }

    if (goToList) {
      carregarChecklists({ pagina: 1 });
    }

    if (!silent && statusPost) {
      statusPost.textContent = goToList
        ? 'Checklist cancelado e listagem recarregada.'
        : 'Formulário limpo e pronto para novo checklist.';
    }
  }

  window.resetChecklistUI = resetChecklistUI;

  /* ==========================================================
     Exportações
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
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 25 }, 2: { cellWidth: 70 }, 3: { cellWidth: 25 } },
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
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 18 }, 2: { cellWidth: 60 }, 3: { cellWidth: 34 }, 4: { cellWidth: 34 }, 5: { cellWidth: 22 } },
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

  // listeners export
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
     Helper de POST com timeout e erro legível
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
      const httpPage = location.protocol === 'http:';
      const httpApi  = url.startsWith('http://');

      let dica = '';
      if (!online) {
        dica = 'Sem conexão com a internet.';
      } else if (err.name === 'AbortError') {
        dica = 'Conexão lenta ou servidor não respondeu (timeout).';
      } else if (httpPage && !httpApi) {
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
     POST para a API
     ========================================================== */
  botaoSendApi?.addEventListener('click', async ()=>{
    try {
      botaoSendApi.disabled = true;
      const labelOrig = botaoSendApi.textContent;
      botaoSendApi.textContent = 'Enviando...';
      if (statusPost) statusPost.textContent = '';

      const body = await montarPayloadParaApi();
      const resp = await postJson(API_URL, body, { timeoutMs: 20000 });
      console.log('[POST /checklists] resp:', resp);

      if (statusPost) statusPost.textContent = 'Checklist salvo com sucesso!';
      botaoSendApi.textContent = 'Salvo ✅';

      resetChecklistUI();

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
  renderizarFotos360Guiadas();
})();
