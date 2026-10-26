import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";

interface ThemeToggleProps {
  className?: string;
}

/** Compact light/dark toggle for the toolbar and mobile drawer. */
export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-base-content/70 transition-colors duration-200 hover:bg-accent-tint hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${className}`}
      aria-label={t(isDark ? "theme.switchToLight" : "theme.switchToDark")}
      title={t(isDark ? "theme.lightMode" : "theme.darkMode")}
    >
      {isDark ? (
        <Sun className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
