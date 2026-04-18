import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Rocket,
  Users,
  Linkedin,
  FileText,
  Settings,
  Zap,
  LogOut,
  Inbox,
  GitPullRequestArrow,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import ProfileModal from "@/components/ProfileModal";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Inbox", url: "/inbox", icon: Inbox },
  { title: "Pipeline", url: "/pipeline", icon: GitPullRequestArrow },
  { title: "Campaign Builder", url: "/campaigns/new", icon: Rocket },
  { title: "Contact Manager", url: "/contacts", icon: Users },
  { title: "LinkedIn Queue", url: "/linkedin", icon: Linkedin },
  { title: "Templates", url: "/templates", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      const { count } = await supabase
        .from("email_replies")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      setInboxUnreadCount(count || 0);
    };
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const allItems = isAdmin
    ? [...navItems, { title: "Settings", url: "/settings", icon: Settings }]
    : navItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 py-4 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-semibold text-foreground tracking-tight">Office Beacon</h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">Outbound</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <SidebarGroup className="flex-1 relative">
          {/* Top fade */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-sidebar-background to-transparent z-10" />
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 px-2">
              {allItems.map((item) => {
                const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-lg transition-all duration-150 relative
                          ${isActive
                            ? "bg-primary/8 text-primary font-semibold border-l-[3px] border-primary ml-0 pl-2.5"
                            : "text-muted-foreground font-normal hover:bg-sidebar-accent/80 hover:text-foreground"
                          }`}
                        activeClassName=""
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <span className="flex-1 flex items-center gap-2">
                            {item.title}
                            {item.title === "Inbox" && inboxUnreadCount > 0 && (
                              <span className="ml-auto inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full leading-none">
                                {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                              </span>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          {/* Bottom fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-sidebar-background to-transparent z-10" />
        </SidebarGroup>

        {/* Bottom user area */}
        {!collapsed && (
          <div className="px-4 py-4 border-t border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setProfileOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
                title="Edit profile"
              >
                {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setProfileOpen(true)}
                  className="text-xs font-medium text-foreground truncate block hover:underline"
                >
                  {profile?.full_name || "User"}
                </button>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 h-4 rounded-sm mt-0.5 ${
                    isAdmin
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-blue-300 bg-blue-50 text-blue-700"
                  }`}
                >
                  {isAdmin ? "Admin" : "BDM"}
                </Badge>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Sign out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      </SidebarContent>
    </Sidebar>
  );
}
