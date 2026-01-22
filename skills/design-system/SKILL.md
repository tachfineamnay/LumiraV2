---
name: Design System & UI
description: Guidelines for using the Lumira V2 Design System, Tailwind CSS, and UI components.
---

# Design System & UI Skills

## Context

The project uses a comprehensive Design System located in `packages/ui` and consumed by `apps/web`.
Styling is handled by **Tailwind CSS v3.4** with a custom configuration preset.

## Core Principles

1. **Sublime Celestial Palette**: Use semantic color names (e.g., `bg-void`, `text-divine`, `text-gold`) instead of raw hex values or generic colors.
2. **Glassmorphism**: Heavy use of `backdrop-blur`, semi-transparent backgrounds (`bg-slate-800/60`), and subtle borders (`border-white/10`).
3. **Animations**: Use `framer-motion` for complex interactions and Tailwind `animate-*` classes for simple loops (pulse, spin).

## Usage Instructions

### 1. Using Colors

Refer to `apps/web/tailwind.config.js` for the full palette.

- **Backgrounds**: `bg-abyss-900`, `bg-celestial-gradient`, `bg-void`
- **Text**: `text-divine` (White/Off-white), `text-slate-400` (Muted), `text-amber-400` (Gold accents).
- **Borders**: `border-slate-700/50`.

### 2. Component Library (`packages/ui`)

Always check if a component exists in `packages/ui` before creating a new one.

- **Button**: Use the shared `Button` component with variants (`default`, `ghost`, `outline`).
- **Inputs**: Use shared `Input`, `Select`.

### 3. Glass Card Pattern

For cards and containers, use the standard "Glass" effect:

```tsx
<div className="backdrop-blur-xl bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
  {/* Content */}
</div>
```

### 4. Icons

Use **Lucide React** for all icons.

```tsx
import { Sparkles } from 'lucide-react';
<Sparkles className="w-5 h-5 text-amber-400" />
```

## Common Pitfalls

- **Do NOT** hardcode hex values.
- **Do NOT** use `px` values for spacing; use Tailwind's `p-4`, `m-2` scale.
- **Do NOT** import components from relative paths if they are available in `@packages/ui`.
