import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload as UploadIcon, 
  File, 
  X, 
  CheckCircle, 
  Database,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  
  const [topic, setTopic] = useState("");
  const [docType, setDocType] = useState("lecture");

  const [indexedDocs, setIndexedDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const fetchIndexedDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch("http://localhost:8000/api/documents");
      if (res.ok) setIndexedDocs(await res.json());
    } catch {
      // backend not running
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchIndexedDocs();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) added`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) added`);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setProgress(10); // Start progress
    setUploadComplete(false);
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", file);
      });
      
      if (topic) formData.append("topic", topic);
      if (docType) formData.append("doc_type", docType);

      // Simulate progress while waiting for the real API
      const progressInterval = setInterval(() => {
        setProgress(prev => prev < 90 ? prev + 5 : prev);
      }, 500);

      const response = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setProgress(100);
      setUploadComplete(true);
      toast.success(data.message || "Files processed successfully!");
      fetchIndexedDocs(); // refresh the file history
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to process files. Please try again.");
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 h-full overflow-y-auto pb-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Upload Knowledge Base
        </h1>
        <p className="text-muted-foreground mt-2">
          Add lecture slides, notes, and tutorials to train your AI tutor. You can upload multiple files at once.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Upload Area */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card border-border backdrop-blur-md overflow-hidden">
            <CardContent className="p-6">
              <div
                className={`
                  relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200
                  ${dragActive ? "border-primary bg-primary/10" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"}
                  ${isProcessing ? "opacity-50 pointer-events-none" : ""}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleChange}
                  accept=".pdf"
                />
                
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                    <UploadIcon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground">
                      Drag & drop files here
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse from your computer
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported: PDF only (Max 50MB)
                  </p>
                </div>
              </div>

              {/* File List */}
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 space-y-3"
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Selected Files ({files.length})</span>
                      <button 
                        onClick={() => setFiles([])}
                        className="text-red-500 hover:text-red-600 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {files.map((file, index) => (
                        <motion.div
                          key={`${file.name}-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border group"
                        >
                          <File className="h-5 w-5 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          {!isProcessing && (
                            <button
                              onClick={() => removeFile(index)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/80 rounded-full transition-all"
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress State */}
              <AnimatePresence>
                {(isProcessing || uploadComplete) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 space-y-2"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {uploadComplete ? "Processing Complete" : "Processing & Indexing..."}
                      </span>
                      <span className="text-primary font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-muted" />
                    {uploadComplete && (
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-emerald-500 mt-2 flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Files successfully indexed and ready for chat.
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* Metadata Form */}
        <div className="space-y-6">
          <Card className="bg-card border-border backdrop-blur-md sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="module">Topic / Module</Label>
                <Input 
                  id="module" 
                  placeholder="e.g. UX Design" 
                  className="bg-secondary/50 border-input focus:border-primary/50 text-foreground" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Optional — helps filter results in chat.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="bg-secondary/50 border-input text-foreground">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    <SelectItem value="lecture">Lecture Slides</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="lab">Lab Manual</SelectItem>
                    <SelectItem value="handbook">Handbook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
                  disabled={files.length === 0 || isProcessing}
                  onClick={handleProcess}
                >
                  {isProcessing ? "Processing..." : "Process & Index Files"}
                </Button>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tips</p>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Tag files with a topic to enable topic filtering in Study Chat.
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Large PDFs are automatically split into searchable chunks.
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Multiple files share the same metadata — group related materials together.
                  </li>
                  <li className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    Re-uploading a file will overwrite its existing index entries.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Indexed Documents History */}
      <Card className="bg-card border-border backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg text-foreground">
              Indexed Documents
              {indexedDocs.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({indexedDocs.length} file{indexedDocs.length !== 1 ? "s" : ""})</span>
              )}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={fetchIndexedDocs}
            disabled={isLoadingDocs}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingDocs ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {indexedDocs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {isLoadingDocs ? "Loading..." : "No files indexed yet. Upload your first PDF above."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {indexedDocs.map((doc, i) => (
                <motion.div
                  key={doc.source_file}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                >
                  <File className="h-5 w-5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.source_file}</p>
                    <p className="text-xs text-muted-foreground">{doc.chunk_count} chunks indexed</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {doc.topic && (
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                        {doc.topic}
                      </Badge>
                    )}
                    <Badge
                      className={`text-xs border-transparent ${
                        doc.doc_type === "lecture"
                          ? "bg-blue-500/10 text-blue-500"
                          : doc.doc_type === "tutorial"
                          ? "bg-green-500/10 text-green-500"
                          : doc.doc_type === "lab"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-purple-500/10 text-purple-500"
                      }`}
                    >
                      {doc.doc_type || "lecture"}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
