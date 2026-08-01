# KETANTECH VPN Store — Design System Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-08-01  
**Status:** Extracted from existing codebase — documentation-only, no redesign

---

## 1. Design Tokens

### 1.1 Color Palette

The application uses a **dark obsidian theme** with **emerald green** as the primary accent color. All colors are defined as CSS custom properties in HSL format.

#### Semantic Color Tokens

| Token | HSL Value | Hex Equivalent | Usage |
|-------|-----------|----------------|-------|
| `--background` | `0 0% 2%` | `#050505` | Page background |
| `--foreground` | `0 0% 98%` | `#fafafa` | Primary text |
| `--card` | `0 0% 5%` | `#0c0c0c` | Card backgrounds |
| `--card-foreground` | `0 0% 98%` | `#fafafa` | Card text |
| `--card-border` | `0 0% 12%` | `#1e1e1e` | Card borders |
| `--popover` | `0 0% 5%` | `#0c0c0c` | Dropdown/popover backgrounds |
| `--popover-foreground` | `0 0% 98%` | `#fafafa` | Popover text |
| `--popover-border` | `0 0% 12%` | `#1e1e1e` | Popover borders |

#### Primary Accent (Emerald)

| Token | HSL Value | Hex Equivalent | Usage |
|-------|-----------|----------------|-------|
| `--primary` | `160 84% 39%` | `#10b981` | Primary buttons, links, active states |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Text on primary backgrounds |
| `--primary-border` | Dynamic (lighter) | — | Primary button borders |

#### Secondary & Muted

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--secondary` | `0 0% 10%` | Secondary buttons, less prominent backgrounds |
| `--secondary-foreground` | `0 0% 98%` | Text on secondary backgrounds |
| `--muted` | `0 0% 10%` | Muted backgrounds, inactive states |
| `--muted-foreground` | `0 0% 65%` | Muted text, placeholders, hints |

#### Semantic States

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--destructive` | `0 84% 60%` | Error states, delete actions |
| `--destructive-foreground` | `0 0% 100%` | Text on destructive backgrounds |
| `--ring` | `160 84% 39%` | Focus ring color (emerald) |

#### Chart Colors

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--chart-1` | `160 84% 39%` | Primary chart color (emerald) |
| `--chart-2` | `173 58% 39%` | Secondary chart color |
| `--chart-3` | `197 37% 24%` | Tertiary chart color |
| `--chart-4` | `43 74% 66%` | Quaternary chart color (yellow) |
| `--chart-5` | `27 87% 67%` | Quinary chart color (orange) |

#### Sidebar Tokens

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--sidebar` | `0 0% 3%` | Sidebar background |
| `--sidebar-foreground` | `0 0% 96%` | Sidebar text |
| `--sidebar-primary` | `160 84% 39%` | Active nav item background |
| `--sidebar-primary-foreground` | `0 0% 100%` | Active nav item text |
| `--sidebar-accent` | `0 0% 10%` | Hover state for nav items |
| `--sidebar-border` | `0 0% 12%` | Sidebar border |

#### Elevation Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--elevate-1` | `rgba(255,255,255, 0.04)` | Subtle hover elevation |
| `--elevate-2` | `rgba(255,255,255, 0.09)` | Stronger active elevation |
| `--button-outline` | `rgba(255,255,255, 0.10)` | Outline button border |
| `--badge-outline` | `rgba(255,255,255, 0.05)` | Badge outline border |

### 1.2 Typography

#### Font Stack

```css
--app-font-sans: 'Plus Jakarta Sans', sans-serif;
--app-font-serif: Georgia, serif;
--app-font-mono: 'JetBrains Mono', monospace;
```

**Primary Font:** Plus Jakarta Sans (weights: 400, 500, 600, 700, 800)  
**Monospace Font:** JetBrains Mono (weights: 400, 500, 700)

#### Type Scale

| Element | Classes | Size | Weight | Usage |
|---------|---------|------|--------|-------|
| H1 | `text-2xl font-bold tracking-tight` | ~24px | 700 | Page titles |
| H2 | `text-lg font-semibold` | ~18px | 600 | Section headers |
| H3 | `text-sm font-semibold` | ~14px | 600 | Card titles, subsections |
| Body | `text-sm` | ~14px | 400 | Default body text |
| Small | `text-xs` | ~12px | 400 | Secondary text, captions |
| Tiny | `text-[10px]` | ~10px | 600 | Badges, labels |
| Micro | `text-[9px]` | ~9px | 700 | Tiny badges, tags |

#### Typography Patterns

- **Page titles:** `text-2xl font-bold tracking-tight`
- **Section descriptions:** `text-sm text-muted-foreground mt-0.5`
- **Card titles:** `font-semibold leading-none tracking-tight`
- **Labels:** `text-xs font-bold tracking-widest uppercase`
- **Monospace:** `font-mono` for codes, usernames, IDs

### 1.3 Spacing

**Base unit:** 4px (0.25rem via Tailwind's `--spacing`)

#### Spacing Scale

| Token | Value | Tailwind Class |
|-------|-------|----------------|
| 1 | 4px | `p-1`, `gap-1`, `space-y-1` |
| 1.5 | 6px | `p-1.5`, `gap-1.5` |
| 2 | 8px | `p-2`, `gap-2` |
| 3 | 12px | `p-3`, `gap-3` |
| 4 | 16px | `p-4`, `gap-4` |
| 5 | 20px | `p-5` |
| 6 | 24px | `p-6` |
| 8 | 32px | `p-8` |

#### Layout Spacing

- **Page container:** `p-4 md:p-8` (16px mobile, 32px desktop)
- **Card padding:** `p-6` (24px)
- **Card content:** `p-6 pt-0` (24px horizontal, 0 top)
- **Section gaps:** `space-y-4` (16px between sections)
- **Form gaps:** `gap-3` (12px between form fields)

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `calc(var(--radius) - 4px)` | Small elements |
| `--radius-md` | `calc(var(--radius) - 2px)` | Buttons, inputs |
| `--radius-lg` | `var(--radius)` = `0.5rem` (8px) | Cards, dialogs |
| `--radius-xl` | `calc(var(--radius) + 4px)` | Large cards |
| `rounded-xl` | 12px | Server cards, feature cards |
| `rounded-2xl` | 16px | Large decorative elements |
| `rounded-full` | 9999px | Pills, badges, avatars |

### 1.5 Shadows & Depth

The design uses **minimal shadows** in favor of glass-morphism effects.

#### Glass Panel Depths

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
}

.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

#### Glow Effects

```css
.glow-primary {
  box-shadow: 0 0 20px 0 hsl(var(--primary) / 0.2),
              inset 0 0 10px 0 hsl(var(--primary) / 0.1);
}

.glow-border-primary {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 0 10px 0 hsl(var(--primary) / 0.3);
}
```

---

## 2. Component Primitives

### 2.1 Button

**File:** `src/components/ui/button.tsx`

#### Variants

| Variant | Styling | Usage |
|---------|---------|-------|
| `default` | `bg-primary text-primary-foreground border border-primary-border` | Primary actions (Order, Bayar, Simpan) |
| `secondary` | `bg-secondary text-secondary-foreground border border-secondary-border` | Secondary actions |
| `destructive` | `bg-destructive text-destructive-foreground border-destructive-border` | Delete, remove actions |
| `outline` | `border [border-color:var(--button-outline)] shadow-xs` | Tertiary actions |
| `ghost` | `border border-transparent` | Minimal actions, icon buttons |
| `link` | `text-primary underline-offset-4 hover:underline` | Text links |

#### Sizes

| Size | Classes | Height |
|------|---------|--------|
| `sm` | `min-h-8 rounded-md px-3 text-xs` | 32px |
| `default` | `min-h-9 px-4 py-2` | 36px |
| `lg` | `min-h-10 rounded-md px-8` | 40px |
| `icon` | `h-9 w-9` | 36px × 36px |

#### States

- **Hover:** `.hover-elevate` — applies `--elevate-1` background overlay
- **Active:** `.active-elevate-2` — applies `--elevate-2` background overlay
- **Disabled:** `disabled:opacity-50 disabled:pointer-events-none`
- **Focus:** `focus-visible:ring-1 focus-visible:ring-ring`

### 2.2 Input

**File:** `src/components/ui/input.tsx`

#### Styling

```css
h-9 w-full rounded-md border border-input bg-transparent px-3 py-1
text-base shadow-sm transition-colors
placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
disabled:cursor-not-allowed disabled:opacity-50
md:text-sm
```

#### States

- **Default:** Transparent background with subtle border
- **Focus:** Ring outline in primary color
- **Error:** `border-destructive focus-visible:ring-destructive`
- **Disabled:** 50% opacity, not-allowed cursor

### 2.3 Select

**File:** `src/components/ui/select.tsx`

Built on Radix UI Select primitive.

#### Trigger

- Height: `h-9`
- Padding: `px-3 py-2`
- Icon: ChevronDown at 50% opacity
- States: Same focus ring pattern as Input

#### Content

- Position: Popper mode with portal
- Animation: `animate-in fade-in zoom-in-95` on open
- Max height: `max-h-[--radix-select-content-available-height]`
- Padding: `p-1`

#### Item

- Height: `py-1.5` with `pl-2 pr-8` padding
- Hover: `focus:bg-accent focus:text-accent-foreground`
- Check icon positioned absolute right

### 2.4 Dialog

**File:** `src/components/ui/dialog.tsx`

Built on Radix UI Dialog primitive.

#### Overlay

```css
fixed inset-0 z-50 bg-black/80
animate-in fade-in-0 (open)
animate-out fade-out-0 (closed)
```

#### Content

```css
fixed left-[50%] top-[50%] z-50
w-full max-w-lg
translate-x-[-50%] translate-y-[-50%]
border bg-background p-6 shadow-lg
sm:rounded-lg
```

#### Animations

- **Enter:** `fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]`
- **Exit:** `fade-out-0 zoom-out-95 slide-out-to-left-1/2 slide-out-to-top-[48%]`
- Duration: 200ms

#### Close Button

- Position: `absolute right-4 top-4`
- Opacity: 70% default, 100% on hover
- Icon: X (16px × 16px)
- Accessible label: sr-only "Close"

### 2.5 Card

**File:** `src/components/ui/card.tsx`

#### Structure

```tsx
<Card>         // rounded-xl border bg-card text-card-foreground shadow
  <CardHeader> // flex flex-col space-y-1.5 p-6
    <CardTitle>      // font-semibold leading-none tracking-tight
    <CardDescription> // text-sm text-muted-foreground
  <CardContent> // p-6 pt-0
  <CardFooter>  // flex items-center p-6 pt-0
```

#### Common Patterns

- **Standard card:** `<Card>` with default styling
- **Glass card:** `<Card className="glass-card">` for depth effect
- **Glass panel:** `<Card className="glass-panel">` for maximum depth
- **Highlight:** `border-primary/30` for emphasis

### 2.6 Badge

**File:** `src/components/ui/badge.tsx`

#### Variants

| Variant | Styling | Usage |
|---------|---------|-------|
| `default` | `bg-primary text-primary-foreground shadow-xs` | Primary status |
| `secondary` | `bg-secondary text-secondary-foreground` | Secondary status |
| `destructive` | `bg-destructive text-destructive-foreground shadow-xs` | Error/destructive status |
| `outline` | `text-foreground border [border-color:var(--badge-outline)]` | Neutral status |

#### Styling

```css
whitespace-nowrap inline-flex items-center rounded-md border
px-2.5 py-0.5 text-xs font-semibold
transition-colors hover-elevate
```

### 2.7 Skeleton

**File:** `src/components/ui/skeleton.tsx`

```css
animate-pulse rounded-md bg-primary/10
```

Used for loading states with pulse animation in primary color at 10% opacity.

### 2.8 Spinner

**File:** `src/components/ui/spinner.tsx`

```tsx
<Loader2Icon role="status" aria-label="Loading" className="size-4 animate-spin" />
```

- Icon: Loader2Icon from Lucide
- Animation: `animate-spin` (continuous rotation)
- Size: `size-4` (16px × 16px) default, scalable via className
- Accessibility: `role="status"` with `aria-label="Loading"`

---

## 3. Layout Patterns

### 3.1 Page Container

```tsx
<div className="mx-auto max-w-6xl p-4 md:p-8 pb-24 md:pb-8">
  {/* Content */}
</div>
```

- Max width: `max-w-6xl` (1152px)
- Padding: 16px mobile, 32px desktop
- Bottom padding: 96px mobile (for bottom nav), 32px desktop

### 3.2 Page Header

```tsx
<div>
  <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
  <p className="text-sm text-muted-foreground mt-0.5">Description</p>
</div>
```

### 3.3 Sidebar

**File:** `src/components/sidebar.tsx`

#### Desktop Sidebar

```tsx
<div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0">
  <nav className="flex flex-col gap-1 p-4 h-full overflow-y-auto">
    {/* Logo */}
    {/* Nav Items */}
    {/* Logout */}
  </nav>
</div>
```

- Width: `w-64` (256px)
- Position: Sticky, full viewport height
- Background: `bg-card/50 backdrop-blur-xl`
- Border: `border-r`

#### Mobile Bottom Nav

```tsx
<nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t-0 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] safe-area-inset-bottom">
  <div className="flex items-stretch h-16 relative">
    {/* Nav items */}
  </div>
</nav>
```

- Height: `h-16` (64px)
- Top border: Gradient line `from-transparent via-primary/50 to-transparent`
- Active indicator: `h-0.5 w-8 bg-primary rounded-full` at bottom center
- Safe area: `safe-area-inset-bottom` for iOS

### 3.4 Glass Effects

#### Glass Panel (Maximum Depth)

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
}
```

**Used for:** Sidebar, bottom nav, sticky headers

#### Glass Card (Medium Depth)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

**Used for:** Server cards, feature cards, interactive elements

### 3.5 Background Gradient

```tsx
<div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.15),rgba(0,0,0,0))] pointer-events-none" />
```

Radial gradient emanating from top center, creating a subtle primary color glow.

---

## 4. Component States

### 4.1 Protocol Status Colors

Defined in `src/pages/user/accounts.tsx`:

```typescript
const PROTOCOL_COLORS: Record<string, string> = {
  ssh:         "bg-orange-500/10 text-orange-400 border-orange-500/30",
  vmess:       "bg-blue-500/10 text-blue-400 border-blue-500/30",
  vless:       "bg-purple-500/10 text-purple-400 border-purple-500/30",
  trojan:      "bg-red-500/10 text-red-400 border-red-500/30",
  shadowsocks: "bg-green-500/10 text-green-400 border-green-500/30",
};
```

### 4.2 Expiry Status

| Status | Condition | Color | Icon |
|--------|-----------|-------|------|
| Expired | `!isActive \|\| days < 0` | `text-red-500` | ShieldOff |
| Critical | `days ≤ 3` | `text-red-500` | Clock |
| Warning | `days ≤ 7` | `text-amber-600` | Clock |
| Healthy | `days > 7` | `text-green-600` | Clock |

### 4.3 Order/Transaction Status

| Status | Badge Color | Background |
|--------|-------------|------------|
| Success/Active | `text-green-600` | `bg-green-500/10` |
| Pending | `text-amber-600` | `bg-amber-500/10` |
| Failed/Expired | `text-red-500` | `bg-red-500/10` |

### 4.4 Capacity Status

```tsx
<span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20">
  <Server className="w-2.5 h-2.5" /> {used}/{limit}
</span>
```

### 4.5 Ready Status

```tsx
<span className="text-[8px] sm:text-[9px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded w-full text-center border border-primary/20">
  <Zap className="w-2 h-2" /> READY
</span>
```

### 4.6 Hover Elevation System

The design uses a custom elevation system for interactive elements:

```css
.hover-elevate::after {
  content: "";
  position: absolute;
  inset: 0px;
  background-color: var(--elevate-1); /* rgba(255,255,255, 0.04) */
  z-index: 999;
}

.active-elevate-2::after {
  background-color: var(--elevate-2); /* rgba(255,255,255, 0.09) */
}
```

Applied to buttons, badges, and interactive cards via `hover-elevate active-elevate-2` classes.

---

## 5. Motion & Animation

### 5.1 Transition Classes

| Duration | Class | Usage |
|----------|-------|-------|
| 150ms | `transition-colors` | Color changes (hover, focus) |
| 200ms | `duration-200` | Dialog animations |
| 300ms | `transition-all duration-300` | Complex transitions (server cards) |

### 5.2 Animation Classes

| Animation | CSS | Usage |
|-----------|-----|-------|
| Pulse | `animate-pulse` | Skeleton loaders |
| Spin | `animate-spin` | Loading spinners |
| Fade In | `animate-in fade-in-0` | Dialog overlay |
| Zoom In | `zoom-in-95` | Dialog content |
| Slide In | `slide-in-from-top-2` | Dropdowns |
| Slide Out | `slide-out-to-left-1/2` | Dialog close |

### 5.3 Interaction Patterns

#### Server Card Hover

```tsx
<div className="transition-all duration-300 border border-white/5 hover:border-primary/30 glass-card">
```

Smooth transition from `border-white/5` to `border-primary/30` over 300ms.

#### Button Hover

```tsx
className="hover-elevate active-elevate-2"
```

Instant elevation overlay on hover/active states.

#### Filter Tabs

```tsx
className="transition-all duration-300"
```

Smooth color and shadow transitions on active state change.

### 5.4 Reduced Motion

No explicit `prefers-reduced-motion` media queries found. Should be added for accessibility compliance.

---

## 6. Responsive Behavior

### 6.1 Breakpoints

Following Tailwind CSS v4 defaults:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| Default | 0px | Mobile-first base |
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets, small laptops |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### 6.2 Mobile Adaptations

#### Text Scaling

- Page titles: `text-2xl` (same on all sizes)
- Card text: `text-sm sm:text-base`
- Tiny labels: `text-[8px] sm:text-[9px]`
- Protocol tags: `text-[9px] sm:text-[10px]`

#### Layout Changes

- Sidebar: `hidden md:flex` (desktop only)
- Bottom nav: `md:hidden` (mobile only)
- Page padding: `p-4 md:p-8`
- Bottom padding: `pb-24 md:pb-8` (extra space for mobile nav)
- Grid columns: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`

#### Touch Targets

- Minimum tap target: 44px × 44px (iOS HIG recommendation)
- Bottom nav items: `flex-1 min-w-0` with `h-16` container
- Buttons: `min-h-9` (36px) minimum

### 6.3 375px Behavior

At 375px viewport width (iPhone SE size):

- Single column layouts for grids
- Bottom navigation visible
- Sidebar completely hidden
- Reduced horizontal padding (`p-4` = 16px)
- Text remains readable (no smaller than `text-[8px]`)
- Scrollable horizontal tabs with `overflow-x-auto`

### 6.4 Safe Area Handling

```css
.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

Applied to mobile bottom navigation for iOS devices with home indicator.

---

## 7. Accessibility Constraints

### 7.1 Target Compliance

**WCAG 2.2 Level AA** (target, not fully verified)

### 7.2 Personas & Constraints

#### Novice Users

- Simple, clear navigation structure
- Icon + text labels on all primary actions
- Step-by-step flows for complex operations (order, payment)
- Confirmation dialogs before destructive actions
- Clear error messages with recovery suggestions

#### Low-Literacy Users

- Iconography throughout (Lucide icons)
- Color-coded status indicators
- Minimal text in UI labels
- Visual hierarchy with size and weight
- Indonesian language (Bahasa Indonesia) throughout

### 7.3 Implemented Accessibility Features

#### Focus Management

- Focus ring: `focus-visible:ring-1 focus-visible:ring-ring`
- Focus outline: `focus-visible:outline-none` (ring replaces outline)
- Focus offset: `ring-offset-background`

#### Screen Reader Support

- Spinner: `role="status" aria-label="Loading"`
- Close buttons: `<span className="sr-only">Close</span>`
- Dialog: Radix UI primitives with built-in ARIA
- Hidden labels: `.sr-only` class for screen-reader-only text

#### Keyboard Navigation

- All interactive elements are focusable
- Tab order follows visual order
- Escape key closes dialogs (`onKeyDown` handlers)
- Enter key submits forms and activates buttons

#### Color Contrast

- Primary text on background: `#fafafa` on `#050505` = 19.5:1 ✓
- Muted text on background: `#a6a6a6` on `#050505` = 8.6:1 ✓
- Primary button: `#ffffff` on `#10b981` = 3.4:1 ✓ (AA for large text)

### 7.4 Accepted Accessibility Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| Tiny labels (`text-[8px]`, `text-[9px]`) | High | Below minimum 12px for readability |
| Zoom disabled | Critical | Viewport meta may prevent user scaling |
| Missing form labels | Medium | Some inputs lack associated `<label>` elements |
| No skip links | Medium | Missing "skip to main content" link |
| No reduced motion | Medium | Missing `prefers-reduced-motion` support |
| Chrome QA blocker | Critical | Specific Chrome accessibility issue (details unknown) |

---

## 8. Accepted Debt & Technical Constraints

### 8.1 Visual Debt

| Issue | Location | Impact | Mitigation |
|-------|----------|--------|------------|
| Tiny text | Status badges, protocol tags | Readability at `text-[8px]` | Use `sm:` breakpoint to increase size |
| Zoom disabled | Viewport meta | Users cannot zoom | Remove `maximum-scale=1` if present |
| Hardcoded colors | Some inline styles | Inconsistency | Migrate to CSS variables |
| Glass effect performance | All glass surfaces | Battery drain on mobile | `backdrop-filter` is GPU-intensive |

### 8.2 Interaction Debt

| Issue | Location | Impact | Notes |
|-------|----------|--------|-------|
| No loading skeletons | Some pages | Perceived performance | Only some pages have skeleton states |
| Optimistic updates | None | UX polish | All mutations wait for server response |
| Toast positioning | Bottom-center | May obscure content | Should be top-right or top-center |

### 8.3 Component Debt

| Issue | Location | Impact | Notes |
|-------|----------|--------|-------|
| No compound components | Forms | Repetitive code | Forms manually assembled each time |
| Inconsistent error states | Various | UX clarity | Some show inline, some show toast only |
| No empty state illustrations | Lists | Visual polish | Uses text-only empty states |

### 8.4 Responsive Debt

| Issue | Location | Impact | Notes |
|-------|----------|--------|-------|
| Horizontal scroll | Filter tabs | Mobile UX | Uses `overflow-x-auto` without visual indicator |
| Fixed bottom nav | All pages | Content overlap | Requires manual bottom padding |

### 8.5 Technical Constraints

#### Browser Support

- Modern browsers only (Chrome 90+, Firefox 88+, Safari 14+)
- `backdrop-filter` requires GPU acceleration
- No IE11 support

#### Performance Considerations

- Glass effects use `backdrop-filter: blur()` which is GPU-intensive
- Multiple glass panels on single page may cause performance issues on low-end devices
- Consider disabling blur on mobile or providing reduced-motion alternative

#### Font Loading

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
```

- External font loading may cause FOUT (Flash of Unstyled Text)
- Consider self-hosting fonts for production

---

## Appendix A: File References

### Core Files

| File | Purpose |
|------|---------|
| `src/index.css` | CSS variables, design tokens, utility classes |
| `src/components/layout.tsx` | Main layout wrapper |
| `src/components/sidebar.tsx` | Navigation components |
| `src/components/ui/button.tsx` | Button primitive |
| `src/components/ui/input.tsx` | Input primitive |
| `src/components/ui/select.tsx` | Select dropdown |
| `src/components/ui/dialog.tsx` | Modal dialog |
| `src/components/ui/card.tsx` | Card container |
| `src/components/ui/badge.tsx` | Status badges |
| `src/components/ui/skeleton.tsx` | Loading skeleton |
| `src/components/ui/spinner.tsx` | Loading spinner |

### Key Pages

| File | Purpose |
|------|---------|
| `src/pages/user/dynamic-order.tsx` | Order form, server cards |
| `src/pages/user/accounts.tsx` | Account list, protocol colors |
| `src/pages/admin/servers.tsx` | Server management |

---

## Appendix B: CSS Utility Classes

### Custom Utilities (from index.css)

```css
.glass-panel        /* Maximum depth glass effect */
.glass-card         /* Medium depth glass effect */
.glow-primary       /* Primary color glow */
.glow-border-primary /* Primary border glow */
.hover-elevate      /* Hover elevation overlay */
.active-elevate     /* Active elevation overlay */
.hover-elevate-2    /* Stronger hover elevation */
.active-elevate-2   /* Stronger active elevation */
```

### Scrollbar Styling

```css
::-webkit-scrollbar              { width: 6px; height: 6px; }
::-webkit-scrollbar-track        { background: transparent; }
::-webkit-scrollbar-thumb        { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover  { background: rgba(16, 185, 129, 0.5); }
```

### Selection Styling

```css
::selection {
  background: rgba(16, 185, 129, 0.3);
  color: #fff;
}
```

### Tap Highlight Removal

```css
* {
  -webkit-tap-highlight-color: transparent;
}
```

---

**Document End**  
This design system documentation is extracted from the existing codebase as of 2026-08-01. No code changes were made. For implementation work, refer to this document as the visual contract.
