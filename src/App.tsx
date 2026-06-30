import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  ListTodo, 
  Bot, 
  BarChart2, 
  Settings,
  Bell,
  Menu,
  X,
  Sun,
  Moon,
  MessageSquare,
  Send,
  Zap,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  Heart,
  Target,
  Search,
  Check,
  Shield
} from "lucide-react";
import { Task, UserSettings, TimeBlock } from "./types";
import { api } from "./lib/api";
import { storageService, setStorageUser } from "./lib/storageService";
import { auth, onAuthStateChanged } from "./lib/firebase";
import OnboardingView from "./components/OnboardingView";
import AuthView from "./components/AuthView";

// Import individual modular Views
import DashboardView from "./components/DashboardView";
import TaskManagerView from "./components/TaskManagerView";
import GuardianView from "./components/GuardianView";
import AnalyticsView from "./components/AnalyticsView";
import SettingsView from "./components/SettingsView";
import CalendarView from "./components/CalendarView";
import ConfirmationDialog from "./components/ConfirmationDialog";
import HabitsView from "./components/HabitsView";
import FocusModeView from "./components/FocusModeView";
import DeadlineGuardianLogo from "./components/DeadlineGuardianLogo";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [scheduleBlocks, setScheduleBlocks] = useState<TimeBlock[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth and Onboarding States
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string | null; isGuest: boolean } | null>(null);
  const [onboarded, setOnboarded] = useState<boolean>(true);
  const [memory, setMemory] = useState<any | null>(null);
  const [isResettingMemory, setIsResettingMemory] = useState(false);
  
  // Collapsible sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("guardian-sidebar-collapsed");
    return saved === "true";
  });
  const isSidebarExpanded = !sidebarCollapsed;

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("guardian-theme");
    return saved === "dark" ? "dark" : "light";
  });

  // Celebration state
  const [celebration, setCelebration] = useState<{ message: string; show: boolean } | null>(null);

  // Floating AI Companion state
  const [companionSessionId] = useState(() => "comp_session_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now());
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionInput, setCompanionInput] = useState("");
  const [companionMessages, setCompanionMessages] = useState<{ sender: "user" | "guardian"; text: string }[]>(() => [
    { sender: "guardian", text: "Hello! I am your AI Productivity Strategist. I can analyze your tasks, organize calendars, create weekly schedules, and prepare focus block plans. Let's optimize your workspace together." }
  ]);
  const [companionLoading, setCompanionLoading] = useState(false);

  // Smart bridging state: when user clicks "Ask Guardian" on task cards, we set activeTab to "guardian"
  const [sharedTaskContext, setSharedTaskContext] = useState<string>("");

  // Global search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

  // Global search shortcut ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("guardian-theme", nextTheme);
  };

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem("guardian-sidebar-collapsed", String(nextState));
  };

  const loadUserProfileAndData = async (uid: string | null = null) => {
    try {
      const profile = storageService.getUserProfile();
      if (profile && profile.onboarded) {
        setOnboarded(true);
        setSettings(profile.settings);
        setMemory(profile.memory || null);

        // Load local collections
        const [loadedTasks, loadedHabits] = await Promise.all([
          storageService.getTasks(),
          storageService.getHabits()
        ]);

        setTasks(loadedTasks);
        if (loadedHabits.length > 0) {
          const keyPrefix = uid ? `_${uid}` : "";
          localStorage.setItem(`guardian-habits-v2${keyPrefix}`, JSON.stringify(loadedHabits));
        } else {
          const defaultHabits = [
            { id: "h-1", name: "Deep Study Block", category: "Study", streak: 7, completedToday: false, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", icon: "book" },
            { id: "h-2", name: "Physical Exercise", category: "Exercise", streak: 5, completedToday: false, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: "dumbbell" },
            { id: "h-3", name: "Mindful Reading", category: "Reading", streak: 12, completedToday: false, color: "text-pink-400 bg-pink-500/10 border-pink-500/20", icon: "reading" },
            { id: "h-4", name: "Hydrate (8 glasses)", category: "Water", streak: 14, completedToday: false, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "droplet" },
            { id: "h-5", name: "Restful Sleep (8h)", category: "Sleep", streak: 8, completedToday: false, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: "moon" }
          ];
          for (const h of defaultHabits) {
            await storageService.saveHabit(h as any);
          }
          setTasks([]);
        }
      } else {
        setOnboarded(false);
        setSettings(null);
        setMemory(null);
        setTasks([]);
      }
    } catch (err) {
      console.error("Failed to load local user datasets", err);
    }
  };

  // Auth Subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);
        if (firebaseUser) {
          setStorageUser(firebaseUser.uid);
          setCurrentUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            isGuest: false
          });
          await loadUserProfileAndData(firebaseUser.uid);
        } else {
          // If no firebaseUser, check if we currently have a guest session.
          // Otherwise, clear user.
          setCurrentUser(prev => {
            if (prev && prev.isGuest) {
              return prev; // Retain guest user state
            }
            setStorageUser(null);
            return null;
          });
        }
      } catch (err) {
        console.error("Authentication check failed", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleContinueAsGuest = async () => {
    setLoading(true);
    try {
      setStorageUser("guest-user");
      setCurrentUser({
        uid: "guest-user",
        email: null,
        isGuest: true
      });
      await loadUserProfileAndData("guest-user");
    } catch (err) {
      console.error("Failed to enter Guest Mode", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = async (user: { uid: string; email: string | null; isGuest: boolean }) => {
    setLoading(true);
    try {
      setStorageUser(user.uid);
      setCurrentUser(user);
      await loadUserProfileAndData(user.uid);
    } catch (err) {
      console.error("Failed to initialize authenticated user data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = async (profileData: {
    userName: string;
    profession: string;
    goals: string[];
    productiveHours: "Morning" | "Afternoon" | "Evening" | "LateNight";
    personality: "Calm" | "Motivational" | "Strict";
  }) => {
    setLoading(true);
    try {
      const initialSettings: UserSettings = {
        userName: profileData.userName,
        productiveHours: profileData.productiveHours,
        preferredWorkBlock: 25,
        frequentlyDelayed: ["Finance"],
        personalBio: `${profileData.profession} focusing on: ${profileData.goals.join(", ")}`,
        failureRiskTolerance: profileData.personality === "Strict" ? "Low" : profileData.personality === "Calm" ? "High" : "Medium"
      };

      const initialMem = {
        preferredFocusTime: profileData.productiveHours,
        preferredSessionLength: 25,
        mostProductiveDay: "Tuesday",
        reminderPreference: profileData.productiveHours === "Evening" ? "7:00 PM" : "9:00 AM",
        currentProductivityGoal: `${profileData.profession}: ${profileData.goals.join(", ")}`,
        frequentlyDelayedCategory: "Study",
        averageTaskCompletionDuration: "2.0 hours",
        habitCompletionRate: "75%",
        burnoutRiskLevel: "Low" as const,
        lastAnalysisTimestamp: new Date().toISOString()
      };

      const profilePayload = {
        onboarded: true,
        settings: initialSettings,
        profile: {
          profession: profileData.profession,
          goals: profileData.goals,
          personality: profileData.personality
        },
        memory: initialMem
      };

      // Save user profile locally
      storageService.saveUserProfile(profilePayload);
      setSettings(initialSettings);
      setMemory(initialMem);

      // Seed default tasks in Local IndexedDB
      const initialTasks = [
        {
          id: "task-1",
          title: "Setup study goals & roadmap",
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          estimatedEffort: 1,
          category: "Study" as const,
          priority: "Critical" as const,
          urgencyScore: 9,
          riskLevel: "High" as const,
          riskExplanation: "This task is overdue. Start now.",
          completed: false,
          subtasks: ["Setup parameters", "Confirm details"],
          createdAt: new Date().toISOString()
        }
      ];

      for (const t of initialTasks) {
        await storageService.saveTask(t);
      }
      setTasks(initialTasks);

      // Initialize default habits locally
      const defaultHabits = [
        { id: "h-1", name: "Deep Study Block", category: "Study", streak: 0, completedToday: false, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", icon: "book" },
        { id: "h-2", name: "Physical Exercise", category: "Exercise", streak: 0, completedToday: false, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: "dumbbell" },
        { id: "h-3", name: "Mindful Reading", category: "Reading", streak: 0, completedToday: false, color: "text-pink-400 bg-pink-500/10 border-pink-500/20", icon: "reading" },
        { id: "h-4", name: "Hydrate (8 glasses)", category: "Water", streak: 0, completedToday: false, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "droplet" },
        { id: "h-5", name: "Restful Sleep (8h)", category: "Sleep", streak: 0, completedToday: false, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: "moon" }
      ];
      for (const h of defaultHabits) {
        await storageService.saveHabit(h as any);
      }

      // Trigger first history log
      await storageService.saveHistoryLog({
        timestamp: new Date().toISOString(),
        action: "Initialization",
        details: "Welcome to The Deadline Guardian!"
      });

      localStorage.setItem("guardian-personality", profileData.personality);
      setOnboarded(true);
    } catch (err) {
      console.error("Onboarding saving error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetMemory = async () => {
    setIsResettingMemory(true);
  };

  const confirmResetMemory = async () => {
    if (!settings) return;
    try {
      setLoading(true);
      const initialMem = {
        preferredFocusTime: settings.productiveHours || "Evening",
        preferredSessionLength: settings.preferredWorkBlock || 25,
        mostProductiveDay: "Tuesday",
        reminderPreference: "7:00 PM",
        currentProductivityGoal: settings.personalBio || "Maintain academic consistency",
        frequentlyDelayedCategory: "Study",
        averageTaskCompletionDuration: "2.0 hours",
        habitCompletionRate: "75%",
        burnoutRiskLevel: "Low" as const,
        lastAnalysisTimestamp: new Date().toISOString()
      };
      
      const currentProfile = storageService.getUserProfile() || {};
      storageService.saveUserProfile({
        ...currentProfile,
        memory: initialMem
      });
      setMemory(initialMem);
      await handleAddHistory("Memory Calibrated", "User requested manual reset of learned behavioral attributes.");
    } catch (err) {
      console.error("Failed to reset memory", err);
    } finally {
      setLoading(false);
      setIsResettingMemory(false);
    }
  };

  const handleTriggerDemoMode = async () => {
    const currentSettings = settings || {
      userName: "Alex",
      productiveHours: "Evening" as const,
      preferredWorkBlock: 35,
      frequentlyDelayed: ["Shopping"],
      personalBio: "Software Engineer focusing on: Technical Prep",
      failureRiskTolerance: "Medium" as const
    };

    try {
      setLoading(true);
      const updatedProfile = await storageService.seedDemoData(currentSettings);
      setSettings(updatedProfile.settings);
      setMemory(updatedProfile.memory);
      setOnboarded(true);
      
      // Reload collections from storage
      const loadedTasks = await storageService.getTasks();
      setTasks(loadedTasks);
      
      // Synchronize with backend server database
      await api.saveSettings(updatedProfile.settings);
      await api.saveTasks(loadedTasks);

      // Load seeded history logs and sync to server
      const loadedLogs = await storageService.getHistoryLogs();
      await api.syncLogs(loadedLogs);
      
      // Record seed action to history
      await handleAddHistory("Demo Mode Seeding", "Guardian has populated fully simulated demo datasets.");

      // Notify other views (like HabitsView) to reload custom data immediately
      window.dispatchEvent(new CustomEvent("guardian-habits-updated"));
    } catch (err) {
      console.error("Failed to seed demo mode", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      if (currentUser && !currentUser.isGuest) {
        const { signOut: firebaseSignOut } = await import("firebase/auth");
        await firebaseSignOut(auth);
      }
      setStorageUser(null);
      setCurrentUser(null);
      setSettings(null);
      setMemory(null);
      setTasks([]);
      setOnboarded(false);
    } catch (err) {
      console.error("Failed to sign out from workspace", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync theme class to document element
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
  }, [theme]);

  // Sync tasks locally and to backend if needed
  const handleTasksUpdate = async (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    try {
      // Save tasks locally to IndexedDB
      for (const t of updatedTasks) {
        await storageService.saveTask(t);
      }
      // Also recalculate memory attributes locally
      const mem = await storageService.calculateAndSaveMemory(
        updatedTasks,
        JSON.parse(localStorage.getItem("guardian-habits-v2") || "[]"),
        [],
        settings!
      );
      setMemory(mem);
    } catch (err) {
      console.error("Failed to sync updated task list with local database", err);
    }
    try {
      await api.saveTasks(updatedTasks);
    } catch (err) {
      console.error("Failed to sync updated task list with server", err);
    }
  };

  const handleSettingsUpdate = async (updatedSettings: UserSettings) => {
    setSettings(updatedSettings);
    try {
      const currentProfile = storageService.getUserProfile() || {};
      storageService.saveUserProfile({ ...currentProfile, settings: updatedSettings });
      const mem = await storageService.calculateAndSaveMemory(
        tasks,
        JSON.parse(localStorage.getItem("guardian-habits-v2") || "[]"),
        [],
        updatedSettings
      );
      setMemory(mem);
    } catch (err) {
      console.error("Failed to sync updated settings with local database", err);
    }
  };

  const handleAddHistory = async (action: string, details: string) => {
    const timestamp = new Date().toISOString();
    try {
      await storageService.saveHistoryLog({ timestamp, action, details });
    } catch (err) {
      console.error("Failed to sync log to local database", err);
    }
    try {
      await api.addLog(action, details);
    } catch (err) {
      console.error("Failed to sync log entry with server", err);
    }
  };

  const handleToggleComplete = async (id: string) => {
    let justCompleted = false;
    const updated = tasks.map(t => {
      if (t.id === id) {
        const completed = !t.completed;
        if (completed) justCompleted = true;
        return {
          ...t,
          completed,
          completedAt: completed ? new Date().toISOString() : undefined
        };
      }
      return t;
    });
    setTasks(updated);

    if (justCompleted) {
      const msgs = [
        "Great job! You made real progress.",
        "One less thing to worry about. Keep going!",
        "You made progress today. Your future self is smiling!",
        "Fantastic! That's how it's done.",
        "Clean checkmark! You're staying in control."
      ];
      const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
      setCelebration({ message: randomMsg, show: true });
      setTimeout(() => {
        setCelebration(prev => prev ? { ...prev, show: false } : null);
      }, 3500);
    }

    try {
      await api.saveTasks(updated);
      const t = tasks.find(item => item.id === id);
      if (t) {
        await handleAddHistory(
          t.completed ? "Reopened Task" : "Completed Task",
          `Status of "${t.title}" synchronized.`
        );
      }
    } catch (err) {
      console.error("Failed to toggle completion status on server", err);
    }
  };

  // Conversational helper for floating companion panel
  const handleCompanionSend = async (text: string) => {
    if (!text.trim()) return;

    // Premium quick action interception
    if (text === "Save My Day") {
      localStorage.setItem("guardian-trigger-save-my-day", "true");
      setActiveTab("dashboard");
      setCompanionOpen(false);
      return;
    }
    
    // Add user message
    const userMsg = { sender: "user" as const, text };
    setCompanionMessages(prev => [...prev, userMsg]);
    setCompanionInput("");
    setCompanionLoading(true);

    try {
      const chatLogs = [...companionMessages, userMsg].map(m => ({
        sender: (m.sender === "guardian" ? "bot" : "user") as "user" | "bot",
        text: m.text
      }));

      const habitsStr = localStorage.getItem("guardian-habits-v2") || "[]";
      let habits: any[] = [];
      try {
        habits = JSON.parse(habitsStr);
      } catch (e) {}

      let focusHistory: any[] = [];
      try {
        focusHistory = await storageService.getFocusHistory();
      } catch (e) {}

      const response = await api.chat(chatLogs, settings!, tasks, habits, focusHistory, companionSessionId);
      setCompanionMessages(prev => [...prev, { sender: "guardian", text: response.response }]);
    } catch (err: any) {
      console.error("Companion chat failed", err);
      setCompanionMessages(prev => [...prev, { 
        sender: "guardian", 
        text: "I encountered a temporary communication issue. Please specify your productivity goals, deadlines, or workload questions, and I will generate an optimized, structured schedule and priority recommendation." 
      }]);
    } finally {
      setCompanionLoading(false);
    }
  };

  // Triggered when clicking "Ask Guardian" on task cards
  const handleAskGuardianAboutTask = (taskTitle: string) => {
    setSharedTaskContext(taskTitle);
    setActiveTab("guardian");
  };

  // Premium navigation items exactly as requested!
  const navItems = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "guardian", label: "Guardian", icon: Bot },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "focus", label: "Focus", icon: Target },
    { id: "analytics", label: "Progress", icon: BarChart2 },
    { id: "habits", label: "Habits", icon: Heart },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // Search logic
  const getSearchResults = () => {
    if (!searchQuery.trim()) {
      return [
        ...navItems.map(item => ({ type: "page", id: item.id, label: `Go to ${item.label}`, icon: item.icon })),
        ...tasks.slice(0, 4).map(task => ({ type: "task", id: task.id, label: task.title, status: task.completed ? "completed" : "active" }))
      ];
    }

    const query = searchQuery.toLowerCase();
    const pages = navItems
      .filter(item => item.label.toLowerCase().includes(query))
      .map(item => ({ type: "page", id: item.id, label: `Go to ${item.label}`, icon: item.icon }));

    const filteredTasks = tasks
      .filter(task => task.title.toLowerCase().includes(query))
      .map(task => ({ type: "task", id: task.id, label: task.title, status: task.completed ? "completed" : "active" }));

    return [...pages, ...filteredTasks];
  };

  const searchResults = getSearchResults();

  // Keyboard navigation for search modal
  useEffect(() => {
    if (!searchOpen) return;
    const handleSearchKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSearchSelectedIndex(prev => (prev + 1) % Math.max(1, searchResults.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSearchSelectedIndex(prev => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (searchResults[searchSelectedIndex]) {
          const selected = searchResults[searchSelectedIndex];
          if (selected.type === "page") {
            setActiveTab(selected.id);
          } else if (selected.type === "task") {
            setActiveTab("tasks");
          }
          setSearchOpen(false);
          setSearchQuery("");
        }
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleSearchKeyDown);
    return () => window.removeEventListener("keydown", handleSearchKeyDown);
  }, [searchOpen, searchResults, searchSelectedIndex]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 select-none transition-all duration-500">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          {/* Pulsing Avatar Sphere */}
          <div className="relative">
            <div className="w-16 h-16 animate-guardian-breathe">
              <DeadlineGuardianLogo variant="app-icon" glowing />
            </div>
            <span className="absolute bottom-0 right-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </span>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-extrabold tracking-tight font-sans text-white">Guardian is readying your space</h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-[280px]">
              Analyzing your tasks and preparing your schedule for absolute peace of mind...
            </p>
          </div>
          
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-400">
            <div className="w-1.5 h-1.5 bg-indigo-50 rounded-full animate-dot-pulse" style={{ animationDelay: "0s" }}></div>
            <div className="w-1.5 h-1.5 bg-indigo-50 rounded-full animate-dot-pulse" style={{ animationDelay: "0.2s" }}></div>
            <div className="w-1.5 h-1.5 bg-indigo-50 rounded-full animate-dot-pulse" style={{ animationDelay: "0.4s" }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthView 
        onAuthSuccess={handleAuthSuccess} 
        onContinueAsGuest={handleContinueAsGuest} 
      />
    );
  }

  if (!onboarded) {
    return (
      <OnboardingView 
        userNameInitial="" 
        onOnboardingComplete={handleOnboardingComplete} 
      />
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 select-none transition-all duration-500">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          {/* Pulsing Avatar Sphere */}
          <div className="relative">
            <div className="w-16 h-16 animate-guardian-breathe">
              <DeadlineGuardianLogo variant="app-icon" glowing />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-extrabold tracking-tight font-sans text-white">Configuring Companion Profile</h3>
          </div>
        </div>
      </div>
    );
  }

  const getGuardianStatus = () => {
    const personality = localStorage.getItem("guardian-personality") || "Calm";
    let mood = "Calm 🧘";
    let advice = "Take a slow, steady breath. Your future self is smiling.";
    if (personality === "Strict") {
      mood = "Focused 🛡️";
      advice = "Lock in your focus workspace right now and conquer distractions.";
    } else if (personality === "Motivational") {
      mood = "Energetic ⚡";
      advice = "Let's build that momentum today! You've got incredible power.";
    }
    return { mood, advice };
  };

  return (
    <div className={`h-screen w-screen overflow-hidden bg-[#0B1120] text-slate-200 flex flex-col md:flex-row antialiased select-none font-sans selection:bg-indigo-500/30 selection:text-white relative ${theme === "light" ? "theme-light" : ""}`}>
      
      {/* Background Blur Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* 1. Sidebar Navigation (Desktop only with Collapsible States) */}
      <aside 
        className={`hidden md:flex flex-col justify-between shrink-0 select-none z-20 h-screen premium-sidebar ${
          isSidebarExpanded ? "w-[280px] p-5" : "w-[72px] p-3"
        }`}
      >
        <div className="space-y-5">
          {/* Brand/Logo & Collapse Toggle Button */}
          <div className={`flex items-center transition-all duration-300 ${isSidebarExpanded ? "justify-between px-2 py-1" : "flex-col gap-4 justify-center py-2"}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${!isSidebarExpanded ? "justify-center" : ""}`}>
              <div className="w-8 h-8 shrink-0">
                <DeadlineGuardianLogo variant="app-icon" glowing={false} />
              </div>
              {isSidebarExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="truncate"
                >
                  <h1 className="font-sans font-extrabold text-sm tracking-tight text-white uppercase leading-none">
                    GUARDIAN
                  </h1>
                  <span className="text-[9px] text-[#6D5DFC] font-mono tracking-widest block font-semibold mt-0.5">DEADLINE DEFENSE</span>
                </motion.div>
              )}
            </div>
            
            {/* Collapse Toggle trigger */}
            <button
              onClick={toggleSidebar}
              className={`bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white transition hidden md:flex items-center justify-center cursor-pointer shrink-0 ${
                !isSidebarExpanded ? "w-8 h-8" : "p-1 ml-1"
              }`}
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Search Trigger (⌘K) */}
          <div className="px-1">
            {isSidebarExpanded ? (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-xs text-slate-400 transition-all group cursor-pointer ${
                  theme === "light" ? "hover:bg-[#F3F4F6] hover:text-slate-800" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <span className="font-sans text-[11.5px]">Search or command...</span>
                </div>
                <span className="text-[9px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded font-mono text-slate-500">⌘K</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={`w-10 h-10 mx-auto flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-slate-400 transition-all group cursor-pointer relative ${
                  theme === "light" ? "hover:bg-[#F3F4F6] hover:text-slate-800" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Search className="w-4 h-4 shrink-0" />
                <span className="absolute left-16 px-2.5 py-1.5 bg-[#151D33] border border-white/10 text-white text-[10px] rounded-lg shadow-xl font-medium font-sans opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
                  Global Search (⌘K)
                </span>
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center rounded-xl text-xs font-medium tracking-tight transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group border cursor-pointer relative ${
                    !isSidebarExpanded ? "justify-center p-3" : "gap-3 px-4 py-3"
                  } ${
                    isActive 
                      ? "bg-[#6D5DFC]/10 text-[#6D5DFC] font-bold border-l-[3.5px] border-l-[#6D5DFC] border-y-transparent border-r-transparent shadow-sm" 
                      : `text-slate-400 border-l-[3.5px] border-transparent border-y-transparent border-r-transparent hover:bg-[#6D5DFC]/5 hover:text-[#6D5DFC] ${
                          theme === "light" 
                            ? "hover:bg-[#F3F4F6] hover:text-slate-800" 
                            : "hover:bg-white/5 hover:text-white"
                        }`
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-all duration-200 group-hover:scale-105 ${
                    isActive ? "text-[#6D5DFC]" : "text-slate-400 opacity-60 group-hover:opacity-100"
                  }`} 
                  />
                  {isSidebarExpanded ? (
                    <span className={`transition-colors duration-200 ${isActive ? "text-[#6D5DFC]" : ""}`}>{item.label}</span>
                  ) : (
                    /* Elegant Tooltip matching Slack/Linear */
                    <span className="absolute left-16 px-2.5 py-1.5 bg-[#151D33] border border-white/10 text-white text-[10px] rounded-lg shadow-xl font-medium font-sans opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Promo block & profile (hidden or collapsed as a tiny badge) */}
        {isSidebarExpanded ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3.5"
          >
            {/* Elegant motivational card with Status Online */}
            <div className="p-3.5 bg-gradient-to-b from-[#6D5DFC]/8 to-transparent border border-[#6D5DFC]/15 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-[#6D5DFC]/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Guardian Online</span>
                </div>
                <span className="text-[9px] font-semibold text-slate-500 font-mono">v2.4</span>
              </div>
            </div>

            {/* User Profile Info */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
              <div className="truncate pr-2">
                <div className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-tight">Active Client</div>
                <div className="text-slate-200 text-xs font-semibold truncate mt-0.5 font-sans">{settings.userName}</div>
              </div>
              <Zap className="w-3.5 h-3.5 text-[#6D5DFC] animate-pulse shrink-0" />
            </div>
          </motion.div>
        ) : (
          <div className="mt-auto pt-4 border-t border-white/10 flex flex-col items-center gap-3 relative group cursor-pointer">
            {/* Tiny pulsing avatar */}
            <div className="relative">
              <div className="w-10 h-10 hover:scale-105 transition-transform duration-200">
                <DeadlineGuardianLogo variant="app-icon" glowing />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#151D33]"></span>
              </span>
            </div>
            
            {/* Hover Popover Tooltip for Collapsed bottom Guardian */}
            <div className="absolute left-16 bottom-2 w-64 p-4 bg-[#11131a] border border-white/10 rounded-2xl shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none z-50 text-left space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Guardian Online</span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">v2.4</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-mono block">TODAY'S ADVICE</span>
                <p className="text-[10.5px] text-slate-300 font-sans italic mt-0.5 leading-relaxed">
                  "{getGuardianStatus().advice}"
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Mobile Nav Header (Auto-hide and dynamic theme support) */}
      <header className={`md:hidden flex items-center justify-between backdrop-blur-xl border-b p-4 shrink-0 z-20 transition-all ${
        theme === "light" 
          ? "bg-white/80 border-slate-200/80 text-slate-800" 
          : "bg-black/40 border-white/10 text-slate-200"
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 shrink-0">
            <DeadlineGuardianLogo variant="app-icon" glowing={false} />
          </div>
          <span className={`font-extrabold text-sm tracking-tight uppercase ${theme === "light" ? "text-slate-900" : "text-white"}`}>GUARDIAN</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSearchOpen(true)}
            className={`p-1.5 border rounded-xl transition ${
              theme === "light"
                ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Search (⌘K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className={`p-1.5 border rounded-xl transition cursor-pointer animate-none ${
              theme === "light"
                ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
            }`}
            title={theme === "dark" ? "Daylight Theme" : "Midnight Theme"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1 transition ${
              theme === "light" ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Side Drawer with Background Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Dark Blur Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />

            {/* Left sliding side drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={`fixed inset-y-0 left-0 w-[280px] p-5 flex flex-col justify-between z-50 shadow-2xl md:hidden overflow-y-auto border-r ${
                theme === "light"
                  ? "bg-white border-slate-200/80"
                  : "bg-[#0E1322]/95 border-white/10"
              }`}
            >
              <div className="space-y-6">
                {/* Header inside side drawer with brand logo and close button */}
                <div className={`flex items-center justify-between pb-4 border-b ${theme === "light" ? "border-slate-200/80" : "border-white/5"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 shrink-0">
                      <DeadlineGuardianLogo variant="app-icon" glowing={false} />
                    </div>
                    <div>
                      <h1 className={`font-sans font-extrabold text-sm tracking-tight uppercase leading-none ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                        GUARDIAN
                      </h1>
                      <span className="text-[9px] text-[#6D5DFC] font-mono tracking-widest block font-semibold mt-0.5">DEADLINE DEFENSE</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className={`p-1.5 border rounded-lg transition ${
                      theme === "light"
                        ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white"
                    }`}
                    title="Close Menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Navigation Links in Mobile Side Drawer */}
                <nav className="space-y-1 mt-4">
                  {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-tight transition-all border cursor-pointer ${
                          isActive 
                            ? "bg-[#6D5DFC]/10 text-[#6D5DFC] font-bold border-l-4 border-l-[#6D5DFC] border-y-transparent border-r-transparent shadow-sm" 
                            : `text-slate-400 border-l-4 border-transparent border-y-transparent border-r-transparent ${
                                theme === "light" 
                                  ? "hover:bg-[#F3F4F6] hover:text-slate-800" 
                                  : "hover:bg-white/5 hover:text-white"
                              }`
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#6D5DFC]" : "text-slate-400"}`} />
                        <span className={isActive ? "text-[#6D5DFC]" : ""}>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Promo and Companion Profile in Mobile Side Drawer */}
              <div className={`space-y-3.5 pt-6 border-t ${theme === "light" ? "border-slate-200/80" : "border-white/5"}`}>
                <div className={`p-3.5 rounded-2xl relative overflow-hidden border ${
                  theme === "light"
                    ? "bg-[#6D5DFC]/5 border-[#6D5DFC]/20"
                    : "bg-gradient-to-b from-[#6D5DFC]/8 to-transparent border-[#6D5DFC]/15"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-wider">Guardian Active</span>
                  </div>
                  <p className={`text-[11px] leading-normal font-sans mt-2 ${theme === "light" ? "text-slate-700" : "text-slate-300"}`}>
                    "{getGuardianStatus().advice}"
                  </p>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  theme === "light"
                    ? "bg-slate-50 border-slate-200/80"
                    : "bg-white/5 border-white/5"
                }`}>
                  <div className="truncate pr-2">
                    <div className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-tight">Active Client</div>
                    <div className={`text-xs font-semibold truncate mt-0.5 ${theme === "light" ? "text-slate-800" : "text-slate-200"}`}>{settings.userName}</div>
                  </div>
                  <Zap className="w-3.5 h-3.5 text-[#6D5DFC] animate-pulse shrink-0" />
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 3. Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 z-10 h-full overflow-hidden">
        
        {/* Floating Utility/Breadcrumb bar */}
        <div className="hidden md:flex justify-between items-center bg-transparent px-8 py-4 border-b border-white/5 select-none">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-white/5 text-slate-400 border border-white/10 px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-tight">Active View</span>
            <span className="text-slate-500 font-mono text-xs">/</span>
            <span className="text-slate-300 text-xs font-medium capitalize font-mono">{activeTab} section</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-slate-200 transition text-xs font-mono cursor-pointer"
              title={theme === "dark" ? "Daylight Mode" : "Midnight Mode"}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition text-xs font-mono cursor-pointer">
              <Bell className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span>Status Sync: Stable</span>
            </div>
          </div>
        </div>

        {/* Unified Tab Viewer with transitions */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "dashboard" && (
                <DashboardView 
                  tasks={tasks} 
                  settings={settings} 
                  onNavigate={setActiveTab}
                  onToggleComplete={handleToggleComplete}
                  onTasksUpdate={handleTasksUpdate}
                  onAddHistory={handleAddHistory}
                  onAskGuardianAboutTask={handleAskGuardianAboutTask}
                  theme={theme}
                />
              )}
              
              {activeTab === "tasks" && (
                <TaskManagerView 
                  tasks={tasks} 
                  settings={settings}
                  onTasksUpdate={handleTasksUpdate} 
                  onAddHistory={handleAddHistory}
                  onNavigate={setActiveTab}
                  onAskGuardianAboutTask={handleAskGuardianAboutTask}
                />
              )}

              {activeTab === "guardian" && (
                <GuardianView 
                  tasks={tasks} 
                  settings={settings} 
                  scheduleBlocks={scheduleBlocks}
                  onScheduleBlocksUpdate={setScheduleBlocks}
                  onTasksUpdate={handleTasksUpdate}
                  onAddHistory={handleAddHistory}
                />
              )}

              {activeTab === "analytics" && (
                <AnalyticsView 
                  tasks={tasks} 
                />
              )}

              {activeTab === "calendar" && (
                <CalendarView 
                  tasks={tasks} 
                  settings={settings}
                  onTasksUpdate={handleTasksUpdate}
                  onAddHistory={handleAddHistory}
                />
              )}

              {activeTab === "focus" && (
                <FocusModeView 
                  settings={settings}
                  onAddHistory={handleAddHistory}
                />
              )}

              {activeTab === "habits" && (
                <HabitsView 
                  onAddHistory={handleAddHistory}
                />
              )}

              {activeTab === "settings" && (
                <SettingsView 
                  settings={settings} 
                  onSettingsUpdate={handleSettingsUpdate} 
                  onAddHistory={handleAddHistory}
                  memory={memory}
                  onResetMemory={handleResetMemory}
                  onSignOut={handleSignOut}
                  onTriggerDemoMode={handleTriggerDemoMode}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Desktop-only Floating AI Companion Trigger Button */}
      <motion.button
        id="guardian-companion-trigger"
        onClick={() => setCompanionOpen(!companionOpen)}
        animate={{ scale: companionOpen ? 1 : [1, 1.05, 1] }}
        transition={companionOpen ? {} : { repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="hidden md:flex fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-tr from-indigo-600 to-[#6D5DFC] hover:from-indigo-500 hover:to-[#6D5DFC]/80 text-white rounded-full shadow-2xl items-center justify-center border border-white/15 cursor-pointer hover:shadow-indigo-500/20 hover:shadow-xl transition-all"
        title="Speak with Guardian"
      >
        <MessageSquare className="w-6 h-6" />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#09090b] rounded-full"></span>
      </motion.button>

      {/* Persistent Floating Guardian Quick Dock (Visible on Mobile/Tablet when companion is closed) */}
      <div className="md:hidden fixed bottom-20 right-4 left-4 z-40">
        <AnimatePresence>
          {!companionOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`border backdrop-blur-2xl p-2 rounded-2xl shadow-2xl flex items-center justify-between gap-1.5 ${
                theme === "light"
                  ? "bg-white/95 border-slate-200/80"
                  : "bg-[#0E1322]/95 border-white/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompanionOpen(true)}
                  className="w-11 h-11 hover:scale-105 transition-transform shadow-md animate-pulse border-none cursor-pointer shrink-0"
                  title="Speak with Guardian"
                >
                  <DeadlineGuardianLogo variant="app-icon" glowing={false} />
                </button>
                <div className="text-left">
                  <span className="text-[9px] text-[#6D5DFC] font-mono block font-black uppercase">Guardian AI</span>
                  <span className={`text-[10px] font-bold block leading-none ${theme === "light" ? "text-emerald-600" : "text-slate-300"}`}>Online</span>
                </div>
              </div>
              
              <div className={`h-6 w-[1px] ${theme === "light" ? "bg-slate-200" : "bg-white/10"}`} />
              
              {/* Quick Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCompanionOpen(true);
                    handleCompanionSend("Save My Day");
                  }}
                  className="h-11 px-2.5 bg-rose-600/15 border border-rose-500/25 hover:bg-rose-600/25 rounded-xl text-[9.5px] font-bold text-rose-300 transition flex items-center gap-1 cursor-pointer"
                >
                  🚨 Save My Day
                </button>
                <button
                  onClick={() => {
                    setCompanionOpen(true);
                    handleCompanionSend("What should I do today?");
                  }}
                  className={`h-11 px-2.5 border rounded-xl text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    theme === "light"
                      ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                      : "bg-white/5 border-white/5 text-slate-300"
                  }`}
                >
                  📅 Plan Today
                </button>
                <button
                  onClick={() => {
                    setCompanionOpen(true);
                    handleCompanionSend("Help me catch up.");
                  }}
                  className={`h-11 px-2.5 border rounded-xl text-[9.5px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    theme === "light"
                      ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                      : "bg-white/5 border-white/5 text-slate-300"
                  }`}
                >
                  🤝 Help Me
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating AI Companion Panel */}
      <AnimatePresence>
        {companionOpen && (
          <motion.div
            id="guardian-companion-panel"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-16 md:bottom-24 left-0 right-0 md:left-auto md:right-6 w-full md:w-96 h-[calc(100vh-4rem)] md:h-[510px] z-40 bg-[#151D33]/98 md:bg-[#151D33]/95 border-t md:border border-white/10 backdrop-blur-2xl rounded-t-[2rem] md:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-200"
          >
            {/* Header */}
            <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8">
                  <DeadlineGuardianLogo variant="app-icon" glowing={false} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white font-sans tracking-wide">The Guardian Chat</h3>
                  <p className="text-[10px] text-slate-400 font-sans">Support Companion</p>
                </div>
              </div>
              <button 
                onClick={() => setCompanionOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition"
              >
                close
              </button>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">
              {companionMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed font-sans ${
                    msg.sender === "user" 
                      ? "bg-[#6D5DFC] text-white rounded-tr-none" 
                      : "bg-white/5 border border-white/5 text-slate-200 rounded-tl-none"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {companionLoading && (
                <div className="flex justify-start">
                  <div className="p-3 bg-white/5 border border-white/5 text-slate-400 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 font-mono">
                    <span className="w-1.5 h-1.5 bg-[#6D5DFC] rounded-full animate-dot-pulse" style={{ animationDelay: "0s" }}></span>
                    <span className="w-1.5 h-1.5 bg-[#6D5DFC] rounded-full animate-dot-pulse" style={{ animationDelay: "0.2s" }}></span>
                    <span className="w-1.5 h-1.5 bg-[#6D5DFC] rounded-full animate-dot-pulse" style={{ animationDelay: "0.4s" }}></span>
                  </div>
                </div>
              )}
            </div>

            {/* Premium Requested Quick Action Buttons */}
            <div className="px-3 py-2 bg-white/5 border-t border-white/5 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
              <button
                onClick={() => handleCompanionSend("Save My Day")}
                className="px-2.5 py-1.5 bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/40 rounded-xl text-[10px] font-bold text-rose-300 transition cursor-pointer flex items-center gap-1"
              >
                🚨 Save My Day
              </button>
              <button
                onClick={() => handleCompanionSend("What should I do today?")}
                className="px-2.5 py-1.5 bg-[#121214] border border-white/5 hover:border-indigo-500/20 rounded-xl text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                📅 Plan Today
              </button>
              <button
                onClick={() => handleCompanionSend("Help me catch up.")}
                className="px-2.5 py-1.5 bg-[#121214] border border-white/5 hover:border-indigo-500/20 rounded-xl text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                🤝 Help Me Catch Up
              </button>
              <button
                onClick={() => handleCompanionSend("Am I behind?")}
                className="px-2.5 py-1.5 bg-[#121214] border border-white/5 hover:border-indigo-500/20 rounded-xl text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                ⚡ Am I Behind?
              </button>
              <button
                onClick={() => handleCompanionSend("Give me some motivation.")}
                className="px-2.5 py-1.5 bg-[#121214] border border-white/5 hover:border-indigo-500/20 rounded-xl text-[10px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
              >
                🌸 Motivate Me
              </button>
            </div>

            {/* Input Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleCompanionSend(companionInput);
              }}
              className="p-3 bg-[#0a0a0c] border-t border-white/5 flex gap-2"
            >
              <input
                type="text"
                value={companionInput}
                onChange={(e) => setCompanionInput(e.target.value)}
                placeholder="Ask your Guardian companion anything..."
                className="flex-1 px-3 py-2.5 bg-white/5 border border-white/5 hover:border-white/10 focus:border-indigo-500/50 outline-none text-xs text-white rounded-xl placeholder:text-slate-500 font-sans"
              />
              <button
                type="submit"
                disabled={!companionInput.trim() || companionLoading}
                className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Elegant Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 h-16 backdrop-blur-xl border-t flex items-center justify-around px-2 z-30 shadow-lg ${
        theme === "light"
          ? "bg-white/95 border-slate-200/80 text-slate-800"
          : "bg-[#0E1322]/95 border-white/10 text-slate-200"
      }`}>
        {[
          navItems.find(n => n.id === "dashboard"),
          navItems.find(n => n.id === "tasks"),
          navItems.find(n => n.id === "guardian"),
          navItems.find(n => n.id === "calendar"),
          navItems.find(n => n.id === "settings")
        ].filter(Boolean).map(item => {
          const Icon = item!.icon;
          const isActive = activeTab === item!.id;
          return (
            <button
              key={item!.id}
              onClick={() => setActiveTab(item!.id)}
              className="flex flex-col items-center justify-center w-12 h-12 transition-all relative"
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-[#6D5DFC] scale-110" : theme === "light" ? "text-slate-500 opacity-80" : "text-slate-400 opacity-70"}`} />
              <span className={`text-[9px] font-medium font-sans mt-1 ${isActive ? "text-[#6D5DFC] font-semibold" : theme === "light" ? "text-slate-500" : "text-slate-500"}`}>
                {item!.label}
              </span>
              {isActive && (
                <span className="absolute -top-[10px] w-5 h-[3px] bg-[#6D5DFC] rounded-full" />
              )}
            </button>
          );
        })}
        
        {/* Additional menu button to trigger side drawer */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center w-12 h-12 transition-all relative"
        >
          <Menu className={`w-5 h-5 ${theme === "light" ? "text-slate-500 opacity-80" : "text-slate-400 opacity-70"}`} />
          <span className="text-[9px] font-medium font-sans mt-1 text-slate-500">More</span>
        </button>
      </div>

      {/* Global Search Command Palette Modal (CMD+K Overlay) */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            {/* Backdrop with elegant blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg bg-[#111625] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
            >
              {/* Search input line */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchSelectedIndex(0);
                  }}
                  placeholder="Search pages, active tasks..."
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 font-sans"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="text-[10.5px] text-slate-500 hover:text-white px-1.5 py-0.5 rounded bg-white/5 font-mono"
                >
                  ESC
                </button>
              </div>

              {/* Search results wrapper */}
              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {searchResults.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-500 font-sans">No matching pages or tasks found.</p>
                  </div>
                ) : (
                  searchResults.map((result, idx) => {
                    const isSelected = idx === searchSelectedIndex;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => {
                          if (result.type === "page") {
                            setActiveTab(result.id);
                          } else if (result.type === "task") {
                            setActiveTab("tasks");
                          }
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          isSelected ? "bg-[#6D5DFC]/20 text-white font-medium" : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {result.type === "page" ? (
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${isSelected ? "bg-[#6D5DFC]/20 text-white" : "bg-white/5 text-slate-400"}`}>
                              {(result as any).icon ? React.createElement((result as any).icon, { className: "w-3.5 h-3.5" }) : "📄"}
                            </div>
                          ) : (
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${isSelected ? "bg-[#6D5DFC]/20 text-white" : "bg-white/5 text-slate-400"}`}>
                              <Shield className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span className="text-xs font-sans">{result.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full font-mono text-slate-500 uppercase tracking-wider">
                            {result.type}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Help Footer */}
              <div className="px-4 py-2 bg-white/5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-sans">
                <div className="flex items-center gap-3">
                  <span>Use <kbd className="bg-white/5 border border-white/5 px-1 py-0.5 rounded font-mono text-slate-400">↑↓</kbd> to navigate</span>
                  <span><kbd className="bg-white/5 border border-white/5 px-1 py-0.5 rounded font-mono text-slate-400">Enter</kbd> to select</span>
                </div>
                <span>Guardian Search Engine v1.0</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Celebration Popup Toast */}
      <AnimatePresence>
        {celebration && celebration.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#121214] border border-emerald-500/30 text-white rounded-2xl px-6 py-4 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex items-center gap-4 max-w-sm"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-400">Task Completed!</div>
              <p className="text-slate-300 text-[11px] font-medium leading-relaxed mt-0.5">
                {celebration.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationDialog
        isOpen={isResettingMemory}
        onClose={() => setIsResettingMemory(false)}
        onConfirm={confirmResetMemory}
        title="Reset Guardian Memory"
        message="Are you sure you want to reset the Guardian's memory engine? This will calibrate learned behavior variables back to onboarding presets."
        confirmText="Reset Memory"
        cancelText="Cancel"
        severity="danger"
      />

    </div>
  );
}
