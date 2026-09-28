import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gueltigerBarcode, nurZiffern } from '../shared/barcode.js';

test('Barcodes werden an Länge und Prüfziffer erkannt', () => {
  assert.equal(gueltigerBarcode('4006381333931'), '4006381333931'); // EAN-13
  assert.equal(gueltigerBarcode('4 006381 333931'), '4006381333931');
  assert.equal(gueltigerBarcode('045496630010'), '045496630010'); // UPC-A
  assert.equal(gueltigerBarcode('96385074'), '96385074'); // EAN-8
  assert.equal(gueltigerBarcode('4006381333932'), null, 'falsche Prüfziffer');
  assert.equal(gueltigerBarcode('400638133'), null, 'halb eingetippt');
  assert.equal(gueltigerBarcode('Zelda 64'), null);
  assert.equal(nurZiffern('4006 3813'), true);
  assert.equal(nurZiffern('Fifa 98'), false);
});
