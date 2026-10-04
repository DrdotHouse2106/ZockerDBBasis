import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bereinigeProduktname, normalisiereBarcode, barcodeVarianten, suchbegriffe } from '../server/services/titel.js';

test('Händler-Produktnamen werden zu Suchbegriffen bereinigt', () => {
  assert.equal(bereinigeProduktname('Super Mario Odyssey - [Nintendo Switch] USK 6'), 'Super Mario Odyssey');
  assert.equal(bereinigeProduktname('FIFA 23 - PS4 - Standard Edition'), 'FIFA 23');
  assert.equal(bereinigeProduktname('The Legend of Zelda: Breath of the Wild (Nintendo Switch)'), 'The Legend of Zelda: Breath of the Wild');
  assert.equal(bereinigeProduktname('Gran Turismo 7 PS5 USK 0'), 'Gran Turismo 7');
});

test('Barcodes werden normalisiert und geprüft', () => {
  assert.equal(normalisiereBarcode('4 005209 101123'), '4005209101123');
  assert.equal(normalisiereBarcode('12345'), null);
  assert.deepEqual(barcodeVarianten('045496590420'), ['045496590420', '0045496590420']);
});

test('Verkaufsfloskeln und angehängte Zahlen („Xxl2 … Brand And Sealed - In Stock - Quick Dispatch“)', () => {
  const name = 'Asterix & Obelix Xxl2 (ps4) Brand And Sealed - In Stock - Quick Dispatch';
  assert.equal(bereinigeProduktname(name), 'Asterix & Obelix Xxl2');
  const begriffe = suchbegriffe(name, 10);
  assert.ok(begriffe.includes('Asterix & Obelix Xxl 2'), 'Zahl abgetrennt');
  assert.ok(begriffe.includes('Asterix & Obelix'), 'notfalls die ersten Wörter');
  assert.equal(bereinigeProduktname('Zelda Breath of the Wild Brand New Factory Sealed Free UK Delivery'), 'Zelda Breath of the Wild');
});
