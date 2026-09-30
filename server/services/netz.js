// Netzwerk-Hilfen: Adressen im lokalen, privaten oder sonst nicht öffentlichen Netz erkennen –
// für den SSRF-Schutz (keine Abrufe ins interne Netz) und die Ersteinrichtung (Zugriff aus dem Internet?).
import net from 'node:net';

function ipv4Intern(ip) {
  const [a, b, c] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0)
    || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** IPv6-Adresse → acht 16-Bit-Gruppen (auch mit eingebetteter IPv4 wie ::ffff:1.2.3.4), sonst null. */
function ipv6Gruppen(adresse) {
  let text = adresse.toLowerCase();
  const eingebettet = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (eingebettet) {
    if (!net.isIPv4(eingebettet[2])) return null;
    const [a, b, c, d] = eingebettet[2].split('.').map(Number);
    text = `${eingebettet[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const teile = text.split('::');
  if (teile.length > 2) return null;
  const links = teile[0] ? teile[0].split(':') : [];
  const rechts = teile.length === 2 && teile[1] ? teile[1].split(':') : [];
  const gruppen = teile.length === 2 ? [...links, ...Array(8 - links.length - rechts.length).fill('0'), ...rechts] : links;
  if (gruppen.length !== 8) return null;
  const zahlen = gruppen.map((g) => Number.parseInt(g, 16));
  return zahlen.every((z) => Number.isInteger(z) && z >= 0 && z <= 0xffff) ? zahlen : null;
}

const ipv4Aus = (hoch, tief) => `${hoch >> 8}.${hoch & 255}.${tief >> 8}.${tief & 255}`;

/**
 * true für Adressen, die nicht ins öffentliche Internet gehören: Loopback, private Netze, Link-Local, CGNAT,
 * Multicast, IPv6-ULA/Site-Local sowie IPv6-Adressen mit eingebetteter interner IPv4 (IPv4-mapped/-kompatibel,
 * NAT64, 6to4). Unbekannte Formate gelten vorsichtshalber als intern.
 */
export function istInterneAdresse(ip) {
  const roh = String(ip ?? '').trim().replace(/^\[|\]$/g, '').replace(/%.*$/, ''); // [::1] und Zonen-ID (fe80::1%eth0)
  if (net.isIPv4(roh)) return ipv4Intern(roh);
  if (!net.isIPv6(roh)) return true;
  const g = ipv6Gruppen(roh);
  if (!g) return true;
  const alleNull = (von, bis) => g.slice(von, bis).every((z) => z === 0);
  if (alleNull(0, 8) || (alleNull(0, 7) && g[7] === 1)) return true; // :: und ::1
  if (alleNull(0, 5) && (g[5] === 0xffff || g[5] === 0)) return ipv4Intern(ipv4Aus(g[6], g[7])); // IPv4-mapped / -kompatibel
  if (g[0] === 0x64 && g[1] === 0xff9b) return g[2] === 1 || ipv4Intern(ipv4Aus(g[6], g[7])); // NAT64 (64:ff9b::/96, lokal 64:ff9b:1::/48)
  if (g[0] === 0x2002) return ipv4Intern(ipv4Aus(g[1], g[2])); // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo (eingebettete Adresse verschleiert)
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // Dokumentation
  if (g[0] === 0x100 && alleNull(1, 4)) return true; // Discard-Präfix 100::/64
  return (g[0] & 0xfe00) === 0xfc00 // ULA fc00::/7
    || (g[0] & 0xffc0) === 0xfe80 // Link-Local fe80::/10
    || (g[0] & 0xffc0) === 0xfec0 // Site-Local fec0::/10 (veraltet)
    || (g[0] & 0xff00) === 0xff00; // Multicast
}
