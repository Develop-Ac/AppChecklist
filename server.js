// import fs from 'fs';
// // Salvar fotos de avarias e substituir no payload
// const damages = Array.isArray(data.damages) ? data.damages : [];
// const damagesSaved = damages.map((d, idx) => {
// const photoPath = saveDataUrlImage(d.photo, `damage-${idx}`);
// return { ...d, photo: photoPath }; // guarda caminho (ou null)
// });


// const payload = { ...data, damages: damagesSaved };
// delete payload.customer_signature; // não manter base64 no JSON final
// delete payload.inspector_signature;


// const created_at = new Date().toISOString();
// db.run(
// `INSERT INTO checklists (payload, created_by, customer_signature_path, inspector_signature_path, created_at)
// VALUES (?, ?, ?, ?, ?)`,
// [JSON.stringify(payload), req.user.id, custSig, inspSig, created_at],
// function (err) {
// if (err) return res.status(500).json({ error: 'db insert error' });
// res.json({ ok: true, id: this.lastID });
// }
// );
// } catch (e) {
// console.error(e);
// res.status(500).json({ error: 'erro inesperado' });
// }
// });


// // (Opcional) listar últimos checklists
// app.get('/api/checklists', authMiddleware, (req, res) => {
// db.all(`SELECT id, created_at, created_by FROM checklists ORDER BY id DESC LIMIT 50`, [], (err, rows) => {
// if (err) return res.status(500).json({ error: 'db error' });
// res.json({ items: rows });
// });
// });


// app.listen(PORT, () => {
// console.log(`\nServidor rodando em http://localhost:${PORT}/checklist_veiculo.html`);
// });