import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Plus,
  Trash2,
  Search,
  Sun,
  Moon,
  FileText,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useTheme } from "next-themes";
import {
  createNotebook,
  deleteNotebook,
  getNotebooks,
  getColorStyles,
  NOTEBOOK_COLORS,
  type Notebook,
} from "../context/NotebookContext";

const EMOJI_OPTIONS = ["📚", "🔬", "📝", "🧠", "💡", "🎓", "🔭", "🧪", "📐", "🖥️", "🌍", "🎵"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Notebooks() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notebook | null>(null);

  // New notebook form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("purple");
  const [newEmoji, setNewEmoji] = useState("📚");

  const reload = () => setNotebooks(getNotebooks());

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const nb = createNotebook(newName.trim(), newDesc.trim(), newColor, newEmoji);
    reload();
    setCreateOpen(false);
    resetForm();
    navigate(`/notebook/${nb.id}`);
  };

  const handleDelete = (nb: Notebook) => {
    deleteNotebook(nb.id);
    reload();
    setDeleteTarget(null);
  };

  const resetForm = () => {
    setNewName("");
    setNewDesc("");
    setNewColor("purple");
    setNewEmoji("📚");
  };

  const filtered = notebooks.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              IRRA
            </h1>
            <span className="text-muted-foreground text-sm ml-1 hidden sm:block">
              — Intelligent Revision Assistant
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground"
          >
            <span className="relative h-5 w-5">
              <Sun className="absolute inset-0 h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute inset-0 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Your Notebooks</h2>
          <p className="text-muted-foreground text-base">
            Each notebook has its own documents, chat history, and exam questions.
          </p>
        </motion.div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notebooks..."
              className="pl-9 bg-card border-border"
            />
          </div>
          <Button
            onClick={() => { resetForm(); setCreateOpen(true); }}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Notebook
          </Button>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground"
          >
            <BookOpen className="h-16 w-16 opacity-20" />
            {notebooks.length === 0 ? (
              <>
                <p className="text-lg font-medium">No notebooks yet</p>
                <p className="text-sm">Create your first notebook to get started.</p>
                <Button
                  onClick={() => { resetForm(); setCreateOpen(true); }}
                  className="mt-2 bg-purple-600 hover:bg-purple-700 text-white gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Notebook
                </Button>
              </>
            ) : (
              <p className="text-sm">No notebooks match your search.</p>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {filtered.map((nb, i) => {
                const cs = getColorStyles(nb.color);
                return (
                  <motion.div
                    key={nb.id}
                    initial={{ opacity: 0, scale: 0.93 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -4 }}
                    className="group relative cursor-pointer"
                    onClick={() => navigate(`/notebook/${nb.id}`)}
                  >
                    <div
                      className={`rounded-2xl border ${cs.border} ${cs.bg} p-5 flex flex-col gap-3 h-full transition-all duration-200 group-hover:shadow-xl group-hover:shadow-purple-500/10`}
                    >
                      {/* Emoji + delete */}
                      <div className="flex items-start justify-between">
                        <span className="text-3xl select-none">{nb.emoji}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(nb);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Name & description */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground leading-tight text-base mb-1 line-clamp-2">
                          {nb.name}
                        </h3>
                        {nb.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{nb.description}</p>
                        )}
                      </div>

                      {/* Footer meta */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className={`flex items-center gap-1 text-xs ${cs.text}`}>
                          <FileText className="h-3 w-3" />
                          <span>{nb.doc_count} {nb.doc_count === 1 ? "source" : "sources"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(nb.created_at)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create Notebook Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create New Notebook</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Emoji picker */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewEmoji(em)}
                    className={`text-xl p-2 rounded-lg border transition-all ${
                      newEmoji === em
                        ? "border-purple-500 bg-purple-500/15 scale-110"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Colour</Label>
              <div className="flex gap-2">
                {NOTEBOOK_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setNewColor(c.key)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${c.bg} ${
                      newColor === c.key ? "border-foreground scale-110" : "border-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="nb-name" className="text-sm text-muted-foreground mb-1 block">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nb-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Machine Learning Week 3"
                className="bg-background border-border"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="nb-desc" className="text-sm text-muted-foreground mb-1 block">
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="nb-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Neural networks, backpropagation, CNNs"
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Create Notebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete notebook?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently deleted.
              Uploaded documents and quiz questions for this notebook will no longer be associated, but indexed chunks
              will remain in the vectorstore. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
