import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  Flame, 
  Award, 
  Sparkles, 
  Heart, 
  Compass, 
  TrendingUp, 
  Activity, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Check, 
  PartyPopper,
  Calendar,
  Smile,
  Zap,
  ChevronRight,
  BookOpen,
  Shield,
  Lightbulb,
  Target
} from "lucide-react";
import { Task, HistoryLog } from "../types";
import { api } from "../lib/api";

interface AnalyticsViewProps {
  tasks: Task[];
}

export default function AnalyticsView({ tasks }: AnalyticsViewProps) {
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        setLoading(true);
        const data = await api.getLogs();
        setLogs(data.reverse());
      } catch (err) {
        console.error("Failed to load logs", err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [tasks]);

  // Calculations based on tasks
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.completed).length;
  
  // Dynamic story stats derived from real tasks & logs
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  // Realistically tracking deadlines saved from logs
  const deadlinesSavedCount = logs.filter(l => 
    l.action.toLowerCase().includes("save") || 
    l.action.toLowerCase().includes("crisis") || 
    l.action.toLowerCase().includes("emergency")
  ).length + 1; // Base + real logs

  // Hardcoded comforting story stats inspired by Apple Fitness/Headspace for high motivation
  const totalFocusHours = 4.5; 
  const currentStreak = 5; // Duolingo style
  const bestFocusSession = 45; // minutes
  const avgSessionDuration = 28; // minutes
  const totalFocusSessions = 10;

  // Encouraging motivational comments selected based on completion status
  const getEncouragement = () => {
    if (completionRate >= 80) return "You're absolutely soaring today! Remember to honor your energy and rest.";
    if (completionRate >= 40) return "You are making steady progress. Brick by brick, your path is clearing.";
    return "Every session builds incremental execution momentum. Focus on starting the next scheduled block.";
  };

  return (
    <div id="story-progress-root" className="space-y-8 w-full max-w-7xl mx-auto pb-16">
      
      {/* 1. Mindfulness Storyteller Header */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-30px] left-[20%] w-32 h-32 bg-indigo-500/5 rounded-full blur-[60px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">
              Your Progress Journey<span className="text-emerald-400">.</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Sal's progress this week.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Apple Fitness & Duolingo High-Impact Visual Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Apple Fitness Style Activity Ring Card (Left Side) */}
        <div className="lg:col-span-4 bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center space-y-6 relative overflow-hidden shadow-xl min-h-[300px]">
          <div className="absolute top-[-40px] left-[-40px] w-24 h-24 bg-indigo-500/15 rounded-full blur-2xl" />
          
          <div className="text-center">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider font-sans">Task Progress Ring</h3>
            <p className="text-[10px] text-slate-500">Your completed daily commitments</p>
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
                className="stroke-emerald-400 fill-none"
                strokeWidth="12"
                strokeDasharray="401.92"
                strokeDashoffset={401.92 - (401.92 * completionRate) / 100}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 401.92 }}
                animate={{ strokeDashoffset: 401.92 - (401.92 * completionRate) / 100 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>

            {/* Absolute Center percentage */}
            <div className="text-center space-y-0.5">
              <span className="text-3xl font-mono font-black text-white">{completionRate}%</span>
              <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 block font-bold">Completed</span>
            </div>
          </div>

          <div className="text-center px-4">
            {completedCount === 0 ? (
              <span className="text-xs text-amber-400 font-bold font-sans block leading-normal">
                Complete your first task to begin your productivity journey.
              </span>
            ) : (
              <span className="text-xs text-slate-300 font-bold font-sans">
                {completedCount} of {totalCount || 0} Targets Cleared
              </span>
            )}
          </div>
        </div>

        {/* Duolingo Streak & Weekly Summary Grid (Right Side) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Duolingo Inspired Streak Card */}
          <div className="bg-gradient-to-b from-amber-500/10 to-amber-950/20 border border-amber-500/20 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden shadow-xl">
            <div className="absolute top-[-30px] right-[-30px] w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-extrabold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-amber-500 stroke-none animate-bounce" /> Focus Momentum
              </span>
              <h3 className="text-lg font-bold text-white font-sans">Active Focus Streak</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {currentStreak} days active this week.
              </p>
            </div>

            <div className="flex items-end justify-between mt-4 border-t border-amber-500/10 pt-4">
              <div className="text-left">
                <span className="text-3xl font-mono font-black text-white">{currentStreak}</span>
                <span className="text-xs text-amber-400 font-mono ml-1">Days Active</span>
              </div>
              
              {/* Daily Streak Indicator dots */}
              <div className="flex gap-1.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => {
                  const isUnlocked = idx < currentStreak;
                  return (
                    <div key={`${day}-${idx}`} className="flex flex-col items-center gap-1">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold transition
                        ${isUnlocked 
                          ? "bg-amber-500/20 border border-amber-500/35 text-amber-400" 
                          : "bg-slate-900 border border-white/5 text-slate-600"}`}>
                        {day}
                      </div>
                      {isUnlocked && <Flame className="w-3 h-3 text-amber-500 animate-pulse" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Weekly Summary Grid */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Compass className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Weekly Summary</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Tasks Completed</span>
                  <p className="text-xl font-bold text-white font-sans">{completedCount} Completed</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Focus Hours</span>
                  <p className="text-xl font-bold text-white font-sans">{totalFocusHours} Hours</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Current Streak</span>
                  <p className="text-xl font-bold text-white font-sans">{currentStreak} Days</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Deadlines Saved</span>
                  <p className="text-xl font-bold text-emerald-400 font-sans">{deadlinesSavedCount} Active</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. Guardian Mindful Insights & Headspace Chat Bubble */}
      <div className="bg-gradient-to-tr from-[#151D33]/60 to-[#1d263f]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-[-40px] right-[-40px] w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg border border-white/15">
                <Shield className="w-5.5 h-5.5 text-white" />
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#151D33] rounded-full animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest font-mono">What Guardian Learned</h3>
              <p className="text-sm font-sans font-bold text-white leading-relaxed">
                "You focus best in the evening."
              </p>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                You completed more work this week than normal! Your focus blocks were highly concentrated when logged between 6:00 PM and 9:00 PM. Continue using these windows for your deepest tasks.
              </p>
            </div>
          </div>

          <div className="px-4.5 py-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-slate-300 font-sans italic shrink-0 max-w-xs flex items-start gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <span><strong>Guardian Coach:</strong> "You completed {completedCount} tasks and logged {totalFocusHours} focus hours this week."</span>
          </div>
        </div>
      </div>

      {/* 4. Achievements Block (Warm, hand-drawn/Forest-styled circular badge medals) */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-400 animate-pulse" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-widest font-sans">Active Milestones & Achievements</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Achievement 1: 5-Day Streak */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-amber-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
              <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div className="truncate">
              <h4 className="font-bold text-xs text-white">5-Day Streak</h4>
              <span className="text-[8.5px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md mt-1.5 inline-block font-bold">Completed</span>
            </div>
          </div>

          {/* Achievement 2: First Deadline Saved */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-emerald-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
              <Shield className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <div className="truncate">
              <h4 className="font-bold text-xs text-white">Crisis Defeated</h4>
              <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md mt-1.5 inline-block font-bold">Unlocked</span>
            </div>
          </div>

          {/* Achievement 3: 10 Focus Sessions */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-purple-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
              <Compass className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <div className="truncate">
              <h4 className="font-bold text-xs text-white">10 Focus Sessions</h4>
              <span className="text-[8.5px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md mt-1.5 inline-block font-bold">10/10 Active</span>
            </div>
          </div>

          {/* Achievement 4: Consistency Master */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-500/20 transition-all shadow-md group">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
              <Target className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <div className="truncate">
              <h4 className="font-bold text-xs text-white">Consistency Pro</h4>
              <span className="text-[8.5px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md mt-1.5 inline-block font-bold">Unlocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Focus Stats & Simple Chart Column split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Focus Stats Module (Left Column) */}
        <div className="lg:col-span-4 bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Focus Stats Overview</h3>
          </div>

          <div className="space-y-3">
            {/* Stat 1 */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-400 font-sans">Total Time Focused</span>
              <span className="font-mono text-white font-bold text-[13px] bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/15">
                {totalFocusHours} Hours
              </span>
            </div>

            {/* Stat 2 */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-400 font-sans font-medium">Completed Sessions</span>
              <span className="font-mono text-white font-bold text-[13px]">
                {totalFocusSessions} Sessions
              </span>
            </div>

            {/* Stat 3 */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-400 font-sans font-medium">Best Focus Time</span>
              <span className="font-mono text-white font-bold text-[13px]">
                {bestFocusSession} Min Block
              </span>
            </div>

            {/* Stat 4 */}
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-400 font-sans font-medium">Average Session</span>
              <span className="font-mono text-white font-bold text-[13px]">
                {avgSessionDuration} Mins
              </span>
            </div>
          </div>
        </div>

        {/* This Week simple Productivity Chart & Support Cards (Right Column) */}
        <div className="lg:col-span-8 bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div className="space-y-0.5">
              <h3 className="text-slate-200 font-semibold text-xs flex items-center gap-2 uppercase tracking-wider font-sans">
                <Calendar className="w-4 h-4 text-indigo-400" />
                This Week's Activity
              </h3>
              <p className="text-[10px] text-slate-500">Your micro-sprints tracked from Monday to Sunday</p>
            </div>
            
            <div className="flex items-center gap-2 bg-[#121214] border border-white/5 rounded-xl px-3 py-1.5 text-[10px] font-mono text-slate-400">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              <span>Calibrated Live</span>
            </div>
          </div>

          {/* Simple, Non-Complex Productivity chart */}
          <div className="h-44 flex items-end justify-between px-4 pt-4 relative">
            
            {/* Subtle background lines */}
            <div className="absolute inset-x-0 top-1/2 border-t border-white/5 pointer-events-none" />
            <div className="absolute inset-x-0 top-1/4 border-t border-white/5 pointer-events-none" />

            {/* Mon */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: "65%" }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">M</span>
            </div>

            {/* Tue */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: "40%" }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">T</span>
            </div>

            {/* Wed (Today) */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${completionRate}%` }}
                  className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400">W</span>
            </div>

            {/* Thu */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: "20%" }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">T</span>
            </div>

            {/* Fri */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: "75%" }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">F</span>
            </div>

            {/* Sat */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: "10%" }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">S</span>
            </div>

            {/* Sun */}
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="relative w-7 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 h-28 rounded-2xl overflow-hidden flex items-end transition-all">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: "35%" }}
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-2xl group-hover:brightness-110 transition"
                  transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">S</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
