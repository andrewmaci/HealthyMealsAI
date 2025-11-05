## HealthyMealsAI

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](./package.json)
[![Node](https://img.shields.io/badge/node-22.14.0-43853d?logo=node.js)](./.nvmrc)
[![Astro](https://img.shields.io/badge/astro-5-FF5D01?logo=astro)](https://astro.build)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/license-not--specified-lightgrey.svg)](#license)

---

### Table of Contents
- [Project name](#healthymealsai)
- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

---

### Project description
HealthyMealsAI is an MVP web application that helps users adapt text-based recipes to their personal dietary needs using AI. Users can store personal recipes, capture allergens and disliked ingredients, and run single-goal AI adaptations (e.g., remove allergens, reduce calories, increase protein) that return a strictly validated JSON result before overwriting the recipe upon confirmation.

Key constraints and assumptions:
- Recipes are stored as a single multiline `recipe_text` field (up to 10,000 chars) with per‑serving macros.
- User profile stores allergens and disliked ingredients; no per-recipe overrides.
- AI provider is OpenRouter; adaptation runs support exactly one goal per submission and must return JSON: `{ recipe_text, macros: { kcal, protein, carbs, fat }, explanation }`.
- Daily quota: max 10 successful adaptations per user per day, reset at user‑local midnight.

Primary reference: [.ai/prd.md](.ai/prd.md)

### Tech stack
- Astro 5
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui (Radix-based UI primitives)
- Supabase (Postgres, Auth)
- OpenRouter (AI model gateway)

Notable dependencies and tooling:
- `astro@^5`, `@astrojs/react`, `@astrojs/node`, `@astrojs/sitemap`
- React 19, `lucide-react`
- Tailwind CSS 4 (`@tailwindcss/vite`), `clsx`, `class-variance-authority`, `tailwind-merge`
- Linting/Formatting: ESLint 9, Prettier (with `prettier-plugin-astro`)
- Testing: Vitest, React Testing Library, Playwright, MSW
- Node runtime: see `.nvmrc` → `22.14.0`

### Getting started locally

Prerequisites:
- Node.js 22.14.0 (recommended to use nvm)
- npm (project uses `package-lock.json`)

Set Node version:

```bash
# macOS/Linux
nvm install 22.14.0 && nvm use 22.14.0

# Windows (PowerShell) with nvm-windows
nvm install 22.14.0
nvm use 22.14.0
```

Install dependencies:

```bash
npm install
# or for reproducible installs
npm ci
```

Run the dev server:

```bash
npm run dev
# Astro defaults to http://localhost:3000
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Optional services and configuration:
- Supabase configuration template exists at `supabase/config.toml`. You can connect this project to a Supabase instance later for Auth/DB.
- Environment variables for OpenRouter and other services are not yet defined; see `src/env.d.ts` as the place where types for env vars would live when added.

Project structure (conventions):

```bash
./src               # source code
./src/layouts       # Astro layouts
./src/pages         # Astro pages
./src/pages/api     # API endpoints (server)
./src/middleware    # Astro middleware
./src/db            # Supabase clients and types
./src/types.ts      # Shared types (backend/frontend)
./src/components    # UI components (Astro/React)
./src/components/ui # shadcn/ui
./src/lib           # Services and helpers
./src/assets        # Internal static assets
./public            # Public assets
```

Note: Some directories above are planned by architecture and may not exist yet in the initial scaffold.

### Available scripts

From `package.json`:

- `npm run dev`: Start Astro development server.
- `npm run build`: Build the production site.
- `npm run preview`: Preview the production build locally.
- `npm run astro`: Run Astro CLI directly.
- `npm run lint`: Lint the project with ESLint.
- `npm run lint:fix`: Lint and attempt automatic fixes.
- `npm run format`: Format files with Prettier.

### Project scope

In scope (MVP):
- User accounts and personal profiles for allergens/dislikes
- Text-only recipes with CRUD operations and validation
- Single‑goal AI adaptation per run with strict JSON output and acceptance overwrite
- Quotas (10/day), input limits, safety guardrails, disclaimers

Out of scope (MVP):
- Importing recipes from URLs
- Rich media (photos, videos)
- Sharing or social features
- Versioning or rollback of adaptations
- Automated allergen validation of AI output
- Finalized analytics provider and dashboards

See full details in [.ai/prd.md](.ai/prd.md).

### Project status
- Status: Early MVP scaffold. Core UI/layout and tooling are set up (Astro + React + Tailwind + ESLint/Prettier). Functional features from the PRD (auth, profile, recipe CRUD, AI adaptation, quotas, analytics) are not yet implemented.
- Known upcoming work (high level):
  - Supabase integration for Auth/DB and access controls
  - Profile UI for allergens/dislikes and timezone capture
  - Recipe CRUD (validation, list/detail, edit/delete with confirmation)
  - AI adaptation modal and OpenRouter integration with strict JSON validation
  - Quota enforcement and midnight reset logic (by user timezone)
  - Analytics events: `profile_updated`, `recipe_created`, `ai_requested`, `ai_succeeded`, `ai_accepted`
  - Safety disclaimers and error/latency handling

### License
No license has been specified for this repository. Until a license is added, all rights are reserved. If you plan to use or distribute this software, please add a license (e.g., MIT) or contact the maintainers.


