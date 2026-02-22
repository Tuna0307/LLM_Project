import { Link, Outlet, useLocation, useParams } from "react-router";
import { 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  UploadCloud, 
  Settings,
  BookOpen,
  Sun,
  Moon,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../components/ui/utils";
import { useTheme } from "next-themes";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { NotebookProvider, useNotebook, getColorStyles } from "../context/NotebookContext";
import { UploadProvider, useUpload } from "../context/UploadContext";

const NAV_ITEMS = [
  { path: "",       label: "Dashboard",    icon: LayoutDashboard },
  { path: "chat",   label: "Study Chat",   icon: MessageSquare },
  { path: "exam",   label: "Exam Mode",    icon: FileText },
  { path: "upload", label: "Upload Notes", icon: UploadCloud },
  { path: "settings", label: "Settings",   icon: Settings },
];

function SidebarContent() {
  const location = useLocation();
  const { notebookId } = useParams<{ notebookId: string }>();
  const { theme, setTheme } = useTheme();
  const { notebook } = useNotebook();

  const base = `/notebook/${notebookId}`;
  const cs = notebook ? getColorStyles(notebook.color) : null;

  const isActive = (subPath: string) => {
    const full = subPath === "" ? base : `${base}/${subPath}`;
    return location.pathname === full;
  };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar text-sidebar-foreground p-4 flex flex-col transition-colors duration-300">
      {/* Back to notebooks */}
      <Link to="/" className="mb-4 flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group rounded-lg hover:bg-muted/50">
        <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
        All Notebooks
      </Link>

      {/* Notebook header */}
      <div className="mb-6 px-2 py-2 flex items-start gap-3">
        {notebook ? (
          <>
            <span className={`text-2xl flex-shrink-0 p-1.5 rounded-xl ${cs?.bg} ${cs?.border} border`}>
              {notebook.emoji}
            </span>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground leading-tight truncate">{notebook.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {notebook.doc_count} {notebook.doc_count === 1 ? "source" : "sources"}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              IRRA
            </h1>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const href = item.path === "" ? base : `${base}/${item.path}`;
          const Icon = item.icon;
          
          return (
            <Link key={item.path} to={href}>
              <div className="relative px-4 py-3 rounded-xl transition-all duration-200 group overflow-hidden">
                {active && (
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
                    active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                  )} />
                  <span className={cn(
                    "font-medium transition-colors",
                    active ? "text-sidebar-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground"
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
        {/* Upload Progress Indicator — persists even when navigating away */}
        <UploadProgressBar />

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
  );
}

function UploadProgressBar() {
  const { isProcessing, progress, progressLabel, processingFiles } = useUpload();
  if (!isProcessing) return null;
  return (
    <div className="mx-4 p-3 rounded-xl bg-sidebar-accent border border-sidebar-border space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
        <p className="text-xs font-medium text-foreground truncate">
          {processingFiles.length === 1 ? processingFiles[0] : `${processingFiles.length} files`}
        </p>
      </div>
      <Progress value={progress} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground truncate">{progressLabel}</p>
    </div>
  );
}

export function DashboardLayout() {
  return (
    <NotebookProvider>
    <UploadProvider>
      <div className="flex h-screen w-full overflow-hidden text-foreground bg-background transition-colors duration-300">
        <SidebarContent />

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative bg-background">
          <div className="absolute inset-0 z-0 pointer-events-none opacity-50 dark:bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] dark:from-purple-900/20 dark:via-transparent dark:to-transparent"></div>
          
          <div className="relative z-10 container mx-auto p-6 md:p-8 max-w-7xl h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </UploadProvider>
    </NotebookProvider>
  );
}
