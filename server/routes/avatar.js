// Avatar: eigenes Bild hochladen bzw. entfernen und die Avatare mehrerer Benutzer auf einmal abrufen (Listen, Nachrichten).
// Symbol und Farbe werden über PUT /api/konto gespeichert. Das Bild wird auf 256 × 256 Pixel zugeschnitten und als WebP
// ohne Metadaten gespeichert; abrufen dürfen es nur angemeldete Benutzer (wie Fotos der Community).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import express, { Router } from 'express';
import { avatarVon } from '../../shared/konstanten.js';
import { verarbeiteBild } from '../services/medien.js';
import { ValidierungsFehler } from '../services/validierung.js';

const BILD_LIMIT = '10mb';
const GROESSE = 256;

export function avatarRouter({ db, dateien }) {
  const router = Router();
  const roh = express.raw({ type: 'image/*', limit: BILD_LIMIT });
  const setzeDatei = db.prepare('UPDATE benutzer SET avatar_datei = ? WHERE id = ?');
  const dateiVon = db.prepare('SELECT avatar_datei FROM benutzer WHERE id = ?').pluck();

  router.put('/konto/avatar/bild', roh, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      throw new ValidierungsFehler({ bild: 'Bitte ein Bild (JPG, PNG oder WebP) auswählen.' });
    }
    const datei = `avatar-${crypto.randomUUID()}.webp`;
    try {
      await verarbeiteBild(req.body, (bild) => bild.rotate().resize(GROESSE, GROESSE, { fit: 'cover', position: 'attention' })
        .webp({ quality: 85 }).toFile(dateien.pfadVon(datei)));
    } catch {
      await fs.rm(dateien.pfadVon(datei), { force: true });
      throw new ValidierungsFehler({ bild: 'Das Bild konnte nicht gelesen werden (erlaubt: JPG, PNG, WebP).' });
    }
    const alt = dateiVon.get(req.benutzer.id);
    setzeDatei.run(datei, req.benutzer.id);
    if (alt) dateien.loesche(alt);
    res.json({ avatar: avatarVon({ ...req.benutzer, avatar_datei: datei }) });
  });

  router.delete('/konto/avatar/bild', (req, res) => {
    const alt = dateiVon.get(req.benutzer.id);
    setzeDatei.run(null, req.benutzer.id);
    if (alt) dateien.loesche(alt);
    res.json({ avatar: avatarVon({ ...req.benutzer, avatar_datei: null }) });
  });

  // Avatare mehrerer Benutzer: ?ids=1,2,3 (höchstens 100) → { "1": { symbol, farbe, url }, … }; gesperrte Konten ohne Bild
  router.get('/avatare', (req, res) => {
    const ids = [...new Set(String(req.query.ids ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
    if (!ids.length) return res.json({});
    const zeilen = db.prepare(`SELECT id, avatar_symbol, avatar_farbe, CASE WHEN gesperrt = 0 THEN avatar_datei END AS avatar_datei
      FROM benutzer WHERE id IN (${ids.map(() => '?').join(', ')})`).all(...ids);
    res.set('Cache-Control', 'private, max-age=60');
    res.json(Object.fromEntries(zeilen.map((z) => [z.id, avatarVon(z)])));
  });

  return router;
}
