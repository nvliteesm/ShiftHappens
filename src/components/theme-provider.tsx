/**
 * Theme Provider Component
 *
 * Wraps next-themes ThemeProvider for dark mode support.
 * Uses class-based dark mode (Tailwind's `dark:` variants).
 * Persists theme preference in localStorage.
 */
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
