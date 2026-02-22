import { useState, useEffect } from "react";
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Plus, 
  Search, 
  Trash2,
  FileText,
  Activity,
  AlertCircle,
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import { toast } from "sonner";

export default function Settings() {
  const [pending, setPending] = useState<any[]>([]);
  const [accepted, setAccepted] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total_questions: 0,
    pending: 0,
    accepted: 0,
    rejected: 0
  });
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState(5);
  const [genType, setGenType] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [pendingRes, acceptedRes, statsRes] = await Promise.all([
        fetch("http://localhost:8000/api/quiz/pending"),
        fetch("http://localhost:8000/api/quiz/accepted?limit=50"),
        fetch("http://localhost:8000/api/stats")
      ]);

      if (pendingRes.ok) setPending(await pendingRes.json());
      if (acceptedRes.ok) setAccepted(await acceptedRes.json());
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.quiz);
      }
    } catch (error) {
      console.error("Error fetching settings data:", error);
      toast.error("Failed to load settings data");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/quiz/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", admin_notes: "Approved" })
      });
      if (res.ok) {
        toast.success("Question approved and added to bank");
        fetchData();
      } else {
        throw new Error("Failed to approve");
      }
    } catch (error) {
      toast.error("Error approving question");
    }
  };

  const handleReject = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/quiz/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", admin_notes: "Rejected" })
      });
      if (res.ok) {
        toast.error("Question rejected");
        fetchData();
      } else {
        throw new Error("Failed to reject");
      }
    } catch (error) {
      toast.error("Error rejecting question");
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("http://localhost:8000/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: genTopic || null, num_questions: genCount, question_type: genType })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchData();
      } else {
        throw new Error("Failed to generate");
      }
    } catch (error) {
      toast.error("Error generating questions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = (q: any) => {
    setEditingQuestion({
      id: q.id,
      question: q.question,
      correct_answer: q.correct_answer,
      explanation: q.explanation || "",
      difficulty: q.difficulty || "medium",
      options: q.options ? (typeof q.options === "string" ? JSON.parse(q.options) : q.options) : [],
    });
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Delete this question permanently?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/questions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Question deleted");
        fetchData();
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Failed to delete question");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    try {
      const res = await fetch(`http://localhost:8000/api/quiz/${editingQuestion.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          admin_notes: "Edited via Settings",
          edited_data: {
            question: editingQuestion.question,
            correct_answer: editingQuestion.correct_answer,
            explanation: editingQuestion.explanation,
            difficulty: editingQuestion.difficulty,
          },
        }),
      });
      if (res.ok) {
        toast.success("Question updated and approved");
        setEditingQuestion(null);
        fetchData();
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      toast.error("Error saving question");
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Type", "Question", "Correct Answer", "Difficulty", "Topic", "Source Doc", "Source Page"];
    const rows = accepted.map(q => [
      q.id,
      q.type || "",
      `"${(q.question || "").replace(/"/g, '""')}"`,
      `"${(q.correct_answer || "").replace(/"/g, '""')}"`,
      q.difficulty || "medium",
      q.topic || "",
      q.source_doc || "",
      q.source_page || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_bank.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(accepted, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_bank.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exported");
  };

  const STATS_DISPLAY = [
    { label: "Total Questions", value: stats.total_questions || 0, change: "", icon: FileText, color: "text-blue-500" },
    { label: "Pending Review", value: stats.pending || 0, change: "", icon: AlertCircle, color: "text-amber-500" },
    { label: "Approved", value: stats.accepted || 0, change: "", icon: CheckCircle, color: "text-green-500" },
    { label: "Rejected", value: stats.rejected || 0, change: "", icon: XCircle, color: "text-red-500" },
  ];

  return (
    <div className="space-y-8 h-full overflow-y-auto pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Review generated content and manage the question bank.</p>
        </div>
        <Button
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <Plus className="mr-2 h-4 w-4" /> {isGenerating ? "Generating..." : "Generate New Questions"}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATS_DISPLAY.map((stat) => (
          <Card key={stat.label} className="bg-card border-border backdrop-blur-md">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className={`text-2xl font-bold ${stat.color}`}>{stat.value}</h3>
                  <span className="text-xs text-muted-foreground">{stat.change}</span>
                </div>
              </div>
              <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Review Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Pending Review ({pending.length})
              </CardTitle>
              <CardDescription>AI-generated questions needing human verification.</CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500/20" />
                  <p>All caught up! No questions pending review.</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {pending.map((q) => {
                    const options = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
                    return (
                    <AccordionItem key={q.id} value={q.id.toString()} className="border border-border rounded-lg bg-secondary/50 px-4">
                      <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                        <div className="flex items-center gap-4 text-left">
                          <Badge variant="outline" className="text-muted-foreground border-border text-xs">
                            {q.type === "mcq" ? "MCQ" : q.type === "true_false" ? "T/F" : "Short"}
                          </Badge>
                          <span className="font-medium text-sm truncate max-w-[300px] md:max-w-md">
                            {q.question}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground font-semibold uppercase">Question</label>
                            <p className="text-sm bg-card p-3 rounded-md text-foreground border border-border">{q.question}</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground font-semibold uppercase">Answer</label>
                            <p className="text-sm bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-md border border-green-500/20">
                              {q.correct_answer}
                            </p>
                          </div>
                        </div>

                        {options.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground font-semibold uppercase">Distractors</label>
                            <div className="flex flex-wrap gap-2">
                              {options.filter((o: string) => o !== q.correct_answer).map((opt: string, i: number) => (
                                <span key={i} className="text-xs bg-card px-2 py-1 rounded text-muted-foreground border border-border">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2 border-t border-border mt-4">
                          <div className="text-xs text-muted-foreground">
                            Source: {q.source_doc} (p. {q.source_page})
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-muted-foreground hover:text-foreground border-border" onClick={() => handleEdit(q)}>
                              <Edit3 className="h-4 w-4 mr-2" /> Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 shadow-none border"
                              onClick={() => handleReject(q.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" /> Reject
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 shadow-none"
                              onClick={() => handleApprove(q.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" /> Accept
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )})}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <div className="space-y-6">
          <Card className="bg-card border-border backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-foreground">Generate Questions</CardTitle>
              <CardDescription>Manually trigger AI generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Topic</label>
                <Input 
                  placeholder="e.g. React Hooks" 
                  className="bg-background border-border text-foreground" 
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Question Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([{ value: null, label: "Mixed" }, { value: "mcq", label: "MCQ" }, { value: "true_false", label: "True / False" }, { value: "open_ended", label: "Open Ended" }] as { value: string | null; label: string }[]).map(({ value, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setGenType(value)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        genType === value
                          ? "border-purple-500 bg-purple-500/20 text-purple-300"
                          : "border-border bg-background text-muted-foreground hover:border-purple-500/50 hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Count</label>
                <Input 
                  type="number"
                  min="1"
                  max="20"
                  className="bg-background border-border text-foreground" 
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 5)}
                />
              </div>
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 hover:from-purple-700 hover:to-pink-700"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Batch"}
              </Button>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-foreground">Export Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start border-border text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Button variant="outline" className="w-full justify-start border-border text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleExportJSON}>
                <Download className="mr-2 h-4 w-4" /> Export JSON
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Question Bank Table */}
      <Card className="bg-card border-border backdrop-blur-md mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Question Bank</CardTitle>
            <CardDescription>Recently approved questions</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              className="pl-8 bg-background border-border text-foreground"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">ID</TableHead>
                <TableHead className="text-muted-foreground">Question</TableHead>
                <TableHead className="text-muted-foreground">Topic</TableHead>
                <TableHead className="text-muted-foreground">Difficulty</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accepted.filter((q: any) =>
                !searchQuery ||
                q.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                q.topic?.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((q: any, i: number) => (
                <TableRow key={q.id} className="border-border hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-muted-foreground">#{q.id}</TableCell>
                  <TableCell className="text-foreground truncate max-w-[300px]">{q.question}</TableCell>
                  <TableCell><Badge variant="outline" className="border-border text-muted-foreground">{q.topic || "General"}</Badge></TableCell>
                  <TableCell>
                    <Badge className={q.difficulty === "easy" ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 border-transparent" : q.difficulty === "hard" ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border-transparent" : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-transparent"}>
                      {q.difficulty ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1) : "Medium"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(q)}
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Question Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Question</Label>
                <Textarea
                  className="bg-background border-border text-foreground min-h-[80px]"
                  value={editingQuestion.question}
                  onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, question: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Correct Answer</Label>
                <Input
                  className="bg-background border-border text-foreground"
                  value={editingQuestion.correct_answer}
                  onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, correct_answer: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Explanation</Label>
                <Textarea
                  className="bg-background border-border text-foreground min-h-[60px]"
                  value={editingQuestion.explanation}
                  onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, explanation: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Difficulty</Label>
                <select
                  className="w-full bg-background border border-border rounded-md p-2 text-sm text-foreground outline-none focus:border-primary/50"
                  value={editingQuestion.difficulty}
                  onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, difficulty: e.target.value }))}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-border" onClick={() => setEditingQuestion(null)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0" onClick={handleSaveEdit}>Save & Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
