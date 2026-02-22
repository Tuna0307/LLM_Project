import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Bot, 
  User, 
  BookOpen, 
  MoreHorizontal, 
  Trash2,
  Sparkles,
  Search,
  History,
  Plus,
  Clock
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  citations?: {
    source: string;
    page: number;
    snippet: string;
  }[];
  metadata?: {
    confidence: number;
    route: string;
  };
}

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    role: "ai",
    content: "Hello! I'm IRRA, your intelligent study companion. Ask me anything about your uploaded course materials and I'll find the answers for you.",
    timestamp: new Date(),
    metadata: { confidence: 100, route: "System" }
  }
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState("");
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/documents/metadata");
        if (res.ok) {
          const data = await res.json();
          setAvailableTopics(data.topics || []);
        }
      } catch {
        // backend may not be running yet, fail silently
      }
    };
    fetchMetadata();
  }, []);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch("http://localhost:8000/api/sessions");
      if (res.ok) setSessions(await res.json());
    } catch {
      // fail silently
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // On mount: restore session from localStorage and load sessions list
  useEffect(() => {
    fetchSessions();
    const savedId = localStorage.getItem("irra_session_id");
    if (savedId) {
      setSessionId(savedId);
      // Load messages for the restored session
      fetch(`http://localhost:8000/api/sessions/${savedId}/messages`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.length > 0) {
            const restored: Message[] = data.map((m: any, i: number) => ({
              id: (i + 1).toString(),
              role: m.role === "user" ? "user" : "ai",
              content: m.content,
              timestamp: new Date(m.timestamp),
              metadata: m.role !== "user" ? { confidence: 0, route: "History" } : undefined,
            }));
            setMessages(restored);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Persist sessionId to localStorage whenever it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("irra_session_id", sessionId);
    }
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const filters: any = {};
      if (topicFilter) filters.topic = topicFilter;

      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMsg.content,
          session_id: sessionId,
          filters: Object.keys(filters).length > 0 ? filters : null
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      const data = await response.json();
      
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }
      // Refresh session list so new/updated chat appears in history
      fetchSessions();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.answer + (data.citations ? "\n\n" + data.citations : ""),
        timestamp: new Date(),
        metadata: { 
          confidence: Math.round(data.confidence * 100), 
          route: data.route.toUpperCase() 
        }
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "Sorry, I encountered an error while processing your request. Please make sure the backend server is running.",
        timestamp: new Date(),
        metadata: { confidence: 0, route: "ERROR" }
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([{
      id: Date.now().toString(),
      role: "ai",
      content: "Chat history cleared. What would you like to review today?",
      timestamp: new Date(),
      metadata: { confidence: 100, route: "System" }
    }]);
    setSessionId(null);
    localStorage.removeItem("irra_session_id");
  };

  const handleNewChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: "ai",
      content: "Hello! I'm IRRA, your intelligent study companion. Ask me anything about your uploaded course materials and I'll find the answers for you.",
      timestamp: new Date(),
      metadata: { confidence: 100, route: "System" }
    }]);
    setSessionId(null);
    localStorage.removeItem("irra_session_id");
  };

  const handleLoadSession = async (loadId: string) => {
    if (loadId === sessionId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/sessions/${loadId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const restored: Message[] = data.map((m: any, i: number) => ({
        id: (i + 1).toString(),
        role: m.role === "user" ? "user" : "ai",
        content: m.content,
        timestamp: new Date(m.timestamp),
        metadata: m.role !== "user" ? { confidence: 0, route: "History" } : undefined,
      }));
      setMessages(restored);
      setSessionId(loadId);
      localStorage.setItem("irra_session_id", loadId);
    } catch {
      // fail silently
    }
  };

  const handleDeleteSession = async (delId: string) => {
    try {
      await fetch(`http://localhost:8000/api/sessions/${delId}`, { method: "DELETE" });
      setSessions(prev => prev.filter(s => s.session_id !== delId));
      if (sessionId === delId) handleNewChat();
    } catch {
      // fail silently
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col bg-card border-border backdrop-blur-md overflow-hidden h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Study Assistant</h2>
              <p className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online & Ready
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-10 w-10 border border-border shadow-sm">
                  {msg.role === "ai" ? (
                    <AvatarFallback className="bg-primary/20 text-primary"><Bot className="h-5 w-5" /></AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-blue-500/20 text-blue-500"><User className="h-5 w-5" /></AvatarFallback>
                  )}
                </Avatar>
                
                <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`
                    p-4 rounded-2xl shadow-sm text-sm leading-relaxed relative
                    ${msg.role === "user" 
                      ? "bg-blue-500 text-white rounded-tr-sm" 
                      : "bg-muted/50 border border-border text-foreground rounded-tl-sm backdrop-blur-md"
                    }
                  `}>
                    {msg.content}
                    
                    {msg.citations && (
                      <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                        <p className={`text-xs font-semibold flex items-center gap-1 ${msg.role === "user" ? "text-blue-100" : "text-muted-foreground"}`}>
                          <BookOpen className="h-3 w-3" /> Sources:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cite, idx) => (
                            <Badge 
                              key={idx} 
                              variant="secondary" 
                              className={`
                                text-xs py-1 cursor-pointer transition-colors
                                ${msg.role === "user" 
                                  ? "bg-white/20 hover:bg-white/30 text-white border-transparent" 
                                  : "bg-background hover:bg-muted text-primary border-border"}
                              `}
                            >
                              {cite.source} (p. {cite.page})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {msg.role === "ai" && msg.metadata && (
                    <div className="flex items-center gap-2 px-1">
                      <Badge variant="outline" className="text-[10px] py-0 h-5 border-border text-muted-foreground">
                        {msg.metadata.route}
                      </Badge>
                      {msg.metadata.confidence && (
                        <span className="text-[10px] text-muted-foreground">
                          {msg.metadata.confidence}% Confidence
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4"
              >
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarFallback className="bg-primary/20"><Bot className="h-5 w-5 text-primary" /></AvatarFallback>
                </Avatar>
                <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center h-12">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                </div>
              </motion.div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-muted/20">
          <div className="relative max-w-3xl mx-auto flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask a question about your notes..."
              className="bg-background border-border focus-visible:ring-primary/50 pl-4 pr-12 py-6 text-base shadow-sm"
            />
            <Button 
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 top-1.5 h-9 w-9 p-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/20 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            AI responses are based on your uploaded study materials. Always verify important information.
          </p>
        </div>
      </Card>

      {/* Right Sidebar */}
      <div className="w-80 hidden xl:flex flex-col gap-4">

        {/* New Chat */}
        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 gap-2"
          onClick={() => { handleNewChat(); fetchSessions(); }}
        >
          <Plus className="h-4 w-4" /> New Chat
        </Button>

        {/* Context Filters */}
        <Card className="bg-card border-border backdrop-blur-md">
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Context Filters</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Limit responses to a specific topic.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Topic</label>
              <Input 
                placeholder="Filter by topic..." 
                className="bg-background border-border h-9 text-sm" 
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                list="topics-datalist"
              />
              {availableTopics.length > 0 && (
                <datalist id="topics-datalist">
                  {availableTopics.map(t => <option key={t} value={t} />)}
                </datalist>
              )}
              {topicFilter && (
                <button
                  onClick={() => setTopicFilter("")}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat History */}
        <Card className="bg-card border-border backdrop-blur-md flex-1 min-h-0">
          <div className="p-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Chat History</h3>
            </div>
            <button
              onClick={fetchSessions}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Refresh
            </button>
          </div>
          <CardContent className="p-0 pb-4">
            <ScrollArea className="h-56">
              <div className="px-3 space-y-1">
                {isLoadingSessions ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Loading...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No past conversations yet.</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.session_id}
                      className={`group flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
                        sessionId === s.session_id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-secondary border border-transparent"
                      }`}
                      onClick={() => handleLoadSession(s.session_id)}
                    >
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{s.preview}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(s.updated_at).toLocaleDateString()} · {s.message_count} msgs
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.session_id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 text-muted-foreground transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pro Tip */}
        <Card className="bg-gradient-to-br from-purple-900/10 to-blue-900/10 border-primary/20 backdrop-blur-md">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <h3 className="text-sm font-semibold text-foreground">Pro Tip</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ask IRRA to "Explain like I'm 5" for simpler breakdowns of complex topics.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
