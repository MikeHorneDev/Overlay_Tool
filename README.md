# Drawing Overlay Tool

A web application for construction GCs and subcontractors to compare two sets of drawings page-by-page and identify changes.

## System Dependencies

### GraphicsMagick (required for PDF-to-image conversion)

The PDF processing pipeline uses [`pdf2pic`](https://github.com/yakovmeister/pdf2pic), which requires **GraphicsMagick** (or ImageMagick) to be installed on the host machine.

**Windows**
1. Download the GraphicsMagick installer from http://www.graphicsmagick.org/download.html
2. Run the installer and ensure "Add application directory to your system path" is checked
3. Verify: `gm version`

**macOS**
```bash
brew install graphicsmagick
```

**Ubuntu / Debian**
```bash
sudo apt-get install graphicsmagick
```

> **Note:** Without GraphicsMagick, PDF uploads will queue successfully but jobs will fail during page conversion. Everything else (project management, upload, job tracking) works without it.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up the database (first time only)
npm run db:push

# 3. Start development server (client + server concurrently)
npm run dev
```

- **Client:** http://localhost:5173
- **Server / API:** http://localhost:3001

## Project Structure

```
overlay-tool/
├── client/          # React + Vite + TypeScript + Tailwind CSS
│   └── src/
│       ├── api/     # Typed API client (axios)
│       ├── components/
│       └── pages/
└── server/          # Express + TypeScript + Prisma
    ├── prisma/      # Schema + SQLite database
    └── src/
        ├── routes/
        ├── services/
        └── workers/ # Background job processing
```

## Sessions

| # | Description | Status |
|---|-------------|--------|
| 1 | Scaffolding, upload, job queue | ✅ Complete |
| 2 | PDF-to-image pipeline, sheet number extraction | ✅ Complete |
| 3 | Page matching by sheet number | Planned |
| 4 | Diff engine (pixel-level comparison) | Planned |
| 5 | Overlay viewer | Planned |
| 6 | Title block masking | Planned |
| 7 | Export & reporting | Planned |
| 8 | Polish & deployment | Planned |
