// Avatar eines Benutzers: eigenes Bild, sonst gewähltes Symbol auf seiner Farbe, sonst Anfangsbuchstabe.
// Mit `avatar` direkt anzeigen; mit `benutzerId` wird er nachgeladen – mehrere Avatare einer Liste in einer Anfrage.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const cache = new Map();
const wartend = new Map(); // id → Liste von Rückrufen
let zeitgeber = null;

function lade(id, rueckruf) {
  if (cache.has(id)) return rueckruf(cache.get(id));
  wartend.set(id, [...(wartend.get(id) ?? []), rueckruf]);
  if (zeitgeber) return undefined;
  zeitgeber = setTimeout(async () => {
    zeitgeber = null;
    const ids = [...wartend.keys()];
    const rueckrufe = new Map(wartend);
    wartend.clear();
    for (let i = 0; i < ids.length; i += 100) {
      const teil = ids.slice(i, i + 100);
      const ergebnis = await api.avatare(teil).catch(() => ({}));
      for (const tid of teil) {
        cache.set(tid, ergebnis[tid] ?? null);
        for (const fn of rueckrufe.get(tid) ?? []) fn(ergebnis[tid] ?? null);
      }
    }
  }, 30);
  return undefined;
}

/** Nach einer Änderung (eigenes Konto, Administration) neu laden. */
export function avatarVergessen(id) {
  cache.delete(Number(id));
}

const GROESSEN = { mini: 'size-5 text-[10px]', klein: 'size-7 text-xs', mittel: 'size-10 text-base', gross: 'size-20 text-3xl' };

export default function Avatar({ avatar: vorgabe, benutzerId, name = '?', groesse = 'mittel', className = '' }) {
  const id = Number(benutzerId) || null;
  const [geladen, setGeladen] = useState(() => (id && cache.has(id) ? cache.get(id) : null));
  useEffect(() => {
    if (vorgabe || !id) return undefined;
    let aktiv = true;
    lade(id, (a) => { if (aktiv) setGeladen(a); });
    return () => { aktiv = false; };
  }, [id, vorgabe]);
  const a = vorgabe ?? geladen;
  const klassen = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white ${GROESSEN[groesse] ?? GROESSEN.mittel} ${className}`;
  if (a?.url) return <img src={a.url} alt="" className={`${klassen} bg-karte-hover object-cover`} loading="lazy" data-testid="avatar" />;
  return (
    <span className={klassen} style={{ backgroundColor: a?.farbe ?? '#64748b' }} aria-hidden="true" data-testid="avatar">
      {a?.symbol ? <span className="leading-none">{a.symbol}</span> : String(name || '?').trim().slice(0, 1).toUpperCase()}
    </span>
  );
}
