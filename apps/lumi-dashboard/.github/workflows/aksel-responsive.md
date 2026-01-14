---
description: Make a component responsive using Aksel design system primitives
---

# Aksel Responsive Design Workflow

Use this workflow when making a component responsive. Follow the Aksel design system patterns for consistency.

## Aksel Breakpoints Reference

| Token | Min-width | Target Devices |
|-------|-----------|----------------|
| `xs` | 0px | Small phones (320-479px) |
| `sm` | 480px | Large phones, small tablets |
| `md` | 768px | Tablets portrait |
| `lg` | 1024px | Tablets landscape, small laptops |
| `xl` | 1280px | Desktop, large laptops |
| `2xl` | 1440px | Large desktop screens |

## Step 1: Audit the Component

Check the component for these common issues:
- [ ] Hardcoded widths (e.g., `width: 200px`, `style={{ width: "250px" }}`)
- [ ] Fixed heights that don't adapt to content
- [ ] Horizontal layouts that don't wrap (`HStack` without `wrap` prop)
- [ ] Tables with too many columns for mobile
- [ ] `gridColumn: span X` that breaks on single-column layouts
- [ ] Popovers/modals that overflow on small screens

## Step 2: Choose the Right Aksel Primitives

### For Visibility Control
```tsx
// Hide content below a breakpoint (hide on mobile)
import { Hide } from "@navikt/ds-react";
<Hide below="md">Desktop only content</Hide>

// Hide content above a breakpoint (hide on desktop)
<Hide above="md">Mobile only content</Hide>

// Show content above a breakpoint
import { Show } from "@navikt/ds-react";
<Show above="md">Desktop content</Show>
```

### For Responsive Layouts
```tsx
// HGrid for responsive columns
import { HGrid } from "@navikt/ds-react";
<HGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap={{ xs: "3", md: "6" }}>
  {children}
</HGrid>

// HStack/VStack with responsive gap
import { HStack, VStack } from "@navikt/ds-react";
<HStack gap={{ xs: "2", md: "4" }} wrap>
  {children}
</HStack>
```

### For Responsive Spacing
```tsx
// Box.New with responsive padding
import { Box } from "@navikt/ds-react";
<Box.New 
  padding={{ xs: "3", sm: "4", lg: "6" }}
  paddingInline={{ xs: "2", md: "4" }}
>
  {children}
</Box.New>
```

## Step 3: Mobile-First Patterns

### Tables → Cards on Mobile
For data tables, create a card-based alternative for mobile:
```tsx
<Hide above="md">
  <VStack gap="3">
    {items.map(item => <ItemCard key={item.id} {...item} />)}
  </VStack>
</Hide>

<Show above="md">
  <Table>...</Table>
</Show>
```

### Horizontal Filters → Stacked on Mobile
```tsx
<HGrid columns={{ xs: 1, md: "1fr 1fr auto" }} gap="3">
  <Select ... />
  <Select ... />
  <Button ... />
</HGrid>
```

### Popovers → Consider Mobile Alternatives
- Bottom sheets for date pickers on mobile
- Full-width modals instead of narrow popovers
- Collapsible sections instead of hover menus

## Step 4: Touch-Friendly Sizing

Ensure interactive elements meet minimum touch target size:
```css
/* Minimum 44px x 44px for touch targets */
button, [role="button"], a {
  min-height: 44px;
  min-width: 44px;
}
```

## Step 5: Test at Key Breakpoints

Verify the component at these widths:
- [ ] 320px (iPhone SE)
- [ ] 375px (iPhone 14)
- [ ] 768px (iPad portrait)
- [ ] 1024px (iPad landscape)
- [ ] 1280px+ (Desktop)

## Common Patterns for This Project

### DashboardGrid (reusable component)
Use `DashboardGrid` with responsive minColumnWidth:
```tsx
<DashboardGrid minColumnWidth={{ xs: "140px", md: "240px" }}>
  <DashboardCard>...</DashboardCard>
</DashboardGrid>
```

### Header Navigation
- Icons only on mobile (`below="sm"`)
- Icons + text on tablet and up (`above="sm"`)

### FilterBar
- Stack vertically on mobile (`xs: 1 column`)
- Horizontal layout on tablet+ (`md: multiple columns`)
