import { Router } from 'express';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, MEDIENARTEN, PRUEFSTATUS, ROLLEN,
} from '../../shared/konstanten.js';

export function statusRouter({ igdb, barcode, plattformen, konfiguration, version, erweiterungen }) {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json({
      status: 'ok',
      version,
      igdbKonfiguriert: igdb.konfiguriert,
      barcodeAnbieter: barcode.aktiveAnbieter,
      registrierungOffen: konfiguration.konten.registrierungOffen,
      zweiFaktorPflicht: konfiguration.konten.zweiFaktorPflicht,
      medienTeilenErlaubt: konfiguration.medienTeilenErlaubt,
      oeffentlicherKatalog: konfiguration.oeffentlicherKatalog,
      maxUploadMb: konfiguration.maxUploadMb,
      maxMedienMb: konfiguration.maxMedienMb,
      speicherKontingentMb: konfiguration.speicherKontingentMb,
      ...erweiterungen.sammle('status'),
    });
  });

  router.get('/meta', (_req, res) => {
    res.json({
      ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, MEDIENARTEN, PRUEFSTATUS, ROLLEN,
      PLATTFORMEN: plattformen.alle(),
    });
  });

  return router;
}
