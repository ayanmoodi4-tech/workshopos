import { cn } from "@/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import type { AppRole } from "../../types";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Workers", path: "/admin/workers", icon: Users },
  { label: "Jobs", path: "/admin/jobs", icon: Briefcase },
  { label: "Job Board", path: "/admin/job-board", icon: ClipboardList },
  { label: "Incentives", path: "/admin/incentives", icon: BarChart3 },
  { label: "Attendance", path: "/admin/attendance", icon: BookOpen },
  { label: "Notifications", path: "/admin/notifications", icon: Bell },
  { label: "Reports", path: "/admin/reports", icon: BarChart3 },
  { label: "Settings", path: "/admin/settings", icon: Settings },
  { label: "Audit Log", path: "/admin/audit", icon: BookOpen },
];

const workshopNav: NavItem[] = [
  { label: "Dashboard", path: "/workshop", icon: LayoutDashboard },
  { label: "Job Board", path: "/workshop/job-board", icon: ClipboardList },
  { label: "Workers", path: "/workshop/workers", icon: Users },
  { label: "Attendance", path: "/workshop/attendance", icon: BookOpen },
  { label: "Notifications", path: "/workshop/notifications", icon: Bell },
];

const salesNav: NavItem[] = [
  { label: "Dashboard", path: "/sales", icon: LayoutDashboard },
  { label: "Job Board", path: "/sales/job-board", icon: ClipboardList },
  { label: "Create Job", path: "/sales/job-create", icon: Briefcase },
  { label: "Products", path: "/sales/products", icon: Package },
  { label: "Notifications", path: "/sales/notifications", icon: Bell },
];

function getNavItems(role: AppRole | null): NavItem[] {
  switch (role) {
    case "Admin":
      return adminNav;
    case "WorkshopManager":
      return workshopNav;
    case "SalesManager":
      return salesNav;
    default:
      return [];
  }
}

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { role } = useAuth();
  const location = useLocation();
  const navItems = getNavItems(role);

  return (
    <aside
      data-ocid="sidebar"
      className={cn(
        "sidebar-nav flex flex-col h-full transition-all duration-300 overflow-hidden",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" />
              <rect
                x="9"
                y="1"
                width="6"
                height="6"
                rx="1.5"
                fill="white"
                opacity="0.7"
              />
              <rect
                x="1"
                y="9"
                width="6"
                height="6"
                rx="1.5"
                fill="white"
                opacity="0.7"
              />
              <rect
                x="9"
                y="9"
                width="6"
                height="6"
                rx="1.5"
                fill="white"
                opacity="0.4"
              />
            </svg>
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-base text-sidebar-foreground truncate">
              WorkshopOS
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === location.pathname ||
            (item.path !== "/admin" &&
              item.path !== "/workshop" &&
              item.path !== "/sales" &&
              location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              data-ocid={`sidebar.${item.label.toLowerCase().replace(/\s+/g, "-")}.link`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-smooth",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Role badge at bottom */}
      {!collapsed && role && (
        <div className="px-4 py-3 border-t border-sidebar-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {role}
          </span>
        </div>
      )}
    </aside>
  );
}
