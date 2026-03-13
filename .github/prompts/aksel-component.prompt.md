---
name: aksel-component
description: Scaffold a responsive React component using Aksel Design System with correct spacing tokens
---

You are creating a new React component using Nav's Aksel Design System.

## CRITICAL Rules

1. **NEVER use Tailwind padding/margin utilities** (`p-*`, `m-*`, `px-*`, `py-*`)
2. **ALWAYS use Aksel spacing tokens** with `space-` prefix
3. **Mobile-first responsive design** with breakpoints: `xs`, `sm`, `md`, `lg`, `xl`
4. **Use Aksel components**: Box, VStack, HGrid, Heading, BodyShort, Button, etc.

## Ask the User

1. **Component name**: What is the component called? (PascalCase)
2. **Purpose**: What does the component do?
3. **Layout**: Card, list item, form, dashboard section, etc.?
4. **Responsive**: Should layout change on different screen sizes?

## Component Template

```tsx
import { Box, VStack, Heading, BodyShort } from "@navikt/ds-react";

interface {ComponentName}Props {
  title: string;
  description?: string;
  // Add more props as needed
}

export function {ComponentName}({
  title,
  description
}: {ComponentName}Props) {
  return (
    <Box
      background="surface-subtle"
      padding={{ xs: "space-16", md: "space-24" }}
      borderRadius="large"
    >
      <VStack gap="space-16">
        <Heading size="medium" level="2">
          {title}
        </Heading>
        {description && (
          <BodyShort>
            {description}
          </BodyShort>
        )}
      </VStack>
    </Box>
  );
}
```

## Common Patterns

### Card Component

```tsx
<Box
  background="surface-subtle"
  padding={{ xs: "space-16", md: "space-24" }}
  borderRadius="large"
>
  <VStack gap="space-16">
    <Heading size="medium" level="3">
      {title}
    </Heading>
    <BodyShort>{description}</BodyShort>
  </VStack>
</Box>
```

### Responsive Grid Layout

```tsx
<HGrid columns={{ xs: 1, md: 2, lg: 3 }} gap="space-16">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</HGrid>
```

### Form Section

```tsx
<Box paddingBlock="space-24">
  <VStack gap="space-24">
    <Heading size="large" level="2">
      Form Title
    </Heading>
    <VStack gap="space-16">
      <TextField label="Field 1" />
      <TextField label="Field 2" />
      <Button>Submit</Button>
    </VStack>
  </VStack>
</Box>
```

### Dashboard Section

```tsx
<Box background="surface-default" padding={{ xs: "space-16", md: "space-24" }} borderRadius="medium">
  <VStack gap="space-24">
    <HStack justify="space-between" align="center" wrap>
      <Heading size="large" level="2">
        Section Title
      </Heading>
      <Button variant="secondary" size="small">
        Action
      </Button>
    </HStack>
    <HGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="space-16">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} {...metric} />
      ))}
    </HGrid>
  </VStack>
</Box>
```

### Page Container

```tsx
<main>
  <Box paddingBlock={{ xs: "space-16", md: "space-24" }} paddingInline={{ xs: "space-16", md: "space-40" }}>
    <VStack gap={{ xs: "space-16", md: "space-24" }}>{/* Page content */}</VStack>
  </Box>
</main>
```

## Testing

Create a test file `{component-name}.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ComponentName } from "./component-name";

describe("ComponentName", () => {
  it("should render title", () => {
    render(<ComponentName title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });
});
```

## Checklist

After generating the component, verify:

- ✅ No Tailwind padding/margin utilities
