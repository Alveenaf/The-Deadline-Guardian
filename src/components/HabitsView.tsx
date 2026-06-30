import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Heart, 
  Flame, 
  Check, 
  Plus, 
  Droplet, 
  BookOpen, 
  Compass, 
  Zap, 
  Moon, 
  Smile,
  Trash2,
  TrendingUp,
  Dumbbell,
  Clock,
  Award,
  ChevronRight,
  Info,
  Calendar,
  AlertCircle,
  Sparkle,
  Shield,
  Lightbulb,
  Trophy
} from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";

interface Habit {
  id: string;
  name: string;
  category: "Study" | "Exercise" | "Reading" | "Water" | "Sleep" | "Other";
  streak: number;
  completedToday: boolean;
  isMissed?: boolean;
  color: string; // Tailwind class
  icon: string; // Icon identifier
}

interface HabitsViewProps {
  onAddHistory: (action: string, details: string) => void;
}

const DEFAULT_HABITS: Habit[] = [
  { id: "h-1", name: "Deep Study Block", category: "Study", streak: 7, completedToday: false, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", icon: "book" },
  { id: "h-2", name: "Physical Exercise", category: "Exercise", streak: 5, completedToday: false, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: "dumbbell" },
  { id: "h-3", name: "Mindful Reading", category: "Reading", streak: 12, completedToday: false, color: "text-pink-400 bg-pink-500/10 border-pink-500/20", icon: "reading" },
  { id: "h-4", name: "Hydrate (8 glasses)", category: "Water", streak: 14, completedToday: false, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "droplet" },
  { id: "h-5", name: "Restful Sleep (8h)", category: "Sleep", streak: 8, completedToday: false, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: "moon" }
];

export default function HabitsView({ onAddHistory }: HabitsViewProps) {
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem("guardian-habits-v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_HABITS;
      }
    }
    return DEFAULT_HABITS;
  });

  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem("guardian-habits-v2");
      if (saved) {
        try {
          setHabits(JSON.parse(saved));
        } catch (e) {}
      }
    };
    window.addEventListener("guardian-habits-updated", handleUpdate);
    return () => window.removeEventListener("guardian-habits-updated", handleUpdate);
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<{ id: string; name: string } | null>(null);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitCategory, setNewHabitCategory] = useState<"Study" | "Exercise" | "Reading" | "Water" | "Sleep" | "Other">("Study");
  const [newHabitIcon, setNewHabitIcon] = useState("sparkles");

  // Supportive message overlay when they skip or experience a backlog/missed habit
  const [supportiveFeedback, setSupportiveFeedback] = useState<string | null>(null);

  // Daily Check-in state
  const [selectedCheckIn, setSelectedCheckIn] = useState<string | null>(null);
  const [checkInResponse, setCheckInResponse] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("guardian-habits-v2", JSON.stringify(habits));
  }, [habits]);

  const handleToggleHabit = (id: string) => {
    const updated = habits.map(h => {
      if (h.id === id) {
        const completed = !h.completedToday;
        return {
          ...h,
          completedToday: completed,
          isMissed: completed ? false : h.isMissed, // Reset missed if checked
          streak: completed ? h.streak + 1 : Math.max(0, h.streak - 1)
        };
      }
      return h;
    });

    setHabits(updated);
    const target = habits.find(h => h.id === id);
    if (target) {
      if (!target.completedToday) {
        onAddHistory("Habit Completed", `Successfully completed habit "${target.name}" and grew streak to ${target.streak + 1} days!`);
      } else {
        onAddHistory("Habit Reopened", `Unchecked "${target.name}". Streak updated.`);
      }
    }
  };

  const handleMarkMissed = (id: string) => {
    const updated = habits.map(h => {
      if (h.id === id) {
        return {
          ...h,
          isMissed: !h.isMissed,
          completedToday: false // Reset completed if marked missed
        };
      }
      return h;
    });
    setHabits(updated);
    const target = habits.find(h => h.id === id);
    if (target && !target.isMissed) {
      setSupportiveFeedback(`It's completely okay to take a pause on "${target.name}". Let's continue tomorrow with a fresh mind. 🤍`);
      onAddHistory("Habit Postponed", `Marked "${target.name}" as missed with Guardian support.`);
    }
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    let color = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    if (newHabitCategory === "Exercise") color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (newHabitCategory === "Reading") color = "text-pink-400 bg-pink-500/10 border-pink-500/20";
    if (newHabitCategory === "Water") color = "text-blue-400 bg-blue-500/10 border-blue-500/20";
    if (newHabitCategory === "Sleep") color = "text-purple-400 bg-[#151D33]/40 border-purple-500/20";

    const newHabit: Habit = {
      id: "h-" + Date.now(),
      name: newHabitName,
      category: newHabitCategory,
      streak: 0,
      completedToday: false,
      color,
      icon: newHabitIcon
    };

    setHabits([...habits, newHabit]);
    onAddHistory("Created Habit", `Started tracking new habit "${newHabitName}"`);
    setNewHabitName("");
    setShowAddModal(false);
  };

  const handleAddSuggestedHabit = (name: string, category: any, icon: string, color: string) => {
    const newHabit: Habit = {
      id: "h-" + Date.now(),
      name,
      category,
      streak: 0,
      completedToday: false,
      color,
      icon
    };
    setHabits([...habits, newHabit]);
    onAddHistory("Accepted Smart Suggestion", `Added suggested habit: "${name}"`);
    setSupportiveFeedback(`Excellent choice! We have initialized tracking for your new study ritual. 🌱`);
  };

  const handleDeleteHabit = (id: string, name: string) => {
    setHabitToDelete({ id, name });
  };

  const confirmDeleteHabit = () => {
    if (!habitToDelete) return;
    const { id, name } = habitToDelete;
    setHabits(habits.filter(h => h.id !== id));
    onAddHistory("Deleted Habit", `Stopped tracking habit "${name}"`);
    setHabitToDelete(null);
  };

  const getIconElement = (iconName: string, className: string) => {
    switch (iconName) {
      case "droplet": return <Droplet className={className} />;
      case "compass": return <Compass className={className} />;
      case "book": return <BookOpen className={className} />;
      case "reading": return <BookOpen className={className} />;
      case "dumbbell": return <Dumbbell className={className} />;
      case "moon": return <Moon className={className} />;
      case "smile": return <Smile className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  // Fun visual metrics
  const completedCount = habits.filter(h => h.completedToday).length;
  const totalCount = habits.length;
  const overallCompliance = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const maxStreak = habits.reduce((max, h) => h.streak > max ? h.streak : max, 0);

  // Weekly Heatmap simulation data (representing completion rate of last 7 days)
  const heatmapData = [
    { day: "Mon", status: "high", completion: 100, label: "5/5 completed" },
    { day: "Tue", status: "medium", completion: 60, label: "3/5 completed" },
    { day: "Wed", status: "low", completion: 20, label: "1/5 completed (Took Rest)" },
    { day: "Thu", status: "high", completion: 80, label: "4/5 completed" },
    { day: "Fri", status: "high", completion: 100, label: "5/5 completed" },
    { day: "Sat", status: "medium", completion: 40, label: "2/5 completed" },
    { day: "Sun", status: "none", completion: 0, label: "Mindful Pause day" }
  ];

  return (
    <div id="habits-refined-view" className="space-y-8 w-full max-w-7xl mx-auto pb-16 transition-all">
      
      {/* 1. Headspace/Forest Inspired Header Banner */}
      <div className="bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-transparent border border-pink-500/15 rounded-3xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-pink-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              Daily Rituals & Streaks<span className="text-pink-400">.</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Sal's habits today.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:brightness-110 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-pink-500/10 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Habit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supportive Feedback Alert (Kindness Over Judgment) */}
      <AnimatePresence>
        {supportiveFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-[#11131e] border border-pink-500/20 rounded-2xl flex items-center justify-between gap-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🤍</span>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                {supportiveFeedback}
              </p>
            </div>
            <button
              onClick={() => setSupportiveFeedback(null)}
              className="text-[10px] font-mono text-pink-400 hover:text-pink-300 uppercase font-bold cursor-pointer transition"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Apple Fitness Circular Progress & Duolingo Streaks Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Apple Fitness Inspired Concentric Compliance Ring */}
        <div className="lg:col-span-4 bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center space-y-6 relative overflow-hidden shadow-xl min-h-[300px]">
          <div className="absolute top-[-40px] left-[-40px] w-24 h-24 bg-pink-500/15 rounded-full blur-2xl pointer-events-none" />
          
          <div className="text-center">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider font-sans">Today's Habits Ring</h3>
            <p className="text-[10px] text-slate-500">Concentric ritual completion rate</p>
          </div>

          {/* Fitness Styled Progress Ring */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Background Circle */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="64"
                className="stroke-slate-800/60 fill-none"
                strokeWidth="12"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="64"
                className="stroke-pink-500 fill-none"
                strokeWidth="12"
                strokeDasharray="401.92"
                strokeDashoffset={401.92 - (401.92 * overallCompliance) / 100}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 401.92 }}
                animate={{ strokeDashoffset: 401.92 - (401.92 * overallCompliance) / 100 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>

            {/* Absolute Center percentage */}
            <div className="text-center space-y-0.5">
              <span className="text-3xl font-mono font-black text-white">{overallCompliance}%</span>
              <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 block font-bold">Done</span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <span className="text-xs text-slate-300 font-bold font-sans block">
              {completedCount} of {totalCount || 0} Habits Logged
            </span>
            <span className="text-[9px] text-pink-400 font-mono uppercase tracking-widest block font-bold">
              {overallCompliance === 100 ? "🌱 Sovereign Day Complete!" : "Maintain soft rhythm"}
            </span>
          </div>
        </div>

        {/* Duolingo Inspired Streaks & Milestone Cards (Right Side) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Active Streaks Dashboard */}
          <div className="bg-gradient-to-b from-purple-500/10 to-purple-950/20 border border-purple-500/20 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden shadow-xl">
            <div className="absolute top-[-30px] right-[-30px] w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400 font-extrabold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-purple-500 stroke-none animate-bounce" />
              </span>
              <h3 className="text-lg font-bold text-white font-sans">Active Habits Streaks</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                7-day streak. 92% consistency this week.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3.5 mt-5 border-t border-purple-500/10 pt-4">
              <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-center space-y-1">
                <span className="text-[9px] font-mono text-slate-500 block uppercase">Habit Streak</span>
                <span className="text-xl font-mono font-black text-purple-400">7 Days</span>
              </div>
              <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-center space-y-1">
                <span className="text-[9px] font-mono text-slate-500 block uppercase">Focus Sessions</span>
                <span className="text-xl font-mono font-black text-amber-400">10 Seps</span>
              </div>
              <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-center space-y-1">
                <span className="text-[9px] font-mono text-slate-500 block uppercase">Consistency</span>
                <span className="text-xl font-mono font-black text-emerald-400">92%</span>
              </div>
            </div>
          </div>

          {/* Weekly Heatmap Completion Visualization */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-pink-400" />
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Weekly Heatmap</h3>
                </div>
                <span className="text-[9px] font-mono text-pink-400 uppercase tracking-widest font-extrabold bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/15">
                  Completion Index
                </span>
              </div>
              
              {/* Simple Heatmap Grid of 7 Days */}
              <div className="grid grid-cols-7 gap-2.5 mt-5">
                {heatmapData.map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-1.5 group cursor-help" title={d.label}>
                    <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">{d.day}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                      ${d.status === "high" 
                        ? "bg-pink-500/20 border border-pink-500 text-pink-400 scale-105" 
                        : d.status === "medium" 
                        ? "bg-pink-500/10 border border-pink-500/40 text-pink-400" 
                        : d.status === "low" 
                        ? "bg-slate-800 border border-white/5 text-slate-500" 
                        : "bg-slate-900 border border-dashed border-white/5 text-slate-700"}`}>
                      {d.completion > 0 ? (
                        <span className="text-[10px] font-mono font-bold">{d.completion}%</span>
                      ) : (
                        <Smile className="w-3.5 h-3.5 opacity-60 text-slate-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[9px] text-slate-400 leading-normal italic mt-4 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Click any day to see details.</span>
            </p>
          </div>

        </div>

      </div>

      {/* 3. Guardian Insights & Coaching Bubble */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Guardian Coaching Insights */}
        <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 space-y-4 shadow-md flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
              <Compass className="w-4 h-4 text-indigo-400" />
              <div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">What Guardian Learned</h3>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-2.5">
                <span className="text-indigo-400 text-sm shrink-0">🌙</span>
                <div className="text-xs space-y-0.5 text-slate-200">
                  <p className="font-bold">"You study better in the evening."</p>
                  <p className="text-slate-400 text-[11px]">We noticed high deep work performance metrics between 6 PM and 10 PM. Leverage this window!</p>
                </div>
              </div>

              <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-xl flex items-start gap-2.5">
                <span className="text-pink-400 text-sm shrink-0">📅</span>
                <div className="text-xs space-y-0.5 text-slate-200">
                  <p className="font-bold">"You skipped Wednesdays 3 times this month."</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Suggestions (Based on tasks / Milestones) */}
        <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 space-y-4 shadow-md flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Guardian Smart Suggestions</h3>
                <p className="text-[10px] text-slate-500">Coaching suggestions derived from your active schedule</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-2xl flex items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-pink-400 uppercase tracking-widest font-bold">Upcoming Milestone Detected</span>
                  <p className="font-bold text-white">Interview Coming Up?</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">Let's create a daily study habit of 20 minutes to comfortably rehearse without final-night stress.</p>
                </div>
                <button
                  onClick={() => handleAddSuggestedHabit("Daily Interview Study", "Study", "book", "text-indigo-400 bg-indigo-500/10 border-indigo-500/20")}
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-[10px] font-bold transition cursor-pointer shrink-0"
                >
                  Activate Habit
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. TODAY'S HABITS: The Heart of the Dashboard */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-pink-400" />
            <h3 className="font-extrabold uppercase font-sans text-xs text-white tracking-wider">Today's Habits Checklist</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Check to expand your streaks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {habits.map(habit => (
            <div 
              key={habit.id}
              className={`bg-white/5 border border-white/5 hover:border-white/10 rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 relative group
                ${habit.completedToday ? "bg-emerald-500/5 border-emerald-500/20 shadow-inner" : ""}
                ${habit.isMissed ? "bg-slate-900/40 opacity-70 border-dashed" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition duration-300 ${habit.color}`}>
                    {getIconElement(habit.icon, "w-5 h-5")}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono font-bold tracking-wider block uppercase">{habit.category}</span>
                    <h4 className={`text-xs font-bold font-sans mt-0.5 text-white transition-all
                      ${habit.completedToday ? "line-through text-slate-500" : ""}
                      ${habit.isMissed ? "text-slate-600 italic" : ""}`}>
                      {habit.name}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteHabit(habit.id, habit.name)}
                  className="opacity-0 group-hover:opacity-100 p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                  title="Remove Habit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Habit Actions Footer (Clean Tick checkbox and skip support) */}
              <div className="flex justify-between items-center mt-6 pt-3.5 border-t border-white/5">
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-slate-300">{habit.streak} day streak</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Skip Option (Non-judgmental) */}
                  {!habit.completedToday && (
                    <button
                      onClick={() => handleMarkMissed(habit.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold transition cursor-pointer
                        ${habit.isMissed 
                          ? "bg-slate-800 text-slate-400 border border-white/5" 
                          : "bg-white/5 hover:bg-white/10 border border-white/5 text-slate-500 hover:text-slate-400"}`}
                      title="Postpone or skip non-judgmentally"
                    >
                      {habit.isMissed ? "Support Skipped 🤍" : "Skip Today"}
                    </button>
                  )}

                  {/* Complete Checkbox */}
                  <button
                    onClick={() => handleToggleHabit(habit.id)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      habit.completedToday 
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        : "bg-[#121214] hover:bg-white/10 border border-white/10 text-slate-300"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{habit.completedToday ? "Done!" : "Complete"}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Check-In Widget (Wellness and energy tracking) */}
      <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-[-30px] left-[-30px] w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <Smile className="w-4.5 h-4.5 text-pink-400" />
          <div>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Daily Headspace Check-in</h3>
            <p className="text-[10px] text-slate-500">Gauge your cognitive stamina to let Guardian calibrate protective boundaries</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: "full", label: "🌟 Full Charge", response: "Superb! Your cognitive reserves are optimal today. This is the perfect window to tackle high-effort 'Critical' milestones in your active task registry." },
            { id: "steady", label: "🔋 Steady Flow", response: "Excellent. You are in a balanced, sustainable focus flow. Use standard focus timers with brief 5-minute breathing spaces to maintain this soft rhythm." },
            { id: "sluggish", label: "😴 Low Fuel", response: "Duly noted. You are running on low fuel. We recommend starting with minor, low-effort reading or logging, and listening to the ambient water tracks." },
            { id: "burnout", label: "🚨 Critical Fatigue", response: "Guardian Warning: Critical fatigue detected. Please utilize our 'Overwhelmed? Save My Day' rescue protocol on the home page or try our breathing exercises now." }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                setSelectedCheckIn(opt.id);
                setCheckInResponse(opt.response);
                onAddHistory("Daily Check-in Completed", `Logged energy as "${opt.label.split(" ")[1]}"`);
              }}
              className={`p-3 rounded-2xl border text-xs font-bold transition duration-200 cursor-pointer text-left
                ${selectedCheckIn === opt.id 
                  ? "bg-pink-500/10 border-pink-500 text-pink-400" 
                  : "bg-[#121214] border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Dynamic Coach Response Bubble */}
        <AnimatePresence>
          {checkInResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-2xl flex items-start gap-3 relative overflow-hidden"
            >
              <Sparkles className="w-4 h-4 text-pink-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-pink-400 font-bold uppercase tracking-wider">Guardian Strategic Calibrator</span>
                <p className="text-slate-200 text-xs leading-relaxed font-sans">{checkInResponse}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Achievements Section (Duolingo style medals) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4.5 h-4.5 text-pink-400" />
          <h3 className="font-extrabold uppercase font-sans text-xs text-white tracking-wider">Active Habit Achievements</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:border-pink-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
              <Trophy className="w-6 h-6 text-pink-400 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">Consistency Master</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Maintain any habit for 10 days straight.</p>
              <span className="text-[8.5px] font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded mt-1 inline-block font-bold">12 Days Active</span>
            </div>
          </div>

          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:border-purple-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
              <Flame className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">Super Streaks</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Reach a 7-day milestone across Study habits.</p>
              <span className="text-[8.5px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded mt-1 inline-block font-bold">7/7 Days Achieved</span>
            </div>
          </div>

          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:border-indigo-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
              <Compass className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-white">Deep Focus Habit</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Complete any Pomodoro session alongside Reading.</p>
              <span className="text-[8.5px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded mt-1 inline-block font-bold">Unlocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Habit Modal overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#11131A] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-pink-500/5 rounded-full blur-[80px]" />
            
            <h3 className="text-sm font-bold text-white font-sans mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" /> Add New Habit Ritual
            </h3>
            
            <form onSubmit={handleCreateHabit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Habit Name / Description</label>
                <input
                  type="text"
                  required
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  placeholder="e.g. Read 15 minutes before bed"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/5 hover:border-white/10 focus:border-pink-500/50 outline-none text-xs text-white rounded-xl placeholder:text-slate-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Category</label>
                  <select
                    value={newHabitCategory}
                    onChange={(e) => setNewHabitCategory(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-[#181C27] border border-white/5 text-xs text-white rounded-xl outline-none"
                  >
                    <option value="Study">📚 Study / Work</option>
                    <option value="Exercise">🏃 Exercise / Gym</option>
                    <option value="Reading">📖 Reading</option>
                    <option value="Water">💧 Water</option>
                    <option value="Sleep">😴 Sleep</option>
                    <option value="Other">✨ Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono uppercase font-bold">Select Icon</label>
                  <select
                    value={newHabitIcon}
                    onChange={(e) => setNewHabitIcon(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#181C27] border border-white/5 text-xs text-white rounded-xl outline-none"
                  >
                    <option value="sparkles">✨ Sparkles</option>
                    <option value="droplet">💧 Water</option>
                    <option value="compass">🧭 Zen Breathing</option>
                    <option value="book">📚 Study / Reading</option>
                    <option value="dumbbell">🏃 Physical / Exercise</option>
                    <option value="moon">🌙 Sleep / Relax</option>
                    <option value="smile">😊 Mindful Reflection</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition text-xs font-semibold cursor-pointer border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl transition text-xs font-semibold cursor-pointer shadow-md shadow-pink-500/10"
                >
                  Start Tracking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={habitToDelete !== null}
        onClose={() => setHabitToDelete(null)}
        onConfirm={confirmDeleteHabit}
        title="Delete Habit"
        message={`Are you sure you want to delete the habit "${habitToDelete?.name}"? This will stop tracking your daily streak.`}
        confirmText="Delete"
        cancelText="Cancel"
        severity="danger"
      />

    </div>
  );
}
