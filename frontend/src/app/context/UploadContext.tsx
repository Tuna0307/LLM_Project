import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import type { Notebook } from "./NotebookContext";
import { setNotebookDocCount } from "./NotebookContext";

interface UploadContextType {
  isProcessing: boolean;
  progress: number;
  progressLabel: string;
  uploadComplete: boolean;
  processingFiles: string[]; // file names currently being uploaded
  startUpload: (files: File[], topic: string, docType: string, notebook: Notebook | null) => void;
  resetUpload: () => void;
}

const UploadContext = createContext<UploadContextType>({
  isProcessing: false,
  progress: 0,
  progressLabel: "",
  uploadComplete: false,
  processingFiles: [],
  startUpload: () => {},
  resetUpload: () => {},
});

export function UploadProvider({ children }: { children: ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [uploadComplete, setUploadComplete] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const resetUpload = () => {
    setProgress(0);
    setProgressLabel("");
    setUploadComplete(false);
    setProcessingFiles([]);
  };

  const startUpload = async (
    files: File[],
    topic: string,
    docType: string,
    notebook: Notebook | null
  ) => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress(5);
    setProgressLabel("Uploading files...");
    setUploadComplete(false);
    setProcessingFiles(files.map(f => f.name));

    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      if (topic) formData.append("topic", topic);
      if (docType) formData.append("doc_type", docType);
      if (notebook) formData.append("notebook_id", notebook.id);

      // Slow progress simulation — embedding takes time
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          const next = prev < 88 ? prev + 1 : prev;
          if (next < 20) setProgressLabel("Extracting & cleaning text...");
          else if (next < 50) setProgressLabel("Generating embeddings...");
          else if (next < 80) setProgressLabel("Indexing into vector store...");
          else setProgressLabel("Almost done — finalising index...");
          return next;
        });
      }, 1200);

      const response = await fetch("http://localhost:8001/api/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload failed");
      }

      const data = await response.json();
      setProgress(100);
      setProgressLabel("Complete!");
      setUploadComplete(true);

      // Update notebook doc count in localStorage
      if (notebook) {
        try {
          const docsRes = await fetch(
            `http://localhost:8001/api/documents?notebook_id=${encodeURIComponent(notebook.id)}`
          );
          if (docsRes.ok) {
            const docs = await docsRes.json();
            setNotebookDocCount(notebook.id, docs.length);
          }
        } catch {}
      }

      toast.success(data.message || "Files processed successfully!");
    } catch (error: any) {
      if (error?.name === "AbortError") {
        toast.error("Upload timed out after 5 minutes.");
      } else {
        toast.error(error?.message || "Failed to process files. Please try again.");
      }
      setProgress(0);
      setProgressLabel("");
      setUploadComplete(false);
    } finally {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      clearTimeout(timeoutId);
      setIsProcessing(false);
    }
  };

  return (
    <UploadContext.Provider value={{
      isProcessing, progress, progressLabel, uploadComplete, processingFiles,
      startUpload, resetUpload,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  return useContext(UploadContext);
}
