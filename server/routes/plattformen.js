// Plattformen pflegen (Moderationsteam und Administratoren) – unter /api/moderation/plattformen.
import { Router } from 'express';
import { istModerator } from '../../shared/konstanten.js';
import { ValidierungsFehler } from '../services/validierung.js';
import { plattformZuObjekt } from '../services/plattformen.js';

export function plattformenRouter({ db, plattformen }) {
  const router = Router();
  router.use((req, res, next) => (istModerator(req.benutzer) ? next() : res.status(403).json({ fehler: 'Nur für das Moderationsteam.' })));

  function pruefePlattform(eingabe = {}) {
    const fehler = {};
    const name = String(eingabe.name ?? '').trim().slice(0, 100);
    const kurz = String(eingabe.kurz ?? '').trim().slice(0, 20);
    if (!name) fehler.name = 'Bitte einen Namen angeben.';
    if (!kurz) fehler.kurz = 'Bitte ein Kürzel angeben (z. B. PS5).';
    const typ = ['konsole', 'handheld', 'computer', 'sonstige'].includes(eingabe.typ) ? eingabe.typ : 'konsole';
    const jahr = eingabe.erscheinungsjahr ? Number(eingabe.erscheinungsjahr) : null;
    if (jahr !== null && (!Number.isInteger(jahr) || jahr < 1950 || jahr > 2100)) fehler.erscheinungsjahr = 'Ungültiges Jahr.';
    const aliase = (Array.isArray(eingabe.aliase) ? eingabe.aliase : String(eingabe.aliase ?? '').split(','))
      .map((a) => String(a).trim()).filter(Boolean).slice(0, 30);
    if (Object.keys(fehler).length) throw new ValidierungsFehler(fehler);
    return { name, kurz, typ, erscheinungsjahr: jahr, hersteller: String(eingabe.hersteller ?? '').trim().slice(0, 60) || 'Sonstige', aliase: JSON.stringify(aliase),
      // Standardsystem: für alle vorausgewählt („Meine Systeme“); neue Plattformen sind es nur auf ausdrücklichen Wunsch
      standard: eingabe.standard === undefined ? null : eingabe.standard === true || eingabe.standard === 'true' ? 1 : 0 };
  }

  router.post('/', (req, res) => {
    const d = pruefePlattform(req.body);
    if (db.prepare('SELECT 1 FROM plattformen WHERE name = ?').get(d.name)) throw new ValidierungsFehler({ name: 'Diese Plattform gibt es bereits.' });
    const p = db.prepare(`INSERT INTO plattformen (name, kurz, hersteller, typ, erscheinungsjahr, aliase, standard)
      VALUES (@name, @kurz, @hersteller, @typ, @erscheinungsjahr, @aliase, COALESCE(@standard, 0)) RETURNING *`).get(d);
    plattformen.indexNeuLaden();
    plattformen.verknuepfeNachNamen(p.id, [p.name, ...JSON.parse(p.aliase)]);
    res.status(201).json(plattformZuObjekt(p));
  });

  router.put('/:id', (req, res) => {
    const d = pruefePlattform(req.body);
    const p = db.prepare(`UPDATE plattformen SET name = @name, kurz = @kurz, hersteller = @hersteller, typ = @typ,
      erscheinungsjahr = @erscheinungsjahr, aliase = @aliase, standard = COALESCE(@standard, standard) WHERE id = @id RETURNING *`).get({ ...d, id: Number(req.params.id) });
    if (!p) return res.status(404).json({ fehler: 'Plattform nicht gefunden.' });
    db.prepare('UPDATE artikel SET plattform = ? WHERE plattform_id = ?').run(p.name, p.id);
    plattformen.indexNeuLaden();
    plattformen.verknuepfeNachNamen(p.id, [p.name, ...JSON.parse(p.aliase)]);
    res.json(plattformZuObjekt(p));
  });

  return router;
}
