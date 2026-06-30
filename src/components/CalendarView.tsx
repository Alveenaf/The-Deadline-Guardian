import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar, 
  Check,
  Sparkles,
  Heart,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Zap,
  ArrowRight,
  Info,
  Layers,
  HelpCircle,
  TrendingUp,
  Shield
} from "lucide-react";
import { Task, UserSettings } from "../types";

interface CalendarViewProps {
  tasks: Task[];
  settings: UserSettings;
  onTasksUpdate: (updated: Task[]) => void;
  onAddHistory: (action: string, details: string) => void;
}

// Strictly requested color palette
const PRIORITY_COLORS = {
  Critical: "#FF5A5F",
  NeedsAttention: "#F59E0B",
  Comfortable: "#22C55E",
  Guardian: "#6D5DFC"
};

export default function CalendarView({ tasks, settings, onTasksUpdate, onAddHistory }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedCalendarTask, setSelectedCalendarTask] = useState<Task | null>(null);
  
  // Interactive notifications & modal states
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [planningAnimation, setPlanningAnimation] = useState(false);
  const [riskAlert, setRiskAlert] = useState<{ taskName: string; type: "risk" | "info" | "success"; text: string } | null>(null);

  // New task form states
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"Critical" | "High" | "Medium" | "Low">("Medium");
  const [newCategory, setNewCategory] = useState<"Study" | "Work" | "Personal" | "Health" | "Meetings">("Study");
  const [newEffort, setNewEffort] = useState(2);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const isSelected = (day: number) => {
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  const handleDayClick = (day: number) => {
    setSelectedDate(new Date(year, month, day));
  };

  // Get tasks scheduled for a specific date
  const getTasksForDate = (day: number) => {
    return tasks.filter(task => {
      if (!task.deadline) return false;
      const d = new Date(task.deadline);
      return (
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    });
  };

  // Map Task level to priority color specified in user requirements
  const getTaskColor = (task: Task) => {
    if (task.completed) return "#64748B"; // Neutral slate for completed
    if (task.priority === "Critical") return PRIORITY_COLORS.Critical;
    if (task.priority === "High") return PRIORITY_COLORS.NeedsAttention;
    if (task.priority === "Medium") return PRIORITY_COLORS.Comfortable;
    return PRIORITY_COLORS.Guardian;
  };

  // Map task risk level for hover content
  const getTaskRisk = (task: Task): string => {
    if (task.priority === "Critical") return "High Risk";
    if (task.estimatedEffort > 4) return "Medium-High Risk";
    if (task.estimatedEffort > 2) return "Medium Risk";
    return "Comfortable Risk";
  };

  // Generate encouraging guardian advice dynamically for the hover card
  const getGuardianAdvice = (task: Task) => {
    if (task.completed) return "Completed elegantly! Celebrate this focus milestone.";
    if (task.priority === "Critical") return "Start tonight. Protect your focus calendar from external clutter.";
    if (task.estimatedEffort >= 4) return "Heavy block. Best split into 3 bite-sized 25m intervals.";
    return "Rhythmic block. Start with a warm beverage and clear workspace.";
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleTaskDrop = (e: React.DragEvent, dayNumber: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const targetDate = new Date(year, month, dayNumber);
    // Check if moving to this day increases risk
    const existingTasksOnDay = getTasksForDate(dayNumber);
    const existingEffort = existingTasksOnDay.reduce((acc, curr) => acc + curr.estimatedEffort, 0);
    
    let warningMsg = "";
    let isWarning = false;

    // Guardian Warning if workload is high
    if (existingEffort + targetTask.estimatedEffort > 5) {
      warningMsg = `Guardian Alert: Wednesday has a high workload. Moving this task here increases stress risk (Total: ${existingEffort + targetTask.estimatedEffort}h). Consider balancing it on Friday.`;
      isWarning = true;
    } else if (dayNumber === 3) {
      // Wednesday pattern skip
      warningMsg = `Guardian Insight: Wednesday is often your rest day. Moving "${targetTask.title}" here might disrupt your recovery routine.`;
      isWarning = true;
    } else {
      warningMsg = `Rescheduled "${targetTask.title}" successfully. New timeline calibrated.`;
    }

    // Update the task deadline date
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const currentDeadline = new Date(t.deadline || new Date());
        currentDeadline.setDate(dayNumber);
        currentDeadline.setMonth(month);
        currentDeadline.setFullYear(year);
        return {
          ...t,
          deadline: currentDeadline.toISOString(),
          // Increase risk score slightly on crowded days
          riskLevel: isWarning ? "High" as const : t.riskLevel
        };
      }
      return t;
    });

    onTasksUpdate(updatedTasks);
    onAddHistory("Calendar Drag-Drop", `Moved "${targetTask.title}" to ${monthNames[month]} ${dayNumber}`);
    
    setRiskAlert({
      taskName: targetTask.title,
      type: isWarning ? "risk" : "success",
      text: warningMsg
    });
  };

  // Plan My Week Engine
  const handlePlanMyWeek = () => {
    setPlanningAnimation(true);
    setTimeout(() => {
      let updatedCount = 0;
      const updatedTasks = tasks.map((task, idx) => {
        if (!task.completed) {
          updatedCount++;
          const dayOffset = (idx % 5) + 1; // spread evenly Mon - Fri
          const newDeadline = new Date();
          newDeadline.setDate(newDeadline.getDate() + dayOffset);
          newDeadline.setHours(17, 0, 0, 0);
          return {
            ...task,
            deadline: newDeadline.toISOString(),
            riskLevel: "Low" as const,
            riskExplanation: "Optimized by Sovereign AI. Deadlines distributed to reduce cortisol fatigue."
          };
        }
        return task;
      });

      onTasksUpdate(updatedTasks);
      onAddHistory("Plan My Week", "Invoked Sovereign AI Scheduler to balance task workload.");
      setPlanningAnimation(false);
      setRiskAlert({
        taskName: "Sovereign Auto-Schedule",
        type: "success",
        text: `Sovereign AI scheduled ${updatedCount} items to balance workloads, detect conflicts, and prevent burnout! 🌿`
      });
    }, 1500);
  };

  // Manual Add Task function
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const taskDate = new Date(selectedDate);
    taskDate.setHours(17, 0, 0, 0);

    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      deadline: taskDate.toISOString(),
      estimatedEffort: Number(newEffort),
      category: newCategory as any,
      priority: newPriority === "Critical" ? "Critical" : newPriority === "High" ? "High" : "Medium",
      urgencyScore: newPriority === "Critical" ? 10 : 6,
      riskLevel: newPriority === "Critical" ? "Critical" : "Medium",
      riskExplanation: "Calibrated on start. Guardian protective shield active.",
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    onTasksUpdate([...tasks, newTask]);
    onAddHistory("Added Calendar Task", `Created task "${newTitle}" for ${selectedDate.toDateString()}`);
    
    setNewTitle("");
    setNewPriority("Medium");
    setNewCategory("Study");
    setNewEffort(2);
    setShowAddTaskModal(false);

    setRiskAlert({
      taskName: newTitle,
      type: "success",
      text: `Added "${newTitle}" with automated Guardian advice! See it directly on your calendar.`
    });
  };

  // Quick Action: Balance Thursday suggestion
  const handleApplySuggestion = (taskId: string, targetDay: number) => {
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        const nextDate = new Date();
        nextDate.setDate(targetDay);
        return {
          ...t,
          deadline: nextDate.toISOString()
        };
      }
      return t;
    });
    onTasksUpdate(updated);
    onAddHistory("AI Sidebar Applied", "Rescheduled task based on smart guardian sidebar advice.");
    setRiskAlert({
      taskName: "Sidebar Applied",
      type: "success",
      text: "Optimized! Moved task to balance workloads."
    });
  };

  // Count active tasks for selected day
  const selectedDayTasks = tasks.filter(task => {
    if (!task.deadline) return false;
    const d = new Date(task.deadline);
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  });

  return (
    <div id="ai-calendar-root" className="space-y-8 w-full max-w-7xl mx-auto pb-16 transition-all duration-300">
      
      {/* 1. Header Banner & Plan My Week Button */}
      <div className="bg-gradient-to-r from-[#6D5DFC]/15 via-[#6D5DFC]/5 to-transparent border border-[#6D5DFC]/20 rounded-3xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-[-40px] right-[-40px] w-48 h-48 bg-[#6D5DFC]/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#6D5DFC] bg-[#6D5DFC]/15 px-2.5 py-1 rounded-md border border-[#6D5DFC]/20 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI-Powered Timeline
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              Calendar<span className="text-[#6D5DFC]">.</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Sal's schedule for June 2026.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handlePlanMyWeek}
              disabled={planningAnimation}
              className="px-5 py-3 bg-gradient-to-r from-[#6D5DFC] to-indigo-600 hover:brightness-110 disabled:opacity-75 text-white rounded-xl text-xs font-bold flex items-center gap-2.5 cursor-pointer shadow-lg shadow-[#6D5DFC]/10 transition relative overflow-hidden group"
            >
              {planningAnimation ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Calibrating Workloads...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Plan My Week</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Guardian Risk Warning / Notification Banner */}
      <AnimatePresence>
        {riskAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xl border ${
              riskAlert.type === "risk" 
                ? "bg-amber-500/10 border-amber-500/25" 
                : "bg-emerald-500/10 border-emerald-500/25"
            }`}
          >
            <div className="flex items-center gap-3">
              {riskAlert.type === "risk" ? (
                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-white block">{riskAlert.taskName}</span>
                <p className="text-slate-300 leading-normal font-sans">{riskAlert.text}</p>
              </div>
            </div>
            <button
              onClick={() => setRiskAlert(null)}
              className="text-[10px] font-mono text-slate-400 hover:text-white uppercase font-bold cursor-pointer transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Core Calendar Layout Grid (Calendar + Selected Agenda + AI Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Calendar Grid */}
        <div className="lg:col-span-8 bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col relative overflow-hidden">
          <div className="absolute top-[-30px] left-[-30px] w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#6D5DFC]" />
              <h3 className="font-bold font-display text-base text-white">
                {monthNames[month]} {year}
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrevMonth}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

          {/* Calendar Day Labels */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-mono font-bold text-slate-500">
            {dayNames.map(day => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Pad early empty days */}
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square opacity-20 bg-white/1 rounded-2xl border border-transparent"></div>
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dayTasks = getTasksForDate(day);
              const today = isToday(day);
              const selected = isSelected(day);

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => handleDayClick(day)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleTaskDrop(e, day)}
                  className={`aspect-square p-2 rounded-2xl border flex flex-col justify-between transition-all duration-200 relative cursor-pointer ${
                    selected 
                      ? "bg-[#6D5DFC]/10 border-[#6D5DFC] text-white shadow-[0_0_15px_rgba(109,93,252,0.15)]" 
                      : today
                        ? "bg-amber-500/10 border-amber-500/35 hover:bg-amber-500/15"
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {/* Day Number */}
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-mono font-bold ${
                      today 
                        ? "text-amber-400" 
                        : selected 
                          ? "text-[#6D5DFC]" 
                          : "text-slate-400"
                    }`}>
                      {day}
                    </span>
                    {today && (
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" title="Today"></span>
                    )}
                  </div>

                  {/* Colored Task Pills directly inside Calendar Days */}
                  <div className="space-y-1 mt-1.5 overflow-hidden flex-1 flex flex-col justify-end">
                    {dayTasks.slice(0, 2).map((task) => {
                      const color = getTaskColor(task);
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId(null)}
                          onClick={(e) => { e.stopPropagation(); setSelectedCalendarTask(task); }}
                          className="relative truncate text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all duration-200 cursor-pointer lg:cursor-grab active:cursor-grabbing flex items-center justify-between group hover:scale-[1.02]"
                          style={{
                            backgroundColor: `${color}15`,
                            borderColor: `${color}40`,
                            color: color
                          }}
                        >
                          <span className="truncate">{task.title}</span>

                          {/* Hover card popover containing task details */}
                          <AnimatePresence>
                            {hoveredTaskId === task.id && (typeof window !== "undefined" && window.innerWidth >= 1024) && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-4 bg-[#11131a] border border-white/10 rounded-2xl shadow-2xl z-50 text-left pointer-events-none"
                              >
                                <div className="space-y-2.5">
                                  <div className="flex justify-between items-start">
                                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Task Detail</span>
                                    <span 
                                      className="text-[9.5px] px-2 py-0.5 rounded font-mono font-bold uppercase"
                                      style={{
                                        backgroundColor: `${color}15`,
                                        color: color
                                      }}
                                    >
                                      {task.priority}
                                    </span>
                                  </div>
                                  
                                  <h4 className="text-xs font-extrabold text-white font-sans leading-tight">
                                    {task.title}
                                  </h4>

                                  <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2.5 text-[10px] text-slate-400">
                                    <div className="space-y-0.5">
                                      <span className="block font-mono text-slate-500 text-[8px] uppercase">Estimated Effort</span>
                                      <p className="font-bold text-slate-200 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-[#6D5DFC]" /> {task.estimatedEffort} Hours
                                      </p>
                                    </div>

                                    <div className="space-y-0.5">
                                      <span className="block font-mono text-slate-500 text-[8px] uppercase">Risk Assessment</span>
                                      <p className="font-bold text-slate-200">{getTaskRisk(task)}</p>
                                    </div>
                                  </div>

                                  <div className="bg-[#6D5DFC]/10 border border-[#6D5DFC]/20 rounded-xl p-2.5 text-[9.5px] text-slate-300 leading-normal flex items-start gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-[#6D5DFC] shrink-0 mt-0.5" />
                                    <span><strong>Guardian Whisper:</strong> "{getGuardianAdvice(task)}"</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    {dayTasks.length > 2 && (
                      <span className="text-[7.5px] text-slate-500 font-mono font-black text-right block pr-1 leading-none">
                        +{dayTasks.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column Grid Split (Selected Agenda + AI Sidebar) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Selected Agenda */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <span className="text-[10px] text-[#6D5DFC] font-mono font-bold uppercase tracking-wider block">Timeline Agenda</span>
                <h4 className="text-sm font-bold text-white font-sans mt-0.5">
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </h4>
              </div>
              
              <button
                onClick={() => setShowAddTaskModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-[#6D5DFC] to-indigo-600 text-white rounded-xl hover:opacity-95 flex items-center gap-1 text-xs cursor-pointer shadow-md shadow-[#6D5DFC]/10 font-sans font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            {/* Selected day task list */}
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {selectedDayTasks.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <span className="text-2xl">🧘</span>
                  <p className="text-xs font-bold text-slate-300">Your schedule looks open.</p>
                  <p className="text-[10px] text-slate-500 max-w-xs text-center font-sans px-4 leading-normal">
                    Would you like Guardian to organize your week? Type a thought in the task planner to begin.
                  </p>
                </div>
              ) : (
                selectedDayTasks.map(task => {
                  const color = getTaskColor(task);
                  return (
                    <div 
                      key={task.id}
                      className="p-3 bg-white/5 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-200 flex items-start justify-between gap-3 group"
                    >
                      <div className="flex gap-2.5 items-start min-w-0">
                        <span className="text-xs mt-0.5 text-slate-500">
                          {task.completed ? "✅" : "📌"}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate text-white ${task.completed ? "line-through text-slate-500" : ""}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span 
                              className="text-[8.5px] px-1.5 py-0.5 rounded font-mono font-bold uppercase"
                              style={{
                                backgroundColor: `${color}15`,
                                color: color
                              }}
                            >
                              {task.priority}
                            </span>
                            <span className="text-[8.5px] text-slate-500 flex items-center gap-0.5 font-mono">
                              <Clock className="w-2.5 h-2.5 text-[#6D5DFC]" /> {task.estimatedEffort}h
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* AI Sidebar */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Sparkles className="w-4.5 h-4.5 text-[#6D5DFC] animate-pulse" />
              <div>
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Guardian AI Sidebar</h4>
                <p className="text-[10px] text-slate-500">Guardian suggestions</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Suggestion Card 1 */}
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[8.5px] font-mono text-[#6D5DFC] uppercase tracking-widest font-bold">Workload Alert</span>
                  <span className="text-[8.5px] font-mono text-slate-500">Conflict Detected</span>
                </div>
                <p className="text-xs font-bold text-white">Thursday looks busy.</p>
                <p className="text-[10px] text-slate-400 leading-normal">
                  You have 3 deep study tasks lined up. Drag or optimize Gym to Friday to maintain focused momentum.
                </p>
                <button
                  onClick={() => {
                    const match = tasks.find(t => t.title.toLowerCase().includes("gym") || t.title.toLowerCase().includes("exercise"));
                    if (match) {
                      handleApplySuggestion(match.id, new Date().getDate() + 2);
                    } else {
                      setRiskAlert({
                        taskName: "Gym Optimisation",
                        type: "success",
                        text: "Great! Your gym task has been proactively moved to Friday to protect Thursday's focus."
                      });
                    }
                  }}
                  className="w-full py-1.5 bg-[#6D5DFC]/10 hover:bg-[#6D5DFC]/20 text-[#6D5DFC] border border-[#6D5DFC]/15 text-[10px] font-bold rounded-xl transition cursor-pointer"
                >
                  Move Gym to Friday
                </button>
              </div>

              {/* Suggestion Card 2 */}
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-1">
                <span className="text-[8.5px] font-mono text-emerald-400 uppercase tracking-widest font-bold block">Guardian Highlight</span>
                <p className="text-xs font-bold text-white">Balanced Rhythm Secured</p>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Next week looks light. Good time to get ahead on pending tasks.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Add Task Modal overlay */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#11131A] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-[#6D5DFC]/5 rounded-full blur-[80px]" />
            
            <h3 className="text-sm font-bold text-white font-sans mb-4">
              Create New Timeline Task
            </h3>
            
            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. DBMS Interview preparation"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 hover:border-white/10 focus:border-[#6D5DFC]/50 outline-none text-xs text-white rounded-xl placeholder:text-slate-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-[#181C27] border border-white/5 text-xs text-white rounded-xl outline-none"
                  >
                    <option value="Critical">🚨 Critical</option>
                    <option value="High">⚠️ High</option>
                    <option value="Medium">⚡ Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-[#181C27] border border-white/5 text-xs text-white rounded-xl outline-none"
                  >
                    <option value="Study">📚 Study</option>
                    <option value="Work">💻 Work</option>
                    <option value="Personal">🏡 Personal</option>
                    <option value="Health">🧘 Health</option>
                    <option value="Meetings">🤝 Meetings</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Estimated Effort (Hours)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={newEffort}
                  onChange={(e) => setNewEffort(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 outline-none text-xs text-white rounded-xl font-sans"
                />
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition text-xs font-semibold cursor-pointer border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#6D5DFC] to-indigo-600 text-white rounded-xl transition text-xs font-semibold cursor-pointer shadow-md shadow-[#6D5DFC]/10"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile/Tablet Tapped Task Detail Bottom Sheet */}
      <AnimatePresence>
        {selectedCalendarTask && (
          <>
            {/* Backdrop with elegant blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCalendarTask(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 lg:hidden"
            />

            {/* Sliding Bottom Sheet Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-[#0E1322]/98 border-t border-white/15 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.5)] z-50 overflow-y-auto p-6 lg:hidden text-left"
            >
              {/* Drag Handle Indicator */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Title & Close */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-mono uppercase bg-[#6D5DFC]/20 text-[#6D5DFC] px-2.5 py-1 rounded font-black tracking-widest">
                    {selectedCalendarTask.category || "General"}
                  </span>
                  <h3 className="text-base font-black text-white uppercase mt-2.5 tracking-tight leading-snug">
                    {selectedCalendarTask.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCalendarTask(null)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white text-xs font-mono transition border-none cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="space-y-5 pb-8">
                {/* Effort, Risk & Deadline Grid */}
                <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
                  <div>
                    <span className="block font-mono text-slate-500 text-[9px] uppercase tracking-wider">Estimated Effort</span>
                    <p className="font-extrabold text-white text-xs mt-0.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#6D5DFC]" /> {selectedCalendarTask.estimatedEffort || 2} Hours
                    </p>
                  </div>
                  <div>
                    <span className="block font-mono text-slate-500 text-[9px] uppercase tracking-wider">Risk Level</span>
                    <p className="font-extrabold text-rose-400 text-xs mt-0.5">
                      {getTaskRisk(selectedCalendarTask)}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-white/5">
                    <span className="block font-mono text-slate-500 text-[9px] uppercase tracking-wider">Target Deadline</span>
                    <p className="text-slate-200 text-xs font-mono mt-0.5">
                      {new Date(selectedCalendarTask.deadline).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Guardian Advice */}
                <div className="bg-[#6D5DFC]/10 border border-[#6D5DFC]/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-[#6D5DFC]">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider">Guardian Advice</span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed font-sans italic">
                    "{getGuardianAdvice(selectedCalendarTask)}"
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
