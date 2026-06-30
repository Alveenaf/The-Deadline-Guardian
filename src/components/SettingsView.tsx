import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Settings, 
  User, 
  Clock, 
  Brain, 
  Save, 
  CheckCircle2, 
  Sparkles,
  Heart,
  Eye,
  Sliders,
  Volume2,
  ShieldCheck,
  Bell,
  Info,
  Zap,
  Activity,
  Smile,
  Lock,
  Moon,
  Sun,
  Laptop,
  Check
} from "lucide-react";
import { UserSettings } from "../types";
import { api } from "../lib/api";
import DeadlineGuardianLogo from "./DeadlineGuardianLogo";

interface SettingsViewProps {
  settings: UserSettings;
  onSettingsUpdate: (updatedSettings: UserSettings) => void;
  onAddHistory: (action: string, details: string) => void;
  memory?: any;
  onResetMemory?: () => void;
  onSignOut?: () => void;
  onTriggerDemoMode?: () => Promise<void>;
}

// Custom Switch Toggle Component for supreme polish
interface ToggleProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

function CustomToggle({ enabled, onChange, label, description, icon }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all">
      <div className="flex gap-2.5 items-start">
        {icon && <div className="mt-0.5 text-slate-400">{icon}</div>}
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-white block">{label}</span>
          {description && (
            <span className="text-[10.5px] text-slate-400 block leading-tight font-sans">
              {description}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          enabled ? "bg-[#6D5DFC]" : "bg-slate-800"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-4.5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsView({ settings, onSettingsUpdate, onAddHistory, memory, onResetMemory, onSignOut, onTriggerDemoMode }: SettingsViewProps) {
  // Appearance (Light, Dark, Auto)
  const [appearance, setAppearance] = useState<"Light" | "Dark" | "Auto">(
    () => (localStorage.getItem("guardian-appearance") as any) || "Dark"
  );

  // Accent colors (Lavender, Emerald, Coral, Sky Blue)
  const [accentColor, setAccentColor] = useState<string>(
    () => localStorage.getItem("guardian-accent") || "#6D5DFC"
  );

  // Layout preferences
  const [compactMode, setCompactMode] = useState<boolean>(
    () => localStorage.getItem("guardian-compact") === "true"
  );
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(
    () => localStorage.getItem("guardian-animations") !== "false"
  );

  // Personality (Calm, Motivational, Strict)
  const [personality, setPersonality] = useState<"Calm" | "Motivational" | "Strict">(
    () => (localStorage.getItem("guardian-personality") as any) || "Calm"
  );

  // AI Behavior States
  const [predictDelays, setPredictDelays] = useState(true);
  const [rearrangeTasks, setRearrangeTasks] = useState(true);
  const [dailyPlans, setDailyPlans] = useState(true);
  const [smartReminders, setSmartReminders] = useState(true);
  const [habitSuggestions, setHabitSuggestions] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);

  // Notifications Toggles
  const [morningPlanNotif, setMorningPlanNotif] = useState(true);
  const [eveningCheckNotif, setEveningCheckNotif] = useState(true);
  const [deadlineAlertsNotif, setDeadlineAlertsNotif] = useState(true);

  // Companion state variables (Name & bio)
  const [userName, setUserName] = useState(settings.userName);
  const [personalBio, setPersonalBio] = useState(settings.personalBio);
  const [productiveHours, setProductiveHours] = useState(settings.productiveHours);
  const [preferredWorkBlock, setPreferredWorkBlock] = useState(settings.preferredWorkBlock);

  // Save states
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Guardian Dynamic quotes matching active personality settings
  const getPersonalityQuote = () => {
    switch (personality) {
      case "Calm":
        return {
          title: "Calm Shield Active",
          icon: "🧘",
          color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
          quote: `"Guardian will give ${userName || "Sal"} direct, calm advice focused on tasks and deadlines."`
        };
      case "Strict":
        return {
          title: "Guardian Defender Active",
          icon: "🛡️",
          color: "text-rose-400 border-rose-500/20 bg-rose-500/5",
          quote: `"Distractions are the thieves of your future. Let's lock your focus workspace right now and execute our priority tasks. Time is our ally, let's defend it."`
        };
      case "Motivational":
      default:
        return {
          title: "Momentum Coach Active",
          icon: "⚡",
          color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
          quote: `"Let's build that streak! You have incredible creative potential waiting to unlock. Push for 25 minutes of supreme focus today and celebrate!"`
        };
    }
  };

  const activeQuote = getPersonalityQuote();

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    const updated: UserSettings = {
      userName: userName.trim(),
      productiveHours,
      preferredWorkBlock: Number(preferredWorkBlock),
      frequentlyDelayed: settings.frequentlyDelayed,
      personalBio: personalBio.trim(),
      failureRiskTolerance: personality === "Strict" ? "Low" : personality === "Calm" ? "High" : "Medium"
    };

    try {
      await api.saveSettings(updated);
      onSettingsUpdate(updated);

      // Persist client preferences
      localStorage.setItem("guardian-appearance", appearance);
      localStorage.setItem("guardian-personality", personality);
      localStorage.setItem("guardian-accent", accentColor);
      localStorage.setItem("guardian-compact", String(compactMode));
      localStorage.setItem("guardian-animations", String(animationsEnabled));

      setSuccess(true);
      onAddHistory(
        "Settings Calibrated",
        `Configured Guardian companion (${personality} persona) and personalized interface accents.`
      );
      
      // Auto dismiss success after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save companion customizer", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="companion-customizer-root" className="space-y-8 w-full max-w-7xl mx-auto pb-16 transition-all">
      
      {/* Header Profile Dashboard */}
      <div className="bg-gradient-to-r from-[#6D5DFC]/10 via-[#6D5DFC]/5 to-transparent border border-[#6D5DFC]/15 rounded-3xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-[-40px] right-[-40px] w-40 h-40 bg-[#6D5DFC]/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              Configure Your Companion<span className="text-[#6D5DFC]">.</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Customize how Guardian works for you.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="px-4 py-3 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Reset Profile
              </button>
            )}

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              style={{ backgroundColor: accentColor }}
              className="px-5 py-3 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 transition cursor-pointer shadow-lg shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving Changes..." : "Apply Configurations"}</span>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: Personality Tuning & Interactive Previews */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Companion Live Response Preview Card */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
            <div className="absolute top-[-30px] left-[-30px] w-24 h-24 bg-[#6D5DFC]/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
              <span className="text-[9px] font-mono uppercase text-slate-400 tracking-widest font-extrabold">Companion Preview</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 animate-pulse flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Active Mode
              </span>
            </div>

            {/* Simulated interactive quote avatar bubble */}
            <div className="space-y-4 py-4">
              <div className="flex gap-3.5 items-start">
                <div className="w-12 h-12 shrink-0 animate-pulse">
                  <DeadlineGuardianLogo variant="app-icon" glowing />
                </div>
                
                <div className={`p-4 rounded-2xl text-xs leading-relaxed font-sans italic border ${activeQuote.color} relative`}>
                  <div className="absolute left-[-5px] top-4 w-2.5 h-2.5 transform rotate-45 border-l border-b border-inherit bg-inherit" />
                  {activeQuote.quote}
                </div>
              </div>
            </div>
          </div>

          {/* Personality Configuration Card */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Smile className="w-4 h-4 text-pink-400" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Guardian Personality</h3>
            </div>

            <p className="text-[10.5px] text-slate-400 leading-normal font-sans">
              How Guardian talks to you.
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Calm */}
              <button
                type="button"
                onClick={() => setPersonality("Calm")}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  personality === "Calm"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                    : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block">🧘 Calm Persona</span>
                  <span className="text-[9.5px] text-slate-500 block leading-tight">Short, direct. No drama.</span>
                </div>
                {personality === "Calm" && <Check className="w-4 h-4" />}
              </button>

              {/* Motivational */}
              <button
                type="button"
                onClick={() => setPersonality("Motivational")}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  personality === "Motivational"
                    ? "bg-amber-500/10 border-amber-500 text-amber-400"
                    : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block">⚡ Motivational Persona</span>
                  <span className="text-[9.5px] text-slate-500 block leading-tight">Energetic. Celebrates wins.</span>
                </div>
                {personality === "Motivational" && <Check className="w-4 h-4" />}
              </button>

              {/* Strict */}
              <button
                type="button"
                onClick={() => setPersonality("Strict")}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  personality === "Strict"
                    ? "bg-rose-500/10 border-rose-500 text-rose-400"
                    : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold block">🛡️ Strict Persona</span>
                  <span className="text-[9.5px] text-slate-500 block leading-tight">No-nonsense. Deadlines only.</span>
                </div>
                {personality === "Strict" && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* User Bio configuration Card */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <User className="w-4 h-4 text-[#6D5DFC]" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Identity Details</h3>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[9.5px] text-slate-400 font-mono uppercase font-bold">Your Preferred Name</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  placeholder="e.g. Alveena"
                  className="w-full px-4 py-2 bg-white/5 border border-white/5 hover:border-white/10 text-xs text-white rounded-xl focus:border-[#6D5DFC] focus:outline-none placeholder-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9.5px] text-slate-400 font-mono uppercase font-bold">Your Focus Occupation / Bio</label>
                <input
                  type="text"
                  value={personalBio}
                  onChange={e => setPersonalBio(e.target.value)}
                  placeholder="e.g. Computer Science Student preparing for exams"
                  className="w-full px-4 py-2 bg-white/5 border border-white/5 hover:border-white/10 text-xs text-white rounded-xl focus:border-[#6D5DFC] focus:outline-none placeholder-slate-600"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right column: Appearance, AI behavior toggles, and Privacy */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Appearance settings */}
            <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Eye className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Companion Appearance</h3>
              </div>

              {/* Mode Selectors */}
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[9.5px] text-slate-500 uppercase font-mono block">Visual Theme Mode</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAppearance("Light")}
                      className={`py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        appearance === "Light" 
                          ? "bg-white text-slate-900 border-white" 
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" /> Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppearance("Dark")}
                      className={`py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        appearance === "Dark" 
                          ? "bg-indigo-600 text-white border-indigo-600" 
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" /> Dark
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppearance("Auto")}
                      className={`py-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        appearance === "Auto" 
                          ? "bg-[#6D5DFC]/20 text-[#6D5DFC] border-[#6D5DFC]" 
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5" /> Auto
                    </button>
                  </div>
                </div>

                {/* Accent Selection */}
                <div className="space-y-2">
                  <span className="text-[9.5px] text-slate-500 uppercase font-mono block">Accent Colors</span>
                  <div className="flex gap-3">
                    {[
                      { hex: "#6D5DFC", name: "Lavender" },
                      { hex: "#22C55E", name: "Emerald" },
                      { hex: "#FF5A5F", name: "Coral" },
                      { hex: "#3B82F6", name: "Sky Blue" }
                    ].map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setAccentColor(c.hex)}
                        title={c.name}
                        className="w-7 h-7 rounded-full border-2 relative transition cursor-pointer flex items-center justify-center hover:scale-110 duration-200"
                        style={{ 
                          backgroundColor: c.hex, 
                          borderColor: accentColor === c.hex ? "#FFFFFF" : "transparent"
                        }}
                      >
                        {accentColor === c.hex && (
                          <span className="w-1.5 h-1.5 bg-black rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact and Animations toggles */}
                <div className="space-y-1 pt-1.5">
                  <CustomToggle
                    enabled={compactMode}
                    onChange={setCompactMode}
                    label="Compact Mode"
                    description="Reduces visual margins and spacings."
                  />
                  <CustomToggle
                    enabled={animationsEnabled}
                    onChange={setAnimationsEnabled}
                    label="Animations"
                    description="Smooth dynamic UI transitions."
                  />
                </div>
              </div>
            </div>

            {/* AI Calibration card */}
            <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Calibration Overrides</h3>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9.5px] text-slate-400 font-mono uppercase font-bold">Most Productive Hours</label>
                  <select
                    value={productiveHours}
                    onChange={e => setProductiveHours(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#121214] border border-white/5 text-xs text-slate-300 outline-none"
                  >
                    <option value="Morning">🌅 Morning (6:00 AM - 12:00 PM)</option>
                    <option value="Afternoon">☀️ Afternoon (12:00 PM - 5:00 PM)</option>
                    <option value="Evening">🌌 Evening (5:00 PM - 10:00 PM)</option>
                    <option value="LateNight">🦉 Late Night (10:00 PM - 4:00 AM)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9.5px] text-slate-400 font-mono uppercase font-bold">Standard Focus Block Length</label>
                  <select
                    value={preferredWorkBlock}
                    onChange={e => setPreferredWorkBlock(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#121214] border border-white/5 text-xs text-slate-300 outline-none"
                  >
                    <option value={15}>Micro block (15 minutes)</option>
                    <option value={25}>Pomodoro Block (25 minutes)</option>
                    <option value={50}>Deep Focus Sprint (50 minutes)</option>
                    <option value={90}>Ultra-Density Sprint (90 minutes)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* AI Behaviors Toggles */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Core Companion AI Behaviors</h3>
            </div>

            <p className="text-[10.5px] text-slate-400 leading-normal font-sans">
              Turn features on or off.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomToggle
                enabled={predictDelays}
                onChange={setPredictDelays}
                label="Predict Delays"
                description="Warns if scheduled deadlines have delay risks."
              />
              <CustomToggle
                enabled={rearrangeTasks}
                onChange={setRearrangeTasks}
                label="Rearrange Overdue Tasks"
                description="Auto schedules expired items gracefully."
              />
              <CustomToggle
                enabled={dailyPlans}
                onChange={setDailyPlans}
                label="Generate Daily Plans"
                description="Curates smart daily priorities and breaks."
              />
              <CustomToggle
                enabled={smartReminders}
                onChange={setSmartReminders}
                label="Smart Focus Reminders"
                description="Pushes alerts during scheduled productive hours."
              />
              <CustomToggle
                enabled={habitSuggestions}
                onChange={setHabitSuggestions}
                label="Habit Coaching Suggestions"
                description="Prompts new habits based on pending tasks."
              />
              <CustomToggle
                enabled={weeklyReports}
                onChange={setWeeklyReports}
                label="Weekly Performance Reports"
                description="Creates non-judgmental performance journals."
              />
            </div>
          </div>

          {/* Sensory Alerts / Notifications */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Bell className="w-4 h-4 text-pink-400" />
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Notifications</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CustomToggle
                enabled={morningPlanNotif}
                onChange={setMorningPlanNotif}
                label="Morning Plan Notification"
                description="Push task outline at 8:00 AM."
              />
              <CustomToggle
                enabled={eveningCheckNotif}
                onChange={setEveningCheckNotif}
                label="Evening Check-in Advice"
                description="Review daily achievements at 8:00 PM."
              />
              <CustomToggle
                enabled={deadlineAlertsNotif}
                onChange={setDeadlineAlertsNotif}
                label="Crisis Deadline Alerts"
                description="Alert when a deadline is within 6 hours."
              />
            </div>
          </div>

          {/* Guardian Memory Subsystem Card */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Guardian Memory Engine</h3>
              </div>
              {onResetMemory && memory && (
                <button
                  type="button"
                  onClick={onResetMemory}
                  className="px-2.5 py-1 bg-rose-600/10 border border-rose-500/20 text-rose-300 rounded-lg text-[10px] font-mono hover:bg-rose-600/25 transition cursor-pointer"
                >
                  Reset Memory
                </button>
              )}
            </div>

            <p className="text-[10.5px] text-slate-400 leading-normal font-sans">
              Adaptive intelligence parameters synthesized in real-time by observing your workflows, active habits, and focus logs.
            </p>

            {memory ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Peak Focus Time</span>
                  <span className="text-xs font-bold text-emerald-400 block">{memory.preferredFocusTime || "Evening"}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Synthesized from timer logs.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Session Duration</span>
                  <span className="text-xs font-bold text-white block">{memory.preferredSessionLength || 25} Minutes</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Learned pacing block.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Best Weekday</span>
                  <span className="text-xs font-bold text-indigo-400 block">{memory.mostProductiveDay || "Tuesday"}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Peak completions detected.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Procrastination Zone</span>
                  <span className="text-xs font-bold text-rose-400 block">{memory.frequentlyDelayedCategory || "Study"}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Frequently delayed tags.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Avg Task Effort</span>
                  <span className="text-xs font-bold text-white block">{memory.averageTaskCompletionDuration || "2.0 hours"}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Calculated weight metrics.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Habit Rate</span>
                  <span className="text-xs font-bold text-white block">{memory.habitCompletionRate || "75%"}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Today's routine status.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Burnout Risk</span>
                  <span className={`text-xs font-bold block ${memory.burnoutRiskLevel === "High" ? "text-rose-500" : memory.burnoutRiskLevel === "Medium" ? "text-amber-500" : "text-emerald-400"}`}>{memory.burnoutRiskLevel || "Low"}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Based on pending effort.</p>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-mono uppercase block">Refinement Clock</span>
                  <span className="text-[11px] font-medium text-slate-300 block truncate">{new Date(memory.lastAnalysisTimestamp || Date.now()).toLocaleTimeString()}</span>
                  <p className="text-[9.5px] text-slate-500 font-sans">Adaptive calibration.</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl text-center space-y-1">
                <p className="text-xs text-slate-300 font-semibold">Adaptive calibration in progress...</p>
                <p className="text-[10px] text-slate-500">Add tasks, habits, and log some completed focus timer blocks to populate learned patterns.</p>
              </div>
            )}
          </div>

          {/* Presentation Demo Mode */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">Presentation Demo Mode</h3>
              </div>
              <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/15 font-bold uppercase tracking-wider">
                Hackathon Tool
              </span>
            </div>
            
            <p className="text-[10.5px] text-slate-300 font-sans leading-relaxed">
              Fill the app with sample data for testing.
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to seed Demo Mode? This will overwrite your current tasks and habits with rich, realistic presentation data.")) {
                    if (onTriggerDemoMode) {
                      await onTriggerDemoMode();
                    }
                  }
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition cursor-pointer shadow-lg flex items-center gap-2 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
                Seed Demo Environment
              </button>
            </div>
          </div>

          {/* Privacy & About Compass (Grid split) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Privacy Shield Info Card */}
            <div className="bg-gradient-to-tr from-[#111625]/80 to-[#1d263f]/50 border border-white/5 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-emerald-400 font-sans font-semibold text-xs">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Privacy Shield Active</span>
                </div>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-2.5 py-1 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600/20 text-rose-300 rounded-lg text-[10px] font-semibold transition cursor-pointer"
                  >
                    Clear Guardian Memory
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-slate-300 font-sans leading-relaxed">
                Guardian processes your logs, tasks, and coaching queries via strict secure proxy structures. No tracking databases, and zero data leakage. All focus habits stay fully yours.
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9.5px] text-slate-400 font-mono">Storage Mode</span>
                <span className="text-[9.5px] text-emerald-400 font-medium">Your personal data is stored only on this device.</span>
              </div>
            </div>

          </div>

          {/* Success Dialog Banner */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5 shadow-xl text-emerald-400 text-xs font-mono"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                <span>Your Companion has calibrated and locked in these preferences! 🌿</span>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </form>

    </div>
  );
}
