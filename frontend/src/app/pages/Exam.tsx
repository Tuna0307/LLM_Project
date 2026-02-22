import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { useNotebook } from "../context/NotebookContext";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award, 
  BookOpen, 
  RefreshCw,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
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

function saveExamState(key: string, state: object) {
  try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
}
function loadExamState(key: string): any | null {
  try { const s = sessionStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function clearExamState(key: string) {
  try { sessionStorage.removeItem(key); } catch {}
}

export default function Exam() {
  const navigate = useNavigate();
  const { notebook } = useNotebook();

  // Per-notebook session storage key — exam state is isolated per notebook
  const examStorageKey = notebook?.id ? `irra_exam_state_${notebook.id}` : "irra_exam_state";

  // Restore persisted state or use defaults
  const saved = loadExamState(examStorageKey);

  const [stage, setStage] = useState<"setup" | "quiz" | "results">(saved?.stage ?? "setup");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(saved?.currentQuestionIndex ?? 0);
  const [answers, setAnswers] = useState<Record<number, string>>(saved?.answers ?? {});
  // lockedIn tracks which question IDs have been answered (feedback shown, can't change)
  const [lockedIn, setLockedIn] = useState<Record<number, boolean>>(saved?.lockedIn ?? {});
  const [score, setScore] = useState<number>(saved?.score ?? 0);
  const [questions, setQuestions] = useState<any[]>(saved?.questions ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [examStats, setExamStats] = useState<any>(null);
  const examSessionId = useRef<string>(saved?.examSessionId ?? crypto.randomUUID());

  // Setup State
  const [difficulty, setDifficulty] = useState<string>(saved?.difficulty ?? "Medium");
  const [questionCount, setQuestionCount] = useState<number[]>(saved?.questionCount ?? [5]);

  // Persist state to sessionStorage whenever key state changes
  useEffect(() => {
    if (stage === "setup") return; // don't persist setup screen
    saveExamState(examStorageKey, {
      stage, currentQuestionIndex, answers, lockedIn, score,
      questions, examSessionId: examSessionId.current, difficulty, questionCount,
    });
  }, [stage, currentQuestionIndex, answers, lockedIn, score, questions]);

  useEffect(() => {
    setExamStats(null);
    const fetchStats = async () => {
      try {
        const nbParam = notebook?.id ? `?notebook_id=${encodeURIComponent(notebook.id)}` : "";
        const res = await fetch(`http://localhost:8001/api/stats${nbParam}`);
        if (res.ok) setExamStats((await res.json()).quiz);
      } catch {}
    };
    fetchStats();
  }, [notebook?.id]);

  const handleStartQuiz = async () => {
    setIsLoading(true);
    try {
      const nbParam = notebook?.id ? `&notebook_id=${encodeURIComponent(notebook.id)}` : "";
      const response = await fetch(`http://localhost:8001/api/quiz/accepted?limit=${questionCount[0]}&difficulty=${difficulty.toLowerCase()}${nbParam}`);
      if (!response.ok) throw new Error("Failed to fetch questions");
      const data = await response.json();
      if (data && data.length > 0) {
        const formattedQuestions = data.map((q: any) => ({
          id: q.id,
          text: q.question,
          type: q.type,
          options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : undefined,
          correctAnswer: q.correct_answer,
          source: `${q.source_doc || 'Unknown'} (p. ${q.source_page || '?'})`,
          difficulty: q.difficulty ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1) : "Medium"
        }));
        const newSessionId = crypto.randomUUID();
        examSessionId.current = newSessionId;
        setQuestions(formattedQuestions);
        setStage("quiz");
        setCurrentQuestionIndex(0);
        setAnswers({});
        setLockedIn({});
        setScore(0);
      } else {
        alert("No approved questions found for this difficulty. Please generate and approve some in the Settings page first.");
      }
    } catch (error) {
      alert("Failed to start quiz. Make sure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (val: string) => {
    const q = questions[currentQuestionIndex];
    // Already locked in (MCQ/TF) — ignore
    if (q.type !== "short_answer" && lockedIn[q.id]) return;
    setAnswers(prev => ({ ...prev, [q.id]: val }));
    // For MCQ / true_false: lock immediately and show feedback
    if (q.type !== "short_answer") {
      setLockedIn(prev => ({ ...prev, [q.id]: true }));
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const finalScore = calculateScore();
      submitQuiz(answers, finalScore);
      setStage("results");
      clearExamState(examStorageKey);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (q.type !== "short_answer" && answers[q.id] === q.correctAnswer) correct++;
    });
    setScore(correct);
    return correct;
  };

  const submitQuiz = async (finalAnswers: Record<number, string>, finalScore: number) => {
    const attemptPromises = questions.map(q => {
      const userAnswer = finalAnswers[q.id] || "";
      const isCorrect = q.type !== "short_answer" ? userAnswer === q.correctAnswer : false;
      return fetch("http://localhost:8001/api/quiz/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: examSessionId.current,
          question_id: q.id,
          user_answer: userAnswer,
          is_correct: isCorrect,
        }),
      }).catch(() => null);
    });
    await Promise.all(attemptPromises);
  };

  // Helper: option style for MCQ/TF after locking in
  const getOptionClass = (q: any, opt: string) => {
    const userAnswer = answers[q.id];
    const locked = lockedIn[q.id];
    if (!locked) {
      return userAnswer === opt
        ? "bg-purple-600/10 border-purple-500"
        : "border-border hover:bg-secondary";
    }
    // locked — show right/wrong
    if (opt === q.correctAnswer) return "bg-green-500/15 border-green-500 text-green-300";
    if (opt === userAnswer && opt !== q.correctAnswer) return "bg-red-500/15 border-red-500 text-red-300";
    return "border-border opacity-50";
  };

  return (
    <div className="flex h-full gap-8 max-w-6xl mx-auto items-start">
      {/* Sidebar */}
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
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${difficulty === d ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"}
                    ${stage !== "setup" && "opacity-50 cursor-not-allowed"}`}
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
              min={3} max={20} step={1}
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
          {stage === "quiz" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40"
              onClick={() => { clearExamState(examStorageKey); setStage("setup"); setQuestions([]); setAnswers({}); setLockedIn({}); }}
            >
              Abandon Quiz
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="flex-1 min-h-[500px]">
        <AnimatePresence mode="wait">
          {stage === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
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
                  <div className="text-2xl font-bold text-foreground">{examStats?.accepted ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Available Questions</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border backdrop-blur-sm">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{examStats ? `${Math.round(examStats.accuracy || 0)}%` : "—"}</div>
                  <div className="text-xs text-muted-foreground">Quiz Accuracy</div>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border backdrop-blur-sm">
                  <Award className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{examStats?.total_attempts ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Total Attempts</div>
                </div>
              </div>
            </motion.div>
          )}

          {stage === "quiz" && questions.length > 0 && (
            <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
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

                  {/* MCQ / True-False */}
                  {(questions[currentQuestionIndex].type === "mcq" || questions[currentQuestionIndex].type === "true_false") ? (() => {
                    const q = questions[currentQuestionIndex];
                    const opts = q.options?.length ? q.options : q.type === "true_false" ? ["True", "False"] : [];
                    const locked = lockedIn[q.id];
                    return (
                      <div className="space-y-3">
                        {opts.map((opt: string) => {
                          const isCorrect = opt === q.correctAnswer;
                          const isSelected = answers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={locked}
                              onClick={() => handleAnswer(opt)}
                              className={`w-full flex items-center justify-between rounded-lg border p-4 text-left transition-all
                                ${locked ? "cursor-default" : "cursor-pointer"}
                                ${getOptionClass(q, opt)}`}
                            >
                              <span className="text-base font-normal">{opt}</span>
                              {locked && isCorrect && <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />}
                              {locked && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
                            </button>
                          );
                        })}

                        {/* Inline feedback after locking */}
                        <AnimatePresence>
                          {locked && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`rounded-lg p-3 text-sm mt-1 ${answers[q.id] === q.correctAnswer ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}
                            >
                              {answers[q.id] === q.correctAnswer
                                ? <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4" /> Correct!</span>
                                : <span className="flex items-center gap-1.5"><XCircle className="h-4 w-4" /> Incorrect — the correct answer is: {q.correctAnswer}</span>
                              }
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })() : (
                    /* Open-ended */
                    <Textarea
                      placeholder="Type your answer here..."
                      className="bg-background border-border min-h-[150px] text-base p-4 focus:border-purple-500/50"
                      value={answers[questions[currentQuestionIndex].id] || ""}
                      onChange={(e) => handleAnswer(e.target.value)}
                    />
                  )}
                </CardContent>

                <CardFooter className="bg-muted/30 border-t border-border p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-3 w-3" />
                      Source: {questions[currentQuestionIndex].source}
                    </div>
                    {answers[questions[currentQuestionIndex].id] && (() => {
                      const q = questions[currentQuestionIndex];
                      const userAnswer = answers[q.id];
                      const isShortAnswer = q.type === "short_answer";
                      const isCorrect = !isShortAnswer && userAnswer === q.correctAnswer;
                      const explainMessage = isShortAnswer
                        ? `I am taking a quiz on this material and was given this open-ended question:\n\n"${q.text}"\n\nI answered: "${userAnswer}"\n\nCan you explain the ideal answer to this question based on the course material?`
                        : isCorrect
                        ? `I am taking a quiz on this material and was given this question:\n\n"${q.text}"\n\nI chose the correct answer: "${userAnswer}"\n\nCan you help me understand this topic more deeply so I can retain it better?`
                        : `I am taking a quiz on this material and was given this question:\n\n"${q.text}"\n\nI chose this as my answer: "${userAnswer}"\n\nThat answer was incorrect. The correct answer is "${q.correctAnswer}"\n\nHelp me understand why my answer was incorrect.`;
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 gap-2"
                          onClick={() => navigate("../chat", { state: { explainMessage } })}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Explain
                        </Button>
                      );
                    })()}
                  </div>
                  <Button
                    onClick={handleNext}
                    disabled={
                      // For MCQ/TF: must have locked in; for short_answer: must have typed something
                      questions[currentQuestionIndex].type === "short_answer"
                        ? !answers[questions[currentQuestionIndex].id]?.trim()
                        : !lockedIn[questions[currentQuestionIndex].id]
                    }
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-40"
                  >
                    {currentQuestionIndex === questions.length - 1 ? "Submit Exam" : "Next Question"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {stage === "results" && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
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
                    <span className="block text-xs mt-1 text-amber-500">Short-answer questions are shown below for self-assessment.</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl text-left">
                {questions.map((q: any, i: number) => {
                  const isShortAnswer = q.type === "short_answer";
                  const isCorrect = !isShortAnswer && answers[q.id] === q.correctAnswer;
                  return (
                    <Card key={q.id} className={`border-l-4 ${isShortAnswer ? "border-l-amber-400" : isCorrect ? "border-l-green-500" : "border-l-red-500"} bg-card`}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="font-medium text-sm text-foreground">Q{i + 1}: {q.text}</h4>
                          {isShortAnswer
                            ? <span className="text-xs text-amber-500 shrink-0">Self-assess</span>
                            : isCorrect ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
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
              <Button onClick={() => setStage("setup")} size="lg" variant="outline" className="text-foreground border-border hover:bg-secondary">
                <RefreshCw className="mr-2 h-4 w-4" /> Take Another Quiz
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
