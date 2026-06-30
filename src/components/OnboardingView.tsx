import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  User, 
  Target, 
  Clock, 
  Smile, 
  ShieldCheck,
  Check
} from "lucide-react";
import { UserSettings } from "../types";
import DeadlineGuardianLogo from "./DeadlineGuardianLogo";

interface OnboardingViewProps {
  userNameInitial: string;
  onOnboardingComplete: (profile: {
    userName: string;
    profession: string;
    goals: string[];
    productiveHours: "Morning" | "Afternoon" | "Evening" | "LateNight";
    personality: "Calm" | "Motivational" | "Strict";
  }) => void;
}

export default function OnboardingView({ userNameInitial, onOnboardingComplete }: OnboardingViewProps) {
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState(userNameInitial || "");
  const [profession, setProfession] = useState<string>("Student");
  const [goals, setGoals] = useState<string[]>([]);
  const [productiveHours, setProductiveHours] = useState<"Morning" | "Afternoon" | "Evening" | "LateNight">("Evening");
  const [personality, setPersonality] = useState<"Calm" | "Motivational" | "Strict">("Calm");

  const toggleGoal = (goal: string) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter(g => g !== goal));
    } else {
      setGoals([...goals, goal]);
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      onOnboardingComplete({
        userName: userName.trim() || "Friend",
        profession,
        goals,
        productiveHours,
        personality
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const goalOptions = [
    "Prepare for Interviews",
    "Complete Semester Successfully",
    "Never Miss Deadlines",
    "Reduce Procrastination",
    "Build Better Habits",
    "Improve Work-Life Balance"
  ];

  const professionOptions = [
    { id: "Student", label: "Student", desc: "Acing academic timelines and tests." },
    { id: "Professional", label: "Professional", desc: "Climbing milestones, managing meetings." },
    { id: "Freelancer", label: "Freelancer", desc: "Slaying deadlines across client deliverables." },
    { id: "Entrepreneur", label: "Entrepreneur", desc: "Building products, launching goals." },
    { id: "Other", label: "Other", desc: "Unlocking focus on personal milestones." }
  ];

  const hourOptions = [
    { id: "Morning", label: "🌅 Morning", desc: "6:00 AM - 12:00 PM" },
    { id: "Afternoon", label: "☀️ Afternoon", desc: "12:00 PM - 5:00 PM" },
    { id: "Evening", label: "🌌 Evening", desc: "5:00 PM - 10:00 PM" },
    { id: "LateNight", label: "🦉 Late Night", desc: "10:00 PM - 4:00 AM" }
  ];

  const personalityOptions = [
    { id: "Calm", label: "🧘 Calm", desc: "Gentle, supportive, priority on physical recovery." },
    { id: "Motivational", label: "⚡ Motivational", desc: "High-energy coaching, streak builders, milestones." },
    { id: "Strict", label: "🛡️ Strict", desc: "Pragmatic, execution-focused, strict timeline rules." }
  ];

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5 w-full text-center md:text-left"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-[#6D5DFC] font-extrabold uppercase tracking-widest block">Step 1 of 5</span>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Let's connect</h2>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                What should your Guardian companion call you?
              </p>
            </div>
            
            <div className="relative max-w-sm mx-auto md:mx-0">
              <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name (e.g. Alveena)"
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/5 hover:border-white/10 text-xs text-white rounded-2xl focus:border-[#6D5DFC] focus:outline-none transition-all placeholder-slate-600"
              />
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5 w-full"
          >
            <div className="space-y-1 text-center md:text-left">
              <span className="text-[10px] font-mono text-[#6D5DFC] font-extrabold uppercase tracking-widest block">Step 2 of 5</span>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Your Role</h2>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                What best describes your current focus or profession?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              {professionOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setProfession(opt.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-0.5 cursor-pointer relative ${
                    profession === opt.id
                      ? "bg-[#6D5DFC]/10 border-[#6D5DFC] text-white"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  }`}
                >
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 block leading-tight font-sans mt-0.5">{opt.desc}</span>
                  {profession === opt.id && (
                    <div className="absolute right-3.5 top-3.5 w-4 h-4 bg-[#6D5DFC] rounded-full flex items-center justify-center p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5 w-full"
          >
            <div className="space-y-1 text-center md:text-left">
              <span className="text-[10px] font-mono text-[#6D5DFC] font-extrabold uppercase tracking-widest block">Step 3 of 5</span>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Primary Goals</h2>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                What would you like to achieve with Guardian? (Select all that apply)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg">
              {goalOptions.map((goal) => {
                const selected = goals.includes(goal);
                return (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      selected
                        ? "bg-[#6D5DFC]/10 border-[#6D5DFC] text-[#6D5DFC] font-bold"
                        : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300 font-sans text-xs"
                    }`}
                  >
                    <span className="text-xs">{goal}</span>
                    {selected ? (
                      <div className="w-4.5 h-4.5 bg-[#6D5DFC] rounded-full flex items-center justify-center p-0.5 shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-4.5 h-4.5 bg-white/5 rounded-full border border-white/10 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5 w-full"
          >
            <div className="space-y-1 text-center md:text-left">
              <span className="text-[10px] font-mono text-[#6D5DFC] font-extrabold uppercase tracking-widest block">Step 4 of 5</span>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Circadian Flow</h2>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                When are you usually at your highest productivity week-to-week?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              {hourOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setProductiveHours(opt.id as any)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-0.5 cursor-pointer relative ${
                    productiveHours === opt.id
                      ? "bg-[#6D5DFC]/10 border-[#6D5DFC] text-white"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  }`}
                >
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 block leading-tight font-sans mt-0.5">{opt.desc}</span>
                  {productiveHours === opt.id && (
                    <div className="absolute right-3.5 top-3.5 w-4 h-4 bg-[#6D5DFC] rounded-full flex items-center justify-center p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5 w-full"
          >
            <div className="space-y-1 text-center md:text-left">
              <span className="text-[10px] font-mono text-[#6D5DFC] font-extrabold uppercase tracking-widest block">Step 5 of 5</span>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Emotional Vibe</h2>
              <p className="text-xs text-slate-400 font-sans leading-normal">
                What personality tone should your Guardian defender adopt?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
              {personalityOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPersonality(opt.id as any)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer relative h-32 justify-between ${
                    personality === opt.id
                      ? "bg-[#6D5DFC]/10 border-[#6D5DFC] text-white"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  }`}
                >
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className="text-[9.5px] text-slate-400 block leading-tight font-sans">{opt.desc}</span>
                  {personality === opt.id && (
                    <div className="w-4 h-4 bg-[#6D5DFC] rounded-full flex items-center justify-center p-0.5 self-end">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#060A13] text-slate-200 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <div className="w-full max-w-xl bg-[#0F172A]/75 border border-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl relative z-10">
        
        {/* Onboarding Branding Progress */}
        <div className="flex items-center justify-between pb-6 border-b border-white/5 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8">
              <DeadlineGuardianLogo variant="app-icon" glowing />
            </div>
            <span className="text-[11px] text-white uppercase tracking-wider font-extrabold">Guardian System Calibrator</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-300 ${
                  i <= step ? "w-6 bg-[#6D5DFC]" : "w-2 bg-white/10"
                }`} 
              />
            ))}
          </div>
        </div>

        {/* Form Body Container */}
        <div className="min-h-[220px] flex items-center">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-6">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            Back
          </button>
          
          <button
            onClick={handleNext}
            disabled={step === 1 && !userName.trim()}
            className="px-5 py-2.5 bg-[#6D5DFC] hover:bg-[#5B4CEB] text-xs font-bold text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
          >
            <span>{step === 5 ? "Initialize Sovereign Guard" : "Continue"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
