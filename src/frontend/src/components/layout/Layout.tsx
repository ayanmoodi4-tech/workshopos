import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
        />

        <main
          data-ocid="main.content"
          className="flex-1 overflow-y-auto bg-background p-4 lg:p-6"
        >
          {children}
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
