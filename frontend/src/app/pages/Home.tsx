import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  BookOpen, 
  MessageSquare, 
  UploadCloud, 
  ShieldAlert, 
  CheckCircle,
  FileText,
  Activity
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Link } from "react-router";

const FEATURES = [
  {
    title: "Study Chat",
    description: "Ask questions and get instant answers sourced directly from your lecture notes.",
    icon: MessageSquare,
    link: "/chat",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  },
  {
    title: "Exam Mode",
    description: "Generate practice quizzes to test your knowledge before the real exam.",
    icon: FileText,
    link: "/exam",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  },
  {
    title: "Upload Notes",
    description: "Upload your PDFs, slides, and tutorials to expand the AI's knowledge base.",
    icon: UploadCloud,
    link: "/upload",
    color: "bg-pink-500/10 text-pink-500 border-pink-500/20"
  },
  {
    title: "Settings",
    description: "Review and approve AI-generated questions for accuracy.",
    icon: ShieldAlert,
    link: "/settings",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20"
  }
];

export default function Home() {
  const [stats, setStats] = useState<any>({
    vectorstore: { count: 0 },
    quiz: { accepted: 0, pending: 0, accuracy: 0 }
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();
  }, []);

  const STATS_DISPLAY = [
    { label: "Indexed Chunks", value: stats.vectorstore?.count || 0, icon: BookOpen, color: "text-emerald-500" },
    { label: "Quiz Questions", value: stats.quiz?.accepted || 0, icon: FileText, color: "text-purple-500" },
    { label: "Pending Review", value: stats.quiz?.pending || 0, icon: Activity, color: "text-amber-500" },
    { label: "Quiz Accuracy", value: `${Math.round(stats.quiz?.accuracy || 0)}%`, icon: CheckCircle, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-8 h-full overflow-y-auto">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-12 md:py-16 relative"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-purple-500/20 blur-[100px] rounded-full -z-10" />
        
        <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-sm">
          Welcome to IRRA
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Intelligent RAG Revision Assistant — Your AI-Powered Study Buddy.
        </p>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS_DISPLAY.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-card border-border hover:shadow-lg transition-all dark:hover:bg-white/5">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <h3 className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</h3>
                </div>
                <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
        {FEATURES.map((feature, index) => (
          <Link key={feature.title} to={feature.link} className="block group h-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="h-full"
            >
              <Card className="bg-card border-border h-full overflow-hidden relative group-hover:shadow-xl transition-all duration-300 group-hover:border-purple-500/30">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className={`p-3 rounded-xl border ${feature.color}`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors">
                    {feature.description}
                  </p>
                </CardContent>
                
                {/* Decorative glow */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full group-hover:bg-purple-500/20 transition-all duration-500" />
              </Card>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
