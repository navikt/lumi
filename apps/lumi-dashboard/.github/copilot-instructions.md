# Lumi Dashboard – AI Coding Guide

TanStack Start dashboard for viewing and exporting Lumi survey feedback.

## Quality Standards & Workflow
- **Static Analysis**: Always run `npm run lint` (Biome) and `npm run typecheck` (TypeScript) before finishing a task.
- **Pre-commit**: This project uses `husky` and `lint-staged`. Commits will fail if linting or type checking fails.
- **Tests**: Run `npm test` when making logic changes.
- **Workflow**:
    1. Plan changes.
    2. Implement code.
    3. Verify with `npm run lint` and `npm run typecheck`.
    4. Create/Update artifacts to document work.

## Architecture

```
app/
├── routes/
│   ├── __root.tsx        # Root layout with nav
│   ├── index.tsx         # Dashboard with charts
│   ├── feedback.tsx      # Paginated feedback table
│   ├── export.tsx        # Export panel (CSV/JSON/Excel)
│   └── api/              # API routes (proxy to backend)
├── components/
│   ├── FilterBar/        # Date range, team, app, tags filters
│   ├── FeedbackTable/    # Expandable rows with answer fields
│   ├── dashboard/        # Dashboard-specific components
│   └── shared/           # Shared layout components (DashboardCard, DashboardGrid)
├── hooks/
│   ├── useFeedback.ts    # TanStack Query hook for feedback
│   ├── useStats.ts       # Dashboard stats hook
│   └── useSearchParams.ts# URL state for filters
├── types/
│   ├── api.ts            # API response types (matches backend DTOs)
│   └── filters.ts        # Filter-related types
├── server/
│   ├── fetchFromBackend.ts  # Server function with OBO token
│   └── utils.ts          # Server-side utilities
├── context/              # React context providers
├── utils/                # Client-side utilities
└── styles/global.css     # Aksel Darkside overrides
```

### Key Concepts
- **Server functions**: `createServerFn` from TanStack Start handles OBO token exchange via `@navikt/oasis`
- **URL-driven filters**: All filter state lives in URL params via `useSearchParams` hook
- **Expandable rows**: `FeedbackTable` shows collapsed summary; expand for full answers
- **PII redaction**: Backend redacts sensitive data before sending—frontend just displays

## Commands
```sh
npm run dev        # Vite dev server
npm run build      # Production build + typecheck
npm run lint       # Biome check
npm run lint:fix   # Biome auto-fix
npm run typecheck  # TypeScript check (added to pre-commit)
```

## Environment Variables
| Variable | Description |
|----------|-------------|
| `LUMI_API_URL` | Backend API (default: `http://localhost:8080`) |
| `LUMI_API_AUDIENCE` | Azure AD audience for OBO |
| `NAIS_CLUSTER_NAME` | When set, enables auth flow |

## Conventions
1. **Aksel Darkside**: Import `@navikt/ds-css/darkside` – uses `--ax-*` tokens
2. **Query keys**: Match backend endpoint paths for cache invalidation
3. **Date handling**: Use `dayjs` for formatting, ISO strings for API params
4. **Chart colors**: Define in `COLORS` constant, not inline

## Related Repositories
- **[lumi-api](https://github.com/navikt/lumi-api)**: Backend API. Types in `types/api.ts` must match DTOs in `domain/`.
- **[lumi-survey](https://github.com/navikt/lumi/tree/main/packages/lumi-survey)**: Survey widget (`@navikt/lumi-survey`) that submits to the backend.

## Backend Integration
- Proxy route at `app/routes/api/` forwards to `LUMI_API_URL`
- Types in `types/api.ts` must match backend DTOs
- Backend handles: pagination, filtering, sorting, PII redaction

## Nav Principles

- **Team First**: Autonomous teams with circles of autonomy, supported by Architecture Advice Process
- **Product Development**: Continuous development and product-organized reuse over ad hoc approaches
- **Essential Complexity**: Focus on essential complexity, avoid accidental complexity
- **DORA Metrics**: Measure and improve team performance using DevOps Research and Assessment metrics

### Aksel Requirements

- **CRITICAL**: Always use Aksel spacing tokens, never Tailwind padding/margin
- Mobile-first with responsive props: `xs`, `sm`, `md`, `lg`, `xl`
- Norwegian number formatting with space separators

### Writing Effective Agents

Based on [GitHub's analysis of 2,500+ repositories](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/), follow these patterns when creating or updating agents in `.github/agents/`:

**Structure (in order):**

1. **Frontmatter** - Name and description in YAML
2. **Persona** - One sentence: who you are and what you specialize in
3. **Commands** - Executable commands early, with flags and expected output
4. **Related Agents** - Table of agents to delegate to
5. **Core Content** - Code examples over explanations (show, don't tell)
6. **Boundaries** - Three-tier system at the end

**Six Core Areas to Cover:**

- Commands (with flags and options)
- Testing patterns
- Project structure
- Code style (✅ Good / ❌ Bad examples)
- Git workflow
- Boundaries

**Three-Tier Boundaries:**

```markdown
## Boundaries

### ✅ Always
- Check if your code passes linting and type checks
- Verify that your code changes work as intended

### ⚠️ Ask First
- Modifying production configs
- Changing auth mechanisms

### 🚫 Never
- Commit secrets to git
- Skip input validation
```

**Key Principles:**

- **Commands early**: Put executable commands near the top, not buried at the bottom
- **Code over prose**: Show real code examples, not descriptions of what code should do
- **Actionable boundaries**: "Never commit secrets" not "I cannot access secrets"

---