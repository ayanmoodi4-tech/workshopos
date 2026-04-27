import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, LogOut, Menu } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useNotifications } from "../../hooks/use-notifications";

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const roleBadgeClass: Record<string, string> = {
  Admin: "bg-blue-100 text-blue-800 border-blue-300",
  WorkshopManager: "bg-emerald-100 text-emerald-800 border-emerald-300",
  SalesManager: "bg-amber-100 text-amber-800 border-amber-300",
};

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { role, logout, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <header
      data-ocid="header"
      className="header-elevated h-16 flex items-center justify-between px-4 lg:px-6 shrink-0 z-10"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          data-ocid="header.sidebar_toggle"
          className="text-foreground hover:bg-muted"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={20} />
        </Button>
        <span className="font-display font-bold text-lg text-foreground hidden sm:block">
          WorkshopOS
        </span>
      </div>

      <div className="flex items-center gap-2">
        {role && (
          <span
            className={cn(
              "hidden sm:inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border",
              roleBadgeClass[role] ??
                "bg-muted text-muted-foreground border-border",
            )}
          >
            {role === "WorkshopManager"
              ? "Workshop Mgr"
              : role === "SalesManager"
                ? "Sales Mgr"
                : role}
          </span>
        )}

        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            data-ocid="header.notifications_button"
            className="relative text-foreground hover:bg-muted"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}

        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            data-ocid="header.logout_button"
            className="text-foreground hover:bg-muted"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </Button>
        )}
      </div>
    </header>
  );
}
