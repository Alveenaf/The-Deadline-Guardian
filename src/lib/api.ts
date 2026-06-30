import { Task, UserSettings, TimeBlock, HistoryLog, RiskAnalysis, EmergencyPlan, CoachAdvice, SmartAddResponse } from "../types";

export const api = {
  async getTasks(): Promise<Task[]> {
    const res = await fetch("/api/tasks");
    if (!res.ok) throw new Error("Failed to load tasks");
    return res.json();
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tasks),
    });
    if (!res.ok) throw new Error("Failed to sync tasks");
  },

  async getSettings(): Promise<UserSettings> {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Failed to load settings");
    return res.json();
  },

  async saveSettings(settings: UserSettings): Promise<void> {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error("Failed to save settings");
  },

  async getLogs(): Promise<HistoryLog[]> {
    const res = await fetch("/api/logs");
    if (!res.ok) throw new Error("Failed to load activity logs");
    return res.json();
  },

  async addLog(action: string, details: string): Promise<void> {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, details }),
    });
  },

  async syncLogs(logs: HistoryLog[]): Promise<void> {
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logs),
    });
    if (!res.ok) throw new Error("Failed to sync activity logs");
  },

  // AI endpoints
  async analyzeTask(text: string): Promise<Partial<Task>> {
    const res = await fetch("/api/ai/analyze-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("Failed to analyze input with AI");
    return res.json();
  },

  async generateSchedule(tasks: Task[], settings: UserSettings, habits?: any[], focusHistory?: any[]): Promise<{ timeBlocks: TimeBlock[]; coachTip: string }> {
    const res = await fetch("/api/ai/generate-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks, settings, habits, focusHistory }),
    });
    if (!res.ok) throw new Error("Failed to generate schedule with AI");
    return res.json();
  },

  async getRiskAnalysis(tasks: Task[], habits?: any[], focusHistory?: any[]): Promise<RiskAnalysis> {
    const res = await fetch("/api/ai/risk-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks, habits, focusHistory }),
    });
    if (!res.ok) throw new Error("Failed to load risk analysis");
    return res.json();
  },

  async saveMyDeadline(tasks: Task[], habits?: any[], focusHistory?: any[]): Promise<EmergencyPlan> {
    const res = await fetch("/api/ai/save-my-deadline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks, habits, focusHistory }),
    });
    if (!res.ok) throw new Error("Failed to activate Emergency Plan");
    return res.json();
  },

  async getCoachAdvice(tasks?: Task[], settings?: UserSettings, memory?: any, habits?: any[], focusHistory?: any[]): Promise<CoachAdvice> {
    const COACH_ADVICE_FALLBACK: CoachAdvice = {
      insight: "Focus on your immediate top priority tasks and protect your energy blocks.",
      habitSuggestion: "Start small: Commit to working for just 15 minutes to overcome initial friction.",
      motivationMessage: "Your potential is unlimited. One focused step at a time is all it takes."
    };

    try {
      const usePost = tasks !== undefined && settings !== undefined && settings !== null;
      const res = await fetch("/api/ai/coach-advice", {
        method: usePost ? "POST" : "GET",
        headers: usePost ? { "Content-Type": "application/json" } : undefined,
        body: usePost ? JSON.stringify({ tasks, settings, memory, habits, focusHistory }) : undefined
      });
      if (!res.ok) {
        console.warn("Server responded with error for coach advice, using client-side fallback.");
        return COACH_ADVICE_FALLBACK;
      }
      return await res.json();
    } catch (err) {
      console.warn("Failed to fetch coach advice from server, using client-side fallback.", err);
      return COACH_ADVICE_FALLBACK;
    }
  },

  async dailyCheckin(completedTasks: Task[], pendingTasks: Task[], changesText: string, habits?: any[], focusHistory?: any[]): Promise<{ feedback: string; adjustedTip: string }> {
    const res = await fetch("/api/ai/daily-checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedTasks, pendingTasks, changesText, habits, focusHistory }),
    });
    if (!res.ok) throw new Error("Failed to process daily checkin");
    return res.json();
  },

  async chat(
    messages: { sender: "user" | "bot"; text: string }[],
    settings: UserSettings,
    tasks: Task[],
    habits?: any[],
    focusHistory?: any[],
    sessionId?: string
  ): Promise<{ response: string }> {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, settings, tasks, habits, focusHistory, sessionId }),
    });
    if (!res.ok) throw new Error("Failed to chat with Guardian");
    return res.json();
  },

  async chatStream(
    messages: { sender: "user" | "bot"; text: string }[],
    settings: UserSettings,
    tasks: Task[],
    habits: any[],
    focusHistory: any[],
    theme: string,
    currentPage: string,
    sessionId?: string
  ): Promise<ReadableStream<Uint8Array> | null> {
    const res = await fetch("/api/ai/chat-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, settings, tasks, habits, focusHistory, theme, currentPage, sessionId }),
    });
    if (!res.ok) throw new Error("Failed to stream chat with Guardian");
    return res.body;
  },

  async smartAdd(text: string, sessionContext: { originalText: string; question: string } | null, existingTasks: Task[]): Promise<SmartAddResponse> {
    const res = await fetch("/api/ai/smart-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sessionContext, existingTasks }),
    });
    if (!res.ok) throw new Error("Failed to process input with Guardian AI");
    return res.json();
  }
};
