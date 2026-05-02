import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { tiks } from "@rexa-developer/tiks";
import IMHome from "@/pages/IMHome";
import Chat from "@/pages/Chat";

export default function App() {
  useEffect(() => {
    let initialized = false;

    const handleGlobalClick = (e: MouseEvent) => {
      if (!initialized) {
        tiks.init();
        initialized = true;
      }
      
      const target = e.target as HTMLElement;
      // 为所有 button 和 role="button" 的元素添加点击音效
      if (target.closest('button') || target.closest('[role="button"]')) {
        tiks.click();
      }
    };

    document.addEventListener('click', handleGlobalClick, true); // 使用捕获阶段确保即使事件被阻止冒泡也能触发音效
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<IMHome />} />
        <Route path="/chat" element={<Chat />} />
        <Route 
          path="*" 
          element={
            <div className="flex items-center justify-center h-screen text-2xl bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-white transition-colors duration-500">
              404 - 页面未找到
            </div>
          } 
        />
      </Routes>
    </Router>
  );
}
