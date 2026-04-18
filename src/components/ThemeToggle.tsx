"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[46px] h-[46px] fixed bottom-6 right-6" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-main)] shadow-xl hover:scale-110 transition-all z-50 flex items-center justify-center glass-panel"
      aria-label="Toggle Theme"
      title="Toggle Theme"
    >
      {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-800" />}
    </button>
  );
}
