# Rencana Implementasi: Full Foundation Refactor

## Pilihan User
- **UI Library:** shadcn/ui
- **Font:** Plus Jakarta Sans
- **Auth Storage:** httpOnly Cookie
- **Scope:** Full Foundation (semua 5 perbaikan)

---

## Phase 1: Design Foundation (30-45 menit)

### 1.1 Setup shadcn/ui
- Install dependencies: `tailwind-merge`, `clsx`, `class-variance-authorize`, `lucide-react`
- Buat `src/lib/utils.ts` dengan `cn()` helper
- Buat `components.json` untuk shadcn/ui config

### 1.2 Setup Font (Plus Jakarta Sans)
- Edit `src/app/layout.tsx` untuk import dan apply font
- Tambahkan CSS variables di `globals.css`

### 1.3 Bangun Design Tokens di `globals.css`
```css
@import "tailwindcss";

@theme {
  --color-primary: ...;
  --color-secondary: ...;
  --radius-lg: ...;
  --font-sans: "Plus Jakarta Sans", sans-serif;
}
```

### 1.4 Buat UI Primitives
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/container.tsx`

---

## Phase 2: Auth Infrastructure (30-45 menit)

### 2.1 Buat Middleware
- `src/middleware.ts` untuk protect routes: `/dashboard`, `/pesanan`, `/transaksi`, `/member`, `/profile`
- Read token dari httpOnly cookie, verify, redirect jika invalid

### 2.2 Buat Auth Context + Hook
- `src/context/AuthContext.tsx` — Provider yang fetch user sekali
- `src/hooks/useAuth.ts` — Hook return `{ user, loading, logout }`

### 2.3 Update API Auth untuk httpOnly Cookie
- Edit `src/app/api/auth/login/route.ts` — Set cookie di response
- Edit `src/app/api/auth/register/route.ts` — Set cookie di response
- Edit `src/app/api/auth/me/route.ts` — Read dari cookie, bukan header

### 2.4 Update Root Layout
- Wrap children dengan `<AuthProvider>` di root layout

---

## Phase 3: Folder Restructure (20-30 menit)

### 3.1 Pindahkan Direktori
```
src/app/components/ → src/components/shared/
src/app/lib/        → src/lib/
```

### 3.2 Buat Direktori Baru
```
src/hooks/          ← useAuth, useDebounce
src/types/          ← Centralized interfaces
src/constants/      ← Routes, colors, config
```

### 3.3 Update Semua Imports
- Update `@/app/components/*` → `@/components/*`
- Update `@/app/lib/*` → `@/lib/*`

---

## Phase 4: Component Decomposition (30-45 menit)

### 4.1 Halaman Layanan Detail (`layanan/[slug]/page.tsx`)
Pecah menjadi:
- `ServiceHero.tsx` — Hero section dengan gradient
- `ServerGrid.tsx` — Grid server selection
- `ServiceFAQ.tsx` — FAQ accordion
- `ServiceCTA.tsx` — Call to action section

### 4.2 Login/Register Forms
- `src/components/auth/LoginForm.tsx` — Extract form UI
- `src/components/auth/RegisterForm.tsx` — Extract form UI
- `src/hooks/useLoginForm.ts` — Form state + validation logic
- `src/hooks/useRegisterForm.ts` — Form state + validation logic

### 4.3 Shared Utilities
- `src/lib/format.ts` — `formatPrice()` dan formatting lainnya
- `src/components/shared/StatusBadge.tsx` — Reusable status badge

---

## Phase 5: Error/Loading Infrastructure (15-20 menit)

### 5.1 Loading States
- `src/app/(auth)/loading.tsx`
- `src/app/(main)/loading.tsx`
- `src/app/(panel)/loading.tsx`

### 5.2 Error Boundaries
- `src/app/error.tsx` — Root error boundary
- `src/app/(panel)/error.tsx` — Panel-specific error

### 5.3 Not Found Page
- `src/app/not-found.tsx` — Custom 404 page

---

## Urutan Eksekusi

1. **Setup Dependencies** — Install shadcn/ui packages
2. **Phase 1** — Design Foundation (tokens, font, primitives)
3. **Phase 2** — Auth Infrastructure (middleware, context, cookie)
4. **Phase 3** — Folder Restructure
5. **Phase 4** — Component Decomposition
6. **Phase 5** — Error/Loading Infrastructure
7. **Verification** — Build check, test flows

---

## File Changes Summary

**New Files (~20):**
- `src/lib/utils.ts`
- `src/lib/format.ts`
- `src/context/AuthContext.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useLoginForm.ts`
- `src/hooks/useRegisterForm.ts`
- `src/types/index.ts`
- `src/constants/index.ts`
- `src/middleware.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/container.tsx`
- `src/components/shared/StatusBadge.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- Loading files for each route group

**Modified Files (~15):**
- `src/app/layout.tsx` — Add font, AuthProvider
- `src/app/globals.css` — Add design tokens
- `src/app/api/auth/login/route.ts` — httpOnly cookie
- `src/app/api/auth/register/route.ts` — httpOnly cookie
- `src/app/api/auth/me/route.ts` — Read from cookie
- `src/app/(auth)/login/page.tsx` — Use LoginForm, useAuth
- `src/app/(auth)/register/page.tsx` — Use RegisterForm, useAuth
- `src/app/(main)/layanan/[slug]/page.tsx` — Decompose
- `src/app/(panel)/layout.tsx` — Remove sidebar state (use AuthProvider)
- `src/app/(panel)/dashboard/page.tsx` — Use useAuth
- `src/app/(panel)/member/page.tsx` — Use useAuth
- `src/app/(panel)/profile/page.tsx` — Use useAuth
- `src/app/(panel)/pesanan/page.tsx` — Use useAuth
- `src/app/(panel)/transaksi/page.tsx` — Use useAuth
- All files with import path updates