---
name: aksel-spacing
description: Responsive layout patterns using Aksel spacing tokens with Box, VStack, HStack, and HGrid
---

# Aksel Spacing Skill

This skill provides responsive layout patterns using Nav Aksel Design System spacing tokens.

## Critical Rule

**NEVER use Tailwind padding/margin utilities (`p-`, `m-`, `px-`, `py-`) with Aksel components.**

Always use Aksel spacing tokens: `space-4`, `space-6`, `space-8`, etc.

## Page Container Pattern

```typescript
import { Box, VStack } from '@navikt/ds-react';

export default function Page() {
  return (
    <main>
      <Box
        paddingBlock={{ xs: 'space-8', md: 'space-12' }}
        paddingInline={{ xs: 'space-4', md: 'space-10' }}
      >
        <VStack gap={{ xs: 'space-6', md: 'space-8' }}>
          {/* Page content */}
        </VStack>
      </Box>
    </main>
  );
}
```

## Card Pattern

```typescript
import { Box, VStack, Heading, BodyShort } from '@navikt/ds-react';

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      background="surface-default"
      padding={{ xs: 'space-6', md: 'space-8' }}
      borderRadius="large"
      borderWidth="1"
      borderColor="border-subtle"
    >
      <VStack gap="space-4">
        <Heading size="medium">{title}</Heading>
        <BodyShort>{children}</BodyShort>
      </VStack>
    </Box>
  );
}
```

## Dashboard Grid Pattern

```typescript
import { HGrid, Box, VStack, Heading } from '@navikt/ds-react';

export function Dashboard() {
  return (
    <VStack gap={{ xs: 'space-6', md: 'space-8' }}>
      <Heading size="xlarge">Dashboard</Heading>

      <HGrid gap="space-4" columns={{ xs: 1, sm: 2, lg: 4 }}>
        <MetricCard title="Users" value="1 234" />
        <MetricCard title="Revenue" value="5 678" />
        <MetricCard title="Orders" value="910" />
        <MetricCard title="Growth" value="+12%" />
      </HGrid>

      <Box
        background="surface-subtle"
        padding={{ xs: 'space-6', md: 'space-8' }}
        borderRadius="large"
      >
        {/* Content */}
      </Box>
    </VStack>
  );
}
```
