import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Sparkles, 
  Trash2, 
  Check, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  Loader2,
  Zap,
  Clock3,
  ListChecks,
  Compass,
  Brain,
  ShieldAlert,
  ListTodo,
  BellRing,
  Play,
  CheckCircle2,
  Target,
  ArrowRight,
  Shield,
  Lightbulb,
  Hourglass
} from "lucide-react";
import { Task, UserSettings } from "../types";
import { api } from "../lib/api";
import FocusModeView from "./FocusModeView";
import ConfirmationDialog from "./ConfirmationDialog";

interface TaskManagerViewProps {
  tasks: Task[];
  settings: UserSettings;
  onTasksUpdate: (updatedTasks: Task[]) => void;
  onAddHistory: (action: string, details: string) => void;
  onNavigate: (page: string) => void;
  onAskGuardianAboutTask: (taskTitle: string) => void;
}

export default function TaskManagerView({ 
  tasks, 
  settings, 
  onTasksUpdate, 
  onAddHistory,
  onNavigate,
  onAskGuardianAboutTask
}: TaskManagerViewProps) {
  // Sub Tab: checklist vs focus
  const [activeSubTab, setActiveSubTab] = useState<"list" | "focus">(() => {
    const saved = localStorage.getItem("guardian-tasks-subtab");
    if (saved === "focus" || saved === "list") {
      return saved;
    }
    return "list";
  });

  // Mobile Bottom Sheet Task Creation Open State
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);

  // Unified Intelligent Input States
  const [smartInputText, setSmartInputText] = useState("");
  const [smartAnalyzing, setSmartAnalyzing] = useState(false);
  const [smartError, setSmartError] = useState("");
  const [sessionContext, setSessionContext] = useState<{ originalText: string; question: string } | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Handle cross-tab redirects from Dashboard
  useEffect(() => {
    const handleRedirect = () => {
      const savedSub = localStorage.getItem("guardian-tasks-subtab");
      if (savedSub === "focus" || savedSub === "list") {
        setActiveSubTab(savedSub);
        localStorage.removeItem("guardian-tasks-subtab");
      }
      const savedTaskId = localStorage.getItem("guardian-active-focus-task");
      if (savedTaskId) {
        setSelectedTaskId(savedTaskId);
        localStorage.removeItem("guardian-active-focus-task");
      }
    };
    handleRedirect(); // run once on mount too in case we were already redirected
    window.addEventListener("guardian-tab-redirect", handleRedirect);
    return () => window.removeEventListener("guardian-tab-redirect", handleRedirect);
  }, []);

  const PLACEHOLDERS = [
    "I have a math test on Friday at 9 AM.",
    "Need to submit my DBMS assignment tomorrow.",
    "Interview next Tuesday. Help me prepare.",
    "Pay my electricity bill before the 25th.",
    "Remind me to call Mom this evening.",
    "Gym after work tomorrow."
  ];

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<"All" | "Pending" | "Completed">("Pending");

  // Advanced Sorting & Search States for Power Users
  const [sortBy, setSortBy] = useState<"deadline" | "urgency" | "effort" | "priority" | "title">("deadline");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [localSearchQuery, setLocalSearchQuery] = useState<string>("");

  // Selected Task for Bottom AI Analysis panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [analyzingTaskId, setAnalyzingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);

  // Subtask local interactivity state (checks off subtasks elegantly in memory & persists to parent list)
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // Setup initial selected task
  useEffect(() => {
    if (tasks.length > 0 && !selectedTaskId) {
      const firstPending = tasks.find(t => !t.completed);
      setSelectedTaskId(firstPending ? firstPending.id : tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  // Map our requested custom priority labels to types.ts priority values
  const mapLabelToPriority = (label: "Comfortable" | "Needs Attention" | "Critical"): Task["priority"] => {
    if (label === "Comfortable") return "Low";
    if (label === "Needs Attention") return "High";
    return "Critical";
  };

  const mapPriorityToLabel = (priority: Task["priority"]): "Comfortable" | "Needs Attention" | "Critical" => {
    if (priority === "Critical") return "Critical";
    if (priority === "High" || priority === "Medium") return "Needs Attention";
    return "Comfortable";
  };

  // Helper for generating dynamic suggested schedules
  const getSuggestedSchedule = (task: Task): string => {
    const peakTime = settings.productiveHours || "Evening";
    const deadlineDate = new Date(task.deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let dayStr = "Today";
    if (diffDays <= 0) {
      dayStr = "Today (Overdue)";
    } else if (diffDays === 1) {
      dayStr = "Tomorrow";
    } else if (diffDays <= 3) {
      dayStr = `In ${diffDays} days`;
    } else {
      dayStr = deadlineDate.toLocaleDateString(undefined, { weekday: "long" });
    }

    let timeRange = "7:00 PM - 9:00 PM";
    if (peakTime === "Morning") {
      timeRange = "9:00 AM - 11:00 AM";
    } else if (peakTime === "Afternoon") {
      timeRange = "2:00 PM - 4:00 PM";
    } else if (peakTime === "LateNight") {
      timeRange = "11:00 PM - 1:00 AM";
    }

    return `${dayStr} during your ${peakTime} productivity window (${timeRange})`;
  };

  // Helper for generating custom friendly actions based on user bio and settings
  const getSuggestedAction = (task: Task): string => {
    const isFrequentlyDelayed = settings.frequentlyDelayed && settings.frequentlyDelayed.includes(task.category);
    
    if (task.priority === "Critical") {
      return "Critical item detected! Open Steps and immediately tackle milestone 1.";
    }
    if (isFrequentlyDelayed) {
      return `This is a ${task.category} task, which you frequently delay. Run a 15-minute micro block now.`;
    }
    if (task.estimatedEffort >= 4) {
      return `Requires substantial focus (${task.estimatedEffort}h). We recommend splitting this into 3 blocks.`;
    }
    return `Schedule one standard ${settings.preferredWorkBlock || 25}m focus block when alert.`;
  };

  // Unified Intelligent Task Creation Handler
  const handleSmartSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smartInputText.trim()) return;

    setSmartAnalyzing(true);
    setSmartError("");
    setSuccessFeedback(null);

    try {
      const res = await api.smartAdd(smartInputText.trim(), sessionContext, tasks);
      
      if (res.isComplete && res.task) {
        // Create task!
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
        
        // Show personalized feedback message!
        if (res.feedbackMessage) {
          setSuccessFeedback(res.feedbackMessage);
        } else {
          setSuccessFeedback(`Successfully created task: "${createdTask.title}".`);
        }

        // Clear input states
        setSmartInputText("");
        setSessionContext(null);
        setIsCreateSheetOpen(false);
      } else if (res.followUpQuestion) {
        // We need a follow-up answer!
        setSessionContext({
          originalText: sessionContext ? `${sessionContext.originalText} ${smartInputText}` : smartInputText,
          question: res.followUpQuestion
        });
        setSmartInputText(""); // Clear text so they can type their answer to the question
      }
    } catch (err: any) {
      console.error("Smart Task Creation Failed", err);
      setSmartError(err.message || "Failed to process task via Guardian AI.");
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

  // Toggle Task Completion
  const handleToggleComplete = (id: string) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        const completed = !t.completed;
        return {
          ...t,
          completed,
          completedAt: completed ? new Date().toISOString() : undefined
        };
      }
      return t;
    });
    onTasksUpdate(updated);

    const task = tasks.find(t => t.id === id);
    if (task) {
      onAddHistory(
        task.completed ? "Reopened Task" : "Completed Task",
        `Task "${task.title}" completion state toggled.`
      );
    }
  };

  // Delete Task
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
    
    // Clear selection or re-route selection
    if (selectedTaskId === id) {
      const remaining = updated.filter(t => !t.completed);
      setSelectedTaskId(remaining.length > 0 ? remaining[0].id : (updated.length > 0 ? updated[0].id : null));
    }
    
    onAddHistory("Deleted Task", "Removed task from database Registry.");
    setTaskToDelete(null);
  };

  // Postpone Task (Push deadline 24 hours forward)
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
  };

  // Interactive Subtask additions
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

  // Toggle checklist subtask state (Strikes it out or toggles in string)
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
        return {
          ...t,
          subtasks: newSubtasks
        };
      }
      return t;
    });

    onTasksUpdate(updated);
    onAddHistory("Updated Milestone", "Milestone checklist step updated.");
  };

  // Ask Guardian Quick action
  const handleAskGuardianAction = (taskTitle: string) => {
    onAskGuardianAboutTask(taskTitle);
  };

  // Remind Me action
  const handleRemindMeAction = (taskTitle: string) => {
    onAddHistory("Configured Reminder", `Scheduled alerts and notifications for "${taskTitle}".`);
    setSuccessFeedback(`🛡️ Guardian reminder set! We will remind you 2 hours before the deadline of "${taskTitle}".`);
  };

  // Schedule action (Simulates immediate schedule blocking into Calendar page)
  const handleScheduleAction = (taskTitle: string) => {
    onAddHistory("Blocked Schedule Slot", `Allocated focus slots for "${taskTitle}" on peak hours.`);
    setSuccessFeedback(`📅 Time slot booked! "${taskTitle}" has been blocked into your daily calendar based on your productive settings.`);
  };

  // Generate Personalized Guardian Suggestions based on active tasks and settings
  const getPersonalizedSuggestions = () => {
    const suggestions: { id: string; badge: string; text: string; actionLabel: string; action: () => void }[] = [];
    const pendingTasks = tasks.filter(t => !t.completed);

    // Suggestion 1: Morning Focus Session
    const soonestTask = pendingTasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
    if (soonestTask) {
      suggestions.push({
        id: "sug-focus",
        badge: "Focus Session",
        text: `Launch a dedicated ${soonestTask.estimatedEffort || 1}-hour Focus Session for your most urgent task: "${soonestTask.title}".`,
        actionLabel: "Start Focus",
        action: () => {
          setSelectedTaskId(soonestTask.id);
          setActiveSubTab("focus");
          onAddHistory("Focus Session Launched", `Started deep focus on "${soonestTask.title}" from Guardian Suggestion.`);
          setSuccessFeedback(`Launched deep focus session timer for "${soonestTask.title}"!`);
        }
      });
    }

    // Suggestion 2: Break down a task (Subtask/Reminder creation)
    const complexTask = pendingTasks.find(t => (t.subtasks && t.subtasks.length > 0) || t.priority === "Critical" || t.priority === "High");
    if (complexTask) {
      suggestions.push({
        id: "sug-subtask",
        badge: "Task Breakdowns",
        text: `Break down "${complexTask.title}" by creating a clear 30-minute quick prep checklist.`,
        actionLabel: "Add Milestone",
        action: () => {
          const updated = tasks.map(t => {
            if (t.id === complexTask.id) {
              const currentSub = t.subtasks || [];
              if (!currentSub.includes("Quick Prep Review")) {
                return { ...t, subtasks: ["Quick Prep Review", ...currentSub] };
              }
            }
            return t;
          });
          onTasksUpdate(updated);
          onAddHistory("Milestone Added", `Added "Quick Prep Review" checklist to "${complexTask.title}".`);
          setSuccessFeedback(`Added 30-minute "Quick Prep Review" checkpoint to "${complexTask.title}"!`);
        }
      });
    }

    // Suggestion 3: Set Calendar Block
    if (soonestTask) {
      suggestions.push({
        id: "sug-calendar",
        badge: "Calendar Slot",
        text: `Reserve a peak focus hour today at 10:00 AM for "${soonestTask.title}".`,
        actionLabel: "Block Calendar",
        action: () => {
          onAddHistory("Calendar Focus Blocked", `Reserved 10:00 AM focus slot for "${soonestTask.title}".`);
          setSuccessFeedback(`Successfully scheduled 10:00 AM Calendar Focus Block for "${soonestTask.title}"!`);
        }
      });
    }

    // Suggestion 4: General Habit Trigger
    const habitsStr = localStorage.getItem("guardian-habits-v2") || "[]";
    let habitsList: any[] = [];
    try {
      habitsList = JSON.parse(habitsStr);
    } catch(e) {}
    const incompleteHabit = habitsList.find(h => !h.completedToday);
    if (incompleteHabit) {
      suggestions.push({
        id: "sug-habit",
        badge: "Habit Hack",
        text: `Extend your streak by completing your daily routine: "${incompleteHabit.name}".`,
        actionLabel: "Complete Habit",
        action: () => {
          const updatedHabits = habitsList.map((h: any) => {
            if (h.id === incompleteHabit.id) {
              return {
                ...h,
                completedToday: true,
                streak: (h.streak || 0) + 1
              };
            }
            return h;
          });
          localStorage.setItem("guardian-habits-v2", JSON.stringify(updatedHabits));
          window.dispatchEvent(new Event("guardian-habits-updated"));
          onAddHistory("Habit Checked Off", `Marked habit "${incompleteHabit.name}" as complete.`);
          setSuccessFeedback(`Awesome job completing your habit "${incompleteHabit.name}"!`);
        }
      });
    }

    // Fallback if empty
    if (suggestions.length === 0) {
      suggestions.push({
        id: "sug-create",
        badge: "Sovereign Guide",
        text: "Your active schedule is clean. Let's create a new target project together.",
        actionLabel: "Add Task",
        action: () => {
          setSmartInputText("Need to prepare midterm review next Wednesday");
          setSuccessFeedback("Intelligent draft filled. Press 'Analyze & Add' to finalize!");
        }
      });
    }

    return suggestions;
  };

  // Filter, Search & Sort Tasks
  const filteredTasks = tasks.filter(task => {
    const matchesCategory = filterCategory === "All" || task.category === filterCategory;
    
    // Mapping Priority labels appropriately
    const customPriorityLabel = mapPriorityToLabel(task.priority);
    const matchesPriority = filterPriority === "All" || customPriorityLabel === filterPriority;
    
    const matchesStatus = 
      filterStatus === "All" || 
      (filterStatus === "Completed" && task.completed) || 
      (filterStatus === "Pending" && !task.completed);

    const matchesSearch = !localSearchQuery.trim() || 
      task.title.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
      (task.category && task.category.toLowerCase().includes(localSearchQuery.toLowerCase()));

    return matchesCategory && matchesPriority && matchesStatus && matchesSearch;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === "deadline") {
      comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    } else if (sortBy === "urgency") {
      comparison = (a.urgencyScore || 0) - (b.urgencyScore || 0);
    } else if (sortBy === "effort") {
      comparison = (a.estimatedEffort || 0) - (b.estimatedEffort || 0);
    } else if (sortBy === "priority") {
      const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      comparison = priorityWeight[a.priority] - priorityWeight[b.priority];
    } else if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Power User Bulk Actions
  const handleBulkCompleteAllFiltered = () => {
    const filteredIds = filteredTasks.filter(t => !t.completed).map(t => t.id);
    if (filteredIds.length === 0) return;
    const updated = tasks.map(t => {
      if (filteredIds.includes(t.id)) {
        return { ...t, completed: true, completedAt: new Date().toISOString() };
      }
      return t;
    });
    onTasksUpdate(updated);
    onAddHistory("Bulk Completed Tasks", `Marked ${filteredIds.length} tasks as complete in Registry.`);
    setSuccessFeedback(`🛡️ Marked ${filteredIds.length} tasks as complete!`);
  };

  const handleBulkDeleteCompleted = () => {
    const completedTasks = tasks.filter(t => t.completed);
    if (completedTasks.length === 0) return;
    setIsBulkDeleting(true);
  };

  const confirmBulkDeleteCompleted = () => {
    const completedTasks = tasks.filter(t => t.completed);
    const updated = tasks.filter(t => !t.completed);
    onTasksUpdate(updated);
    if (selectedTaskId && completedTasks.some(t => t.id === selectedTaskId)) {
      setSelectedTaskId(updated.length > 0 ? updated[0].id : null);
    }
    onAddHistory("Bulk Deleted Completed", `Removed ${completedTasks.length} completed tasks from active list.`);
    setSuccessFeedback(`🧹 Cleaned up ${completedTasks.length} completed tasks!`);
    setIsBulkDeleting(false);
  };

  // Fetch task currently selected for the bottom panel
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  const renderCreatorForm = () => {
    return (
      <div className="space-y-6 text-left">
        {/* 1. Task Input Panel */}
        <div className="smart-guardian-container bg-[#151D33]/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-xl p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white tracking-tight font-sans smart-guardian-title">
              What do you need help with?
            </h3>
          </div>

          <form onSubmit={handleSmartSubmit} className="space-y-4">
            {/* Guardian Conversation Bubble */}
            {sessionContext && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="smart-guardian-chat-bubble p-4 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl flex items-start gap-3 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-[8px] text-amber-400 font-mono rounded-bl-lg font-bold uppercase tracking-widest">
                  Conversation Thread
                </div>
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1 pr-6">
                  <p className="text-[9px] font-mono text-indigo-400 font-bold uppercase tracking-wider chat-bubble-tag">Guardian Clarifying Request</p>
                  <p className="text-white text-xs leading-relaxed font-sans font-medium chat-bubble-text">{sessionContext.question}</p>
                </div>
              </motion.div>
            )}

            <div>
              <textarea
                rows={3}
                placeholder={PLACEHOLDERS[placeholderIndex]}
                value={smartInputText}
                onChange={e => setSmartInputText(e.target.value)}
                className="smart-guardian-textarea w-full px-4 py-3.5 rounded-2xl bg-[#09090b]/80 border border-white/10 focus:border-indigo-500 focus:outline-none text-xs text-white placeholder-slate-500 font-sans leading-relaxed focus:ring-1 focus:ring-indigo-500 shadow-inner"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={smartAnalyzing || !smartInputText.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 disabled:opacity-40 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-500/15 border-none"
              >
                {smartAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Guardian is analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    {sessionContext ? "Send Reply to Guardian" : "Ask Guardian"}
                  </>
                )}
              </button>

              {sessionContext && (
                <button
                  type="button"
                  onClick={handleCancelConversation}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-xs font-semibold transition border border-white/10 cursor-pointer smart-guardian-reset-btn"
                >
                  Reset
                </button>
              )}
            </div>
          </form>

          {smartError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-400 leading-normal">
              {smartError}
            </div>
          )}

          {/* Success Banner */}
          {successFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="smart-guardian-success-feedback p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-left relative overflow-hidden"
            >
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider success-feedback-tag">Guardian Scheduler</p>
                <p className="text-slate-200 text-xs leading-relaxed font-sans success-feedback-text">{successFeedback}</p>
              </div>
              <button
                onClick={() => setSuccessFeedback(null)}
                className="text-slate-400 hover:text-slate-200 transition cursor-pointer self-start p-1 bg-transparent border-none"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
              </button>
            </motion.div>
          )}
        </div>

        {/* 2. Guardian Suggestions Panel */}
        <div className="bg-[#151D33]/40 border border-indigo-500/10 rounded-3xl p-6 space-y-4 text-left">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
            <Brain className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Guardian Suggestions</h3>
            </div>
          </div>

          <div className="space-y-3.5">
            {getPersonalizedSuggestions().map(suggestion => (
              <div key={suggestion.id} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden group hover:border-indigo-500/20 transition-all text-left">
                <div className="flex items-start gap-3">
                  <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider px-2 py-0.5 bg-indigo-500/10 rounded font-bold self-start mt-0.5 whitespace-nowrap">
                    {suggestion.badge}
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed font-sans">{suggestion.text}</p>
                </div>
                <button
                  onClick={suggestion.action}
                  className="self-end sm:self-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0"
                >
                  <span>{suggestion.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="task-manager-root" className="space-y-6">
      
      {/* Sub Tab Switcher: Checklist vs Focus Timer */}
      <div className="flex border border-white/10 max-w-xs bg-white/5 p-1 rounded-2xl relative z-10">
        <button
          onClick={() => setActiveSubTab("list")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5
            ${activeSubTab === "list" 
              ? "bg-indigo-600 text-white shadow-sm" 
              : "text-slate-400 hover:text-white"}`}
        >
          <ListChecks className="w-3.5 h-3.5" />
          My Tasks
        </button>
        <button
          onClick={() => setActiveSubTab("focus")}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5
            ${activeSubTab === "focus" 
              ? "bg-indigo-600 text-white shadow-sm" 
              : "text-slate-400 hover:text-white"}`}
        >
          <Clock3 className="w-3.5 h-3.5" />
          Focus Timer
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "focus" ? (
          <motion.div
            key="focus-mode-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <FocusModeView settings={settings} onAddHistory={onAddHistory} />
          </motion.div>
        ) : (
          // Main Redesigned AI Task Page
          <motion.div 
            key="task-checklist-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top Row status flag */}
            <div className="bg-indigo-950/20 border border-indigo-500/25 p-3 rounded-2xl flex items-center justify-between text-xs text-indigo-200 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  <strong>Guardian is watching your deadlines.</strong>
                </span>
              </div>
            </div>

            {/* Split Top Grid: Left (Input & Suggestions) vs Right (Task List) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Task Creator & Suggestions (5 cols, hidden on mobile/tablet) */}
              <div className="hidden lg:block lg:col-span-5 space-y-6 text-left">
                {renderCreatorForm()}
              </div>

              {/* Right Column: Dynamic Filters & Task Cards List (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Mobile Button to trigger Task Creation Bottom Sheet */}
                <button
                  onClick={() => setIsCreateSheetOpen(true)}
                  className="lg:hidden w-full h-12 bg-gradient-to-r from-[#6D5DFC] to-indigo-600 hover:opacity-95 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider mb-2 shadow-lg shadow-[#6D5DFC]/10 border-none cursor-pointer duration-200"
                >
                  <Plus className="w-4 h-4" /> Add New Task
                </button>
                
                {/* Search, Sort, & Bulk Actions Container */}
                <div className="bg-[#151D33]/40 border border-white/10 rounded-3xl p-5 space-y-4 shadow-sm text-left">
                  
                  {/* Top Row: Search & Status Filters */}
                  <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                    {/* Search Field */}
                    <div className="w-full md:w-auto flex-1">
                      <input
                        type="text"
                        placeholder="🔍 Search registry title or category..."
                        value={localSearchQuery}
                        onChange={e => setLocalSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 bg-[#121214] border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Status Tabs */}
                    <div className="flex bg-[#121214] p-1 rounded-xl border border-white/10 w-full md:w-auto justify-around shrink-0">
                      {(["Pending", "Completed", "All"] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => setFilterStatus(st)}
                          className={`px-4 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex-1 text-center md:flex-none
                            ${filterStatus === st 
                              ? "bg-white/10 text-white font-bold" 
                              : "text-slate-400 hover:text-white"}`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Middle Row: Filters & Advanced Sorting */}
                  <div className="flex flex-wrap gap-2.5 items-center justify-between border-t border-white/5 pt-3">
                    
                    <div className="flex flex-wrap gap-2">
                      {/* Category Selector */}
                      <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 bg-[#121214] border border-white/10 hover:border-white/25 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <option value="All">All Fields</option>
                        <option value="Study">Study</option>
                        <option value="Work">Work</option>
                        <option value="Personal">Personal</option>
                        <option value="Health">Health</option>
                        <option value="Finance">Finance</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Meetings">Meetings</option>
                        <option value="Other">Other</option>
                      </select>

                      {/* Priority Selector */}
                      <select
                        value={filterPriority}
                        onChange={e => setFilterPriority(e.target.value)}
                        className="px-3 py-1.5 bg-[#121214] border border-white/10 hover:border-white/25 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <option value="All">All Priorities</option>
                        <option value="Comfortable">Comfortable</option>
                        <option value="Needs Attention">Needs Attention</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>

                    {/* Advanced Sorting Controls */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-mono text-[10px] uppercase font-bold">Sort By</span>
                      <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="px-3 py-1.5 bg-[#121214] border border-white/10 hover:border-white/25 rounded-xl text-xs text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <option value="deadline">📅 Deadline</option>
                        <option value="urgency">⚠️ Urgency Score</option>
                        <option value="effort">⏱️ Effort Estimate</option>
                        <option value="priority">🔥 Priority</option>
                        <option value="title">🔤 Task Title</option>
                      </select>

                      <button
                        onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                        className="px-2.5 py-1.5 bg-[#121214] hover:bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 transition cursor-pointer"
                        title="Toggle sort direction"
                      >
                        {sortOrder === "asc" ? "Asc ↑" : "Desc ↓"}
                      </button>
                    </div>

                  </div>

                  {/* Bottom Row: Bulk Action Utilities */}
                  <div className="flex flex-wrap gap-2 items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-slate-500 font-mono text-[10px]">Registry Power Actions:</span>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={handleBulkCompleteAllFiltered}
                        disabled={filteredTasks.filter(t => !t.completed).length === 0}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 rounded-xl text-[10px] font-extrabold transition disabled:opacity-30 cursor-pointer"
                      >
                        ✓ Mark Filtered as Complete
                      </button>

                      <button
                        onClick={handleBulkDeleteCompleted}
                        disabled={tasks.filter(t => t.completed).length === 0}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 rounded-xl text-[10px] font-extrabold transition disabled:opacity-30 cursor-pointer"
                      >
                        🧹 Wipe All Completed Tasks
                      </button>
                    </div>
                  </div>

                </div>

                {/* Main Task List cards stack */}
                <div className="space-y-3 max-h-[490px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-white/10">
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-16 bg-[#151D33]/20 border border-white/5 rounded-3xl space-y-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl mx-auto mb-1 animate-pulse">
                        🌿
                      </div>
                      <h3 className="text-sm font-bold text-slate-300 font-sans">You're all caught up. Enjoy your free time.</h3>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Guardian is ready whenever you need help. Type a messy thought or schedule a target project on the left.
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map(task => {
                      const isSelected = selectedTaskId === task.id;
                      const isAnalyzing = analyzingTaskId === task.id;
                      const isOverdue = new Date(task.deadline) < new Date() && !task.completed;
                      const displayPriorityLabel = mapPriorityToLabel(task.priority);

                      return (
                        <motion.div
                          key={task.id}
                          layoutId={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`group border transition-all duration-200 rounded-2xl p-4 relative overflow-hidden cursor-pointer flex flex-col justify-between gap-3
                            ${isSelected 
                              ? "bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20" 
                              : "bg-[#151D33]/40 hover:bg-[#151D33]/60 border-white/10"} 
                            ${task.completed ? "opacity-65 border-white/5 bg-[#151D33]/15" : ""}`}
                        >
                          {/* Inner contents */}
                          <div className="flex items-start gap-3 justify-between">
                            {/* Left part: Checkbox + Title + Meta tags */}
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleComplete(task.id);
                                }}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition
                                  ${task.completed 
                                    ? "bg-emerald-500/10 border-emerald-500/45 text-emerald-400" 
                                    : isOverdue
                                    ? "border-rose-500/40 hover:border-rose-500 text-transparent hover:text-rose-400"
                                    : "border-white/20 hover:border-indigo-500 text-transparent hover:text-indigo-400"}`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </button>

                              <div className="space-y-1 flex-1 min-w-0">
                                <h4 className={`text-xs md:text-sm font-bold tracking-tight leading-snug truncate pr-2
                                  ${task.completed ? "line-through text-slate-500 font-medium" : "text-white"}`}>
                                  {task.title}
                                </h4>

                                {/* Meta Indicators & Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                  <span className="bg-[#121214] px-2 py-0.5 rounded text-slate-300 font-bold">
                                    {task.category}
                                  </span>
                                  
                                  {/* Priority Badge */}
                                  <span className={`px-2 py-0.5 rounded font-bold border ${
                                    displayPriorityLabel === "Critical" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                                    displayPriorityLabel === "Needs Attention" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
                                    "bg-emerald-500/10 border-emerald-500/10 text-emerald-400"
                                  }`}>
                                    {displayPriorityLabel}
                                  </span>

                                  {/* Risk level badge */}
                                  <span className={`px-2 py-0.5 rounded font-bold border ${
                                    task.riskLevel === "Critical" || task.riskLevel === "High" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                                    task.riskLevel === "Medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
                                    "bg-slate-500/10 border-slate-500/10 text-slate-400"
                                  }`}>
                                    Risk: {task.riskLevel || "Low"}
                                  </span>
                                  
                                  <span className="text-slate-500 font-bold">•</span>
                                  
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Clock className="w-3 h-3 text-indigo-400" />
                                    <span>{task.estimatedEffort || 2}h</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right action indicator */}
                            <div className="flex items-center gap-2 shrink-0 self-start">
                              <span className="text-[10px] font-mono text-slate-500">
                                {isOverdue ? "OVERDUE" : new Date(task.deadline).toLocaleDateString(undefined, {month: "short", day: "numeric"})}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
                            </div>
                          </div>

                          {/* Suggested Action Bar on card */}
                          {!task.completed && (
                            <div className="mt-1 p-2 bg-[#09090b]/40 border border-white/5 rounded-xl flex items-center justify-between text-[10px] text-slate-400 group-hover:border-indigo-500/20 transition-all font-sans">
                              <div className="flex items-center gap-1.5 truncate">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                                <span className="truncate text-slate-300 leading-normal">
                                  <strong>Next action:</strong> {getSuggestedAction(task)}
                                </span>
                              </div>
                              <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest font-bold ml-2">Guardian Tip</span>
                            </div>
                          )}

                          {/* Loading cover if analyzing */}
                          {isAnalyzing && (
                            <div className="absolute inset-0 bg-[#121625]/90 backdrop-blur-sm flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                              <span className="text-xs font-mono text-indigo-400 tracking-wider font-bold animate-pulse">Guardian is Analyzing...</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>

              </div>

            </div>

            {/* Bottom Panel: AI analysis (Full Width) */}
            <div id="guardian-ai-bottom-diagnostics" className="bg-[#151D33]/50 border border-indigo-500/15 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
              {/* Background gradient lighting effect */}
              <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

              {/* Panel Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 mb-5 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                    <Shield className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-widest font-sans flex items-center gap-1.5">
                      The Deadline Guardian AI Analysis
                    </h3>
                    <p className="text-[10px] text-indigo-300 font-sans">Task breakdown</p>
                  </div>
                </div>

                {selectedTask && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">SELECTED FOCUS TASK:</span>
                    <span className="text-xs text-white font-bold bg-white/5 border border-white/10 px-3 py-1 rounded-xl truncate max-w-[200px]">
                      {selectedTask.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Analysis Content */}
              {!selectedTask ? (
                <div className="text-center py-10 space-y-2">
                  <ShieldAlert className="w-10 h-10 text-slate-500 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-400 font-sans">No focus task selected.</h4>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                    Select any task card from the Registry above to launch deep diagnostic calculations.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column of Bottom Panel: Health Stats (4 cols) */}
                  <div className="lg:col-span-4 space-y-4">
                    
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Metric 1: Category */}
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Category</span>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                          <span className="text-xs text-white font-bold">{selectedTask.category}</span>
                        </div>
                      </div>

                      {/* Metric 2: Estimated Effort */}
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Estimated Effort</span>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs text-white font-bold">{selectedTask.estimatedEffort || 2} Hours</span>
                        </div>
                      </div>

                      {/* Metric 3: Attention */}
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Attention Level</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-white font-bold capitalize">
                            {mapPriorityToLabel(selectedTask.priority)}
                          </span>
                        </div>
                      </div>

                      {/* Metric 4: Urgency Score */}
                      <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Urgency Score</span>
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                selectedTask.urgencyScore >= 8 ? "bg-rose-500" :
                                selectedTask.urgencyScore >= 5 ? "bg-amber-400" :
                                "bg-emerald-400"
                              }`}
                              style={{ width: `${(selectedTask.urgencyScore || 5) * 10}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-white font-mono font-bold shrink-0">{selectedTask.urgencyScore || 5}/10</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Level Banner */}
                    <div className={`p-4 rounded-2xl border flex items-start gap-3
                      ${selectedTask.riskLevel === "Critical" || selectedTask.riskLevel === "High"
                        ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                        : selectedTask.riskLevel === "Medium"
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold block uppercase tracking-wider">
                          Risk Assessment: {selectedTask.riskLevel || "Low"}
                        </span>
                        <p className="text-[11px] leading-normal font-sans text-slate-300">
                          This task is overdue. Start now.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Center Column of Bottom Panel: Suggested Schedule & Guardian Recommendation (4 cols) */}
                  <div className="lg:col-span-4 space-y-4">
                    
                    {/* Suggested Schedule slot */}
                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-1.5">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Suggested Schedule</span>
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-white font-bold leading-relaxed">
                          {getSuggestedSchedule(selectedTask)}
                        </span>
                      </div>
                    </div>

                    {/* Guardian recommendation */}
                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-1.5">
                      <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">Guardian Recommendation</span>
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-indigo-200 font-sans leading-relaxed">
                          "Start with milestone 1: Setup parameters."
                        </span>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                      <div className="p-4 bg-[#121625]/40 border border-white/5 rounded-2xl space-y-2">
                        <div className="flex justify-between text-[10px] font-mono text-slate-400">
                          <span>MILESTONES COMPLETED</span>
                          <span>
                            {selectedTask.subtasks.filter(s => s.startsWith("✓ ")).length} / {selectedTask.subtasks.length}
                          </span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(selectedTask.subtasks.filter(s => s.startsWith("✓ ")).length / selectedTask.subtasks.length) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Right Column of Bottom Panel: Break into steps & Task Actions (4 cols) */}
                  <div className="lg:col-span-4 space-y-4">
                    
                    {/* Steps Checklist */}
                    <div className="p-4 bg-[#121625]/60 border border-white/5 rounded-2xl space-y-3">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                        Break into steps (Milestones)
                      </span>

                      {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                        <div className="space-y-2 max-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-1">
                          {selectedTask.subtasks.map((sub, idx) => {
                            const isChecked = sub.startsWith("✓ ");
                            const cleanSub = sub.replace("✓ ", "");
                            
                            return (
                              <div key={idx} className="flex items-start gap-2 text-[11px] font-sans text-slate-300">
                                <input 
                                  type="checkbox"
                                  id={`sub-${selectedTask.id}-${idx}`}
                                  checked={isChecked}
                                  onChange={() => handleToggleSubtaskCheckbox(selectedTask.id, idx)}
                                  className="rounded border-white/15 text-indigo-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer bg-white/5 mt-0.5 shrink-0"
                                />
                                <label 
                                  htmlFor={`sub-${selectedTask.id}-${idx}`} 
                                  className={`cursor-pointer select-none leading-relaxed ${isChecked ? "line-through text-slate-500 font-medium" : "text-slate-300"}`}
                                >
                                  {cleanSub}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500">No milestones registered.</p>
                      )}

                      {/* Add Custom Subtask Inline */}
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddSubtask(selectedTask.id);
                        }}
                        className="flex gap-1.5 pt-2 border-t border-white/5"
                      >
                        <input 
                          type="text"
                          placeholder="Add custom milestone..."
                          value={newSubtaskText}
                          onChange={e => setNewSubtaskText(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 text-[10px] text-white rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                        <button 
                          type="submit"
                          className="px-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-[10px] font-bold"
                        >
                          Add
                        </button>
                      </form>

                    </div>

                    {/* Tactical Action Triggers */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Ask Guardian */}
                        <button
                          onClick={() => handleAskGuardianAction(selectedTask.title)}
                          className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1 shadow-md shadow-indigo-600/10"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                          Ask Guardian
                        </button>

                        {/* Schedule Block */}
                        <button
                          onClick={() => handleScheduleAction(selectedTask.title)}
                          className="py-2.5 bg-[#1C2640] hover:bg-[#253254] border border-white/10 text-white rounded-xl text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                          Schedule Block
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Remind Me */}
                        <button
                          onClick={() => handleRemindMeAction(selectedTask.title)}
                          className="py-2.5 bg-[#1C2640] hover:bg-[#253254] border border-white/10 text-white rounded-xl text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <BellRing className="w-3.5 h-3.5 text-indigo-400" />
                          Remind Me
                        </button>

                        {/* Postpone 1 Day */}
                        <button
                          onClick={() => handlePostponeTask(selectedTask.id)}
                          disabled={selectedTask.completed}
                          className="py-2.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-rose-400 rounded-xl text-[10px] font-extrabold transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Hourglass className="w-3.5 h-3.5 text-rose-400" />
                          Postpone 1 Day
                        </button>
                      </div>

                      {/* Delete Task */}
                      <button
                        onClick={() => handleDeleteTask(selectedTask.id)}
                        className="w-full py-2 bg-rose-950/15 hover:bg-rose-900/35 border border-rose-500/25 text-rose-400 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove from Active Registry
                      </button>

                    </div>

                  </div>

                </div>
              )}

            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile/Tablet Bottom Sheet Task Creation */}
      <AnimatePresence>
        {isCreateSheetOpen && (
          <>
            {/* Backdrop with elegant blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateSheetOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 lg:hidden"
            />

            {/* Sliding Bottom Sheet Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[#0E1322]/98 border-t border-white/15 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.5)] z-50 overflow-y-auto p-6 lg:hidden"
            >
              {/* Drag Handle Indicator */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Title & Close */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#6D5DFC] animate-pulse" />
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-sans">
                    Create New Task
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateSheetOpen(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white text-xs font-mono transition border-none cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="pb-12">
                {renderCreatorForm()}
              </div>
            </motion.div>
          </>
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

      <ConfirmationDialog
        isOpen={isBulkDeleting}
        onClose={() => setIsBulkDeleting(false)}
        onConfirm={confirmBulkDeleteCompleted}
        title="Clear Completed Tasks"
        message="Are you sure you want to delete all completed tasks? This action cannot be undone."
        confirmText="Yes, Clear All"
        cancelText="Cancel"
        severity="danger"
      />

    </div>
  );
}
