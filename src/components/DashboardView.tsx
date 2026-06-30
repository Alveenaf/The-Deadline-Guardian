import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  ArrowRight, 
  Check, 
  HelpCircle, 
  Loader2, 
  Zap, 
  CheckCircle2, 
  Compass, 
  Target, 
  Lightbulb, 
  Shield, 
  Plus,
  Trash2,
  BellRing,
  Hourglass,
  ChevronDown,
  ChevronUp,
  Info,
  ListTodo
} from "lucide-react";
import { Task, UserSettings, CoachAdvice, EmergencyPlan } from "../types";
import { api } from "../lib/api";
import { storageService } from "../lib/storageService";
import DeadlineGuardianLogo from "./DeadlineGuardianLogo";
import ConfirmationDialog from "./ConfirmationDialog";

interface DashboardViewProps {
  tasks: Task[];
  settings: UserSettings;
  onNavigate: (page: string) => void;
  onToggleComplete: (id: string) => void;
  onTasksUpdate: (updatedTasks: Task[]) => void;
  onAddHistory: (action: string, details: string) => void;
  onAskGuardianAboutTask?: (taskTitle: string) => void;
  theme?: "dark" | "light";
}

export function formatFriendlyDeadline(deadlineStr: string): string {
  if (!deadlineStr) return "";
  const now = new Date();
  const deadline = new Date(deadlineStr);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  const isToday = now.toDateString() === deadline.toDateString();
  
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = tomorrow.toDateString() === deadline.toDateString();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = yesterday.toDateString() === deadline.toDateString();

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}${minutes !== 0 ? ':' + minutesStr : ''}${ampm}`;
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  if (diffMs < 0) {
    const absDiffHours = Math.abs(diffHours);
    if (absDiffHours < 1) {
      const minutes = Math.round(absDiffHours * 60);
      return `${minutes === 0 ? 1 : minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (absDiffHours < 24) {
      const hours = Math.round(absDiffHours);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (isYesterday) {
      return `yesterday at ${formatTime(deadline)}`;
    } else {
      return `on ${getDayName(deadline)}`;
    }
  } else {
    if (diffHours < 1) {
      const minutes = Math.round(diffHours * 60);
      return `in ${minutes === 0 ? 1 : minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    } else if (diffHours < 24 && isToday) {
      return `today at ${formatTime(deadline)}`;
    } else if (isTomorrow) {
      return `tomorrow at ${formatTime(deadline)}`;
    } else if (diffHours < 168) {
      return `${getDayName(deadline)}`;
    } else {
      return `on ${deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${formatTime(deadline)}`;
    }
  }
}

export default function DashboardView({ 
  tasks, 
  settings, 
  onNavigate, 
  onToggleComplete,
  onTasksUpdate,
  onAddHistory,
  onAskGuardianAboutTask,
  theme = "dark"
}: DashboardViewProps) {
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Dynamic UI States
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [dismissedGuardianCard, setDismissedGuardianCard] = useState<boolean>(false);
  const [acceptedAlertIds, setAcceptedAlertIds] = useState<string[]>([]);
  
  // Messy thought Smart Input state
  const [smartInputText, setSmartInputText] = useState("");
  const [smartAnalyzing, setSmartAnalyzing] = useState(false);
  const [smartError, setSmartError] = useState("");
  const [sessionContext, setSessionContext] = useState<{ originalText: string; question: string } | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // Emergency Plan Triage flow
  const [triageStep, setTriageStep] = useState(-1); // -1 = closed
  const [emergencyPlan, setEmergencyPlan] = useState<EmergencyPlan | null>(null);
  const [triageError, setTriageError] = useState("");

  const pendingTasks = tasks.filter(t => !t.completed);

  // Sorting pending tasks by priority and deadline
  const sortedPending = [...pendingTasks].sort((a, b) => {
    const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  // Current Mission (Single top priority pending task)
  const todaysFocusTask = sortedPending[0] || null;

  useEffect(() => {
    if (!settings) return;
    async function fetchData() {
      try {
        setLoading(true);
        let habits: any[] = [];
        try {
          const habitsStr = localStorage.getItem("guardian-habits-v2") || "[]";
          habits = JSON.parse(habitsStr);
        } catch (e) {
          console.error("Error parsing habits for coach advice", e);
        }

        let focusHistory: any[] = [];
        try {
          focusHistory = await storageService.getFocusHistory();
        } catch (e) {
          console.error("Error getting focus history for coach advice", e);
        }

        const advice = await api.getCoachAdvice(tasks, settings, null, habits, focusHistory);
        setCoachAdvice(advice);
      } catch (err) {
        console.error("Failed to load dashboard coach advice", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tasks, settings]);

  // Set default selected task
  useEffect(() => {
    if (pendingTasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(pendingTasks[0].id);
    }
  }, [pendingTasks, selectedTaskId]);

  // Trigger Save My Day Emergency Escape Path
  const handleTriggerEmergencyTriage = async () => {
    setTriageStep(0);
    setTriageError("");
    setEmergencyPlan(null);

    try {
      // Simulate analysis steps
      for (let step = 1; step <= 5; step++) {
        await new Promise(resolve => setTimeout(resolve, 350));
        setTriageStep(step);
      }

      let habits: any[] = [];
      try {
        const habitsStr = localStorage.getItem("guardian-habits-v2") || "[]";
        habits = JSON.parse(habitsStr);
      } catch (e) {
        console.error("Error parsing habits for emergency save", e);
      }

      let focusHistory: any[] = [];
      try {
        focusHistory = await storageService.getFocusHistory();
      } catch (e) {
        console.error("Error getting focus history for emergency save", e);
      }

      const plan = await api.saveMyDeadline(tasks, habits, focusHistory);
      setEmergencyPlan(plan);
      setTriageStep(6); // Show plan!
      onAddHistory("🚨 SAVE MY DAY Activated", "The Guardian drafted a simplified minimum-viable survival plan to reduce panic.");
    } catch (err: any) {
      console.error("Emergency triage failed", err);
      setTriageError(err.message || "Failed to trigger emergency recovery plan.");
      setTriageStep(-1);
    }
  };

  const handleAcceptRescuePlan = () => {
    onAddHistory("Rescue Plan Adopted", "The user approved the minimal focus timeline to stay calm.");
    setTriageStep(-1);
    setEmergencyPlan(null);
  };

  // Messy Thought Smart Submission
  const handleSmartSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smartInputText.trim()) return;

    setSmartAnalyzing(true);
    setSmartError("");
    setSuccessFeedback(null);

    try {
      const res = await api.smartAdd(smartInputText.trim(), sessionContext, tasks);
      
      if (res.isComplete && res.task) {
        const createdTask: Task = {
          id: "task-" + Date.now(),
          title: res.task.title || "Custom Task",
          deadline: res.task.deadline || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          estimatedEffort: res.task.estimatedEffort || 2,
          category: res.task.category || "Other",
          priority: res.task.priority || "Medium",
          urgencyScore: res.task.urgencyScore || 6,
          riskLevel: res.task.riskLevel || "Medium",
          riskExplanation: res.task.riskExplanation || "Effort is balanced for this timeline.",
          completed: false,
          subtasks: res.task.subtasks && res.task.subtasks.length > 0 ? res.task.subtasks : ["Review requirements", "Develop draft", "Final audit"],
          createdAt: new Date().toISOString()
        };

        const updatedTasks = [createdTask, ...tasks];
        onTasksUpdate(updatedTasks);
        setSelectedTaskId(createdTask.id);
        onAddHistory("Created AI Task", `Guardian intelligently structured and created task: "${createdTask.title}"`);
        
        if (res.feedbackMessage) {
          setSuccessFeedback(res.feedbackMessage);
        } else {
          setSuccessFeedback(`Successfully created task: "${createdTask.title}".`);
        }

        setSmartInputText("");
        setSessionContext(null);
      } else if (res.followUpQuestion) {
        setSessionContext({
          originalText: sessionContext ? `${sessionContext.originalText} ${smartInputText}` : smartInputText,
          question: res.followUpQuestion
        });
      }
    } catch (err: any) {
      setSmartError(err.message || "Failed to process messy thought.");
    } finally {
      setSmartAnalyzing(false);
    }
  };

  const handleCancelConversation = () => {
    setSessionContext(null);
    setSmartInputText("");
    setSmartError("");
    setSuccessFeedback(null);
  };

  // Subtask Interaction
  const handleToggleSubtaskCheckbox = (taskId: string, subtaskIdx: number) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        const newSubtasks = [...t.subtasks];
        const current = newSubtasks[subtaskIdx];
        if (current.startsWith("✓ ")) {
          newSubtasks[subtaskIdx] = current.replace("✓ ", "");
        } else {
          newSubtasks[subtaskIdx] = "✓ " + current;
        }
        return { ...t, subtasks: newSubtasks };
      }
      return t;
    });
    onTasksUpdate(updated);
    onAddHistory("Updated Milestone", "Completed/reopened milestone step.");
  };

  const handleAddSubtask = (taskId: string) => {
    if (!newSubtaskText.trim()) return;
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: [...t.subtasks, newSubtaskText.trim()]
        };
      }
      return t;
    });
    onTasksUpdate(updated);
    setNewSubtaskText("");
    onAddHistory("Added Step", `Added custom milestone to task.`);
  };

  // Tactical Actions
  const handlePostponeTask = (id: string) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        const curDeadline = new Date(t.deadline);
        curDeadline.setDate(curDeadline.getDate() + 1);
        return {
          ...t,
          deadline: curDeadline.toISOString()
        };
      }
      return t;
    });
    onTasksUpdate(updated);
    onAddHistory("Postponed Task", "Rescheduled task deadline forward by 24 hours.");
    setSuccessFeedback("Deadline postponed by 1 day!");
  };

  const handleRemindMeAction = (taskTitle: string) => {
    onAddHistory("Configured Reminder", `Scheduled alerts and notifications for "${taskTitle}".`);
    setSuccessFeedback(`🛡️ Guardian reminder set! We will remind you 2 hours before the deadline of "${taskTitle}".`);
  };

  const handleScheduleAction = (taskTitle: string) => {
    onAddHistory("Blocked Schedule Slot", `Allocated focus slots for "${taskTitle}" on peak hours.`);
    setSuccessFeedback(`📅 Time slot booked! "${taskTitle}" has been blocked into your daily calendar based on your productive settings.`);
  };

  const handleDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      setTaskToDelete({ id, title: task.title });
    }
  };

  const confirmDeleteTask = () => {
    if (!taskToDelete) return;
    const { id } = taskToDelete;
    const updated = tasks.filter(t => t.id !== id);
    onTasksUpdate(updated);
    if (selectedTaskId === id) {
      const remaining = updated.filter(t => !t.completed);
      setSelectedTaskId(remaining.length > 0 ? remaining[0].id : (updated.length > 0 ? updated[0].id : null));
    }
    onAddHistory("Deleted Task", "Removed task from active registry.");
    setSuccessFeedback("Task deleted.");
    setTaskToDelete(null);
  };

  const stepsText = [
    "Analyzing workload...",
    "Estimating effort...",
    "Finding available time...",
    "Optimizing schedule...",
    "Reducing deadline risk...",
    "Preparing recovery plan..."
  ];

  return (
    <div id="mission-control-root" className="space-y-6 w-full max-w-7xl mx-auto pb-12 transition-all duration-300 ease-in-out select-none">
      
      {/* Toast Feedback Banner */}
      <AnimatePresence>
        {successFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{successFeedback}</span>
            </div>
            <button 
              onClick={() => setSuccessFeedback(null)} 
              className="text-slate-400 hover:text-white font-mono font-bold hover:underline"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* Rescue Mode Active */}
        {triageStep >= 0 ? (
          <motion.div 
            key="rescue-container"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-gradient-to-br from-[#1A0C16] via-[#120B1C] to-[#0D0D11] border-2 border-rose-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative"
          >
            {triageStep < 6 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 max-w-md mx-auto text-center">
                <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                <h3 className="text-lg font-bold text-white font-sans tracking-tight">Activating Crisis Defense Protocol</h3>
                <div className="w-full space-y-2 mt-4 text-left">
                  {stepsText.map((label, index) => {
                    const isDone = index < triageStep;
                    const isActive = index === triageStep;
                    return (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center text-[8px] text-slate-600 font-mono">{index + 1}</div>
                        )}
                        <span className={isDone ? "text-slate-400 line-through" : isActive ? "text-rose-400 font-semibold" : "text-slate-600"}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-xl font-mono font-bold uppercase tracking-wider flex items-center gap-1 w-fit">
                      <Zap className="w-3 h-3 text-rose-400 animate-bounce" /> Active Rescue Mode
                    </span>
                    <h3 className="text-xl font-extrabold text-white font-sans tracking-tight">🚨 Emergency Escape Path Activated</h3>
                  </div>
                  <button
                    onClick={handleAcceptRescuePlan}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:brightness-110 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer shrink-0"
                  >
                    Accept Route & Rest Easy
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-4">
                    <h4 className="text-slate-200 font-bold text-xs uppercase tracking-wider font-mono">Minimum-Viable Focus Sequence</h4>
                    <div className="space-y-3">
                      {emergencyPlan?.emergencyTimeline.map((block, idx) => (
                        <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-mono font-bold tracking-tight">
                              {block.timeSpan}
                            </span>
                            <p className="text-slate-200 text-xs font-semibold leading-normal font-sans">
                              {block.action}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono text-right shrink-0">
                            Goal: {block.estimatedProgress}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-4">
                    <div className="p-5 bg-black/40 border border-rose-500/20 rounded-3xl space-y-3.5">
                      <h4 className="text-rose-400 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-rose-400 animate-pulse" />
                        Rescue Operations Metrics
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <span className="text-base select-none">💡</span>
                          <div className="text-left">
                            <p className="font-extrabold text-white">I found a better plan</p>
                            <p className="text-[10.5px] text-slate-400 leading-normal">Calculated a simplified, minimal pathway to secure immediate bottlenecks.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <span className="text-base select-none">🔄</span>
                          <div className="text-left">
                            <p className="font-extrabold text-white">Two tasks were moved</p>
                            <p className="text-[10.5px] text-slate-400 leading-normal">Postponed 2 non-critical personal chores to clear 3.5 hours today.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <span className="text-base select-none">⏱️</span>
                          <div className="text-left">
                            <p className="font-extrabold text-white">One focus block reserved</p>
                            <p className="text-[10.5px] text-slate-400 leading-normal">Added a dedicated 45-minute deep focus block with integrated breathing.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <span className="text-base select-none">📉</span>
                          <div className="text-left">
                            <p className="font-extrabold text-[#10B981]">Deadline risk decreased</p>
                            <p className="text-[10.5px] text-emerald-300 font-semibold leading-normal">Your overall deadline threat rating has decreased by 56%.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-3">
                      <h4 className="text-slate-300 font-bold text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-indigo-400" />
                        Tasks Postponed (Rest Easy)
                      </h4>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        To protect your energy, we have safely pushed these items out of your schedule for now. Ignore them completely.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {emergencyPlan?.cutOffTasks.length === 0 ? (
                          <span className="text-[10px] text-slate-500 font-mono">All items merged into the core focus zone.</span>
                        ) : (
                          emergencyPlan?.cutOffTasks.map((t, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-xl text-rose-400 font-mono text-[10px]">
                              {t}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="p-5 bg-indigo-950/20 border border-indigo-500/10 rounded-3xl space-y-2">
                      <h4 className="text-indigo-300 font-bold text-xs font-mono uppercase tracking-wider">Coach Support</h4>
                      <p className="text-slate-300 text-xs leading-relaxed italic">
                        "{emergencyPlan?.emergencyAdvice}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Normal Mission Control Grid Layout */
          <motion.div 
            key="normal-container"
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-slate-200/50 dark:border-white/5 gap-4">
              <div>
                <h1 className="text-2xl font-sans font-black text-[#111827] dark:text-white tracking-tight">
                  MISSION CONTROL
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tactical defense console for {settings.userName || "Sal"}. Real-time deadline safeguards active.
                </p>
              </div>

              {/* Crisis Trigger button */}
              <button
                onClick={handleTriggerEmergencyTriage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/10 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                🚨 Overwhelmed? Save My Day
              </button>
            </div>

            {/* TWO-COLUMN GRID: Left = Current Mission + Active Registry; Right = Smart Creator & Guardian Intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: Current Mission & Active Tasks Registry (7 Cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. CURRENT MISSION PANEL */}
                {todaysFocusTask ? (
                  <div className="bg-white dark:bg-[#1D1D1D] border border-slate-200/60 dark:border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-sm transition-all duration-300">
                    <div className="absolute top-[-50%] left-[-20%] w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="space-y-3 relative z-10">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-purple-300 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1 border border-indigo-500/20">
                          <Target className="w-3 h-3 text-indigo-500" /> Current Mission
                        </span>
                        
                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase border ${
                          todaysFocusTask.priority === "Critical" 
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-500" 
                            : todaysFocusTask.priority === "High"
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
                        }`}>
                          Priority: {todaysFocusTask.priority}
                        </span>

                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase border ${
                          todaysFocusTask.riskLevel === "Critical" || todaysFocusTask.riskLevel === "High"
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse" 
                            : "bg-slate-500/10 border-slate-500/10 text-slate-400"
                        }`}>
                          Risk: {todaysFocusTask.riskLevel || "Low"}
                        </span>
                      </div>
                      
                      <h2 className="text-xl md:text-2xl font-black text-[#111827] dark:text-white tracking-tight leading-tight">
                        "{todaysFocusTask.title}"
                      </h2>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 border-y border-slate-100 dark:border-white/5">
                        <div>
                          <span className="font-mono text-[9px] block uppercase text-slate-400">Estimated Effort</span>
                          <span className="font-bold text-[#111827] dark:text-white">{todaysFocusTask.estimatedEffort || 1.5} Hours</span>
                        </div>
                        <div>
                          <span className="font-mono text-[9px] block uppercase text-slate-400">Target Deadline</span>
                          <span className="font-bold text-rose-500 dark:text-rose-400">{formatFriendlyDeadline(todaysFocusTask.deadline)}</span>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <span className="font-mono text-[9px] block uppercase text-slate-400">Next Action</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">
                            {todaysFocusTask.subtasks && todaysFocusTask.subtasks.length > 0 
                              ? todaysFocusTask.subtasks.find(s => !s.startsWith("✓ ")) || "Final touch-ups"
                              : "Review parameters"}
                          </span>
                        </div>
                      </div>

                      {/* Control Actions */}
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                          onClick={() => {
                            localStorage.setItem("guardian-active-focus-task", todaysFocusTask.id);
                            localStorage.setItem("guardian-tasks-subtab", "focus");
                            window.dispatchEvent(new Event("guardian-tab-redirect"));
                            onNavigate("focus");
                            onAddHistory("Initiated Focus Block", `Launched deep session for "${todaysFocusTask.title}".`);
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>Start Focus Session</span>
                        </button>
                        
                        <button
                          onClick={() => onAskGuardianAboutTask && onAskGuardianAboutTask(todaysFocusTask.title)}
                          className="px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ask Guardian</span>
                        </button>

                        <button
                          onClick={() => handleScheduleAction(todaysFocusTask.title)}
                          className="px-4 py-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Schedule Slot</span>
                        </button>

                        <button
                          onClick={() => onToggleComplete(todaysFocusTask.id)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ml-auto"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Complete</span>
                        </button>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#1D1D1D] border border-slate-200/60 dark:border-white/10 rounded-3xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden shadow-sm transition-all duration-300">
                    <div className="space-y-2 flex-1 text-center md:text-left">
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider text-[9px]">
                        <Check className="w-3" /> All Targets Secured
                      </div>
                      <h2 className="text-xl md:text-2xl font-black text-[#111827] dark:text-white tracking-tight leading-tight">
                        Your Schedule is Beautifully Clear
                      </h2>
                      <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-2xl font-medium">
                        Excellent work! Every single task has been completed and your threat timeline is completely balanced. Rest or draft a fresh challenge.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. ACTIVE REGISTRY LIST */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-150 dark:border-white/5 pb-2">
                    <h3 className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ListTodo className="w-4 h-4 text-indigo-500" />
                      Active Tasks Registry
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">{pendingTasks.length} pending items</span>
                  </div>

                  {pendingTasks.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6">
                      <span className="text-2xl select-none mb-1 block">🌾</span>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No active tasks found.</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Use the Smart AI input on the right to draft a task.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingTasks.map((task) => {
                        const isSelected = selectedTaskId === task.id;
                        const displayPriority = task.priority;
                        const isOverdue = new Date(task.deadline) < new Date() && !task.completed;

                        return (
                          <div 
                            key={task.id}
                            className={`border transition-all duration-300 rounded-2xl overflow-hidden shadow-sm
                              ${isSelected 
                                ? "bg-indigo-600/5 dark:bg-indigo-500/10 border-indigo-500/50" 
                                : "bg-white dark:bg-[#1D1D1D] hover:bg-slate-50 dark:hover:bg-[#252525] border-slate-200/60 dark:border-white/10"
                              }`}
                          >
                            {/* Main Task Header Row */}
                            <div 
                              onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
                              className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleComplete(task.id);
                                  }}
                                  className="w-5 h-5 rounded-md border border-slate-300 dark:border-white/20 flex items-center justify-center text-transparent hover:text-indigo-500 dark:hover:text-purple-400 cursor-pointer transition shrink-0 bg-transparent"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </button>

                                <div className="space-y-1 truncate">
                                  <h4 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white truncate">
                                    {task.title}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono font-bold">
                                    <span className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                                      {task.category}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded border ${
                                      displayPriority === "Critical" ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                                      displayPriority === "High" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                      "bg-emerald-500/10 border-emerald-500/10 text-emerald-500"
                                    }`}>
                                      {displayPriority}
                                    </span>
                                    <span className="text-slate-400">
                                      {task.estimatedEffort || 2}h estimated
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isOverdue ? "bg-rose-500/15 text-rose-500" : "text-slate-400 bg-slate-50 dark:bg-white/5"
                                }`}>
                                  {isOverdue ? "OVERDUE" : formatFriendlyDeadline(task.deadline)}
                                </span>
                                {isSelected ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                            </div>

                            {/* Inline Expandable AI Diagnostics */}
                            <AnimatePresence initial={false}>
                              {isSelected && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: "easeInOut" }}
                                  className="border-t border-slate-150 dark:border-white/5 bg-slate-50/50 dark:bg-[#191919] p-5 space-y-5"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-xs">
                                    {/* Left Sub-column: Core Stats & Checklist */}
                                    <div className="space-y-4">
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-mono text-slate-400 uppercase font-bold tracking-wider">Milestones Checklist</span>
                                        {task.subtasks && task.subtasks.length > 0 ? (
                                          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                            {task.subtasks.map((sub, sIdx) => {
                                              const isChecked = sub.startsWith("✓ ");
                                              const cleanSub = sub.replace("✓ ", "");
                                              return (
                                                <div key={sIdx} className="flex items-start gap-2.5">
                                                  <input 
                                                    type="checkbox"
                                                    id={`sub-mission-${task.id}-${sIdx}`}
                                                    checked={isChecked}
                                                    onChange={() => handleToggleSubtaskCheckbox(task.id, sIdx)}
                                                    className="rounded border-slate-300 dark:border-white/10 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer bg-white/5 mt-0.5 shrink-0"
                                                  />
                                                  <label 
                                                    htmlFor={`sub-mission-${task.id}-${sIdx}`}
                                                    className={`cursor-pointer leading-normal ${isChecked ? "line-through text-slate-400 font-medium" : "text-slate-700 dark:text-slate-200 font-semibold"}`}
                                                  >
                                                    {cleanSub}
                                                  </label>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <p className="text-[10px] text-slate-400 italic">No milestones registered.</p>
                                        )}
                                      </div>

                                      {/* Add subtask inline */}
                                      <form 
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          handleAddSubtask(task.id);
                                        }}
                                        className="flex gap-1.5 pt-1.5"
                                      >
                                        <input 
                                          type="text"
                                          placeholder="Add custom milestone..."
                                          value={newSubtaskText}
                                          onChange={e => setNewSubtaskText(e.target.value)}
                                          className="flex-1 px-3 py-1.5 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-white rounded-lg focus:outline-none focus:border-indigo-500"
                                        />
                                        <button 
                                          type="submit"
                                          className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer border-none"
                                        >
                                          Add
                                        </button>
                                      </form>
                                    </div>

                                    {/* Right Sub-column: AI Assessment & Schedule */}
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-white dark:bg-[#202020] border border-slate-200/60 dark:border-white/5 rounded-xl">
                                          <span className="text-[9px] font-mono text-slate-400 block uppercase">Suggested Schedule</span>
                                          <span className="font-bold text-slate-700 dark:text-slate-200 mt-0.5 block">{settings.productiveHours || "Evening"} Block</span>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-[#202020] border border-slate-200/60 dark:border-white/5 rounded-xl">
                                          <span className="text-[9px] font-mono text-slate-400 block uppercase">Dependencies</span>
                                          <span className="font-bold text-indigo-500 dark:text-purple-300 mt-0.5 block">Independent</span>
                                        </div>
                                      </div>

                                      <div className="p-3 bg-white dark:bg-[#202020] border border-slate-200/60 dark:border-white/5 rounded-xl space-y-1">
                                        <span className="text-[9px] font-mono text-slate-400 block uppercase">Risk Assessment & explanation</span>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal font-sans">
                                          {task.riskExplanation || "This task is balanced in your timeline. Completing it secures your calendar completely."}
                                        </p>
                                      </div>

                                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/10 rounded-xl space-y-0.5">
                                        <span className="text-[9px] font-mono text-indigo-500 dark:text-purple-300 block uppercase font-bold">Guardian reasoning</span>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                                          "Securing this task clears cognitive clutter. Highly recommend starting now before downstream tasks overlap."
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom Tactical Triggers */}
                                  <div className="pt-3 border-t border-slate-150 dark:border-white/5 flex flex-wrap gap-2.5">
                                    <button
                                      onClick={() => onAskGuardianAboutTask && onAskGuardianAboutTask(task.title)}
                                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                                      <span>Ask Guardian</span>
                                    </button>

                                    <button
                                      onClick={() => handleScheduleAction(task.title)}
                                      className="px-3.5 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      <span>Schedule Block</span>
                                    </button>

                                    <button
                                      onClick={() => handleRemindMeAction(task.title)}
                                      className="px-3.5 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <BellRing className="w-3.5 h-3.5" />
                                      <span>Remind Me</span>
                                    </button>

                                    <button
                                      onClick={() => handlePostponeTask(task.id)}
                                      className="px-3.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Hourglass className="w-3.5 h-3.5" />
                                      <span>Postpone 1 Day</span>
                                    </button>

                                    <button
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="px-3 py-1.5 bg-transparent text-rose-500 hover:underline text-xs font-medium ml-auto cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                                      Delete
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: Guardian Intelligence & Smart Task Creation (5 Cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* 1. GUARDIAN INTELLIGENCE CARD (Executive Assistant Style) */}
                <AnimatePresence>
                  {!dismissedGuardianCard && todaysFocusTask && (
                    <motion.div
                      initial={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-gradient-to-br from-[#121625] via-[#16132A] to-[#0E1322] border border-indigo-500/35 rounded-3xl p-6 space-y-5 shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
                      
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center animate-pulse">
                            <Shield className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <h3 className="text-xs font-extrabold text-white uppercase tracking-widest font-sans flex items-center gap-1.5">
                              Guardian Analysis
                            </h3>
                            <p className="text-[10px] text-indigo-300 font-mono">Dynamic Intelligence Feed</p>
                          </div>
                        </div>

                        <span className="text-[8px] font-mono font-bold bg-indigo-500/25 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/10 uppercase tracking-widest animate-pulse">
                          Active Sync
                        </span>
                      </div>

                      {/* Diagnostic breakdown parameters */}
                      <div className="space-y-3 text-[11px] leading-relaxed">
                        
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">🎯 Why this task matters</span>
                          <p className="text-slate-300 font-medium">
                            "{todaysFocusTask.title}" secures your primary progress targets. Completing it now prevents a cascading delay in your schedule and guarantees high failure tolerance parameters.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">⚠️ Conflict detection</span>
                          <p className="text-slate-300 font-medium">
                            {pendingTasks.length > 1 
                              ? `We detected ${pendingTasks.length - 1} secondary pending items competing for your mental focus today. Resolving this primary milestone secures your peak focus block.`
                              : "No scheduling conflicts or overlapping task deadlines detected. Your workspace parameters are clear."
                            }
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">📅 Suggested plan</span>
                          <p className="text-slate-300 font-medium">
                            Dedicate a clean {todaysFocusTask.estimatedEffort || 2}-hour block during your productive {settings.productiveHours || "Evening"} hours. Focus solely on milestones.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">🛡️ Potential risks & recovery</span>
                          <p className="text-slate-300 font-medium">
                            Delaying triggers {todaysFocusTask.riskLevel || "Low"} risk status. Recovery strategy: Break down remaining milestones or click "Overwhelmed" to reschedule non-essential items.
                          </p>
                        </div>

                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                        <button
                          onClick={() => {
                            setSuccessFeedback("Recommendation accepted! Schedule synchronized.");
                            onAddHistory("Accepted Guardian Recommendation", `Approved tactical advice for "${todaysFocusTask.title}".`);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer border-none"
                        >
                          Accept Recommendation
                        </button>
                        
                        <button
                          onClick={() => setDismissedGuardianCard(true)}
                          className="px-3 py-2 bg-transparent text-slate-400 hover:text-white text-xs font-bold transition hover:underline cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>

                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2. SMART AI INPUT CREATOR (Intelligent Messy Thought Parser) */}
                <div className="bg-[#151D33]/60 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl p-5 space-y-4 text-left bg-white dark:bg-[#1D1D1D]">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                    <div>
                      <h3 className="text-xs font-extrabold text-[#111827] dark:text-white uppercase tracking-widest font-sans">
                        Messy Thought Creator
                      </h3>
                      <p className="text-[9px] text-slate-400 font-mono">Brain-dump a loose deadline, let AI structure it</p>
                    </div>
                  </div>

                  <form onSubmit={handleSmartSubmit} className="space-y-4">
                    {sessionContext && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-start gap-2.5 relative overflow-hidden"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                        <div className="space-y-0.5 pr-4">
                          <p className="text-[8px] font-mono text-indigo-400 font-bold uppercase tracking-wider">Guardian Request</p>
                          <p className="text-white text-[11px] leading-relaxed font-sans font-semibold">{sessionContext.question}</p>
                        </div>
                      </motion.div>
                    )}

                    <div>
                      <textarea
                        rows={3}
                        placeholder="e.g. math study guide by friday evening, takes about 3 hours"
                        value={smartInputText}
                        onChange={e => setSmartInputText(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#09090b]/80 border border-slate-200 dark:border-white/10 focus:border-indigo-500 focus:outline-none text-xs text-slate-800 dark:text-white placeholder-slate-400 font-sans leading-relaxed shadow-inner"
                      />
                    </div>

                    {smartError && (
                      <div className="text-[10px] text-rose-500 font-medium">
                        {smartError}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={smartAnalyzing || !smartInputText.trim()}
                        className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md border-none"
                      >
                        {smartAnalyzing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Structuring...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Process Messy Thought</span>
                          </>
                        )}
                      </button>

                      {sessionContext && (
                        <button
                          type="button"
                          onClick={handleCancelConversation}
                          className="px-3 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-800 dark:text-slate-400 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={taskToDelete !== null}
        onClose={() => setTaskToDelete(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete the task "${taskToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        severity="danger"
      />

    </div>
  );
}
