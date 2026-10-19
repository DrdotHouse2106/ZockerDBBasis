# 🎮 ZockerDB Basis

[![Buy me a coffee](https://img.shields.io/badge/☕_Buy_me_a_coffee-PayPal-0070ba?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/DrdotHouse)

**Your game collection, self-hosted – mobile-first, German user interface.**

> 🇩🇪 The primary documentation is in German: [README.md](README.md). The app's user interface is German only.

> 🌐 **No server of your own? Use [zockerdb.de](https://zockerdb.de)** – ready to go, with achievements, trading market, market
> prices and community. Using it or booking extras **directly supports the development of ZockerDB**. Thank you! 💜

ZockerDB Basis is the freely available base edition of [zockerdb.de](https://zockerdb.de): a Progressive Web App for managing
**games, consoles and accessories**, tailored to collectors in German-speaking countries (PAL/USK regions, CIB status,
special colours, editions and model revisions).

> 🔒 **Found a vulnerability?** Please report it privately by e-mail to [security@zockerdb.de](mailto:security@zockerdb.de).

## Features

- Games, consoles and accessories with condition, completeness, region, colour, edition, model/serial number, price, notes and photos
- In-browser **barcode scanner** (EAN/UPC); barcodes are learned on first use
- Search and barcodes via the **central zockerdb.de catalogue** (real German titles and descriptions, no own IGDB keys
  needed; `ZOCKERDB_CENTRAL=aus` uses your own IGDB access instead)
- Optional **sync with a zockerdb.de account** in both directions (scans stay at home) and optional **anonymous data
  donation** (only counts per title, with a preview for admins)
- Fixed platform taxonomy, known variants as a collecting checklist, multiple copies per item
- Scans & manuals per game (incl. TIFF and PDF), **print covers at original size**
- Photos of cartridge, disc, box and console taken with the phone camera, with a checklist of missing shots
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

## ☕ Support

If this project saves you work, I'd be happy about a coffee – voluntary, no support
obligation, just a nice gesture:

[![Buy me a coffee](https://img.shields.io/badge/☕_Buy_me_a_coffee-PayPal-0070ba?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/DrdotHouse)
