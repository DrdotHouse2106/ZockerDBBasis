import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bereinigeProduktname, normalisiereBarcode, barcodeVarianten, suchbegriffe, plattformImNamen } from '../server/services/titel.js';

test('Händler-Produktnamen werden zu Suchbegriffen bereinigt', () => {
  assert.equal(bereinigeProduktname('Super Mario Odyssey - [Nintendo Switch] USK 6'), 'Super Mario Odyssey');
  assert.equal(bereinigeProduktname('FIFA 23 - PS4 - Standard Edition'), 'FIFA 23');
  assert.equal(bereinigeProduktname('The Legend of Zelda: Breath of the Wild (Nintendo Switch)'), 'The Legend of Zelda: Breath of the Wild');
  // Händlertitel aus upcitemdb mit Versandfloskeln und Währungsresten
  assert.equal(bereinigeProduktname('Playstation 4 : Battlefield 4 [german Version] Videogames Free Shipping, Save £s'), 'Battlefield 4');
  assert.equal(bereinigeProduktname('Gran Turismo 7 PS5 USK 0'), 'Gran Turismo 7');
  // Hersteller vor dem Titel und Plattform mit Bindestrich („Ps-4“, upcitemdb)
  assert.equal(bereinigeProduktname('Electronic Arts - Plants Vs Zombies 2 Ps-4 Garden Warfare 2 [de-version]'), 'Plants Vs Zombies 2 Garden Warfare 2');
  assert.equal(bereinigeProduktname('Ubisoft: Assassins Creed Unity PS 4'), 'Assassins Creed Unity');
  // Ohne Trenner bleibt ein Herstellername Teil des Titels
  assert.equal(bereinigeProduktname('Sega Rally Championship'), 'Sega Rally Championship');
  assert.equal(bereinigeProduktname('Nintendo Land - Wii U'), 'Nintendo Land');
  // „2K Games“ ist der Publisher, nicht „PlayStation 2“; „--“ trennt Zusätze ab
  assert.ok(suchbegriffe('Nba 2k15 --nba 2k15 [de-version]- playstation 2k Games').includes('Nba 2k15'));
  // Verkäufer-Werbung im Produktnamen (upcitemdb)
  assert.equal(bereinigeProduktname('Playstation 4 : Titanfall 2 Videogames Highly Rated Ebay Seller Great Prices'), 'Titanfall 2');
  // Regionsangabe und Händlerkürzel am Ende (upcitemdb)
  assert.equal(bereinigeProduktname('Call of Duty MODERN WARFARE 2 PlayStation 3 PS3 Game UK Version Region 2 VGC'), 'Call of Duty MODERN WARFARE 2');
  assert.equal(bereinigeProduktname('Halo 3 Xbox 360 Region Free'), 'Halo 3');
  // Fremde Sprachfassung und kyrillischer Text
  assert.equal(bereinigeProduktname('Call Of Duty: Modern Warfare 3 (ps3, 2011) Russian Version, Русская Версия'), 'Call Of Duty: Modern Warfare 3');
  assert.ok(suchbegriffe('Assassins Creed 4 Black Flag PS4').includes('Assassins Creed 4'), 'Rückfall bis zur Fortsetzungsnummer');
  assert.equal(bereinigeProduktname('Playstation 3 : Ps3 Game Call Of Duty 4 Modern Warfare U Videogames Great Value'), 'Call Of Duty 4 Modern Warfare');
  assert.equal(bereinigeProduktname('Ps3 / Sony Playstation 3 Game - Call Of Duty: Ghosts [standard] En/ger Boxed'), 'Call Of Duty: Ghosts');
  assert.equal(bereinigeProduktname('F-Zero GX GameCube'), 'F-Zero GX', 'Buchstabe mit Bindestrich bleibt');
  assert.equal(bereinigeProduktname('Call Of Duty-activ Call Of Duty Black Ops'), 'Call Of Duty Black Ops', 'Kürzel vor dem wiederholten Namen');
  assert.equal(bereinigeProduktname('Evil Neighbors (nintendo Gamecube) Ngc Game Boxed, Pal, Cib, Top, Very Good'), 'Evil Neighbors');
  assert.equal(bereinigeProduktname('Top Spin 4 PS3'), 'Top Spin 4', '„Top“ im Titel bleibt');
  assert.equal(bereinigeProduktname('Grand Theft Auto V PS4'), 'Grand Theft Auto V', 'römische Zahl bleibt');
  // Hersteller ohne Trenner, direkt vor der Plattform
  assert.equal(bereinigeProduktname('Bethesda Softworks Ps4 The Elder Scrolls Online'), 'The Elder Scrolls Online');
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

test('Plattform im Produktnamen: „Ps-4“ erkannt, „2K Games“ ist keine PlayStation 2', () => {
  assert.equal(plattformImNamen('Electronic Arts - Plants Vs Zombies 2 Ps-4 Garden Warfare 2 [de-version]'), 'Ps-4');
  assert.equal(plattformImNamen('Nba 2k15 --nba 2k15 [de-version]- playstation 2k Games'), 'playstation');
});
