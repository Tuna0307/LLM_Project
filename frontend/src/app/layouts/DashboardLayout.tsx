import { Link, Outlet, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  UploadCloud, 
  Settings,
  BookOpen,
  Sun,
  Moon
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../components/ui/utils";
import { useTheme } from "next-themes";
import { Button } from "../components/ui/button";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/chat", label: "Study Chat", icon: MessageSquare },
  { path: "/exam", label: "Exam Mode", icon: FileText },
  { path: "/upload", label: "Upload Notes", icon: UploadCloud },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function DashboardLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-screen w-full overflow-hidden text-foreground bg-background transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar text-sidebar-foreground p-4 flex flex-col transition-colors duration-300">
        <div className="mb-8 px-4 py-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                IRRA
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1 pl-1">Intelligent Revision</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link key={item.path} to={item.path}>
                <div className="relative px-4 py-3 rounded-xl transition-all duration-200 group overflow-hidden">
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-sidebar-accent border border-sidebar-border rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  <div className="relative z-10 flex items-center gap-3">
                    <Icon className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )} />
                    <span className={cn(
                      "font-medium transition-colors",
                      isActive ? "text-sidebar-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )}>
                      {item.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
           {/* Theme Toggle in Sidebar */}
           <div className="px-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <span className="relative h-4 w-4 flex-shrink-0">
                <Sun className="absolute inset-0 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute inset-0 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </span>
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </Button>
          </div>

          <div className="pt-4 border-t border-sidebar-border px-4">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent border border-sidebar-border">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
                JD
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-sidebar-foreground">John Doe</p>
                <p className="text-xs text-muted-foreground truncate">Student</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative bg-background">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50 dark:bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] dark:from-purple-900/20 dark:via-transparent dark:to-transparent"></div>
        
        <div className="relative z-10 container mx-auto p-6 md:p-8 max-w-7xl h-full flex flex-col">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
