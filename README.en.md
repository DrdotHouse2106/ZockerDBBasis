# 🎮 ZockDB Basis

**Your game collection, self-hosted – mobile-first, German user interface.**

> 🇩🇪 The primary documentation is in German: [README.md](README.md). The app's user interface is German only.

> 🌐 **No server of your own? Use [zockdb.de](https://zockdb.de)** – ready to go, with achievements, trading market, market
> prices and community. Using it or booking extras **directly supports the development of ZockDB**. Thank you! 💜

ZockDB Basis is the freely available base edition of [zockdb.de](https://zockdb.de): a Progressive Web App for managing
**games, consoles and accessories**, tailored to collectors in German-speaking countries (PAL/USK regions, CIB status,
special colours, editions and model revisions).

> 🔒 **Found a vulnerability?** Please report it privately by e-mail to [security@zockdb.de](mailto:security@zockdb.de).

## Features

- Games, consoles and accessories with condition, completeness, region, colour, edition, model/serial number, price, notes and photos
- In-browser **barcode scanner** (EAN/UPC); barcodes are learned on first use
- **IGDB** search (via Twitch API), cached locally
- Fixed platform taxonomy, known variants as a collecting checklist, multiple copies per item
- Scans & manuals per game (incl. TIFF and PDF), **print covers at original size**
- Multiple users, roles, **two-factor authentication (TOTP)**, scrypt password hashing
- Share your collection via a secret link, optional e-mail (password reset, notifications)
- JSON/CSV export, JSON import, **CSV import from CLZ Games/Excel**, automatic database backups
- Settings in the web UI, installable PWA with offline access, light & dark mode

## Quick start (Docker)

Save [`docker-compose.yml`](docker-compose.yml), adjust the `environment:` entries and run `docker compose up -d`.
Open <http://localhost:3000> – the first account you register becomes administrator. Data lives in the
`sammlung-daten` volume; back up the whole directory including `geheimnis.key`.

The camera (barcode scanner) only works over **HTTPS** or on `localhost` – use a reverse proxy such as Caddy and set `TRUST_PROXY: "1"`.

## Development

```bash
npm ci
npm run dev     # API on :3000, UI with hot reload on :5173
npm test
npm run build
```

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) – free for personal, hobby and non-profit use; commercial use requires permission.
Game data and cover art provided by [IGDB.com](https://www.igdb.com).
