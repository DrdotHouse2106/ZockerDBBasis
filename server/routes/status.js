import { Router } from 'express';
import {
  ARTIKELTYPEN, ZUSTAENDE, VOLLSTAENDIGKEITEN, REGIONEN, MEDIENARTEN, PRUEFSTATUS, ROLLEN,
} from '../../shared/konstanten.js';

export function statusRouter({ igdb, barcode, plattformen, konfiguration, version, erweiterungen, ideen }) {
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
      fotosTeilenErlaubt: konfiguration.fotosTeilenErlaubt,
      oeffentlicherKatalog: konfiguration.oeffentlicherKatalog,
      maxUploadMb: konfiguration.maxUploadMb,
      maxMedienMb: konfiguration.maxMedienMb,
      speicherKontingentMb: konfiguration.speicherKontingentMb,
      zentrale: konfiguration.zentrale?.url || null,
      zentraleSpende: konfiguration.zentrale?.url ? Boolean(konfiguration.zentrale.spende) : null,
      // Ideen & Wünsche: 'brett' (hier abstimmen), 'zentrale' (an zockerdb.de) oder null
      ideen: ideen?.modus() ?? null,
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
