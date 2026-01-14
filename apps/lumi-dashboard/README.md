# Lumi Dashboard

Analytics dashboard for Lumi survey data. Built with TanStack Start.

## Quick Start

```bash
# Prerequisites: Node.js 20+

# 1. Clone and install
git clone https://github.com/navikt/lumi.git
cd lumi
npm install

# 2. Set environment (optional - defaults work locally)
export LUMI_API_URL=http://localhost:8080

# 3. Start development server
npm run dev
# Open http://localhost:3000
```

## Features

- 📊 **Dashboard** - Visual overview with charts and statistics
- 📈 **Charts** - Rating distribution, timeline, top apps
- 🔍 **Advanced filtering** - Date range, team, app, text search, tags
- 📤 **Export** - CSV, JSON, and Excel downloads
- 🔒 **Sensitive data protection** - PII is automatically redacted by the backend
- 🎨 **Aksel Darkside** - NAV Design System with dark mode support

## Tech Stack

- **TanStack Start** - Full-stack React framework
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Server state management
- **@navikt/ds-react** - NAV Aksel components
- **Recharts** - Charts and visualizations
- **@navikt/oasis** - Azure AD authentication

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with overview charts and stats |
| `/feedback` | Detailed feedback table with filters |
| `/export` | Export data in various formats |

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LUMI_API_URL` | Backend API URL | `http://localhost:8080` |
| `LUMI_API_AUDIENCE` | Azure AD audience for OBO | `api://dev-gcp.team-esyfo.lumi-api/.default` |
| `NAIS_CLUSTER_NAME` | NAIS cluster (enables auth) | - |

## Deployment

Deployed to NAIS via GitHub Actions.

### URLs

- **Dev**: https://lumi-dashboard.intern.dev.nav.no
- **Prod**: https://lumi-dashboard.intern.nav.no

## Authentication

Uses Wonderwall + Azure AD for authentication:

1. User navigates to the app
2. Wonderwall intercepts and redirects to Azure AD login
3. After login, Wonderwall adds the token to requests
4. App validates token and exchanges for OBO token to call backend

## Project Structure

```
app/
├── routes/             # TanStack Router page routes
│   ├── index.tsx       # Dashboard page (main entry)
│   └── feedback.tsx    # Feedback table page
├── components/
│   ├── dashboard/      # Dashboard components
│   │   ├── views/      # Survey-type specific views
│   │   │   ├── Overview/       # Default "all surveys" view
│   │   │   ├── TopTasks/       # Top Tasks survey
│   │   │   ├── Discovery/      # Discovery survey
│   │   │   ├── TaskPriority/   # Task Priority survey
│   │   │   └── Rating/         # Rating/Custom survey
│   │   ├── DashboardComponents/
│   │   ├── StatsCards/
│   │   └── FieldStats/
│   ├── feedback/       # Feedback table and related
│   └── shared/         # Cross-cutting utilities and charts
├── hooks/              # Custom TanStack Query hooks
├── types/              # TypeScript interfaces and Zod schemas
├── server/             # Server-side logic and API functions
├── styles/             # Global CSS and tokens
└── mock/               # MSW mock data and handlers
```
