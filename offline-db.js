/* ==========================================================
   OFFLINE DB – IndexedDB para offline-first
   Armazena checklists pendentes com fotos como dataURL.
   ========================================================== */
(function () {
  'use strict';

  const DB_NAME       = 'oficina-checklist-offline-v1';
  const DB_VERSION    = 2;
  const STORE         = 'checklists_pendentes';
  const STORE_RASCUNHO = 'checklist_rascunho';
  const RASCUNHO_ID   = 'atual'; // único rascunho em edição por vez

  let _db = null;

  function abrirDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      // Executado na criação (v0→v2) e no upgrade (v1→v2). Idempotente: só
      // cria o que ainda não existe, preservando os pendentes já gravados.
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'localId' });
          store.createIndex('status',   'status',   { unique: false });
          store.createIndex('criadoEm', 'criadoEm', { unique: false });
        }
        // Rascunho do checklist em preenchimento (antes do "Concluir").
        // Fica no IndexedDB — não no sessionStorage — para não estourar a
        // cota de ~5 MB com fotos base64 nem sumir ao fechar o app/PWA.
        if (!db.objectStoreNames.contains(STORE_RASCUNHO)) {
          db.createObjectStore(STORE_RASCUNHO, { keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  function gerarLocalId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /* ---------- CRUD ---------- */

  async function salvarChecklistLocal(payload, localIdFixo) {
    const db = await abrirDB();
    // Reaproveita o localId estável do rascunho (quando informado) para que ele
    // seja a chave de idempotência no backend — reenvio não gera duplicata.
    const localId  = localIdFixo || gerarLocalId();
    const registro = {
      localId,
      tipo:     'checklist',
      status:   'pendente',
      payload:  JSON.parse(JSON.stringify(payload)), // clone profundo
      criadoEm: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(registro);
      req.onsuccess   = () => resolve(localId);
      tx.onerror      = (e) => reject(e.target.error);
    });
  }

  /**
   * Salva na MESMA fila de pendentes uma foto avulsa adicionada depois que o
   * checklist já foi concluído (fotos do serviço / seguro). Fica com
   * tipo='foto-extra' para a sincronização saber como reenviá-la.
   * payload esperado: { checklistId, foto: dataURL, osInterna?, veiculoPlaca?, clienteNome? }
   */
  async function salvarFotoExtraLocal(payload) {
    const db = await abrirDB();
    const localId  = gerarLocalId();
    const registro = {
      localId,
      tipo:     'foto-extra',
      status:   'pendente',
      payload:  JSON.parse(JSON.stringify(payload)),
      criadoEm: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(registro);
      req.onsuccess   = () => resolve(localId);
      tx.onerror      = (e) => reject(e.target.error);
    });
  }

  async function listarPendentes() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result || []).filter((r) => r.status === 'pendente'));
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function listarTodos() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async function atualizarStatus(localId, status, extra = {}) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req   = store.get(localId);

      req.onsuccess = () => {
        const reg = req.result;
        if (!reg) return resolve(false);
        Object.assign(reg, { status, atualizadoEm: Date.now(), ...extra });
        const r2 = store.put(reg);
        r2.onsuccess = () => resolve(true);
        r2.onerror   = (e) => reject(e.target.error);
      };

      req.onerror = (e) => reject(e.target.error);
      tx.onerror  = (e) => reject(e.target.error);
    });
  }

  async function removerRegistro(localId) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const r  = tx.objectStore(STORE).delete(localId);
      r.onsuccess = () => resolve(true);
      r.onerror   = (e) => reject(e.target.error);
    });
  }

  /**
   * Remove registros já sincronizados para o IndexedDB não inchar com fotos
   * base64 e acabar estourando a cota (o que faria futuras gravações falharem).
   * @param {number} maxIdadeMs mantém os sincronizados nos últimos X ms (0 = remove todos).
   */
  async function purgarSincronizados(maxIdadeMs = 0) {
    const db = await abrirDB();
    const limite = Date.now() - maxIdadeMs;
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req   = store.getAll();
      req.onsuccess = () => {
        let removidos = 0;
        (req.result || []).forEach((reg) => {
          if (reg.status === 'sincronizado' && (reg.sincronizadoEm || 0) <= limite) {
            store.delete(reg.localId);
            removidos++;
          }
        });
        tx.oncomplete = () => resolve(removidos);
      };
      req.onerror = (e) => reject(e.target.error);
      tx.onerror  = (e) => reject(e.target.error);
    });
  }

  /* ---------- Rascunho (checklist em preenchimento) ---------- */

  async function salvarRascunho(snapshot) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_RASCUNHO, 'readwrite');
      const req = tx.objectStore(STORE_RASCUNHO).put({
        id: RASCUNHO_ID,
        dados: snapshot,
        atualizadoEm: Date.now(),
      });
      req.onsuccess = () => resolve(true);
      tx.onerror    = (e) => reject(e.target.error);
    });
  }

  async function lerRascunho() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_RASCUNHO, 'readonly');
      const req = tx.objectStore(STORE_RASCUNHO).get(RASCUNHO_ID);
      req.onsuccess = () => resolve(req.result?.dados || null);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  async function limparRascunho() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_RASCUNHO, 'readwrite');
      const req = tx.objectStore(STORE_RASCUNHO).delete(RASCUNHO_ID);
      req.onsuccess = () => resolve(true);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /* ---------- API pública ---------- */
  window.OfflineDB = {
    gerarLocalId,
    salvarChecklistLocal,
    salvarFotoExtraLocal,
    listarPendentes,
    listarTodos,
    marcarSincronizado : (id) =>
      atualizarStatus(id, 'sincronizado', { sincronizadoEm: Date.now() }),
    marcarErro         : (id, err) =>
      atualizarStatus(id, 'erro', { erro: String(err) }),
    marcarPendente     : (id) =>
      atualizarStatus(id, 'pendente', { erro: null }),
    remover            : removerRegistro,
    purgarSincronizados,
    salvarRascunho,
    lerRascunho,
    limparRascunho,
  };
})();
