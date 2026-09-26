import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type SiteTheme = "light" | "dark";

export default function ThemeSwitcher({ onTintedChrome }: { onTintedChrome?: boolean } = {}) {
  const { theme, toggleTheme } = useTheme();
  const selectTheme = (nextTheme: SiteTheme) => {
    if (theme !== nextTheme) toggleTheme?.();
  };
  return <div className="mm-theme-switcher" aria-label="Escolha o tema do site" style={onTintedChrome ? { color: "var(--secondary-foreground)" } : undefined}>
    <span className="mm-theme-label">Tema do site</span>
    <div className="mm-theme-options" role="group" aria-label="Tema do site">
      <button type="button" className="mm-theme-option" data-active={theme === "light"} aria-pressed={theme === "light"} onClick={() => selectTheme("light")} style={onTintedChrome && theme !== "light" ? { color: "var(--secondary-foreground)" } : undefined}><Sun className="h-2.5 w-2.5" />Claro</button>
      <button type="button" className="mm-theme-option" data-active={theme === "dark"} aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")} style={onTintedChrome && theme !== "dark" ? { color: "var(--secondary-foreground)" } : undefined}><Moon className="h-2.5 w-2.5" />Escuro</button>
    </div>
  </div>;
}
