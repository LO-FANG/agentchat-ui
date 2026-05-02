import { useState, useEffect } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    // 优先读取本地缓存，如果没缓存则根据当前时间自动设置
    const saved = localStorage.getItem("theme");
    if (saved) {
      return saved === "dark";
    }
    // 获取当前时间，早6点到晚6点为白天，其余时间为夜间
    const hour = new Date().getHours();
    return hour < 6 || hour >= 18;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return { isDark, toggleTheme };
}
