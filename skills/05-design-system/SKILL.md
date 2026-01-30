---
name: Design System & UI
description: Tailwind CSS configuration, Lumira color palette, glassmorphism, and animation patterns.
---

# Design System & UI

## Context

- **Framework**: Tailwind CSS 3.4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Utility**: `cn()` from `lib/utils.ts` (clsx + tailwind-merge)

---

## Color Palette - Sublime Celestial

Oracle Lumira uses a cosmic theme inspired by the Milky Way and dawn horizon.

### Primary Colors

```javascript
// tailwind.config.js - apps/web/tailwind.config.js
colors: {
  // Deep peaceful navy blues (backgrounds)
  abyss: {
    900: "#040610",    // Absolute depth
    800: "#080C1A",    // Deep void
    700: "#0C1225",    // Primary background ⭐
    600: "#101830",    // Elevated surfaces
    500: "#18223D",    // Cards
    400: "#1E2A4A",    // Hover states
  },

  // Serene teal/cyan (accents)
  serenity: {
    700: "#0A2E3D",    // Deep teal
    600: "#0F3D50",    // Rich teal
    500: "#145266",    // Mid teal
    400: "#1A6680",    // Bright teal
    300: "#2D8AA0",    // Light teal
    200: "#4BA8BE",    // Soft cyan
  },

  // Warm amber/gold (CTAs, highlights)
  horizon: {
    600: "#B87333",    // Deep amber
    500: "#D4943C",    // Rich gold
    400: "#E8A838",    // Primary gold ⭐
    300: "#F4B942",    // Warm amber
    200: "#FFCC5C",    // Light gold
    100: "#FFE4A0",    // Soft glow
  },

  // Ethereal whites (text)
  stellar: {
    100: "#FFFFFF",    // Pure white
    200: "#F8FAFC",    // Off-white
    300: "#E2E8F0",    // Light gray
    400: "#94A3B8",    // Muted
    500: "#64748B",    // Dimmed
    600: "#475569",    // Subtle
  },
}
```

### Shorthand Aliases

```javascript
// Quick access
void: "#0C1225",      // Main background
deep: "#101830",      // Card backgrounds
gold: "#E8A838",      // Primary accent
```

---

## Class Composition with cn()

**Location**: `apps/web/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```tsx
import { cn } from '@/lib/utils';

// Conditional classes
<div className={cn(
  "bg-abyss-700 rounded-2xl p-6",
  isActive && "border border-horizon-400",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />

// Variant composition
const buttonVariants = cn(
  "px-4 py-2 rounded-xl font-medium transition-all",
  variant === "primary" && "bg-horizon-400 text-abyss-900",
  variant === "ghost" && "bg-transparent text-stellar-300 hover:bg-abyss-500",
);
```

---

## Glass Card Pattern

Standard container for cards and modals:

```tsx
// Basic glass card
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
  {children}
</div>

// Variants
const glassVariants = {
  subtle: "backdrop-blur-md bg-white/5 border border-white/5",
  strong: "backdrop-blur-2xl bg-abyss-600/80 border border-white/20",
  accent: "backdrop-blur-xl bg-horizon-400/10 border border-horizon-400/20",
  glow: "backdrop-blur-xl bg-white/5 border border-horizon-400/30 shadow-[0_0_30px_rgba(232,168,56,0.1)]",
};
```

### GlassCard Component

```tsx
// apps/web/components/ui/GlassCard.tsx
interface GlassCardProps {
  variant?: 'default' | 'subtle' | 'strong' | 'accent';
  hover?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ variant = 'default', hover, children, className }) {
  return (
    <div className={cn(
      glassVariants[variant],
      hover && "hover:border-horizon-400/40 transition-colors",
      className
    )}>
      {children}
    </div>
  );
}
```

---

## Button Component

```tsx
// apps/web/components/ui/Button.tsx
const variants = {
  primary: "bg-horizon-400 text-abyss-900 hover:bg-horizon-300",
  secondary: "bg-serenity-500 text-stellar-100 hover:bg-serenity-400",
  ghost: "bg-transparent text-stellar-300 hover:bg-abyss-500",
  outline: "border border-horizon-400/50 text-horizon-400 hover:bg-horizon-400/10",
  danger: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

<Button variant="primary" size="md">
  Découvrir
</Button>
```

---

## Animation Patterns

### Framer Motion - Fade In

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: 'easeOut' }}
>
  {children}
</motion.div>
```

### Stagger Children

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => (
    <motion.li key={i} variants={item}>
      {i}
    </motion.li>
  ))}
</motion.ul>
```

### Glow Pulse Animation

```css
/* globals.css */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(232, 168, 56, 0.2); }
  50% { box-shadow: 0 0 40px rgba(232, 168, 56, 0.4); }
}

.animate-glow-pulse {
  animation: glow-pulse 2s ease-in-out infinite;
}
```

---

## Level Badges

Color-coded badges for product tiers:

```tsx
// apps/web/components/ui/LevelBadge.tsx
const levelConfig = {
  1: { name: 'Initié', color: 'from-blue-400 to-blue-600', text: 'text-blue-100' },
  2: { name: 'Mystique', color: 'from-purple-400 to-purple-600', text: 'text-purple-100' },
  3: { name: 'Profond', color: 'from-amber-400 to-amber-600', text: 'text-amber-100' },
  4: { name: 'Intégral', color: 'from-rose-400 to-rose-600', text: 'text-rose-100' },
};

<div className={cn(
  "px-3 py-1 rounded-full bg-gradient-to-r",
  levelConfig[level].color
)}>
  <span className={cn("text-xs font-bold uppercase", levelConfig[level].text)}>
    {levelConfig[level].name}
  </span>
</div>
```

---

## Typography

```css
/* Headings */
.text-display { @apply text-4xl md:text-5xl font-bold text-stellar-100; }
.text-title { @apply text-2xl md:text-3xl font-semibold text-stellar-100; }
.text-subtitle { @apply text-lg md:text-xl text-stellar-300; }

/* Body */
.text-body { @apply text-base text-stellar-400; }
.text-caption { @apply text-sm text-stellar-500; }

/* Accent */
.text-gold { @apply text-horizon-400; }
.text-glow { @apply text-stellar-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]; }
```

---

## Responsive Breakpoints

```javascript
// Tailwind defaults
screens: {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
}

// Usage
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-2xl md:text-4xl lg:text-5xl">
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Use semantic colors (`abyss-700`, `horizon-400`) | Use raw hex values (`#0C1225`) |
| Use `cn()` for conditional classes | String concatenation for classes |
| Use glass variants consistently | Mix different blur/opacity randomly |
| Follow mobile-first breakpoints | Desktop-first styling |
| Use `@packages/ui` components | Recreate Button/Card from scratch |
| Keep animations subtle (0.2-0.5s) | Use jarring animations (>1s) |
