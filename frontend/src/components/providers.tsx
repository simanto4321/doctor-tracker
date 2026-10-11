"use client";

import { useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { applyTheme, useThemeStore } from "@/lib/theme-store";

function ThemeBoot({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeBoot>{children}</ThemeBoot>
    </I18nProvider>
  );
}
