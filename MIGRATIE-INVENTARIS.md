# BudgetScanner migratie-inventaris (2026-04-02)

## Verhuisd naar pm-budgetscanner

- Broncode: `src/pages/BudgetScanner/**` (inclusief `components`, `categorize`, `parsers`, `export`, `__tests__`)
- Extra asset buiten BudgetScanner-map:
  - `src/assets/plusminlogo.png`
- Publieke resources:
  - `public/docs/budgetscanner/BudgetScanner.md`
  - `public/docs/budgetscanner/BudgetScanner.pdf`
  - `public/docs/budgetscanner/genereer.sh`
  - `public/docs/budgetscanner/toc-naar-nieuwe-pagina.tex`
  - `public/docs/budgetscanner/images/**`
  - `public/docs/budgetscanner/voorbeelden/**`
- Build-helper script:
  - `build-budgetscanner-pdf.sh` (aangepast naar `pm-budgetscanner` pad)

## In pm-budgetscanner nieuw ingericht

- Zelfstandige Vite + React + TypeScript setup
- Router:
  - `/` -> `BudgetScanner`
  - `/help` -> `BudgetScannerHelp`
- Tailwind + MUI basisstyling voor bestaande componenten
- Vitest setup (`src/test/setup.ts`)

## Niet meeverhuisd (bewust)

- PM-frontend integraties:
  - Routes/lazy imports in `pm-frontend/src/App.tsx`
  - Sidebar menu-item in `pm-frontend/src/components/AppSidebar.tsx`
  - i18n labels in `pm-frontend/src/i18n.ts`
- Superpowers documentatie/plannen in `pm-frontend/docs/superpowers/**`

## Validatie

- `npm install`: geslaagd
- `npm run build`: geslaagd
- `npm test`: 2 bestaande testfouten in `exportPdf.test.ts` (overgenomen uit gemigreerde codebase)
