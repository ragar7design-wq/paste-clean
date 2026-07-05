<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="PasteClean">
</p>

<h1 align="center">PasteClean</h1>

<p align="center">
  Clean URLs and text from trackers and invisible characters.<br>
  URL Cleaner and Text Inspector run in the browser. X-Ray uses a server proxy with no logs or storage.<br>
  No accounts.
</p>

<p align="center">
  <a href="README.md">Русский</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/ragar7design-wq/paste-clean/releases">Releases</a>
  &nbsp;·&nbsp;
  <a href="LICENSE">MIT License</a>
</p>

<p align="center">
  <img src="assets/screenshot.png" width="800" alt="PasteClean — interface screenshot">
</p>

---

## What it is

**PasteClean** is a web tool that cleans what you paste from tracking and hidden characters. Everything runs right in your browser: URL Cleaner and Text Inspector are fully client-side, your data never leaves your device. The tool installs as a PWA and works offline.

Three modes in one window:

- **URL Cleaner** — strips tracking parameters from links (`utm_*`, `fbclid`, `gclid`, `msclkid`, `spm`, `scm`, `pvid` and **200+ more**), unwraps nested redirects, preserves real anchors.
- **Text Inspector** — finds and removes invisible Unicode characters (zero-width space, ZWNJ, ZWJ, word joiner, BOM, soft hyphen, LTR/RTL marks) and detects homoglyph mixes (Cyrillic + Latin in the same word).
- **X-Ray Redirects** — unfolds redirect chains of short links (`bit.ly`, `tinyurl.com`, `t.co`, `goo.su`, etc.), shows status code, domain and safety of each hop, detects suspicious transitions.

---

## Features

### URL Cleaner
Removes tracking parameters from URLs. Database based on [ClearURLs](https://gitlab.com/anti-tracking/ClearURLs/rules) and regularly updated.

- Regex pattern support (`utm_*`, `pf_rd_*`, `hc_*`, etc.)
- Domain-specific rules (Amazon, YouTube, AliExpress / aliexpress.ru, Bilibili, etc.)
- Unwraps nested redirect URLs (`continue`, `url`, `q`)
- Preserves real anchor fragments (`#section`)
- One-click undo for a specific removed parameter
- Long URLs in the UI are automatically truncated with an ellipsis — click to expand

### Text Inspector
Finds and removes invisible Unicode characters:
- Zero-width space (`U+200B`), ZWNJ (`U+200C`), ZWJ (`U+200D`)
- Word joiner, BOM, soft hyphen, LTR/RTL marks
- Homoglyph mixes (Cyrillic + Latin in the same word)

### X-Ray Redirects
Unfolds redirect chains of short links:
- `goo.su`, `bit.ly`, `tinyurl.com`, `t.co` and others
- Shows full path: status code, domain, safety of each hop
- Detects suspicious redirects (IP addresses, loops, 5+ hops)
- Server-side proxy — no browser CORS blocks

### PWA
Installs as an app via the browser menu "Add to Home Screen", works offline (except X-Ray).

---

## One-command install (server)

The easiest way to run PasteClean on your own server is the install script. It installs Node.js and Nginx, clones the repo, builds static assets, and configures systemd + Nginx.

### Quick start

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/ragar7design-wq/paste-clean/main/install.sh)"
```

This installs PasteClean with defaults:
- Directory: `/opt/paste-clean`
- Public port: `8080`
- Internal app port: `9080`
- Site available at: `http://<your-server-ip>:8080`

### With a domain and port

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/ragar7design-wq/paste-clean/main/install.sh)" _ example.com 8080
```

First argument is the domain (`_` = any host/IP), second is the public port.

### What the installer does

1. Installs system packages (`git`, `nginx`, `curl`) via your package manager (apt/dnf/yum/apk).
2. Installs Node.js 20 if it is not present.
3. Clones the repo into `/opt/paste-clean` (or updates it if already cloned).
4. Builds static assets (`npm install && node scripts/build.mjs`).
5. Creates a systemd unit `paste-clean.service` and starts the app.
6. Generates an Nginx site with the ports and domain substituted, enables it and reloads Nginx.

The script is idempotent — re-run it to update.

### HTTPS (optional)

After installing with a domain, add a free TLS certificate via Let's Encrypt:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

### Server management

```bash
sudo systemctl restart paste-clean     # restart app + X-Ray API
sudo systemctl reload  nginx           # reload Nginx
sudo journalctl -u paste-clean -f      # app logs
sudo systemctl status paste-clean      # app status
```

### Update

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/ragar7design-wq/paste-clean/main/install.sh)" _ example.com 8080
```

Re-running pulls fresh code, rebuilds assets and restarts services.

---

## Local run (development)

To run PasteClean on your machine without a server:

```bash
git clone https://github.com/ragar7design-wq/paste-clean.git
cd paste-clean
npm install
npm run dev      # local server at http://localhost:5173
```

`npm run dev` starts the static server and the X-Ray API together.

### Build static assets

```bash
npm run build    # copies src/css and src/js into public/
```

### Tests

```bash
npm test         # node --test src/js/modules/*.test.mjs
```

---

## Stack

| Component | Technology |
|---|---|
| Frontend | Vanilla JS (ES2022), CSS Custom Properties |
| Styling | Tailwind CSS 3.4 (CDN) |
| Fonts | Inter + JetBrains Mono |
| Backend | Node.js (X-Ray redirect resolver + static serving) |
| Server | Nginx |
| Process manager | systemd |
| TLS | Let's Encrypt (certbot, optional) |

## Design

Dark brutalism + glassmorphism. Monochrome palette with cyan accent (`#6EE7F7`).

---

## Project structure

```
paste-clean/
├── assets/
│   ├── logo.png              # Logo
│   └── screenshot.png        # README screenshot
├── deploy/
│   └── nginx.conf            # Nginx config template (substituted by install.sh)
├── install.sh                # One-command install script
├── public/                   # Built static assets (served by Nginx)
│   ├── index.html            # Main page
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service Worker
│   ├── robots.txt
│   └── favicon/icon.svg      # Favicon
├── scripts/
│   ├── build.mjs             # Build static assets (src → public)
│   ├── dev.mjs               # Dev server + API in one command
│   ├── dev-server.mjs        # Static dev server with API proxy
│   └── server.mjs            # Prod server: static + /api/xray
├── src/
│   ├── css/                  # Styles (main, components, animations)
│   └── js/
│       ├── app.js            # App entry point
│       ├── data/
│       │   └── trackers.js  # Tracker database (200+ params)
│       └── modules/
│           ├── urlCleaner.js    # URL cleaning
│           ├── textInspector.js # Text inspection
│           ├── xray.js          # Redirect unfolding (client)
│           ├── clipboard.js     # Clipboard operations
│           ├── ui.js            # UI components
│           └── analytics.js     # Internal analytics (events, no network)
└── package.json
```

---

## Privacy

- URL Cleaner and Text Inspector — **fully client-side**, data never leaves the browser.
- X-Ray uses a server-side proxy for redirect resolution. URLs are **not stored** — the request is processed in memory and immediately discarded.
- No localStorage for user data.
- No cookies, external analytics, or trackers on the site itself.
- `analytics.js` dispatches only local `CustomEvent`s within the page — nothing is sent over the network.

## Tracker database sources

- [ClearURLs](https://gitlab.com/anti-tracking/ClearURLs/rules) — LGPL-3.0
- [Neat URL](https://github.com/Smile4ever/Neat-URL)
- [tracklessURL](https://github.com/col1010/tracklessURL)
- Manual additions for Russian platforms (Dzen, Yandex)

---

## License

MIT — see [LICENSE](LICENSE).