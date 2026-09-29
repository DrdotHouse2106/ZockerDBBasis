import { useState } from 'react';
import Symbol from './Symbole.jsx';

/**
 * Coverbild mit Platzhalter, falls kein Bild vorhanden ist oder es nicht lädt.
 * `band`: deutlicher Schriftzug quer über dem Bild (z. B. „DIGITAL · STEAM“ bei digitalen Spielen).
 */
export default function Cover({ url, typ = 'spiel', alt = '', className = '', band = null }) {
  const [fehler, setFehler] = useState(false);
  const zeigeBild = url && !fehler;
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-karte-hover ${className}`}>
      {band && (
        <span className="pointer-events-none absolute inset-x-0 top-3 z-10 bg-sky-600/90 py-1 text-center text-[11px] font-bold tracking-widest text-white uppercase shadow">
          {band}
        </span>
      )}
      {zeigeBild ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFehler(true)}
          className={`size-full ${typ === 'spiel' ? 'object-cover' : 'object-contain p-2'}`}
        />
      ) : (
        <Symbol name={typ} className="size-1/3 text-leise/50" />
      )}
    </div>
  );
}
