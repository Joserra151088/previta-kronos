/**
 * ThemeContext.jsx
 * Gestiona el tema visual de la aplicación: dark | light | system | custom
 */
import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "app_theme";
const STORAGE_WALLPAPER = "app_wallpaper";

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "light"
  );
  const [wallpaper, setWallpaperState] = useState(
    () => localStorage.getItem(STORAGE_WALLPAPER) || ""
  );

  const applyTheme = (t, wp = wallpaper) => {
    const root = document.documentElement;
    // Remove previous theme class
    root.classList.remove("theme-light", "theme-dark", "theme-system");

    let effective = t;
    if (t === "system") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.classList.add(`theme-${effective}`);

    // Wallpaper
    if (t === "custom" && wp) {
      document.body.style.backgroundImage = `url(${wp})`;
      document.body.style.backgroundSize  = "cover";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize  = "";
    }
  };

  useEffect(() => {
    applyTheme(theme, wallpaper);
    // Listen for system theme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system", wallpaper); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, wallpaper]);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t, wallpaper);
  };

  const setWallpaper = (url) => {
    setWallpaperState(url);
    localStorage.setItem(STORAGE_WALLPAPER, url);
    if (theme === "custom") applyTheme("custom", url);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, wallpaper, setWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
