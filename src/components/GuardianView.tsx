import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Send, 
  Bot, 
  Calendar, 
  Clock, 
  Zap, 
  ChevronRight, 
  Loader2, 
  Lightbulb, 
  Heart,
  Smile,
  Shield,
  Coffee,
  CheckCircle2,
  Trash2,
  Mic,
  AlertTriangle,
  Brain,
  ShieldAlert,
  Flame,
  User,
  Volume2,
  Activity,
  Award,
  BookOpen,
  ArrowRight,
  HelpCircle,
  ThumbsUp,
  RotateCcw
} from "lucide-react";
import { Task, UserSettings, TimeBlock, RiskAnalysis, EmergencyPlan, CoachAdvice } from "../types";
import { api } from "../lib/api";
import { storageService } from "../lib/storageService";
import DeadlineGuardianLogo from "./DeadlineGuardianLogo";
import Markdown from "react-markdown";

// Helper to parse actions-proposal JSON blocks from Gemini responses
function parseMessageContent(text: string) {
  const marker = "```actions-proposal";
  const index = text.indexOf(marker);
  if (index === -1) {
    return { cleanText: text, proposal: null };
  }
  
  const cleanText = text.substring(0, index).trim();
  const rest = text.substring(index + marker.length);
  const closingIndex = rest.indexOf("```");
  
  let jsonString = "";
  if (closingIndex === -1) {
    jsonString = rest.trim();
  } else {
    jsonString = rest.substring(0, closingIndex).trim();
  }
  
  let proposal = null;
  try {
    proposal = JSON.parse(jsonString);
  } catch (e) {
    // Expected while streaming or on invalid JSON syntax
  }
  
  return { cleanText, proposal };
}

// Action Confirmation Card for inline user modifications and executions
function ActionProposalCard({
  proposal,
  status,
  onApply,
  onCancel
}: {
  proposal: any;
  status: "pending" | "applied" | "cancelled";
  onApply: (edited: any) => void;
  onCancel: () => void;
}) {
  const isTasks = proposal.type === "create_task" || proposal.type === "add_reminder";
  const isSchedule = proposal.type === "plan_schedule" || proposal.type === "organize_calendar";
  const isHabits = proposal.type === "create_habit" || proposal.type === "manage_habits";

  // Local state for editable tasks
  const [editedTasks, setEditedTasks] = useState<any[]>(() => {
    return (proposal.data?.tasks || []).map((t: any, idx: number) => ({
      id: t.id || `prop-task-${idx}-${Date.now()}`,
      title: t.title || "",
      deadline: t.deadline ? t.deadline.substring(0, 10) : new Date().toISOString().substring(0, 10),
      estimatedEffort: t.estimatedEffort || 1,
      category: t.category || "Study",
      priority: t.priority || "Medium",
      subtasks: t.subtasks || [],
      completed: false,
      createdAt: new Date().toISOString()
    }));
  });

  // Local state for editable schedule blocks
  const [editedBlocks, setEditedBlocks] = useState<any[]>(() => {
    return proposal.data?.timeBlocks || [];
  });

  // Local state for editable habits
  const [editedHabits, setEditedHabits] = useState<any[]>(() => {
    return (proposal.data?.habits || []).map((h: any, idx: number) => ({
      id: h.id || `prop-habit-${idx}-${Date.now()}`,
      name: h.name || "",
      category: h.category || "Study",
      streak: h.streak || 0,
      completedToday: h.completedToday || false,
      color: h.color || "bg-indigo-500",
      icon: h.icon || "Sparkles"
    }));
  });

  if (status === "applied") {
    return (
      <div className="mt-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 animate-fadeIn">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <span className="font-bold uppercase tracking-wider block text-[10px]">Action Successfully Executed</span>
          <p className="text-[11px] text-slate-300 mt-0.5">{proposal.explanation || "The requested workspace adjustments have been applied."}</p>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="mt-3 p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-2.5 text-[11px] text-slate-400">
        <span className="font-medium">Action Proposal Declined</span>
      </div>
    );
  }

  // Task modifications helpers
  const handleTaskChange = (index: number, field: string, value: any) => {
    setEditedTasks(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddSubtask = (taskIndex: number) => {
    setEditedTasks(prev => {
      const copy = [...prev];
      const task = copy[taskIndex];
      task.subtasks = [...(task.subtasks || []), "New subtask"];
      return copy;
    });
  };

  const handleSubtaskChange = (taskIndex: number, subIndex: number, value: string) => {
    setEditedTasks(prev => {
      const copy = [...prev];
      const task = copy[taskIndex];
      const subCopy = [...(task.subtasks || [])];
      subCopy[subIndex] = value;
      task.subtasks = subCopy;
      return copy;
    });
  };

  const handleRemoveSubtask = (taskIndex: number, subIndex: number) => {
    setEditedTasks(prev => {
      const copy = [...prev];
      const task = copy[taskIndex];
      task.subtasks = (task.subtasks || []).filter((_: any, idx: number) => idx !== subIndex);
      return copy;
    });
  };

  const handleRemoveTask = (index: number) => {
    setEditedTasks(prev => prev.filter((_, idx) => idx !== index));
  };

  // Block modification helpers
  const handleBlockChange = (index: number, field: string, value: any) => {
    setEditedBlocks(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveBlock = (index: number) => {
    setEditedBlocks(prev => prev.filter((_, idx) => idx !== index));
  };

  // Habit modification helpers
  const handleHabitChange = (index: number, field: string, value: any) => {
    setEditedHabits(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveHabit = (index: number) => {
    setEditedHabits(prev => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="mt-3 bg-[#111625]/85 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="font-bold text-xs uppercase text-white tracking-wider">
            Guardian Plan: Confirm Actions
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-400 uppercase">
          {proposal.type.replace("_", " ")}
        </span>
      </div>

      <p className="text-[11px] text-slate-300 leading-relaxed font-sans bg-white/5 p-2.5 rounded-xl border border-white/5">
        {proposal.explanation || "Guardian detected actionable items. Let's customize and confirm before modifying your dashboard."}
      </p>

      {/* RENDER TASKS PROPOSAL EDITOR */}
      {isTasks && (
        <div className="space-y-3">
          {editedTasks.map((task, idx) => (
            <div key={task.id} className="p-3.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl space-y-3 relative group">
              <button 
                onClick={() => handleRemoveTask(idx)}
                className="absolute top-2 right-2 p-1 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                title="Remove this task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-[9px] font-mono text-indigo-300 uppercase block">Task Name</label>
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => handleTaskChange(idx, "title", e.target.value)}
                  className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Deadline</label>
                  <input
                    type="date"
                    value={task.deadline}
                    onChange={(e) => handleTaskChange(idx, "deadline", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Est. Effort (h)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={task.estimatedEffort}
                    onChange={(e) => handleTaskChange(idx, "estimatedEffort", parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Category</label>
                  <select
                    value={task.category}
                    onChange={(e) => handleTaskChange(idx, "category", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  >
                    {["Study", "Work", "Personal", "Health", "Finance", "Shopping", "Meetings", "Other"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Priority</label>
                  <select
                    value={task.priority}
                    onChange={(e) => handleTaskChange(idx, "priority", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  >
                    {["Critical", "High", "Medium", "Low"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subtasks rendering */}
              <div className="space-y-1.5 border-t border-white/5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-400 uppercase">Subtasks Checklist</span>
                  <button 
                    onClick={() => handleAddSubtask(idx)}
                    className="text-[9.5px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    + Add Subtask
                  </button>
                </div>
                {task.subtasks && task.subtasks.length > 0 ? (
                  <div className="space-y-1">
                    {task.subtasks.map((sub: string, subIdx: number) => (
                      <div key={subIdx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={sub}
                          onChange={(e) => handleSubtaskChange(idx, subIdx, e.target.value)}
                          className="flex-1 bg-transparent border border-white/5 hover:border-white/10 rounded px-2 py-0.5 text-[10.5px] text-slate-300 focus:outline-none focus:bg-[#0a0c14] focus:border-indigo-500"
                        />
                        <button 
                          onClick={() => handleRemoveSubtask(idx, subIdx)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 transition"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500 block italic text-[10px]">No subtasks defined.</span>
                )}
              </div>
            </div>
          ))}
          {editedTasks.length === 0 && (
            <p className="text-[11px] text-slate-400 italic">All tasks have been removed from this action. Please click cancel or add a task.</p>
          )}
        </div>
      )}

      {/* RENDER CHRONOLOGICAL TIMEBLOCKS PROPOSAL EDITOR */}
      {isSchedule && (
        <div className="space-y-3">
          {editedBlocks.map((block, idx) => (
            <div key={idx} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2 relative group">
              <button 
                onClick={() => handleRemoveBlock(idx)}
                className="absolute top-2 right-2 p-1 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                title="Remove this block"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Slot</label>
                  <input
                    type="text"
                    value={block.timeSlot}
                    onChange={(e) => handleBlockChange(idx, "timeSlot", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Task Title</label>
                  <input
                    type="text"
                    value={block.taskTitle}
                    onChange={(e) => handleBlockChange(idx, "taskTitle", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Duration</label>
                  <input
                    type="text"
                    value={block.duration}
                    onChange={(e) => handleBlockChange(idx, "duration", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Focus Target / Goal</label>
                  <input
                    type="text"
                    value={block.focusGoal}
                    onChange={(e) => handleBlockChange(idx, "focusGoal", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2 py-1 text-[10.5px] text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}
          {editedBlocks.length === 0 && (
            <p className="text-[11px] text-slate-400 italic">All schedule blocks have been removed from this plan.</p>
          )}
        </div>
      )}

      {/* RENDER HABITS PROPOSAL EDITOR */}
      {isHabits && (
        <div className="space-y-3">
          {editedHabits.map((habit, idx) => (
            <div key={habit.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2 relative group">
              <button 
                onClick={() => handleRemoveHabit(idx)}
                className="absolute top-2 right-2 p-1 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                title="Remove this habit"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-1 gap-2">
                <label className="text-[9px] font-mono text-indigo-300 uppercase block">Habit Name</label>
                <input
                  type="text"
                  value={habit.name}
                  onChange={(e) => handleHabitChange(idx, "name", e.target.value)}
                  className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Category</label>
                  <select
                    value={habit.category}
                    onChange={(e) => handleHabitChange(idx, "category", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  >
                    {["Study", "Exercise", "Reading", "Water", "Sleep", "Other"].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-indigo-300 uppercase block">Color Accent</label>
                  <select
                    value={habit.color}
                    onChange={(e) => handleHabitChange(idx, "color", e.target.value)}
                    className="w-full bg-[#0a0c14] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="bg-indigo-500">Indigo</option>
                    <option value="bg-emerald-500">Emerald</option>
                    <option value="bg-amber-500">Amber</option>
                    <option value="bg-pink-500">Pink</option>
                    <option value="bg-sky-500">Sky</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          {editedHabits.length === 0 && (
            <p className="text-[11px] text-slate-400 italic">All habits have been removed from this action.</p>
          )}
        </div>
      )}

      {/* RENDER ANY OTHER ACTIONS (E.G. PRIORITIZE WORK, BREAKDOWN PROJECT) AS A MODIFICATION CARD */}
      {!isTasks && !isSchedule && !isHabits && (
        <div className="text-[11.5px] text-slate-300 p-2 border border-white/5 rounded-xl bg-white/5 font-mono">
          <pre className="whitespace-pre-wrap overflow-x-auto text-[10px] text-indigo-200">
            {JSON.stringify(proposal.data, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => {
            if (isTasks) onApply(editedTasks);
            else if (isSchedule) onApply(editedBlocks);
            else if (isHabits) onApply(editedHabits);
            else onApply(proposal.data);
          }}
          disabled={
            isTasks ? editedTasks.length === 0 :
            isSchedule ? editedBlocks.length === 0 :
            isHabits ? editedHabits.length === 0 : false
          }
          className="flex-1 py-2 bg-gradient-to-r from-[#6D5DFC] to-indigo-600 hover:from-[#5C4EE0] hover:to-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-lg flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Confirm & Apply</span>
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  isQuickAction?: boolean;
  actionType?: "save" | "plan" | "risk" | "motivation" | "focus" | "catchup";
  // Custom structured objects
  riskAnalysis?: RiskAnalysis;
  emergencyPlan?: EmergencyPlan;
  coachAdvice?: CoachAdvice;
  scheduleBlocks?: TimeBlock[];
  proposalStatus?: "pending" | "applied" | "cancelled";
}

interface GuardianViewProps {
  tasks: Task[];
  settings: UserSettings;
  scheduleBlocks: TimeBlock[];
  onScheduleBlocksUpdate: (blocks: TimeBlock[]) => void;
  onTasksUpdate: (tasks: Task[]) => void;
  onAddHistory: (action: string, details: string) => void;
}

const generateSessionId = () => {
  return "session_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();
};

export default function GuardianView({ 
  tasks, 
  settings, 
  scheduleBlocks, 
  onScheduleBlocksUpdate, 
  onTasksUpdate,
  onAddHistory 
}: GuardianViewProps) {
  const sessionIdRef = useRef(generateSessionId());

  // Conversational state (empty by default, first response comes naturally from the AI)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [recentAdvice, setRecentAdvice] = useState<CoachAdvice | null>(null);

  const handleNewChat = () => {
    setMessages([]);
    sessionIdRef.current = generateSessionId();
  };

  const handleApplyProposal = (msgId: string, proposal: any, editedData: any) => {
    if (proposal.type === "create_task" || proposal.type === "add_reminder") {
      const newTasks = [...tasks, ...editedData];
      onTasksUpdate(newTasks);
      onAddHistory(
        "Created Tasks via AI Companion",
        `Created ${editedData.length} tasks: ${editedData.map((t: any) => t.title).join(", ")}`
      );
    } else if (proposal.type === "plan_schedule" || proposal.type === "organize_calendar") {
      onScheduleBlocksUpdate(editedData);
      onAddHistory(
        "Planned Schedule via AI Companion",
        `Scheduled ${editedData.length} focus sessions.`
      );
    } else if (proposal.type === "create_habit" || proposal.type === "manage_habits") {
      const currentHabits = JSON.parse(localStorage.getItem("guardian-habits-v2") || "[]");
      const mapped = editedData.map((h: any) => ({
        id: h.id || `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: h.name,
        category: h.category,
        streak: h.streak || 0,
        completedToday: h.completedToday || false,
        color: h.color || "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        icon: h.icon || "Sparkles"
      }));
      const newHabits = [...currentHabits, ...mapped];
      localStorage.setItem("guardian-habits-v2", JSON.stringify(newHabits));
      window.dispatchEvent(new Event("guardian-habits-updated"));
      onAddHistory(
        "Created Habits via AI Companion",
        `Created ${editedData.length} habits: ${editedData.map((h: any) => h.name).join(", ")}`
      );
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, proposalStatus: "applied" } : m));
  };

  const handleCancelProposal = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, proposalStatus: "cancelled" } : m));
  };

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "requesting" | "listening" | "processing" | "completed">("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const baselineRef = useRef("");

  // Clear mic error after 5 seconds
  useEffect(() => {
    if (micError) {
      const timer = setTimeout(() => {
        setMicError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [micError]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Load coach advice on mount to power memory & recent recommendations
  useEffect(() => {
    if (!settings) return;
    const fetchCoach = async () => {
      setAdviceLoading(true);
      try {
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
        setRecentAdvice(advice);
      } catch (err) {
        console.warn("Failed to load coach advice", err);
        // Fallback advice
        setRecentAdvice({
          insight: "We noticed you maintain optimal pacing when splitting major Study milestones frog-first.",
          habitSuggestion: "Break complex math prep into three 15-minute sprints to conquer study freeze.",
          motivationMessage: "Action cures anxiety. Focus on the immediate next subtask."
        });
      } finally {
        setAdviceLoading(false);
      }
    };
    fetchCoach();
  }, [tasks, settings]);

  // Web Speech API Voice Input trigger
  const handleVoiceInput = () => {
    setMicError(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError("Voice input isn't supported in your browser. Please use Google Chrome or Microsoft Edge.");
      onAddHistory("Voice Input Failure", "Browser does not support SpeechRecognition.");
      setVoiceStatus("idle");
      return;
    }

    if (isRecording || voiceStatus === "requesting" || voiceStatus === "processing") {
      setVoiceStatus("processing");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn("Error stopping speech recognition", e);
        }
      }
      setIsRecording(false);
      setVoiceStatus("idle");
      return;
    }

    const startRecognition = () => {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {}
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 1;

        baselineRef.current = input;
        let hasError = false;

        recognition.onstart = () => {
          setIsRecording(true);
          setVoiceStatus("listening");
          onAddHistory("Voice Transcript Channel", "Activated Guardian microphone input.");
        };

        recognition.onresult = (event: any) => {
          let finalSpeech = "";
          let interimSpeech = "";
          for (let i = 0; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalSpeech += result[0].transcript;
            } else {
              interimSpeech += result[0].transcript;
            }
          }
          
          if (interimSpeech) {
            setVoiceStatus("processing");
          } else {
            setVoiceStatus("listening");
          }

          let updatedText = baselineRef.current;
          if (finalSpeech) {
            updatedText += (updatedText && !updatedText.endsWith(" ") ? " " : "") + finalSpeech;
          }
          if (interimSpeech) {
            updatedText += (updatedText && !updatedText.endsWith(" ") ? " " : "") + interimSpeech;
          }
          setInput(updatedText);
        };

        recognition.onerror = (event: any) => {
          const errorType = event.error;
          if (errorType === "aborted") {
            // Normal stop/abort sequence, do not display an error banner
            return;
          }
          hasError = true;
          console.warn("Speech recognition error details", event);
          
          if (errorType === "not-allowed" || errorType === "permission-denied") {
            setMicError("Microphone access denied. Please allow microphone access in your browser settings.");
            onAddHistory("Voice Input Denied", "Microphone permission was denied.");
          } else if (errorType === "no-speech") {
            setMicError("No speech detected. Try speaking again.");
          } else if (errorType === "audio-capture") {
            setMicError("No microphone found. Please ensure a microphone is connected and configured.");
          } else if (errorType === "network") {
            setMicError("Network error occurred during speech recognition. Please check your internet connection.");
          } else {
            setMicError(`Speech input error: ${errorType || "Unknown error"}`);
          }
          setIsRecording(false);
          setVoiceStatus("idle");
        };

        recognition.onend = () => {
          setIsRecording(false);
          if (hasError) {
            setVoiceStatus("idle");
            return;
          }
          setVoiceStatus("completed");
          onAddHistory("Voice Translated", "Stopped voice recording and transcription.");
          
          // Clear completed state after 3 seconds
          setTimeout(() => {
            setVoiceStatus(current => current === "completed" ? "idle" : current);
          }, 3000);
        };

        recognitionRef.current = recognition;
        recognition.start();

      } catch (err: any) {
        console.warn("Failed to start speech recognition", err);
        setMicError("Failed to initiate voice input. Please try again.");
        setIsRecording(false);
        setVoiceStatus("idle");
      }
    };

    // Request microphone permission explicitly first if supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setVoiceStatus("requesting");
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // Permission granted, clean up stream and start recognition
          stream.getTracks().forEach(track => track.stop());
          startRecognition();
        })
        .catch((err) => {
          console.warn("Microphone permission denied or error", err);
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setMicError("Microphone access denied. Please allow microphone access in your browser settings.");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            setMicError("No microphone found. Please connect a microphone and try again.");
          } else {
            setMicError("Could not access microphone. Please check your browser settings.");
          }
          setVoiceStatus("idle");
          onAddHistory("Voice Input Denied", `Microphone permission error: ${err.name}`);
        });
    } else {
      // Fallback directly to SpeechRecognition if mediaDevices are not supported
      startRecognition();
    }
  };

  // General chat submit handler
  const handleSend = async (text: string) => {
    if (!text.trim() || chatLoading) return;

    const userMsg: ChatMessage = { 
      id: "msg-" + Date.now(),
      sender: "user", 
      text,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setChatLoading(true);

    const botMessageId = "msg-reply-" + Date.now();
    
    // Add an empty bot message that we will stream text into
    setMessages(prev => [
      ...prev,
      {
        id: botMessageId,
        sender: "bot",
        text: "",
        timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        proposalStatus: "pending"
      }
    ]);

    try {
      const chatLogs = [...messages, userMsg].map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const habitsStr = localStorage.getItem("guardian-habits-v2") || "[]";
      let habits: any[] = [];
      try {
        habits = JSON.parse(habitsStr);
      } catch (e) {}

      const isLight = document.documentElement.classList.contains("theme-light");
      const currentTheme = isLight ? "Light Theme" : "Dark Slate Theme";

      let focusHistory: any[] = [];
      try {
        focusHistory = await storageService.getFocusHistory();
      } catch (e) {
        console.warn("Failed to retrieve focus history", e);
      }

      const stream = await api.chatStream(
        chatLogs,
        settings,
        tasks,
        habits,
        focusHistory,
        currentTheme,
        "Guardian",
        sessionIdRef.current
      );

      if (!stream) {
        throw new Error("Failed to initialize response stream from server");
      }

      const reader = stream.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let buffer = "";

      // Turn off typing indicator as soon as stream connection is open and active
      setChatLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages(prev =>
                  prev.map(m => m.id === botMessageId ? { ...m, text: accumulatedText } : m)
                );
              }
            } catch (e) {
              console.warn("Could not parse SSE JSON chunk", e, trimmed);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Guardian streaming chat error", err);
      // Remove the empty streamed message if it remained empty, and show a friendly error
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== botMessageId || m.text.trim().length > 0);
        return [
          ...filtered,
          {
            id: "msg-error-" + Date.now(),
            sender: "bot",
            text: `⚠️ **Connection Timeout or Interruption**\n\nI encountered a brief hiccup while connecting to the core reasoning engine. Please check your internet connection or try sending your message again. I'm ready to assist whenever you retry!`,
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
    } finally {
      setChatLoading(false);
    }
  };

  // Trigger Specialized Quick Diagnostic Actions
  const handleQuickAction = async (actionType: "save" | "plan" | "risk" | "motivation" | "focus" | "catchup") => {
    if (chatLoading) return;

    let actionLabel = "";
    if (actionType === "save") actionLabel = "Save My Day";
    else if (actionType === "plan") actionLabel = "Plan Tomorrow";
    else if (actionType === "risk") actionLabel = "Am I Behind?";
    else if (actionType === "motivation") actionLabel = "Motivate Me";
    else if (actionType === "focus") actionLabel = "Help Me Focus";
    else if (actionType === "catchup") actionLabel = "Help Me Catch Up";

    const userMsg: ChatMessage = {
      id: "qa-user-" + Date.now(),
      sender: "user",
      text: `[Quick Action Command] ${actionLabel}`,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      isQuickAction: true
    };

    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      let habits: any[] = [];
      try {
        const habitsStr = localStorage.getItem("guardian-habits-v2") || "[]";
        habits = JSON.parse(habitsStr);
      } catch (e) {
        console.error("Error parsing habits for quick action", e);
      }

      let focusHistory: any[] = [];
      try {
        focusHistory = await storageService.getFocusHistory();
      } catch (e) {
        console.error("Error getting focus history for quick action", e);
      }

      if (actionType === "save") {
        onAddHistory("🚨 Saving My Day", "Tapped Crisis Rescue pathway.");
        const plan = await api.saveMyDeadline(tasks, habits, focusHistory);
        
        setMessages(prev => [
          ...prev,
          {
            id: "qa-bot-" + Date.now(),
            sender: "bot",
            text: "🚨 **EMERGENCY CRISIS PLAN INITIATED**\nI have isolated all non-essential items, pruned low-priority tasks, and constructed an immediate tactical rescue route for you. Let's execute these minimum viable steps immediately:",
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            actionType: "save",
            emergencyPlan: plan
          }
        ]);
      } 
      
      else if (actionType === "plan") {
        onAddHistory("📅 Scheduling Pacing Model", "Assembled balanced daily timetable.");
        const plan = await api.generateSchedule(tasks, settings, habits, focusHistory);
        onScheduleBlocksUpdate(plan.timeBlocks);

        setMessages(prev => [
          ...prev,
          {
            id: "qa-bot-" + Date.now(),
            sender: "bot",
            text: `📅 **BALANCED DAILY TIMELINE READY**\nI've generated a comfortable chronological plan for you. Deep focus blocks are spaced evenly with restorative rests based on your ${settings.productiveHours} productivity window:`,
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            actionType: "plan",
            scheduleBlocks: plan.timeBlocks,
            textSuffix: plan.coachTip
          }
        ]);
      } 
      
      else if (actionType === "risk") {
        onAddHistory("🔍 Scanning Deadline Risk", "Requested risk health audit.");
        const risk = await api.getRiskAnalysis(tasks, habits, focusHistory);

        setMessages(prev => [
          ...prev,
          {
            id: "qa-bot-" + Date.now(),
            sender: "bot",
            text: `🔍 **DEADLINE HEALTH REPORT CARD**\nOur active monitoring systems have computed your overall risk index. Let's view the priority vulnerabilities and future-self advice:`,
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            actionType: "risk",
            riskAnalysis: risk
          }
        ]);
      } 
      
      else if (actionType === "motivation") {
        onAddHistory("💖 Requested Guardian Pep-Talk", "Dispensed mindful emotional reassurance.");
        
        // Custom soothing motivational sequence
        const customAdvice: CoachAdvice = {
          insight: "You usually study best in the evening, but occasionally panic in the morning. Let's bridge the gap with kindness.",
          habitSuggestion: "Look at your progress, not your ideal endpoint. Five minutes of focus is an absolute win.",
          motivationMessage: "Your productivity is a system. Focus on starting the next scheduled block to build momentum."
        };

        setMessages(prev => [
          ...prev,
          {
            id: "qa-bot-" + Date.now(),
            sender: "bot",
            text: "✨ **PRODUCTIVITY ANALYSIS & STRATEGY ASSISTANCE**\nLet's clear all emotional friction and focus strictly on execution parameters. Choose a pending item from your workspace, configure a defined duration, and initiate work.",
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            actionType: "motivation",
            coachAdvice: customAdvice
          }
        ]);
      } 
      
      else if (actionType === "focus") {
        onAddHistory("⚡ Focus Protocol Launched", "Accessed peak block guidelines.");
        
        const scheduleBlocksTemp: TimeBlock[] = [
          { timeSlot: "Block 1 (25m)", taskTitle: "Tackle Frog-First Task", duration: "25 min", focusGoal: "Disable all notification tabs. Work continuously on 1 objective." },
          { timeSlot: "Rest (5m)", taskTitle: "Mindful Pacing Break", duration: "5 min", focusGoal: "Stand up, stretch, look away from monitors, drink water." },
          { timeSlot: "Block 2 (25m)", taskTitle: "Sustain Project Velocity", duration: "25 min", focusGoal: "Re-engage. Focus on drafting and incremental sketch outlines." }
        ];

        setMessages(prev => [
          ...prev,
          {
            id: "qa-bot-" + Date.now(),
            sender: "bot",
            text: `⚡ **POMODORO FOCUS SEQUENCE LAUNCHED**\nWe have locked in an optimal study block of ${settings.preferredWorkBlock}m. Follow these steps to ensure zero mental fatigue:`,
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            actionType: "focus",
            scheduleBlocks: scheduleBlocksTemp
          }
        ]);
      } 
      
      else if (actionType === "catchup") {
        onAddHistory("🤝 Caught Up On Backlogs", "Triggered structured catch-up protocol.");
        
        const catchupPlan: EmergencyPlan = {
          emergencyTimeline: [
            { timeSpan: "Step 1", action: "Review All Overdue items & postpone low priority blocks.", estimatedProgress: "Scope Trimming Complete" },
            { timeSpan: "Step 2", action: "Allocate a 10-minute sprint with zero tabs open to break freeze.", estimatedProgress: "Task Activated" },
            { timeSpan: "Step 3", action: "Verify current progress with Guardian companion.", estimatedProgress: "Calibration Complete" }
          ],
          cutOffTasks: ["Social feeds", "Deep workspace cleanups", "Non-urgent personal errands"],
          emergencyAdvice: "Isolate immediate friction factors. Configure a 10-minute sprint to initiate progression on high-priority metrics."
        };

        setMessages(prev => [
          ...prev,
          {
            id: "qa-bot-" + Date.now(),
            sender: "bot",
            text: "🤝 **BACKLOG RESCUE CHECKLIST**\nLet's get you back on track comfortably. We will ignore the trivial noise and target the exact milestones causing high pressure:",
            timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            actionType: "catchup",
            emergencyPlan: catchupPlan
          }
        ]);
      }

    } catch (err) {
      console.error("Quick action failed", err);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div id="guardian-redesign-root" className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      
      {/* 1. Header Grid Area (Swiss Typography Title + Live Avatar Box) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>
        
        {/* Left Typography Column: Minimal, Bold Swiss Branding */}
        <div className="lg:col-span-8 space-y-2">
          <div className="font-sans leading-none">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter uppercase">
              Guardian<span className="text-indigo-500">.</span>
            </h1>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-slate-400 tracking-tight">
              Online<span className="text-emerald-400">.</span>
            </h2>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono uppercase font-extrabold text-emerald-400 tracking-widest">Ready</span>
          </div>
        </div>

        {/* Right Column: Dynamic Breathing Avatar & Sound Sphere */}
        <div className="lg:col-span-4 flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-[260px] p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner group">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
            
            {/* Visual Avatar Centerpiece with Breathing Animation */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Pulsing Breathing Aura */}
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-xl animate-[pulse_4s_ease-in-out_infinite]" />
              {/* Outer Spin Ring */}
              <div className="absolute inset-1 rounded-full border border-dashed border-indigo-500/35 animate-[spin_20s_linear_infinite]" />
              {/* Inner Breath Ring */}
              <div className="absolute inset-4 rounded-full border border-indigo-400/40 animate-[ping_4s_ease-in-out_infinite] opacity-60" />
              {/* Core Active Avatar Shield */}
              <div className="relative w-14 h-14">
                <DeadlineGuardianLogo variant="app-icon" glowing />
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <div className="text-xs font-bold text-white tracking-wide">The Guardian Pilot</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Memory Registry & Recent Recommendation Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Memory Registry */}
        <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
            <Brain className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Memory Log</h3>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
              <span className="text-slate-400">Peak Energy Window</span>
              <span className="font-mono text-indigo-400 font-bold text-[11px] bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/15 uppercase">
                {settings.productiveHours || "Evening"}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
              <span className="text-slate-400">Optimal Work Pacing</span>
              <span className="font-mono font-bold text-slate-200">
                {settings.preferredWorkBlock || 25} Minute blocks
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl">
              <span className="text-slate-400">Delay Vulnerabilities</span>
              <span className="text-slate-300 font-bold truncate max-w-[150px]">
                {settings.frequentlyDelayed?.length > 0 ? settings.frequentlyDelayed.join(", ") : "None Detected"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal italic font-serif border-t border-white/5 pt-3.5">
              "{settings.personalBio || "Custom bio preferences loaded successfully into Guardian local registry."}"
            </p>
          </div>
        </div>

        {/* Recent Advice Logs */}
        <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Recent Advice Log</h3>
              </div>
            </div>
            {adviceLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : recentAdvice ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-200 leading-relaxed font-sans font-bold italic">
                  "You are making steady progress on {tasks[0]?.title || "Setup study goals & roadmap"}. Keep up the momentum to finish without stress."
                </p>
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[11px] text-slate-300 leading-normal">
                  <strong>Habit suggests:</strong> {recentAdvice.habitSuggestion}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No previous recommendations detected.</p>
            )}
          </div>
          {recentAdvice && (
            <div className="border-t border-white/5 pt-3 flex items-center gap-2 text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-bold">
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              <span>{recentAdvice.motivationMessage}</span>
            </div>
          )}
        </div>

      </div>

      {/* 3. Modern Quick Action Dashboard */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-widest font-sans">Quick Support Actions</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Action 1: Save My Day */}
          <button
            onClick={() => handleQuickAction("save")}
            disabled={chatLoading}
            className="p-4 bg-gradient-to-b from-rose-500/10 to-rose-950/20 hover:from-rose-500/15 hover:to-rose-950/30 border border-rose-500/20 hover:border-rose-500/40 rounded-2xl text-left transition duration-200 cursor-pointer group disabled:opacity-40"
          >
            <Flame className="w-5 h-5 text-rose-400 mb-2.5 group-hover:scale-110 transition" />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Save My Day</h4>
          </button>

          {/* Action 2: Plan Tomorrow */}
          <button
            onClick={() => handleQuickAction("plan")}
            disabled={chatLoading}
            className="p-4 bg-gradient-to-b from-indigo-500/10 to-indigo-950/20 hover:from-indigo-500/15 hover:to-indigo-950/30 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl text-left transition duration-200 cursor-pointer group disabled:opacity-40"
          >
            <Calendar className="w-5 h-5 text-indigo-400 mb-2.5 group-hover:scale-110 transition" />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Plan Tomorrow</h4>
          </button>

          {/* Action 3: Help Me Catch Up */}
          <button
            onClick={() => handleQuickAction("catchup")}
            disabled={chatLoading}
            className="p-4 bg-gradient-to-b from-emerald-500/10 to-emerald-950/20 hover:from-emerald-500/15 hover:to-emerald-950/30 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl text-left transition duration-200 cursor-pointer group disabled:opacity-40"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2.5 group-hover:scale-110 transition" />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Help Catch Up</h4>
          </button>

          {/* Action 4: Am I Behind? */}
          <button
            onClick={() => handleQuickAction("risk")}
            disabled={chatLoading}
            className="p-4 bg-gradient-to-b from-amber-500/10 to-amber-950/20 hover:from-amber-500/15 hover:to-amber-950/30 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl text-left transition duration-200 cursor-pointer group disabled:opacity-40"
          >
            <Activity className="w-5 h-5 text-amber-400 mb-2.5 group-hover:scale-110 transition" />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Am I Behind?</h4>
          </button>

          {/* Action 5: Motivate Me */}
          <button
            onClick={() => handleQuickAction("motivation")}
            disabled={chatLoading}
            className="p-4 bg-gradient-to-b from-purple-500/10 to-purple-950/20 hover:from-purple-500/15 hover:to-purple-950/30 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl text-left transition duration-200 cursor-pointer group disabled:opacity-40"
          >
            <Heart className="w-5 h-5 text-purple-400 mb-2.5 group-hover:scale-110 transition" />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Motivate Me</h4>
          </button>

          {/* Action 6: Help Me Focus */}
          <button
            onClick={() => handleQuickAction("focus")}
            disabled={chatLoading}
            className="p-4 bg-gradient-to-b from-sky-500/10 to-sky-950/20 hover:from-sky-500/15 hover:to-sky-950/30 border border-sky-500/20 hover:border-sky-500/40 rounded-2xl text-left transition duration-200 cursor-pointer group disabled:opacity-40"
          >
            <Zap className="w-5 h-5 text-sky-400 mb-2.5 group-hover:scale-110 transition" />
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Help Me Focus</h4>
          </button>
        </div>
      </div>

      {/* 4. Large Conversation Area */}
      <div className="bg-[#151D33]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[500px] h-[600px] relative overflow-hidden">
        
        {/* Chat Log Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-extrabold uppercase text-white tracking-wider">Guardian Active Core Chat</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button 
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                title="Start a fresh chat session"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#6D5DFC]" />
                <span>New Chat</span>
              </button>
            )}
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">
              Support Protocol Active
            </span>
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white text-sm font-bold">Start a New Conversation</h3>
                <p className="text-slate-400 text-xs max-w-sm">
                  What are we working on?
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
            const isUser = msg.sender === "user";
            const { cleanText, proposal } = isUser ? { cleanText: msg.text, proposal: null } : parseMessageContent(msg.text);
            
            return (
              <div 
                key={msg.id} 
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`p-4 rounded-2xl max-w-[90%] text-xs leading-relaxed font-sans shadow-md space-y-3
                  ${isUser 
                    ? "bg-indigo-600 text-white rounded-tr-none" 
                    : "bg-white/5 border border-white/5 text-slate-100 rounded-tl-none"}`}
                >
                  {/* Standard text paragraph block */}
                  <div className="prose prose-invert max-w-none text-[11.5px] leading-relaxed">
                    {isUser ? (
                      msg.text
                    ) : (
                      <Markdown
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-sm font-bold text-white mt-3 mb-1" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-xs font-bold text-white mt-2 mb-1" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-xs font-bold text-slate-200 mt-2 mb-1" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 leading-relaxed text-slate-200" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1 text-slate-300" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-slate-300" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                          code: ({node, ...props}) => <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-300" {...props} />,
                          table: ({node, ...props}) => <table className="w-full border-collapse my-2 border border-white/5 text-[10.5px]" {...props} />,
                          thead: ({node, ...props}) => <thead className="bg-white/5 border-b border-white/10" {...props} />,
                          th: ({node, ...props}) => <th className="px-2 py-1 text-left font-bold text-slate-200" {...props} />,
                          td: ({node, ...props}) => <td className="px-2 py-1 border-t border-white/5 text-slate-300" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                          a: ({node, ...props}) => <a className="text-indigo-400 hover:underline" target="_blank" rel="noreferrer" {...props} />
                        }}
                      >
                        {cleanText || "..."}
                      </Markdown>
                    )}
                  </div>

                  {/* Render the Action Proposal card if detected and parseable */}
                  {proposal && (
                    <ActionProposalCard
                      proposal={proposal}
                      status={msg.proposalStatus || "pending"}
                      onApply={(edited) => handleApplyProposal(msg.id, proposal, edited)}
                      onCancel={() => handleCancelProposal(msg.id)}
                    />
                  )}

                  {/* 1. Custom Structured Rendering: Emergency Plan */}
                  {msg.emergencyPlan && (
                    <div className="mt-3.5 space-y-3 border-t border-white/5 pt-3 text-slate-200">
                      
                      {/* Emergency Timeline Block list */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400 font-bold block">🚨 Hour-by-Hour Crisis Steps</span>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.emergencyPlan.emergencyTimeline?.map((item, idx) => (
                            <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center justify-between text-[11px] gap-2">
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-mono text-rose-400 uppercase font-bold">{item.timeSpan}</span>
                                <p className="font-bold text-white leading-tight">{item.action}</p>
                              </div>
                              <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-rose-300 font-mono font-bold whitespace-nowrap">
                                {item.estimatedProgress}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Cut-off Tasks */}
                      {msg.emergencyPlan.cutOffTasks && msg.emergencyPlan.cutOffTasks.length > 0 && (
                        <div className="p-3 bg-[#111]/60 rounded-xl space-y-1.5 border border-white/5">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold block">❌ DO NOT DO THESE RIGHT NOW (Ignore List)</span>
                          <div className="flex flex-wrap gap-2">
                            {msg.emergencyPlan.cutOffTasks.map((t, idx) => (
                              <span key={idx} className="text-[10px] bg-white/5 px-2.5 py-0.5 rounded text-slate-500 line-through font-medium">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Emergency Advice block */}
                      {msg.emergencyPlan.emergencyAdvice && (
                        <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10.5px] text-slate-300 italic font-sans flex items-start gap-2 leading-relaxed">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                          <span>"{msg.emergencyPlan.emergencyAdvice}"</span>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 2. Custom Structured Rendering: TimeBlock Schedule */}
                  {msg.scheduleBlocks && (
                    <div className="mt-3.5 space-y-2 border-t border-white/5 pt-3 text-slate-200">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold block flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Chronological Pacing Slots
                      </span>
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {msg.scheduleBlocks.map((block, idx) => (
                          <div key={idx} className="p-2.5 bg-[#121214]/50 border border-white/5 rounded-xl flex items-center justify-between text-[11px] gap-2.5">
                            <div>
                              <p className="font-bold text-white">{block.taskTitle}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[190px]">{block.focusGoal}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] bg-white/5 text-indigo-300 px-1.5 py-0.5 rounded font-mono block">
                                {block.timeSlot}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Optional coaching tip at the bottom */}
                      <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-indigo-300 italic leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5 animate-pulse" />
                          <span><strong>Guardian Guide:</strong> Focus intently for 25 minutes, then stand up and disconnect.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Custom Structured Rendering: Risk Analysis */}
                  {msg.riskAnalysis && (
                    <div className="mt-3.5 space-y-3 border-t border-white/5 pt-3 text-slate-200">
                      
                      {/* Overall score gauge */}
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 block uppercase">Overall Timeline Risk Rating</span>
                          <span className="text-xl font-black text-white">{msg.riskAnalysis.overallRiskScore}%</span>
                        </div>
                        <div className="w-24 bg-white/10 rounded-full h-2 relative overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${msg.riskAnalysis.overallRiskScore > 70 ? 'bg-rose-500' : msg.riskAnalysis.overallRiskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${msg.riskAnalysis.overallRiskScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Alerts list */}
                      {msg.riskAnalysis.highRiskAlerts && msg.riskAnalysis.highRiskAlerts.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                            High Vulnerability Alerts
                          </span>
                          {msg.riskAnalysis.highRiskAlerts.map((alertItem, idx) => (
                            <div key={idx} className="p-3 bg-[#111]/40 border border-white/5 rounded-xl text-[10.5px] space-y-1.5">
                              <p className="font-bold text-rose-400 leading-tight flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                {alertItem.warning}
                              </p>
                              <p className="text-slate-300 text-[10px] leading-relaxed"><strong>Action Recommendation:</strong> {alertItem.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Future-self warning */}
                      {msg.riskAnalysis.futureSelfWarning && (
                        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-[10.5px] text-slate-300 leading-relaxed font-sans">
                          <div className="flex items-start gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
                            <span><strong>Future Self Warning:</strong> "{msg.riskAnalysis.futureSelfWarning}"</span>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* 4. Custom Structured Rendering: Coach advice pep talk */}
                  {msg.coachAdvice && (
                    <div className="mt-3.5 space-y-2.5 border-t border-white/5 pt-3 text-slate-200">
                      <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono text-purple-400 uppercase font-bold block flex items-center gap-1.5">
                          <Lightbulb className="w-3 h-3 text-purple-400" />
                          Mindful Insight
                        </span>
                        <p className="text-xs text-white leading-relaxed">"{msg.coachAdvice.insight}"</p>
                      </div>
                      <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono text-indigo-400 uppercase font-bold block flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-indigo-400" />
                          Tactical Habit Adjustment
                        </span>
                        <p className="text-xs text-white leading-relaxed">{msg.coachAdvice.habitSuggestion}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between text-[11px] font-serif italic text-indigo-300 border border-white/5">
                        "{msg.coachAdvice.motivationMessage}"
                      </div>
                    </div>
                  )}

                  {/* Message Timestamp */}
                  <span className={`block text-[8.5px] font-mono mt-2 text-right
                    ${isUser ? "text-indigo-200" : "text-slate-500"}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })
        )}
          
          {/* Active typing loader */}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="p-4 bg-white/5 border border-white/5 text-slate-400 rounded-2xl rounded-tl-none text-xs flex items-center gap-3">
                {/* Typing dots animation */}
                <div className="flex gap-1 items-center shrink-0">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-dot-pulse" style={{ animationDelay: "0s" }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-dot-pulse" style={{ animationDelay: "0.2s" }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-dot-pulse" style={{ animationDelay: "0.4s" }}></span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-extrabold animate-pulse">Guardian is Analyzing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Workstation Panel */}
        <div className="space-y-3.5 border-t border-white/5 pt-4 mt-auto">
          
          {/* Example shortcuts drawer */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-mono uppercase text-slate-500 font-bold tracking-wider">Example Situations:</span>
            {["I wasted my day.", "Interview Friday.", "I'm overwhelmed."].map((ex) => (
              <button
                key={ex}
                onClick={() => handleSend(ex)}
                disabled={chatLoading}
                className="px-3 py-1 bg-[#121214] border border-white/5 hover:border-indigo-500/25 rounded-lg text-[10px] font-medium text-slate-400 hover:text-white cursor-pointer transition"
              >
                "{ex}"
              </button>
            ))}
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2.5 relative items-center"
          >
            {/* Mic error banner */}
            {micError && (
              <div className="absolute inset-x-0 bottom-full mb-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl px-4 py-3 text-[10px] flex items-center justify-between shadow-lg shadow-amber-500/5 z-20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-sans">{micError}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setMicError(null)} 
                  className="text-amber-400 hover:text-white font-bold ml-2 text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Listening HUD banner */}
            {voiceStatus !== "idle" && (
              <div 
                className={`absolute inset-x-0 bottom-full mb-3 border rounded-2xl px-4 py-3 text-[10px] flex items-center justify-between shadow-lg transition-all duration-300 z-20 ${
                  voiceStatus === "requesting"
                    ? "bg-slate-500/10 border-slate-500/20 text-slate-300 shadow-slate-500/5"
                    : voiceStatus === "listening"
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-300 shadow-rose-500/5 animate-pulse"
                    : voiceStatus === "processing"
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-300 shadow-purple-500/5"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-emerald-500/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {voiceStatus === "requesting" && (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
                      <span className="font-sans font-medium">Requesting microphone access... Please approve browser permission.</span>
                    </>
                  )}
                  {voiceStatus === "listening" && (
                    <>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="font-sans font-medium">🎤 Guardian is listening... Speak freely now.</span>
                    </>
                  )}
                  {voiceStatus === "processing" && (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
                      <span className="font-sans font-medium">✨ Converting speech...</span>
                    </>
                  )}
                  {voiceStatus === "completed" && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-sans font-medium">✓ Voice captured. You can now edit and send manually.</span>
                    </>
                  )}
                </div>
                {voiceStatus === "listening" && (
                  <div className="flex gap-0.5 h-3 items-end">
                    <span className="w-0.5 h-1.5 bg-rose-400 rounded-full animate-[bounce_0.8s_infinite]"></span>
                    <span className="w-0.5 h-3 bg-rose-400 rounded-full animate-[bounce_0.8s_infinite_0.1s]"></span>
                    <span className="w-0.5 h-2 bg-rose-400 rounded-full animate-[bounce_0.8s_infinite_0.2s]"></span>
                    <span className="w-0.5 h-1 bg-rose-400 rounded-full animate-[bounce_0.8s_infinite_0.3s]"></span>
                    <span className="w-0.5 h-2.5 bg-rose-400 rounded-full animate-[bounce_0.8s_infinite_0.4s]"></span>
                  </div>
                )}
                {voiceStatus === "processing" && (
                  <div className="flex gap-0.5 h-3 items-end">
                    <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-[bounce_0.6s_infinite_0.1s]"></span>
                    <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-[bounce_0.6s_infinite_0.2s]"></span>
                    <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-[bounce_0.6s_infinite_0.3s]"></span>
                  </div>
                )}
              </div>
            )}

            {/* Mic trigger */}
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={chatLoading}
              className={`p-3.5 rounded-xl border transition flex items-center justify-center shrink-0 cursor-pointer ${
                isRecording 
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse" 
                  : voiceStatus === "requesting"
                  ? "bg-slate-500/10 border-slate-500/30 text-slate-300 animate-pulse"
                  : "bg-[#121214] border-white/5 hover:border-white/10 text-slate-400 hover:text-white"
              }`}
              title="Speak to Guardian (Voice Input)"
            >
              {voiceStatus === "requesting" ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Mic className={`w-4 h-4 transition-transform duration-200 ${isRecording ? 'scale-110 text-rose-400' : ''}`} />
              )}
            </button>

            {/* TextInput bar */}
            <input
              type="text"
              value={input}
              disabled={chatLoading}
              onChange={(e) => {
                setInput(e.target.value);
                if (isRecording) {
                  baselineRef.current = e.target.value;
                }
              }}
              placeholder={
                voiceStatus === "requesting"
                  ? "Awaiting microphone permission..."
                  : voiceStatus === "listening"
                  ? "🎤 Listening... Speak now..."
                  : voiceStatus === "processing"
                  ? "✨ Converting speech to text..."
                  : voiceStatus === "completed"
                  ? "✓ Voice captured."
                  : "Tell the Guardian what's on your mind or how you're feeling..."
              }
              className={`flex-1 px-4 py-3.5 bg-[#121214] border transition focus:outline-none text-xs text-white rounded-xl placeholder:text-slate-500 font-sans ${
                isRecording
                  ? "border-rose-500/40 focus:border-rose-500/60 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                  : "border-white/5 focus:border-indigo-500"
              }`}
            />

            {/* Submit trigger */}
            <button
              type="submit"
              disabled={!input.trim() || chatLoading || isRecording}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer shadow-lg shadow-indigo-500/15 font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
