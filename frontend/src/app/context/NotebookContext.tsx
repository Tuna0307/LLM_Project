import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useParams } from "react-router";

export interface Notebook {
  id: string;
  name: string;
  description: string;
  color: string; // tailwind color key: "purple" | "blue" | "green" | "rose" | "amber" | "sky"
  emoji: string;
  created_at: string;
  doc_count: number;
}

const STORAGE_KEY = "irra_notebooks";

// ── Local-storage helpers ────────────────────────────────────────────────────

export function getNotebooks(): Notebook[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveNotebooks(notebooks: Notebook[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
}

export function createNotebook(
  name: string,
  description: string,
  color: string,
  emoji: string
): Notebook {
  const nb: Notebook = {
    id: crypto.randomUUID(),
    name,
    description,
    color,
    emoji,
    created_at: new Date().toISOString(),
    doc_count: 0,
  };
  const all = getNotebooks();
  saveNotebooks([...all, nb]);
  return nb;
}

export function deleteNotebook(id: string) {
  saveNotebooks(getNotebooks().filter((n) => n.id !== id));
}

export function updateNotebookDocCount(id: string, delta: number) {
  const all = getNotebooks().map((n) =>
    n.id === id ? { ...n, doc_count: Math.max(0, n.doc_count + delta) } : n
  );
  saveNotebooks(all);
}

export function setNotebookDocCount(id: string, count: number) {
  const all = getNotebooks().map((n) =>
    n.id === id ? { ...n, doc_count: Math.max(0, count) } : n
  );
  saveNotebooks(all);
}

export function getNotebookById(id: string): Notebook | undefined {
  return getNotebooks().find((n) => n.id === id);
}

// ── Color palette ────────────────────────────────────────────────────────────

export const NOTEBOOK_COLORS: { key: string; bg: string; border: string; text: string; glow: string }[] = [
  { key: "purple", bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-400", glow: "bg-purple-500/20" },
  { key: "blue",   bg: "bg-blue-500/15",   border: "border-blue-500/40",   text: "text-blue-400",   glow: "bg-blue-500/20" },
  { key: "green",  bg: "bg-green-500/15",  border: "border-green-500/40",  text: "text-green-400",  glow: "bg-green-500/20" },
  { key: "rose",   bg: "bg-rose-500/15",   border: "border-rose-500/40",   text: "text-rose-400",   glow: "bg-rose-500/20" },
  { key: "amber",  bg: "bg-amber-500/15",  border: "border-amber-500/40",  text: "text-amber-400",  glow: "bg-amber-500/20" },
  { key: "sky",    bg: "bg-sky-500/15",    border: "border-sky-500/40",    text: "text-sky-400",    glow: "bg-sky-500/20" },
];

export function getColorStyles(colorKey: string) {
  return NOTEBOOK_COLORS.find((c) => c.key === colorKey) ?? NOTEBOOK_COLORS[0];
}

// ── Context ──────────────────────────────────────────────────────────────────

interface NotebookContextType {
  notebook: Notebook | null;
  refreshNotebook: () => void;
}

const NotebookContext = createContext<NotebookContextType>({
  notebook: null,
  refreshNotebook: () => {},
});

export function NotebookProvider({ children }: { children: ReactNode }) {
  const { notebookId } = useParams<{ notebookId: string }>();
  const [notebook, setNotebook] = useState<Notebook | null>(null);

  const refreshNotebook = () => {
    if (!notebookId) return;
    setNotebook(getNotebookById(notebookId) ?? null);
  };

  useEffect(() => {
    refreshNotebook();
  }, [notebookId]);

  return (
    <NotebookContext.Provider value={{ notebook, refreshNotebook }}>
      {children}
    </NotebookContext.Provider>
  );
}

export function useNotebook() {
  return useContext(NotebookContext);
}
