"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Fournit le thème clair/sombre (stratégie `class`, préférence système par défaut). */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
