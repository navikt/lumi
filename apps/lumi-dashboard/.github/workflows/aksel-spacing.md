---
description: Best practices for using Aksel spacing tokens in components
---

# Aksel Spacing Tokens

When using Aksel design system components (VStack, HStack, HGrid, Box, etc.), always use the **new `space-X` token format** for spacing properties.

## Deprecated vs New Format

The old numeric string format (`"1"`, `"2"`, `"4"`, `"6"`, etc.) is **deprecated**.

Use the new `space-X` format instead:

| Old (deprecated) | New (correct) | Value |
|------------------|---------------|-------|
| `"0"` | `"0"` | 0px |
| `"05"` | `"space-05"` | 2px |
| `"1"` | `"space-4"` | 4px |
| `"2"` | `"space-8"` | 8px |
| `"3"` | `"space-12"` | 12px |
| `"4"` | `"space-16"` | 16px |
| `"5"` | `"space-20"` | 20px |
| `"6"` | `"space-24"` | 24px |
| `"7"` | `"space-28"` | 28px |
| `"8"` | `"space-32"` | 32px |
| `"10"` | `"space-40"` | 40px |
| `"12"` | `"space-48"` | 48px |

## Examples

### Gap
```tsx
// ❌ Deprecated
<VStack gap="4">
<HStack gap={{ xs: "2", md: "4" }}>

// ✅ Correct
<VStack gap="space-16">
<HStack gap={{ xs: "space-8", md: "space-16" }}>
```

### Padding
```tsx
// ❌ Deprecated
<Box padding="6">
<Box paddingBlock={{ xs: "4", md: "6" }}>

// ✅ Correct
<Box padding="space-24">
<Box paddingBlock={{ xs: "space-16", md: "space-24" }}>
```

## References
- [HGrid documentation](https://aksel.nav.no/komponenter/primitives/hgrid)
- [Design tokens](https://aksel.nav.no/grunnleggende/styling/design-tokens#0cc9fb32f213)
