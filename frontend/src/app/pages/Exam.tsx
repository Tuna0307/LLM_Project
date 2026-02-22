import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award, 
  BookOpen, 
  RefreshCw 
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";

type QuestionType = "mcq" | "short_answer" | "true_false";

interface Question {
  id: number;
  text: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string;
  source: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

export default function Exam() {
  const [stage, setStage] = useState<"setup" | "quiz" | "results">("setup");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [examStats, setExamStats] = useState<any>(null);
  const examSessionId = useRef<string>(crypto.randomUUID());

  // Setup State
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState([5]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/stats");
        if (res.ok) setExamStats((await res.json()).quiz);
      } catch {
        // fail silently
      }
    };
    fetchStats();
  }, []);

  const handleStartQuiz = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/quiz/accepted?limit=${questionCount[0]}&difficulty=${difficulty.toLowerCase()}`);
      if (!response.ok) throw new Error("Failed to fetch questions");
      
      const data = await response.json();
      if (data && data.length > 0) {
        // Map backend data to frontend format
        const formattedQuestions = data.map((q: any) => ({
          id: q.id,
          text: q.question,
          type: q.type,
          options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : undefined,
          correctAnswer: q.correct_answer,
          source: `${q.source_doc || 'Unknown'} (p. ${q.source_page || '?'})`,
          difficulty: q.difficulty ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1) : "Medium"
        }));
        
        setQuestions(formattedQuestions);
        setStage("quiz");
        setCurrentQuestionIndex(0);
        setAnswers({});
        setScore(0);
      } else {
        alert("No approved questions found for this difficulty. Please generate and approve some in the Admin Dashboard.");
      }
    } catch (error) {
      console.error("Error starting quiz:", error);
      alert("Failed to start quiz. Make sure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (val: string) => {
    setAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].id]: val }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const finalScore = calculateScore();
      submitQuiz(answers, finalScore);
      setStage("results");
    }
  };

  const calculateScore = () => {
    // Only auto-grade MCQ and true/false; short_answer requires manual review
    let correct = 0;
    questions.forEach(q => {
      if (q.type !== "short_answer" && answers[q.id] === q.correctAnswer) correct++;
    });
    setScore(correct);
    return correct;
  };

  const submitQuiz = async (finalAnswers: Record<number, string>, finalScore: number) => {
    // Record each attempt in the backend
    const attemptPromises = questions.map(q => {
      const userAnswer = finalAnswers[q.id] || "";
      const isCorrect = q.type !== "short_answer"
        ? userAnswer === q.correctAnswer
        : false; // short answers can't be auto-graded
      return fetch("http://localhost:8000/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: examSessionId.current,
          question_id: q.id,
          user_answer: userAnswer,
          is_correct: isCorrect,
        }),
      }).catch(() => null); // don't block UI if recording fails
    });
    await Promise.all(attemptPromises);
  };

  return (
    <div className="flex h-full gap-8 max-w-6xl mx-auto items-start">
      {/* Sidebar - Settings */}
      <Card className="w-80 h-fit bg-card border-border backdrop-blur-md hidden md:block">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 text-foreground">
            <Award className="text-purple-500" />
            Exam Config
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Difficulty</Label>
            <div className="grid grid-cols-3 gap-2">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => stage === "setup" && setDifficulty(d)}
                  disabled={stage !== "setup"}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${difficulty === d 
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" 
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"}
                    ${stage !== "setup" && "opacity-50 cursor-not-allowed"}
                  `}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between">
              <Label>Question Count</Label>
              <span className="text-sm font-medium text-purple-500">{questionCount[0]}</span>
            </div>
            <Slider
              value={questionCount}
              onValueChange={stage === "setup" ? setQuestionCount : undefined}
              min={3}
              max={20}
              step={1}
              disabled={stage !== "setup"}
              className="py-4"
            />
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleStartQuiz} 
              disabled={stage !== "setup" || isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20"
            >
              {isLoading ? "Loading..." : "Start New Quiz"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="flex-1 min-h-[500px]">
        <AnimatePresence mode="wait">
          {stage === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-6 pt-20"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center border border-border shadow-[0_0_50px_-10px_rgba(168,85,247,0.3)]">
                <BookOpen className="h-10 w-10 text-purple-500" />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Ready to test your knowledge?
                </h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Configure your exam settings on the left and click "Start New Quiz" to begin.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-8">
                <div className="p-4 rounded-xl bg-card border border-border backdrop-blur-sm">
                  <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">
                    {examStats?.accepted ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Available Questions</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border backdrop-blur-sm">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">
                    {examStats ? `${Math.round(examStats.accuracy || 0)}%` : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Quiz Accuracy</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border backdrop-blur-sm">
                  <Award className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">
                    {examStats?.total_attempts ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Attempts</div>
                </div>
              </div>
            </motion.div>
          )}

          {stage === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <Badge variant="outline" className="border-purple-500/30 text-purple-500 bg-purple-500/10">
                  {questions[currentQuestionIndex].difficulty}
                </Badge>
              </div>
              
              <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="h-2 bg-muted" />

              <Card className="bg-card border-border backdrop-blur-xl shadow-2xl mt-6">
                <CardContent className="p-8 space-y-8">
                  <h3 className="text-2xl font-semibold leading-relaxed text-foreground">
                    {questions[currentQuestionIndex].text}
                  </h3>

                  <div className="space-y-4">
                    {questions[currentQuestionIndex].type === "mcq" || questions[currentQuestionIndex].type === "true_false" ? (
                      <RadioGroup 
                        value={answers[questions[currentQuestionIndex].id]} 
                        onValueChange={handleAnswer}
                        className="space-y-3"
                      >
                        {questions[currentQuestionIndex].options?.map((opt: string) => (
                          <div key={opt} className={`
                            flex items-center space-x-3 rounded-lg border p-4 transition-all cursor-pointer
                            ${answers[questions[currentQuestionIndex].id] === opt 
                              ? "bg-purple-600/10 border-purple-500 dark:bg-purple-600/20" 
                              : "border-border hover:bg-secondary hover:border-border"}
                          `}>
                            <RadioGroupItem value={opt} id={opt} className="border-primary text-primary" />
                            <Label htmlFor={opt} className="flex-1 cursor-pointer font-normal text-base text-foreground">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <Textarea 
                        placeholder="Type your answer here..."
                        className="bg-background border-border min-h-[150px] text-base p-4 focus:border-purple-500/50"
                        value={answers[questions[currentQuestionIndex].id] || ""}
                        onChange={(e) => handleAnswer(e.target.value)}
                      />
                    )}
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t border-border p-4 flex justify-between items-center">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-3 w-3" />
                    Source: {questions[currentQuestionIndex].source}
                  </div>
                  <Button 
                    onClick={handleNext}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {currentQuestionIndex === questions.length - 1 ? "Submit Exam" : "Next Question"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {stage === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center space-y-8 pt-12"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full" />
                <div className="relative w-40 h-40 rounded-full border-4 border-border bg-card/40 backdrop-blur-md flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-foreground">
                      {questions.filter(q => q.type !== "short_answer").length > 0
                        ? Math.round((score / questions.filter(q => q.type !== "short_answer").length) * 100)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Score</div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Quiz Complete!</h2>
                <p className="text-muted-foreground">
                  You answered {score} out of {questions.filter(q => q.type !== "short_answer").length} auto-graded questions correctly.
                  {questions.some(q => q.type === "short_answer") && (
                    <span className="block text-xs mt-1 text-amber-500">
                      Short-answer questions are shown below for self-assessment.
                    </span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left">
                {questions.map((q: any, i: number) => {
                  const isShortAnswer = q.type === "short_answer";
                  const isCorrect = !isShortAnswer && answers[q.id] === q.correctAnswer;
                  return (
                  <Card key={q.id} className={`border-l-4 ${
                    isShortAnswer
                      ? "border-l-amber-400"
                      : isCorrect ? "border-l-green-500" : "border-l-red-500"
                  } bg-card`}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="font-medium text-sm text-foreground">Q{i + 1}: {q.text}</h4>
                        {isShortAnswer
                          ? <span className="text-xs text-amber-500 shrink-0">Self-assess</span>
                          : isCorrect
                            ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                            : <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        }
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {isShortAnswer && answers[q.id] && (
                        <p className="text-xs text-muted-foreground">Your answer: {answers[q.id]}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Correct Answer: {q.correctAnswer}</p>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              <Button 
                onClick={() => setStage("setup")}
                size="lg"
                variant="outline"
                className="text-foreground border-border hover:bg-secondary"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Take Another Quiz
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
