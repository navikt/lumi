---
description: Create a new React component following project conventions
---

# New Component Workflow

Use this workflow when creating a new component in lumi-dashboard.

## Step 1: Determine Component Location

- **Shared/reusable components**: `app/components/`
- **Page-specific components**: `app/components/[PageName]/`
- **Chart components**: `app/components/charts/`
- **Dashboard building blocks**: `app/components/DashboardComponents/`

## Step 2: Create Component File

### File Structure
```
app/components/
├── MyComponent.tsx           # Simple component
├── MyComponent/              # Complex component with sub-files
│   ├── MyComponent.tsx       # Main component
│   ├── MyComponent.module.css # Component styles (if needed)
│   ├── MyComponentSkeleton.tsx # Loading skeleton
│   └── index.ts              # Re-exports
```

### Component Template
```tsx
import { Box, Heading, VStack } from "@navikt/ds-react";
import type { ReactNode } from "react";

interface MyComponentProps {
  title: string;
  children?: ReactNode;
}

/**
 * Brief description of what this component does.
 * When to use it, any important notes.
 */
export function MyComponent({ title, children }: MyComponentProps) {
  return (
    <Box.New padding="4" background="raised" borderRadius="large">
      <VStack gap="3">
        <Heading size="small">{title}</Heading>
        {children}
      </VStack>
    </Box.New>
  );
}
```

## Step 3: Style Considerations

### Prefer Aksel Primitives
Use `Box.New`, `HStack`, `VStack`, `HGrid` for layout instead of CSS.

### When to Use CSS Modules
- Complex animations
- Pseudo-elements (::before, ::after)
- Complex hover/focus states
- Styles that can't be expressed with Aksel props

### CSS Module Template
```css
/* MyComponent.module.css */

.container {
  /* Use Aksel tokens for colors, spacing */
  color: var(--ax-text-default);
  background: var(--ax-bg-default);
}

.container:hover {
  background: var(--ax-bg-neutral-soft);
}

/* Responsive styles */
@media (max-width: 768px) {
  .container {
    padding: var(--ax-spacing-2);
  }
}
```

## Step 4: Loading States

Create a skeleton component for async data:
```tsx
// MyComponentSkeleton.tsx
import { Skeleton, VStack } from "@navikt/ds-react";

export function MyComponentSkeleton() {
  return (
    <VStack gap="3">
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="rectangle" height={100} />
    </VStack>
  );
}
```

Usage in main component:
```tsx
export function MyComponent() {
  const { data, isLoading } = useMyData();
  
  if (isLoading) return <MyComponentSkeleton />;
  
  // ... rest of component
}
```

## Step 5: Responsive Design

Follow the `/aksel-responsive` workflow:
- Use responsive props: `gap={{ xs: "2", md: "4" }}`
- Add `wrap` to `HStack` for flexible layouts
- Consider mobile-first: Start with mobile layout, enhance for desktop
- Use `Hide`/`Show` for conditional visibility

## Step 6: TypeScript & Props

### Prop Conventions
- Use interface for props (not type)
- Document complex props with JSDoc
- Make optional props explicit with `?`
- Use children?: ReactNode for wrapper components

### Type Imports
```tsx
// Import types with 'type' keyword
import type { FeedbackDto } from "~/types/api";
import type { ReactNode, ComponentProps } from "react";
```

## Step 7: Testing Considerations

- Add `data-testid` attributes for critical interactive elements
- Ensure keyboard navigation works
- Check color contrast in both light and dark modes

## Step 8: Export from Barrel (if needed)

For component folders with multiple files:
```tsx
// index.ts
export { MyComponent } from "./MyComponent";
export { MyComponentSkeleton } from "./MyComponentSkeleton";
```

## Checklist

- [ ] Component follows project file structure
- [ ] Uses Aksel primitives for layout
- [ ] Has TypeScript interface for props
- [ ] Has JSDoc comment describing purpose
- [ ] Loading skeleton created (if uses async data)
- [ ] Responsive at key breakpoints (320px, 768px, 1024px+)
- [ ] Works in both light and dark mode
- [ ] Uses Aksel color tokens, not hardcoded colors
