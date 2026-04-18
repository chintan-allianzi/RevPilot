import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [location.pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 border-l border-border/60">
          <header className="h-11 flex items-center sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/40">
            <SidebarTrigger className="ml-3 text-muted-foreground hover:text-foreground" />
          </header>
          <main className="flex-1 overflow-auto">
            <div
              className={`max-w-6xl mx-auto px-8 py-8 transition-opacity duration-200 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
