---
description: Best practices for using Aksel (NAV Design System) components
---

# Aksel Component Usage Workflow

Use this workflow when adding or modifying Aksel components in this project.

## Key Documentation Links

- Components: https://aksel.nav.no/komponenter
- Primitives: https://aksel.nav.no/komponenter/primitives
- Design Tokens: https://aksel.nav.no/grunnleggende/styling/design-tokens
- Icons: https://aksel.nav.no/ikoner

## Preferred Component Patterns

### Layout Primitives (ALWAYS prefer these)
```tsx
// ✅ Use Aksel primitives
import { Box, HStack, VStack, HGrid } from "@navikt/ds-react";

// ❌ Avoid raw divs with inline styles for layout
<div style={{ display: "flex", gap: "1rem" }}>
```

### Box.New vs Box
The `Box.New` component uses the new Aksel token system:
```tsx
// ✅ Preferred - uses ax-tokens
<Box.New 
  padding="6"
  background="raised"
  borderRadius="large"
  borderWidth="1"
  borderColor="neutral-subtle"
/>

// ⚠️ Legacy - still works but prefer Box.New
<Box padding="6" background="surface-default" />
```

### Typography
```tsx
import { Heading, BodyShort, BodyLong, Detail, Label } from "@navikt/ds-react";

// Heading sizes: xlarge, large, medium, small, xsmall
<Heading size="large" level="1">Page Title</Heading>

// Body text
<BodyShort>Short paragraph or label text</BodyShort>
<BodyLong>Longer form content, paragraphs</BodyLong>

// Small text
<Detail>Fine print, metadata</Detail>
<Label size="small">Form label</Label>
```

### Color Tokens
Always use CSS variables from Aksel, never hardcode colors:
```tsx
// ✅ Correct
style={{ color: "var(--ax-text-subtle)" }}
style={{ background: "var(--ax-bg-neutral-soft)" }}

// ❌ Never hardcode
style={{ color: "#666" }}
style={{ background: "lightgray" }}
```

Common token categories:
- `--ax-text-*` - Text colors (default, subtle, accent, on-*)
- `--ax-bg-*` - Background colors (default, raised, neutral-soft, accent-soft)
- `--ax-border-*` - Border colors (subtle, neutral-subtle, accent)
- `--ax-shadow-*` - Shadows (xsmall, small, medium, large)

### Form Components
```tsx
import { TextField, Select, Checkbox, Radio, RadioGroup, Switch } from "@navikt/ds-react";

// Always include labels (use hideLabel for visual hiding)
<TextField label="Search" hideLabel placeholder="Search..." />
<Select label="Choose option" hideLabel>...</Select>
```

### Buttons
```tsx
import { Button } from "@navikt/ds-react";

// Variants: primary, secondary, tertiary, danger
// Sizes: medium (default), small, xsmall
<Button variant="primary" size="small" icon={<Icon />}>
  Label
</Button>

// Icon-only buttons need aria-label
<Button variant="tertiary" size="small" icon={<XMarkIcon />} aria-label="Close" />
```

### Tables
```tsx
import { Table } from "@navikt/ds-react";

<Table size="small">
  <Table.Header>
    <Table.Row>
      <Table.HeaderCell>Column 1</Table.HeaderCell>
      <Table.HeaderCell align="right">Column 2</Table.HeaderCell>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row>
      <Table.DataCell>Value</Table.DataCell>
      <Table.DataCell align="right">123</Table.DataCell>
    </Table.Row>
    {/* For expandable rows */}
    <Table.ExpandableRow content={<ExpandedContent />}>
      <Table.DataCell>Expandable</Table.DataCell>
    </Table.ExpandableRow>
  </Table.Body>
</Table>
```

### Alerts and Feedback
```tsx
import { Alert, Tag, Tooltip } from "@navikt/ds-react";

// Alert variants: info, success, warning, error
<Alert variant="info" size="small">Information message</Alert>

// Tag variants: neutral, info, success, warning, error
<Tag variant="success" size="small">Active</Tag>

// Tooltips for additional context
<Tooltip content="Detailed explanation">
  <span>Hover for info</span>
</Tooltip>
```

### Loaders and Skeletons
```tsx
import { Loader, Skeleton } from "@navikt/ds-react";

// Spinner loader
<Loader size="small" />

// Skeleton for content loading
<Skeleton variant="text" width="100%" />
<Skeleton variant="rectangle" height={100} />
```

## Import Organization

Keep Aksel imports organized:
```tsx
// 1. Icons (separate import)
import { ChevronDownIcon, XMarkIcon } from "@navikt/aksel-icons";

// 2. Components (single import from ds-react)
import {
  Alert,
  BodyShort,
  Box,
  Button,
  Heading,
  HStack,
  Table,
  VStack,
} from "@navikt/ds-react";
```

## Dark Mode Support

Aksel tokens automatically support dark mode when using the theme wrapper:
```tsx
// In __root.tsx or app layout
<div data-theme={theme} className="app-theme-root">
  {children}
</div>
```

All `--ax-*` tokens will automatically adapt. Never use hardcoded colors that break dark mode.
