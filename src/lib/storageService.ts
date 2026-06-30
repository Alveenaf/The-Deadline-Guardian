import { Task, UserSettings, HistoryLog } from "../types";

export interface Habit {
  id: string;
  name: string;
  category: "Study" | "Exercise" | "Reading" | "Water" | "Sleep" | "Other";
  streak: number;
  completedToday: boolean;
  isMissed?: boolean;
  color: string;
  icon: string;
}

export interface FocusSession {
  id: string;
  goal: string;
  duration: number; // minutes
  completed: boolean;
  distractions: number;
  timestamp: string;
}

export interface GuardianMemory {
  preferredFocusTime: "Morning" | "Afternoon" | "Evening" | "LateNight";
  preferredSessionLength: number;
  mostProductiveDay: string;
  reminderPreference: string;
  currentProductivityGoal: string;
  frequentlyDelayedCategory: string;
  averageTaskCompletionDuration: string;
  habitCompletionRate: string;
  burnoutRiskLevel: "Low" | "Medium" | "High";
  lastAnalysisTimestamp: string;
}

// Low-level IndexedDB Database setup
const DB_VERSION = 1;
let activeUserId: string | null = null;

export function setStorageUser(uid: string | null) {
  activeUserId = uid;
}

function getDBName(): string {
  if (!activeUserId) {
    return "GuardianSovereignDB_guest";
  }
  return `GuardianSovereignDB_${activeUserId}`;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const dbName = getDBName();
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("tasks")) {
        db.createObjectStore("tasks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("habits")) {
        db.createObjectStore("habits", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("focusSessions")) {
        db.createObjectStore("focusSessions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("logs")) {
        db.createObjectStore("logs", { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error || "Failed to open IndexedDB");
    };
  });
}

// DB Generic CRUD Helpers
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToStore<T>(storeName: string, item: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Storage Service Class implementing clean offline persistence
export const storageService = {
  // 1. User Profile & Settings
  getUserProfile() {
    const key = activeUserId ? `guardian-user-profile_${activeUserId}` : "guardian-user-profile";
    const profileStr = localStorage.getItem(key);
    if (profileStr) {
      try {
        return JSON.parse(profileStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  saveUserProfile(data: any) {
    const key = activeUserId ? `guardian-user-profile_${activeUserId}` : "guardian-user-profile";
    localStorage.setItem(key, JSON.stringify(data));
  },


  // 2. Tasks
  async getTasks(): Promise<Task[]> {
    return getAllFromStore<Task>("tasks");
  },

  async saveTask(task: Task): Promise<void> {
    await saveToStore<Task>("tasks", task);
  },

  async deleteTask(taskId: string): Promise<void> {
    await deleteFromStore("tasks", taskId);
  },

  // 3. Habits
  async getHabits(): Promise<Habit[]> {
    return getAllFromStore<Habit>("habits");
  },

  async saveHabit(habit: Habit): Promise<void> {
    await saveToStore<Habit>("habits", habit);
  },

  async deleteHabit(habitId: string): Promise<void> {
    await deleteFromStore("habits", habitId);
  },

  // 4. Focus Sessions
  async getFocusHistory(): Promise<FocusSession[]> {
    return getAllFromStore<FocusSession>("focusSessions");
  },

  async saveFocusSession(session: FocusSession): Promise<void> {
    await saveToStore<FocusSession>("focusSessions", session);
  },

  // 5. History Logs
  async getHistoryLogs(): Promise<HistoryLog[]> {
    const logs = await getAllFromStore<HistoryLog>("logs");
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async saveHistoryLog(log: HistoryLog): Promise<void> {
    const id = `log_${new Date(log.timestamp).getTime()}_${Math.random().toString(36).substring(2, 6)}`;
    await saveToStore<HistoryLog & { id: string }>("logs", { ...log, id });
  },

  // 6. Reset & Clear Storage
  async clearAllData(): Promise<void> {
    const keyPrefix = activeUserId ? `_${activeUserId}` : "";
    localStorage.removeItem(`guardian-user-profile${keyPrefix}`);
    localStorage.removeItem(`guardian-personality${keyPrefix}`);
    localStorage.removeItem(`guardian-appearance${keyPrefix}`);
    localStorage.removeItem(`guardian-sidebar-collapsed${keyPrefix}`);
    localStorage.removeItem(`guardian-habits-v2${keyPrefix}`);
    
    await Promise.all([
      clearStore("tasks"),
      clearStore("habits"),
      clearStore("focusSessions"),
      clearStore("logs")
    ]);
  },

  // 7. Memory Engine
  async calculateAndSaveMemory(
    tasks: Task[],
    habits: Habit[],
    focusSessions: FocusSession[],
    settings: UserSettings
  ): Promise<GuardianMemory> {
    let preferredFocusTime: "Morning" | "Afternoon" | "Evening" | "LateNight" = settings.productiveHours || "Evening";
    if (focusSessions.length > 0) {
      const times = focusSessions.map(f => {
        const hour = new Date(f.timestamp).getHours();
        if (hour >= 6 && hour < 12) return "Morning";
        if (hour >= 12 && hour < 17) return "Afternoon";
        if (hour >= 17 && hour < 22) return "Evening";
        return "LateNight";
      });
      const counts = times.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as any);
      const topTime = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, preferredFocusTime);
      preferredFocusTime = topTime as any;
    }

    let preferredSessionLength = settings.preferredWorkBlock || 25;
    if (focusSessions.length > 0) {
      const totalLen = focusSessions.reduce((sum, f) => sum + f.duration, 0);
      preferredSessionLength = Math.round(totalLen / focusSessions.length);
    }

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let mostProductiveDay = "Tuesday";
    const completedTasks = tasks.filter(t => t.completed && t.completedAt);
    if (completedTasks.length > 0) {
      const days = completedTasks.map(t => daysOfWeek[new Date(t.completedAt!).getDay()]);
      const dCounts = days.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as any);
      mostProductiveDay = Object.keys(dCounts).reduce((a, b) => dCounts[a] > dCounts[b] ? a : b, mostProductiveDay);
    }

    let frequentlyDelayedCategory = "Study";
    const delayed = tasks.filter(t => !t.completed && new Date(t.deadline) < new Date());
    if (delayed.length > 0) {
      const categories = delayed.map(t => t.category);
      const cCounts = categories.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {} as any);
      frequentlyDelayedCategory = Object.keys(cCounts).reduce((a, b) => cCounts[a] > cCounts[b] ? a : b, frequentlyDelayedCategory);
    } else if (settings.frequentlyDelayed && settings.frequentlyDelayed.length > 0) {
      frequentlyDelayedCategory = settings.frequentlyDelayed[0];
    }

    let averageTaskCompletionDuration = "2.4 hours";
    if (completedTasks.length > 0) {
      const avgEffort = completedTasks.reduce((sum, t) => sum + t.estimatedEffort, 0) / completedTasks.length;
      averageTaskCompletionDuration = `${avgEffort.toFixed(1)} hours`;
    }

    let habitCompletionRate = "75%";
    if (habits.length > 0) {
      const completed = habits.filter(h => h.completedToday).length;
      habitCompletionRate = `${Math.round((completed / habits.length) * 100)}%`;
    }

    let burnoutRiskLevel: "Low" | "Medium" | "High" = "Low";
    const totalPendingEffort = tasks.filter(t => !t.completed).reduce((sum, t) => sum + t.estimatedEffort, 0);
    if (totalPendingEffort > 15) {
      burnoutRiskLevel = "High";
    } else if (totalPendingEffort > 8) {
      burnoutRiskLevel = "Medium";
    }

    const calculatedMemory: GuardianMemory = {
      preferredFocusTime,
      preferredSessionLength,
      mostProductiveDay,
      reminderPreference: settings.productiveHours === "Evening" ? "7:00 PM" : "9:00 AM",
      currentProductivityGoal: settings.personalBio || "Maintain academic consistency",
      frequentlyDelayedCategory,
      averageTaskCompletionDuration,
      habitCompletionRate,
      burnoutRiskLevel,
      lastAnalysisTimestamp: new Date().toISOString()
    };

    const currentProfile = this.getUserProfile() || {};
    this.saveUserProfile({
      ...currentProfile,
      memory: calculatedMemory
    });

    return calculatedMemory;
  },

  async seedDemoData(settings: UserSettings): Promise<any> {
    // 1. Clear current stores
    await Promise.all([
      clearStore("tasks"),
      clearStore("habits"),
      clearStore("focusSessions"),
      clearStore("logs")
    ]);

    // 2. Mock Tasks (Assignments, Meetings, Bills, Interviews, Shopping, Exercise)
    const baseTime = Date.now();
    const demoTasks: Task[] = [
      {
        id: "demo-task-1",
        title: "DBMS Assignment 3 - Complex SQL Query Opt",
        deadline: new Date(baseTime + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        estimatedEffort: 3.5,
        category: "Study" as const,
        priority: "Critical" as const,
        urgencyScore: 10,
        riskLevel: "Critical" as const,
        riskExplanation: "Tomorrow already contains two intense team meetings, which may lead to high cognitive fatigue if left to the last minute.",
        completed: false,
        subtasks: ["Review Query Plan", "Draft ER Diagrams", "Write Index optimizations"],
        createdAt: new Date(baseTime - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "demo-task-2",
        title: "SWE Technical Coding Interview Prep",
        deadline: new Date(baseTime + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        estimatedEffort: 6,
        category: "Work" as const,
        priority: "Critical" as const,
        urgencyScore: 9,
        riskLevel: "High" as const,
        riskExplanation: "This milestone has high complexity and significant impact on your core productivity goal.",
        completed: false,
        subtasks: ["Review Graph Algorithms", "Practice 3 Dynamic Programming problems", "Mock system design layout"],
        createdAt: new Date(baseTime - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "demo-task-3",
        title: "Product Roadmap Sync & Design Review",
        deadline: new Date(baseTime + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        estimatedEffort: 1.5,
        category: "Meetings" as const,
        priority: "Medium" as const,
        urgencyScore: 6,
        riskLevel: "Low" as const,
        riskExplanation: "A low-impact check-in that requires minor sync. Risk of delay is minimal.",
        completed: false,
        subtasks: ["Prep slides", "Update sprint issues"],
        createdAt: new Date(baseTime - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "demo-task-4",
        title: "Renew Cloud VPS & database cluster subscription",
        deadline: new Date(baseTime + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
        estimatedEffort: 0.5,
        category: "Finance" as const,
        priority: "Medium" as const,
        urgencyScore: 5,
        riskLevel: "Medium" as const,
        riskExplanation: "Subscription auto-renews soon. Ensure card details are correct to avoid service disruption.",
        completed: false,
        subtasks: ["Check account balance", "Verify primary card"],
        createdAt: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "demo-task-5",
        title: "Weekly Grocery & Nutrition Shopping",
        deadline: new Date(baseTime + 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days
        estimatedEffort: 2,
        category: "Shopping" as const,
        priority: "Low" as const,
        urgencyScore: 3,
        riskLevel: "Low" as const,
        riskExplanation: "Can be easily rescheduled to Saturday without impact on key career deliverables.",
        completed: false,
        subtasks: ["List health items", "Select closest store"],
        createdAt: new Date().toISOString()
      },
      {
        id: "demo-task-6",
        title: "High-Intensity Cardio Workout",
        deadline: new Date(baseTime + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        estimatedEffort: 1,
        category: "Health" as const,
        priority: "Medium" as const,
        urgencyScore: 7,
        riskLevel: "Low" as const,
        riskExplanation: "Vital for physical active status, but flexible to be split into lighter slots.",
        completed: true,
        completedAt: new Date(baseTime - 2 * 60 * 60 * 1000).toISOString(),
        subtasks: ["15m Warmup", "30m Cardio", "15m Stretch"],
        createdAt: new Date(baseTime - 6 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const t of demoTasks) {
      await saveToStore("tasks", t);
    }

    // 3. Mock Habits
    const demoHabits: Habit[] = [
      { id: "h-1", name: "Deep Study Block", category: "Study", streak: 7, completedToday: true, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20", icon: "book" },
      { id: "h-2", name: "Physical Exercise", category: "Exercise", streak: 5, completedToday: true, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: "dumbbell" },
      { id: "h-3", name: "Mindful Reading", category: "Reading", streak: 12, completedToday: false, color: "text-pink-400 bg-pink-500/10 border-pink-500/20", icon: "reading" },
      { id: "h-4", name: "Hydrate (8 glasses)", category: "Water", streak: 14, completedToday: true, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: "droplet" },
      { id: "h-5", name: "Restful Sleep (8h)", category: "Sleep", streak: 8, completedToday: true, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: "moon" }
    ];

    for (const h of demoHabits) {
      await saveToStore("habits", h);
    }
    localStorage.setItem("guardian-habits-v2", JSON.stringify(demoHabits));

    // 4. Mock Focus Sessions
    const demoFocus: FocusSession[] = [
      { id: "fs-1", goal: "Solve LeetCode Hard Recursion problems", duration: 45, distractions: 0, completed: true, timestamp: new Date(baseTime - 12 * 60 * 60 * 1000).toISOString() },
      { id: "fs-2", goal: "Review DBMS transactions manual", duration: 30, distractions: 1, completed: true, timestamp: new Date(baseTime - 28 * 60 * 60 * 1000).toISOString() },
      { id: "fs-3", goal: "Read UI system specs", duration: 25, distractions: 2, completed: true, timestamp: new Date(baseTime - 48 * 60 * 60 * 1000).toISOString() }
    ];

    for (const f of demoFocus) {
      await saveToStore("focusSessions", f);
    }

    // 5. Mock History Logs
    const demoLogs: HistoryLog[] = [
      { timestamp: new Date(baseTime - 5 * 60 * 1000).toISOString(), action: "Schedule Calibration", details: "Guardian updated your workload estimate after detecting SWE prep update." },
      { timestamp: new Date(baseTime - 1 * 60 * 60 * 1000).toISOString(), action: "Guardian Advice Generated", details: "Guardian analyzed your SWE Coding Interview preparation and set safe benchmarks." },
      { timestamp: new Date(baseTime - 3 * 60 * 60 * 1000).toISOString(), action: "Conflict Prevention", details: "Guardian detected a calendar workload conflict tomorrow and deferred Grocery Shopping." },
      { timestamp: new Date(baseTime - 24 * 60 * 60 * 1000).toISOString(), action: "Focus Recommended", details: "Guardian recommended a 45-minute focus session to protect evening relaxation." },
      { timestamp: new Date(baseTime - 36 * 60 * 60 * 1000).toISOString(), action: "Routine Optimized", details: "Guardian calibrated memory pathways to reflect consistent morning focus times." }
    ];

    for (const l of demoLogs) {
      const id = `log_${new Date(l.timestamp).getTime()}_${Math.random().toString(36).substring(2, 6)}`;
      await saveToStore("logs", { ...l, id });
    }

    // 6. Mock Memory
    const demoMemory: GuardianMemory = {
      preferredFocusTime: "Evening",
      preferredSessionLength: 35,
      mostProductiveDay: "Wednesday",
      reminderPreference: "7:00 PM",
      currentProductivityGoal: "Securing upcoming SWE Technical Interview",
      frequentlyDelayedCategory: "Shopping",
      averageTaskCompletionDuration: "1.8 hours",
      habitCompletionRate: "80%",
      burnoutRiskLevel: "Medium",
      lastAnalysisTimestamp: new Date().toISOString()
    };

    const currentProfile = this.getUserProfile() || {};
    const updatedProfile = {
      ...currentProfile,
      onboarded: true,
      settings: {
        ...settings,
        userName: settings.userName || "Alex",
        personalBio: "Software Engineer focusing on: Technical Prep, Deep Learning",
        productiveHours: "Evening" as const,
        preferredWorkBlock: 35,
        failureRiskTolerance: "Medium" as const
      },
      memory: demoMemory
    };
    this.saveUserProfile(updatedProfile);

    return updatedProfile;
  }
};
