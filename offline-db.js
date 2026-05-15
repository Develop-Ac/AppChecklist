/* ==========================================================
   OFFLINE DB – IndexedDB para offline-first
   Armazena checklists pendentes com fotos como dataURL.
   ========================================================== */
(function () {
  'use strict';

  const DB_NAME    = 'oficina-checklist-offline-v1';
  const DB_VERSION = 1;
  const STORE      = 'checklists_pendentes';

  let _db = null;

  function abrirDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'localId' });
          store.createIndex('status',   'status',   { unique: false });
          store.createIndex('criadoEm', 'criadoEm', { unique: false });
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

  async function salvarChecklistLocal(payload) {
    const db = await abrirDB();
    const localId  = gerarLocalId();
    const registro = {
      localId,
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

  /* ---------- API pública ---------- */
  window.OfflineDB = {
    salvarChecklistLocal,
    listarPendentes,
    listarTodos,
    marcarSincronizado : (id) =>
      atualizarStatus(id, 'sincronizado', { sincronizadoEm: Date.now() }),
    marcarErro         : (id, err) =>
      atualizarStatus(id, 'erro', { erro: String(err) }),
    marcarPendente     : (id) =>
      atualizarStatus(id, 'pendente', { erro: null }),
    remover            : removerRegistro,
  };
})();
