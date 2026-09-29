// Bausteine für die wenigen HTML-Seiten, die der Server selbst erzeugt (z. B. die geteilte Sammlung).
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (z) => ESC[z]);

export const CSS = `
:root{--hg:#16131f;--karte:#201c2c;--rand:#2f2940;--text:#ece9f5;--leise:#a39cb8;--akzent:#8b5cf6;--akzent-hell:#b79cff;--akzent-text:#fff}
@media (prefers-color-scheme: light){:root{--hg:#f6f4fb;--karte:#fff;--rand:#e2ddef;--text:#1d1830;--leise:#5f5873;--akzent:#7c3aed;--akzent-hell:#6d28d9}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--hg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
a{color:var(--akzent-hell)}
.kopf{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--rand)}
.kopf a.marke{display:flex;align-items:center;gap:8px;color:var(--text);font-weight:700;text-decoration:none}
.kopf img{width:32px;height:32px}.kopf-rechts{display:flex;align-items:center;gap:6px}.suchknopf{color:var(--text);padding:8px;border-radius:10px;display:inline-flex}
.suche{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.suche input{flex:1 1 100%;min-width:0;padding:12px 14px;border-radius:12px;border:1px solid var(--rand);background:var(--karte);color:var(--text);font-size:16px}.suche select{flex:1;padding:12px;border-radius:12px;border:1px solid var(--rand);background:var(--karte);color:var(--text);font-size:15px}@media(min-width:640px){.suche input{flex:1}.suche select{flex:0 0 auto}}
.held{text-align:center;padding:24px 0 8px}.held img{width:88px;height:88px}.held h1{font-size:34px;margin:8px 0 2px}.held .unter{color:var(--akzent-hell);font-weight:600;margin:0 0 10px}.knoepfe{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0}
.merkmale{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.merkmale div{background:var(--karte);border:1px solid var(--rand);border-radius:14px;padding:12px}.kopf .marke span{display:flex;flex-direction:column;line-height:1.15}.kopf .marke small{font-weight:400;font-size:12px;color:var(--leise)}@media(max-width:380px){.kopf .marke small{display:none}}
.knopf{white-space:nowrap;display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:12px;background:var(--akzent);color:var(--akzent-text);font-weight:600;text-decoration:none}
.knopf.zweit{background:transparent;border:1px solid var(--rand);color:var(--text)}
main{max-width:860px;margin:0 auto;padding:16px}
nav.pfad{font-size:14px;color:var(--leise);margin-bottom:12px}nav.pfad a{color:var(--leise)}
h1{font-size:28px;line-height:1.2;margin:0 0 6px}h2{font-size:20px;margin:0 0 10px}h3{font-size:17px;margin:14px 0 6px}
.kopfbereich{display:grid;gap:16px}@media(min-width:640px){.kopfbereich{grid-template-columns:220px 1fr}}
.cover{width:100%;max-width:220px;aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:var(--karte);border:1px solid var(--rand)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.chip{padding:3px 10px;border-radius:999px;background:var(--karte);border:1px solid var(--rand);font-size:13px;color:var(--text);text-decoration:none}.chip.aktiv{background:var(--akzent);border-color:var(--akzent);color:var(--akzent-text)}
.karte{background:var(--karte);border:1px solid var(--rand);border-radius:16px;padding:16px;margin:16px 0}
.zahlen{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.zahl{background:var(--hg);border-radius:12px;padding:10px}.zahl b{display:block;font-size:22px}
.leise{color:var(--leise);font-size:14px}
ul.liste{list-style:none;padding:0;margin:0}ul.liste li{padding:8px 0;border-top:1px solid var(--rand)}ul.liste li:first-child{border-top:0}
.raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;list-style:none;padding:0;margin:0}
.raster a{display:block;color:var(--text);text-decoration:none}.raster img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;background:var(--karte);border:1px solid var(--rand)}
.raster .platzhalter{width:100%;aspect-ratio:3/4;border-radius:12px;background:var(--karte);border:1px solid var(--rand);display:grid;place-items:center;font-size:36px}
.werbung{font-size:12px;color:var(--leise);border:1px solid var(--rand);border-radius:6px;padding:1px 6px;margin-left:6px}
.seiten{display:flex;justify-content:space-between;gap:8px;margin-top:16px}
ol.rang{list-style:none;padding:0;margin:0;counter-reset:r}ol.rang li{counter-increment:r;display:grid;grid-template-columns:2rem 1fr auto;gap:4px 10px;align-items:baseline;padding:9px 0;border-top:1px solid var(--rand)}ol.rang li:first-child{border-top:0}ol.rang li::before{content:counter(r);color:var(--leise);font-weight:700;text-align:right}ol.rang .preis{font-weight:700;white-space:nowrap}ol.rang .unter{grid-column:2/4;color:var(--leise);font-size:14px}
.balken{display:flex;align-items:flex-end;gap:3px;height:140px;border-bottom:1px solid var(--rand);margin-top:8px}.balken span{flex:1;min-width:0;background:var(--akzent);border-radius:4px 4px 0 0}.balken span.leer{background:var(--rand)}
.achse{display:flex;justify-content:space-between;color:var(--leise);font-size:13px;margin-top:4px}.plus{color:#4ade80;font-weight:700}
main.breit{max-width:1120px}
.buehne{display:grid;gap:20px;align-items:center;padding:20px 0 8px}@media(min-width:820px){.buehne{grid-template-columns:1.05fr 1fr;padding:36px 0 16px}}
.buehne h1{font-size:clamp(30px,5vw,46px);line-height:1.08;margin:0 0 10px;letter-spacing:-.02em}.buehne h1 em{font-style:normal;color:var(--akzent-hell)}
.buehne .einleitung{font-size:17px;color:var(--leise);margin:0 0 6px}
.collage{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;transform:rotate(-3deg);max-width:520px;margin:0 auto}.collage a{display:block}
.collage img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;border:1px solid var(--rand);box-shadow:0 8px 24px rgba(0,0,0,.35)}
.collage a:nth-child(even){transform:translateY(14px)}@media(max-width:819px){.collage{grid-template-columns:repeat(6,1fr);transform:none}.collage a:nth-child(n+7){display:none}.collage a:nth-child(even){transform:none}}
.reihe-kopf{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:26px 0 8px}.reihe-kopf h2{margin:0}.reihe-kopf a{font-size:14px;white-space:nowrap}
.reihe{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(128px,150px);gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;list-style:none;padding:0 0 8px;margin:0}
.reihe li{scroll-snap-align:start}.reihe a{display:block;color:var(--text);text-decoration:none}.reihe img,.reihe .platzhalter{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;background:var(--karte);border:1px solid var(--rand)}
.reihe .platzhalter{display:grid;place-items:center;font-size:36px}.reihe b{display:block;font-size:14px;line-height:1.3;margin-top:6px}.reihe .preis{color:var(--akzent-hell);font-weight:700}
.steckbrief{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0}.steckbrief dt{color:var(--leise)}.steckbrief dd{margin:0}
.galerie{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}.galerie img{width:100%;height:auto;border-radius:10px;display:block;aspect-ratio:16/9;object-fit:cover}
.kacheln{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.kacheln a{display:block;background:var(--karte);border:1px solid var(--rand);border-radius:14px;padding:12px;color:var(--text);text-decoration:none}.kacheln a b{display:block}
.schluss{text-align:center}.schluss .knoepfe{margin-bottom:0}
footer{max-width:860px;margin:24px auto;padding:16px;color:var(--leise);font-size:14px;display:flex;flex-wrap:wrap;gap:12px}footer a{color:var(--leise)}
`;
