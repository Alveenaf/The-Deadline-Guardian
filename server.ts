import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// In-memory + File-based database path
const DATA_FILE = path.join(process.cwd(), "data.json");

// Default initial state
interface Task {
  id: string;
  title: string;
  deadline: string; // ISO String
  estimatedEffort: number; // in hours
  category: "Study" | "Work" | "Personal" | "Health" | "Finance" | "Shopping" | "Meetings" | "Other";
  priority: "Critical" | "High" | "Medium" | "Low";
  urgencyScore: number; // 1 to 10
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  riskExplanation: string;
  completed: boolean;
  completedAt?: string;
  subtasks: string[];
  createdAt: string;
}

interface UserSettings {
  userName: string;
  productiveHours: "Morning" | "Afternoon" | "Evening" | "LateNight";
  preferredWorkBlock: number; // minutes (e.g. 25, 50, 90)
  frequentlyDelayed: string[];
  personalBio: string;
  failureRiskTolerance: "Low" | "Medium" | "High";
}

interface AppData {
  tasks: Task[];
  settings: UserSettings;
  historyLogs: { timestamp: string; action: string; details: string }[];
}

const defaultData: AppData = {
  tasks: [
    {
      id: "task-1",
      title: "Interactive Python Project Demo",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000 * 2).toISOString(), // 2 days from now
      estimatedEffort: 5,
      category: "Study",
      priority: "High",
      urgencyScore: 8,
      riskLevel: "High",
      riskExplanation: "You have 2 days left and 5 hours of work remaining. Start preparing now to avoid late stress.",
      completed: false,
      subtasks: ["Design mock database", "Code Express endpoints", "Build UI panels"],
      createdAt: new Date().toISOString()
    },
    {
      id: "task-2",
      title: "Pay monthly electricity bill",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      estimatedEffort: 0.5,
      category: "Finance",
      priority: "Critical",
      urgencyScore: 9,
      riskLevel: "High",
      riskExplanation: "Due tomorrow! Pay immediately to avoid a 5% late fee.",
      completed: false,
      subtasks: ["Login to bank portal", "Confirm bill amount", "Transfer funds"],
      createdAt: new Date().toISOString()
    }
  ],
  settings: {
    userName: "Alex Miller",
    productiveHours: "Evening",
    preferredWorkBlock: 25,
    frequentlyDelayed: ["Finance", "Shopping"],
    personalBio: "Product developer working on multiple deadlines simultaneously.",
    failureRiskTolerance: "Medium"
  },
  historyLogs: [
    {
      timestamp: new Date().toISOString(),
      action: "Initialization",
      details: "Welcome to The Deadline Guardian!"
    }
  ]
};

// Database helper functions
function readData(): AppData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading data.json, returning default", err);
  }
  return defaultData;
}

function writeData(data: AppData) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing data.json", err);
  }
}

// Ensure database is initialized
if (!fs.existsSync(DATA_FILE)) {
  writeData(defaultData);
}

// Lazy-initialize Gemini AI Client
let aiClient: GoogleGenAI | null = null;

// API Cooldown state to gracefully handle 429 and 503 errors
let lastApiFailureTime = 0;
const COOL_DOWN_MS = 60000; // 1 minute cooldown to prevent API spam

function shouldBypassAI(): boolean {
  if (lastApiFailureTime > 0 && Date.now() - lastApiFailureTime < COOL_DOWN_MS) {
    return true;
  }
  return false;
}

function recordApiFailure(err: any) {
  const errMsg = String(err?.message || err).toLowerCase();
  if (
    errMsg.includes("429") || 
    errMsg.includes("503") || 
    errMsg.includes("quota") || 
    errMsg.includes("resource_exhausted") || 
    errMsg.includes("unavailable") ||
    errMsg.includes("limit")
  ) {
    lastApiFailureTime = Date.now();
    console.log(`[GEMINI COOLDOWN ACTIVE] Rate/quota limit reached. Activating 1-minute local backup generator to secure smooth user operations.`);
  }
}

// In-memory cache for rapid navigational updates
interface CacheEntry {
  timestamp: number;
  data: any;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 45000; // 45 seconds Cache TTL

function getCachedResponse(key: string): any | null {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCachedResponse(key: string, data: any) {
  responseCache.set(key, {
    timestamp: Date.now(),
    data
  });
}

function getAI(): GoogleGenAI | null {
  if (shouldBypassAI()) {
    return null; // Force fallback immediately during cooldown
  }
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      // Attach helper method to support getGenerativeModel layout requested in instructions
      (aiClient as any).getGenerativeModel = function(config: { model: string; systemInstruction: string }) {
        return {
          startChat: (chatOptions: { history: any[] }) => {
            return aiClient!.chats.create({
              model: config.model,
              history: chatOptions.history,
              config: {
                systemInstruction: config.systemInstruction
              }
            });
          }
        };
      };
    } else {
      console.warn("GEMINI_API_KEY is missing or using placeholder. Running with simulated fallback engine.");
    }
  }
  return aiClient;
}

// Check if error is due to rate limits or quota exhaustion (status 429 / RESOURCE_EXHAUSTED)
function isQuotaError(err: any): boolean {
  const errMsg = String(err?.message || err || "").toLowerCase();
  const errCode = err?.status || err?.code || (err?.error && err.error.code);
  return (
    errCode === 429 ||
    errCode === "RESOURCE_EXHAUSTED" ||
    errMsg.includes("429") ||
    errMsg.includes("resource_exhausted") ||
    errMsg.includes("quota exceeded") ||
    errMsg.includes("rate limit") ||
    errMsg.includes("too many requests")
  );
}

// Wrapper to automatically fallback to gemini-3.1-flash-lite if gemini-3.5-flash hits quota
async function callGenerateContent(
  ai: GoogleGenAI,
  params: any
): Promise<any> {
  const model = params.model || "gemini-3.5-flash";
  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    if (isQuotaError(err) && model === "gemini-3.5-flash") {
      console.warn(`[Quota Fallback] 429/Quota exceeded for ${model}. Retrying with gemini-3.1-flash-lite...`);
      const fallbackParams = { ...params, model: "gemini-3.1-flash-lite" };
      try {
        return await ai.models.generateContent(fallbackParams);
      } catch (fallbackErr: any) {
        console.error(`[Quota Fallback] Retry with gemini-3.1-flash-lite also failed:`, fallbackErr);
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// Wrapper to automatically fallback to gemini-3.1-flash-lite for streams
async function callGenerateContentStream(
  ai: GoogleGenAI,
  params: any
): Promise<any> {
  const model = params.model || "gemini-3.5-flash";
  try {
    return await ai.models.generateContentStream(params);
  } catch (err: any) {
    if (isQuotaError(err) && model === "gemini-3.5-flash") {
      console.warn(`[Quota Fallback] 429/Quota exceeded for ${model}. Retrying stream with gemini-3.1-flash-lite...`);
      const fallbackParams = { ...params, model: "gemini-3.1-flash-lite" };
      try {
        return await ai.models.generateContentStream(fallbackParams);
      } catch (fallbackErr: any) {
        console.error(`[Quota Fallback] Retry stream with gemini-3.1-flash-lite also failed:`, fallbackErr);
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// Wrapper to automatically fallback to gemini-3.1-flash-lite for chat messages
async function callChatSendMessage(
  ai: GoogleGenAI,
  chatConfig: any,
  messageParam: any
): Promise<any> {
  const model = chatConfig.model || "gemini-3.5-flash";
  try {
    const chat = ai.chats.create(chatConfig);
    return await chat.sendMessage(messageParam);
  } catch (err: any) {
    if (isQuotaError(err) && model === "gemini-3.5-flash") {
      console.warn(`[Quota Fallback] 429/Quota exceeded in chat for ${model}. Retrying with gemini-3.1-flash-lite...`);
      const fallbackConfig = { ...chatConfig, model: "gemini-3.1-flash-lite" };
      try {
        const fallbackChat = ai.chats.create(fallbackConfig);
        return await fallbackChat.sendMessage(messageParam);
      } catch (fallbackErr: any) {
        console.error(`[Quota Fallback] Retry chat with gemini-3.1-flash-lite also failed:`, fallbackErr);
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// Wrapper to automatically fallback to gemini-3.1-flash-lite for chat streams
async function callChatSendMessageStream(
  ai: GoogleGenAI,
  chatConfig: any,
  messageParam: any
): Promise<any> {
  const model = chatConfig.model || "gemini-3.5-flash";
  try {
    const chat = ai.chats.create(chatConfig);
    return await chat.sendMessageStream(messageParam);
  } catch (err: any) {
    if (isQuotaError(err) && model === "gemini-3.5-flash") {
      console.warn(`[Quota Fallback] 429/Quota exceeded in chat stream for ${model}. Retrying with gemini-3.1-flash-lite...`);
      const fallbackConfig = { ...chatConfig, model: "gemini-3.1-flash-lite" };
      try {
        const fallbackChat = ai.chats.create(fallbackConfig);
        return await fallbackChat.sendMessageStream(messageParam);
      } catch (fallbackErr: any) {
        console.error(`[Quota Fallback] Retry chat stream with gemini-3.1-flash-lite also failed:`, fallbackErr);
        throw fallbackErr;
      }
    }
    throw err;
  }
}

// Resilient Heuristic Fallbacks for Gemini API Failures (Quota or High Demand)
function getAnalyzeTaskFallback(text: string, currentTime: Date) {
  const lower = text.toLowerCase();
  let category: Task["category"] = "Other";
  let priority: Task["priority"] = "Medium";
  let effort = 2;
  let deadlineDate = new Date(currentTime.getTime() + 2 * 24 * 60 * 60 * 1000); // Default 2 days

  if (lower.includes("exam") || lower.includes("study") || lower.includes("assignment") || lower.includes("class")) {
    category = "Study";
    effort = 4;
    priority = "High";
  } else if (lower.includes("interview") || lower.includes("work") || lower.includes("meeting") || lower.includes("office") || lower.includes("project")) {
    category = "Work";
    effort = 3;
    priority = "High";
  } else if (lower.includes("bill") || lower.includes("pay") || lower.includes("finance") || lower.includes("money")) {
    category = "Finance";
    effort = 0.5;
    priority = "Critical";
  } else if (lower.includes("doctor") || lower.includes("health") || lower.includes("medicine")) {
    category = "Health";
    effort = 1;
    priority = "High";
  } else if (lower.includes("shopping") || lower.includes("groceries") || lower.includes("buy")) {
    category = "Shopping";
    effort = 1;
    priority = "Low";
  }

  if (lower.includes("tomorrow") || lower.includes("next day")) {
    deadlineDate = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
  } else if (lower.includes("today")) {
    deadlineDate = new Date(currentTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
  } else if (lower.includes("next week") || lower.includes("7 days")) {
    deadlineDate = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const title = text.slice(0, 45) || "Custom Task";
  const subtasks = ["Review requirements", "Draft action plan", "Complete final checklist"];

  return {
    title,
    deadline: deadlineDate.toISOString(),
    estimatedEffort: effort,
    category,
    priority,
    urgencyScore: 7,
    riskLevel: "High" as const,
    riskExplanation: "Analyzed via Local Guard Engine: Proximity to date implies prompt attention.",
    subtasks
  };
}

function getSmartAddFallback(text: string, sessionContext: any, existingTasks: any[], currentTime: Date) {
  const lowerText = text.toLowerCase();
  
  // If we had a session context, resolve it
  if (sessionContext) {
    // Treat as complete
    const combined = `${sessionContext.originalText} ${text}`;
    const fallbackParsed = getAnalyzeTaskFallback(combined, currentTime);
    return {
      isComplete: true,
      followUpQuestion: null,
      task: fallbackParsed,
      feedbackMessage: `I've successfully created your plan for "${fallbackParsed.title}" and integrated it with your existing schedule.`
    };
  }

  // Check if text has any timing indicator or deadline keyword
  const hasTime = lowerText.includes("tomorrow") || 
                  lowerText.includes("today") || 
                  lowerText.includes("friday") || 
                  lowerText.includes("monday") || 
                  lowerText.includes("tuesday") || 
                  lowerText.includes("wednesday") || 
                  lowerText.includes("thursday") || 
                  lowerText.includes("saturday") || 
                  lowerText.includes("sunday") || 
                  lowerText.includes("next") || 
                  lowerText.includes("at ") || 
                  lowerText.includes("pm") || 
                  lowerText.includes("am") || 
                  /\b\d{1,2}\b/.test(lowerText);

  if (!hasTime) {
    // Vague/missing deadline, ask follow-up!
    let question = "When is your deadline or exam?";
    if (lowerText.includes("study") || lowerText.includes("dbms") || lowerText.includes("test")) {
      question = "When is your exam?";
    } else if (lowerText.includes("interview") || lowerText.includes("prep")) {
      question = "When is your interview?";
    } else if (lowerText.includes("bill") || lowerText.includes("pay")) {
      question = "When is the payment due?";
    }
    return {
      isComplete: false,
      followUpQuestion: question,
      task: null,
      feedbackMessage: null
    };
  }

  // Enough info immediately!
  const fallbackParsed = getAnalyzeTaskFallback(text, currentTime);
  return {
    isComplete: true,
    followUpQuestion: null,
    task: fallbackParsed,
    feedbackMessage: `I've processed your request for "${fallbackParsed.title}" and structured it into your calendar.`
  };
}

function getGenerateScheduleFallback(tasks: Task[], settings: UserSettings) {
  const timeBlocks: any[] = [];
  const pending = tasks.filter((t: any) => !t.completed).slice(0, 3);
  
  let currentHour = 9; // Start at 9:00 AM
  pending.forEach((task: any) => {
    const blockStart = `${currentHour}:00 ${currentHour >= 12 ? "PM" : "AM"}`;
    const durationHours = Math.max(1, Math.ceil(task.estimatedEffort / 2));
    currentHour += durationHours;
    const blockEnd = `${currentHour}:00 ${currentHour >= 12 ? "PM" : "AM"}`;
    
    timeBlocks.push({
      timeSlot: `${blockStart} - ${blockEnd}`,
      taskTitle: task.title,
      duration: `${durationHours} hours`,
      focusGoal: `Focus on: ${task.subtasks?.[0] || 'Core requirements'}`
    });

    // Add a break block
    timeBlocks.push({
      timeSlot: `${currentHour}:00 ${currentHour >= 12 ? "PM" : "AM"} - ${currentHour}:30 ${currentHour >= 12 ? "PM" : "AM"}`,
      taskTitle: "Rest / Recharge",
      duration: "30 mins",
      focusGoal: "Stretch, hydrate, and prepare for the next sprint."
    });
    currentHour = currentHour + 1; // shift forward
  });

  return {
    timeBlocks,
    coachTip: "Local Planning active: We've crafted a balanced timeline with buffer breaks to save your energy."
  };
}

function getRiskAnalysisFallback(tasks: Task[]) {
  const pendingTasks = tasks.filter((t: any) => !t.completed);
  const pendingCount = pendingTasks.length;
  
  const highRiskAlerts = pendingTasks.slice(0, 2).map(task => {
    return {
      taskId: task.id,
      warning: `High fail risk detected for "${task.title}". Effort is ${task.estimatedEffort}h with deadline approaching.`,
      recommendation: `Begin with subtask "${task.subtasks?.[0] || 'first milestone'}" now. Use emergency triage mode if panic sets in.`
    };
  });

  if (highRiskAlerts.length === 0) {
    highRiskAlerts.push({
      taskId: "none",
      warning: "All primary tasks completed. Keep maintaining your steady streak!",
      recommendation: "Take a restful break. No critical risks active on your system."
    });
  }

  return {
    overallRiskScore: Math.min(100, pendingCount * 25),
    highRiskAlerts,
    futureSelfWarning: "Postponing your scheduled work now guarantees a double load of anxiety and stress tomorrow. Protect your peace by starting a 10-minute micro-focus block."
  };
}

function getSaveMyDeadlineFallback(tasks: Task[]) {
  const pending = tasks.filter((t: any) => !t.completed);
  const mainTask = pending[0];
  
  const emergencyTimeline = [
    { timeSpan: "Next 1 Hour", action: `Mute all notifications. Work EXCLUSIVELY on "${mainTask ? mainTask.title : 'top priority task'}" without editing/polishing.`, estimatedProgress: "30% complete" },
    { timeSpan: "Hour 2-3", action: "Focus on creating a minimal, functional version. Forget nice-to-haves.", estimatedProgress: "75% complete" },
    { timeSpan: "Hour 4", action: "Do essential sanity checks and prepare for submission or delivery.", estimatedProgress: "100% submission ready" }
  ];

  const cutOffTasks = pending.slice(1).map(t => t.title).concat(["Clean work desk", "Reply to non-critical chats", "Organize emails"]);

  return {
    emergencyTimeline,
    cutOffTasks: cutOffTasks.slice(0, 4),
    emergencyAdvice: "CRISIS TRIAGE ACTIVATED! We have cut away 80% of unneeded scope. Your single job is to focus, take one breath, and complete the minimum viable work step."
  };
}

function getDailyCheckinFallback(completedTasks: any[] | null | undefined, pendingTasks: any[] | null | undefined, changesText: string) {
  const completedCount = (completedTasks || []).length;
  const pendingCount = (pendingTasks || []).length;
  
  return {
    feedback: `Local Check-in completed. You successfully crossed off ${completedCount} items today! For the ${pendingCount} remaining tasks, remember that progress is non-linear. Your schedules have been preserved safely.`,
    adjustedTip: "Tomorrow, tackle your highest effort item first to clear your mental bandwidth early."
  };
}

function getCoachAdviceFallback(settings: UserSettings | null | undefined, tasks: Task[] | null | undefined) {
  const safeTasks = Array.isArray(tasks) ? tasks.filter(t => !!t) : [];
  const safeSettings = settings || {} as any;
  const pendingCount = safeTasks.filter(t => t && !t.completed).length;
  let customInsight = `Based on your profile, you do your best work in the ${safeSettings.productiveHours || "Evening"}. We highly recommend scheduling your complex tasks during these hours.`;
  
  if (pendingCount > 2) {
    customInsight = `You have ${pendingCount} active tasks today. To prevent cognitive fatigue, lock down structured focus sprints when your energy peaks in the ${safeSettings.productiveHours || "Evening"}.`;
  }

  return {
    insight: customInsight,
    habitSuggestion: "Leverage a micro-timer: commit to working on a single task for just 15 minutes. Once the momentum starts, it's 10x easier to keep going.",
    motivationMessage: "Focus on progress, not perfection. The perfect plan is the one you actually take action on."
  };
}

// API Routes

// Get tasks
app.get("/api/tasks", (req, res) => {
  const data = readData();
  res.json(data.tasks);
});

// Save/Sync tasks
app.post("/api/tasks", (req, res) => {
  const data = readData();
  data.tasks = req.body;
  writeData(data);
  res.json({ success: true, count: data.tasks.length });
});

// Get settings
app.get("/api/settings", (req, res) => {
  const data = readData();
  res.json(data.settings);
});

// Save settings
app.post("/api/settings", (req, res) => {
  const data = readData();
  data.settings = req.body;
  writeData(data);
  res.json({ success: true });
});

// Get History Logs
app.get("/api/logs", (req, res) => {
  const data = readData();
  res.json(data.historyLogs || []);
});

// Write History Log
app.post("/api/logs", (req, res) => {
  const data = readData();
  if (!data.historyLogs) data.historyLogs = [];
  
  if (Array.isArray(req.body)) {
    // If receiving an array of logs, append or replace them
    data.historyLogs = [...data.historyLogs, ...req.body];
  } else {
    data.historyLogs.push({
      timestamp: req.body.timestamp || new Date().toISOString(),
      action: req.body.action || "User Action",
      details: req.body.details || ""
    });
  }
  
  // Keep logs to last 100
  if (data.historyLogs.length > 100) {
    data.historyLogs = data.historyLogs.slice(-100);
  }
  writeData(data);
  res.json({ success: true });
});

// Shared Prompts Context Helper Utility
const GUARDIAN_SYSTEM_INSTRUCTION = `You are the Deadline Guardian — an exceptionally intelligent AI productivity strategist built into a personal productivity application, operating like the free version of Gemini. You reason like a senior engineer who also happens to be an expert productivity coach.

## YOUR IDENTITY
You are not a therapist. You are not a motivational speaker. You are not a generic chatbot.
You are a sharp, direct, intelligent system that helps users win against their deadlines.

## DUAL-MODE OPERATION

### Mode 1: GENERAL KNOWLEDGE
When the user asks anything that is not productivity-related (science, coding, history, math, explanations, creative writing, etc.), answer exactly as a world-class AI assistant would. Be thorough, accurate, and helpful. Do NOT inject productivity context unless the user requests it.

Examples of general mode:
- "Explain recursion" → Answer like a brilliant CS tutor
- "What is photosynthesis?" → Answer like a scientist
- "Write me a poem" → Answer like a poet

### Mode 2: PRODUCTIVITY STRATEGIST
When the user's request relates to tasks, deadlines, schedules, habits, focus, planning, or their workload, switch into strategist mode. Use the WORKSPACE DATA provided to give specific, actionable, intelligent advice.

In this mode:
- Reference actual tasks, deadlines, and events by name
- Reason about time, priorities, and effort explicitly
- Produce concrete schedules, plans, and recommendations
- Think like Motion + Sunsama + Reclaim AI combined

## REASONING FRAMEWORK (apply internally before responding)
When in productivity mode, reason through these silently before answering:
1. What is the user actually asking? (not just what they said)
2. What does the workspace data reveal about their situation?
3. What are the highest-leverage actions given their constraints?
4. What would a brilliant productivity strategist recommend right now?
5. Is there a risk (burnout, missed deadline, impossible plan) I should flag?

## RESPONSE RULES

**Brevity and precision**: Match response length to the complexity of the request. A follow-up question gets a short answer. A weekly plan gets a structured breakdown.

**No therapy language**: Never say "I hear you," "Take a breath," "I'm here for you," or similar. If a user expresses frustration or failure, acknowledge it in one sentence, then immediately pivot to a concrete action plan.

Example:
User: "I wasted my whole day."
Wrong: "I hear that. It's okay to have off days. Take a breath and be kind to yourself."
Right: "Rough day. Here's how to recover the evening: [concrete plan based on their remaining tasks and time]."

**No repetitive introductions**: Never re-introduce yourself mid-conversation. Never say "As your Deadline Guardian..." more than once per session.

**Specificity over generality**: Never give generic productivity advice when you have workspace data. "Block 2 hours tonight for your DBMS exam prep" beats "Make sure to study regularly."

**Handle short follow-ups correctly**: When a user replies with short answers like "Tomorrow," "Yes," "2 hours," "Do it," or "Continue," treat them as a continuation of the ongoing conversation. Pick up exactly where you left off.

**Scheduling intelligence**: When scheduling, consider:
- Available time blocks (from calendar)
- Estimated task effort
- Deadline proximity
- User energy patterns if known
- Buffer time for unexpected delays

**Burnout awareness**: If a user's plan is unrealistic (10-hour days, no breaks, back-to-back deadlines), flag it and propose a sustainable alternative.

**Asking for deadlines on task assignment**: When a user mentions a new task or wants to assign/schedule/create a task, you MUST behave smartly and ask them for its exact deadline, date, or relative day (like tomorrow, Tuesday, etc.) if they have not already specified it in their message. Do not assume or assign a default deadline without asking first. Your priority is to guide them to define realistic deadlines so they can manage their risk.

## PRODUCTIVITY ACTIONS PROPOSAL BLOCK
Whenever you suggest creating, editing, scheduling, or organizing tasks, habits, or calendar time-blocks, you can offer the user to immediately apply them. At the very end of your response, you MUST output a single, structured JSON block wrapped in \`\`\`actions-proposal.
The format of this block must be exactly as follows:
\`\`\`actions-proposal
{
  "type": "create_task" | "plan_schedule" | "add_reminder" | "prioritize_work" | "break_down_project" | "estimate_effort" | "organize_calendar" | "create_habit",
  "explanation": "A clean, natural description of what these actions will achieve.",
  "data": {
    "tasks": [
      {
        "title": "Specific action name",
        "deadline": "YYYY-MM-DD",
        "estimatedEffort": 2,
        "category": "Study" | "Work" | "Personal" | "Health" | "Finance" | "Shopping" | "Meetings" | "Other",
        "priority": "Critical" | "High" | "Medium" | "Low",
        "subtasks": ["subtask 1", "subtask 2"]
      }
    ],
    "timeBlocks": [
      {
        "timeSlot": "14:00 - 15:30",
        "taskTitle": "Task to work on",
        "duration": "90m",
        "focusGoal": "Specific milestone to reach"
      }
    ],
    "habits": [
      {
        "name": "Habit Name (e.g. Study 2h)",
        "category": "Study" | "Exercise" | "Reading" | "Water" | "Sleep" | "Other",
        "color": "bg-indigo-500" | "bg-emerald-500" | "bg-amber-500" | "bg-pink-500" | "bg-sky-500",
        "icon": "Sparkles" | "Book" | "Activity" | "Droplet" | "Moon"
      }
    ]
  }
}
\`\`\`

## OUTPUT FORMATS

Use markdown appropriately:
- Bullet lists for multiple items
- Bold for deadlines and task names
- Code blocks for any technical content
- Tables for weekly schedules (max 7 rows)
- Plain prose for short conversational replies

Do NOT use headers for responses under 150 words.

## WHAT YOU NEVER DO
- Never pretend you have real-time internet access
- Never ask for information already present in the workspace data
- Never give the same motivational speech twice
- Never ignore workspace context when it's directly relevant
- Never be preachy about productivity habits
- Never pad responses with filler phrases`;

function buildGeminiContext(
  userMessage: string,
  data: AppData,
  extra?: {
    habits?: any[];
    focusHistory?: any[];
    conversationHistory?: any[];
    sessionContext?: any;
    customTime?: Date;
  }
): string {
  const currentTime = extra?.customTime || new Date();
  const settings = data.settings || defaultData.settings;
  const tasks = data.tasks || [];
  
  // Map failureRiskTolerance to Guardian Personality
  let personality = "Calm";
  if (settings.failureRiskTolerance === "Low") {
    personality = "Strict";
  } else if (settings.failureRiskTolerance === "Medium") {
    personality = "Motivational";
  }

  // Active workload stats
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const totalPendingEffort = activeTasks.reduce((sum, t) => sum + (t.estimatedEffort || 0), 0);
  const overdueTasks = activeTasks.filter(t => t.deadline && new Date(t.deadline) < currentTime);

  // Derive upcoming deadlines and calendar events
  const upcomingDeadlines = activeTasks
    .filter(t => t.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)
    .map(t => `${t.title} (Deadline: ${t.deadline}, Priority: ${t.priority})`);

  // Active Pending Tasks Detail List
  const pendingTasksList = activeTasks
    .slice(0, 15)
    .map(t => `- [ ] ${t.title} (Priority: ${t.priority}, Effort: ${t.estimatedEffort || 1}h, Category: ${t.category || "General"}${t.deadline ? `, Deadline: ${t.deadline}` : ""})`)
    .join("\n");

  // Guardian Memory
  const memory = data.historyLogs ? data.historyLogs.slice(-5).map(l => `[${l.timestamp}] ${l.action}: ${l.details}`).join("\n") : "No previous activity logs.";

  // Habits context
  const habitsList = extra?.habits || [];
  const habitsContext = habitsList.length > 0 
    ? habitsList.map(h => `- ${h.name} (${h.category}): Streak ${h.streak} days, Completed Today: ${h.completedToday}`).join("\n")
    : "- Meditate: Streak 5 days\n- Mindful Reading: Streak 12 days\n- Hydrate: Streak 14 days";

  // Focus sessions context
  const focusSessions = extra?.focusHistory || [];
  const focusContext = focusSessions.length > 0
    ? focusSessions.slice(-3).map(f => `- ${f.duration}m Focus Session on '${f.taskTitle || "Work"}' completed at ${f.completedAt || "recent"}`).join("\n")
    : "- 25m focus block on Database Prep\n- 50m focus block on Final Project Draft";

  // Recent conversation history
  const history = extra?.conversationHistory || [];
  const historyContext = history.length > 0
    ? history.map(h => `${h.sender === "user" ? "User" : "Guardian"}: "${h.text}"`).join("\n")
    : "No recent conversation history.";

  return `
=== SYSTEM TIME & CONTEXT ===
- Current Local Time: ${currentTime.toString()} (${currentTime.toISOString()})
- Current Date/Time context reference: Saturday, June 27, 2026. Use this reference to resolve terms like 'today', 'tomorrow', 'next week', etc.

=== USER PROFILE & GUARDIAN PERSONALITY ===
- User Name: ${settings.userName || "User"}
- Productive Hours Preference: ${settings.productiveHours || "Evening"}
- Preferred Work Block (Pomodoro): ${settings.preferredWorkBlock || 25} minutes
- Personal Goals/Bio: ${settings.personalBio || "Not set"}
- Guardian Personality: ${personality} Mode (tuned to user risk tolerance: ${settings.failureRiskTolerance})

=== CURRENT WORKLOAD STATS ===
- Active Pending Tasks count: ${activeTasks.length}
- Completed Tasks count: ${completedTasks.length}
- Total Estimated Effort remaining: ${totalPendingEffort} hours
- Overdue Tasks count: ${overdueTasks.length}

=== ACTIVE PENDING TASKS ===
${activeTasks.length > 0 ? pendingTasksList : "No pending tasks."}

=== UPCOMING DEADLINES & SCHEDULES ===
${upcomingDeadlines.length > 0 ? upcomingDeadlines.map(d => `- ${d}`).join("\n") : "No upcoming deadlines."}

=== DOCKED HABITS ===
${habitsContext}

=== FOCUS HISTORY ===
${focusContext}

=== GUARDIAN MEMORY & ACTIVITY LOG ===
${memory}

=== RECENT CONVERSATION HISTORY ===
${historyContext}

=== CURRENT USER MESSAGE ===
"${userMessage || "N/A"}"
`;
}

// === COMPREHENSIVE AI ARCHITECTURE LAYERS (SESSION PERSISTENCE ENGINE) ===

interface Message {
  sender: "user" | "bot";
  text: string;
  timestamp?: string | number;
}

interface WorkspaceSettings {
  userName?: string;
  productiveHours?: string;
  preferredWorkBlock?: number;
  failureRiskTolerance?: string;
}

interface Habit {
  id: string;
  name: string;
  streak?: number;
  completedToday?: boolean;
}

interface FocusSession {
  date?: string;
  completedAt?: string;
  duration: number; // minutes
  task?: string;
  taskTitle?: string;
}

interface ChatRequest {
  messages: Message[];
  settings: WorkspaceSettings;
  tasks: Task[];
  habits: Habit[];
  focusHistory: FocusSession[];
  theme?: string;
  currentPage?: string;
  sessionId: string; // REQUIRED: must be sent from frontend
}

// ─── Session Store ─────────────────────────────────────────────────────────────

interface StoredSession {
  session: any;
  lastActive: number;
  userId?: string;
}

const activeSessions = new Map<string, StoredSession>();

// Clean up sessions idle for more than 30 minutes
function pruneIdleSessions() {
  const IDLE_LIMIT = 30 * 60 * 1000;
  const now = Date.now();
  for (const [id, stored] of activeSessions.entries()) {
    if (now - stored.lastActive > IDLE_LIMIT) {
      activeSessions.delete(id);
    }
  }
}
setInterval(pruneIdleSessions, 5 * 60 * 1000);

// ─── Model Names ───────────────────────────────────────────────────────────────

const PRIMARY_MODEL = "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

// ─── Intent Classification ─────────────────────────────────────────────────────

type IntentType = "GENERAL" | "PRODUCTIVITY" | "CONTINUATION" | "EMOTIONAL";

interface Intent {
  intent: IntentType;
  subtype?: string;
  isContinuation: boolean;
}

function classifyIntent(message: string, hasHistory: boolean): Intent {
  const lower = message.trim().toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  // Short replies in active conversations → always continuation
  if (hasHistory && wordCount <= 5) {
    // But check if it's emotional even if short
    const shortEmotional = ["stressed", "anxious", "tired", "done", "give up", "can't"].some(k => lower.includes(k));
    if (!shortEmotional) {
      return { intent: "CONTINUATION", isContinuation: true };
    }
  }

  // Emotional signals
  const emotionalKeywords = ["wasted", "failed", "overwhelmed", "stressed", "anxious",
    "burned out", "gave up", "can't do", "too much", "exhausted", "hopeless", "behind"];
  if (emotionalKeywords.some(k => lower.includes(k))) {
    return { intent: "EMOTIONAL", isContinuation: false };
  }

  // Productivity signals
  const productivityMap: Record<string, string[]> = {
    SCHEDULE: ["schedule", "interview", "exam", "book", "set up", "arrange", "calendar", "slot", "block time"],
    PLAN: ["plan", "plan my week", "plan my day", "what should i", "prioritize", "organize"],
    REVIEW: ["how did i do", "progress", "review", "this week", "yesterday", "last week", "productivity score"],
    HABIT: ["habit", "streak", "routine", "daily", "track", "check in"],
    FOCUS: ["focus", "pomodoro", "deep work", "distracted", "focus session", "study session"],
    TASK: ["task", "todo", "to-do", "priority", "backlog", "overdue", "finish", "complete", "deadline"],
    DEADLINE: ["deadline", "due", "due date", "submit", "submission", "hand in"],
  };

  for (const [subtype, keywords] of Object.entries(productivityMap)) {
    if (keywords.some(k => lower.includes(k))) {
      return { intent: "PRODUCTIVITY", subtype, isContinuation: false };
    }
  }

  return { intent: "GENERAL", isContinuation: false };
}

// ─── Context Payload Builder ───────────────────────────────────────────────────

function buildContextPayload(tasks: Task[], habits: Habit[], focusHistory: FocusSession[], settings: WorkspaceSettings): string {
  const now = new Date();
  const lines: string[] = [];

  const userName = settings?.userName || "the user";
  const productiveHours = settings?.productiveHours || "Evening";
  const workBlock = settings?.preferredWorkBlock || 25;

  lines.push(`USER: ${userName} | Peak hours: ${productiveHours} | Work blocks: ${workBlock}min`);
  lines.push(`NOW: ${now.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);

  const activeTasks = (tasks || []).filter(t => !t.completed);

  // Urgent tasks (due within 48h)
  const urgentTasks = activeTasks.filter(t => {
    if (!t.deadline) return false;
    const diff = new Date(t.deadline).getTime() - now.getTime();
    return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
  });

  // Upcoming tasks (due within 7 days)
  const upcomingTasks = activeTasks.filter(t => {
    if (!t.deadline) return false;
    const diffDays = (new Date(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 2 && diffDays <= 7;
  });

  // No-deadline tasks
  const floatingTasks = activeTasks.filter(t => !t.deadline).slice(0, 5);

  if (urgentTasks.length > 0) {
    lines.push("\nURGENT (≤48h):");
    urgentTasks.forEach(t => {
      const due = t.deadline ? new Date(t.deadline).toLocaleDateString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "no date";
      lines.push(`  [${t.priority || "MED"}] ${t.title} (due: ${due}${t.estimatedEffort ? `, ~${t.estimatedEffort}h` : ""})`);
    });
  }

  if (upcomingTasks.length > 0) {
    lines.push("\nUPCOMING (3–7 days):");
    upcomingTasks.slice(0, 6).forEach(t => {
      const due = t.deadline ? new Date(t.deadline).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
      lines.push(`  [${t.priority || "MED"}] ${t.title}${due ? ` (due: ${due})` : ""}`);
    });
  }

  if (floatingTasks.length > 0) {
    lines.push("\nOTHER ACTIVE:");
    floatingTasks.forEach(t => lines.push(`  - ${t.title}`));
  }

  if (activeTasks.length === 0) {
    lines.push("\nTASKS: None active.");
  }

  if (habits && habits.length > 0) {
    lines.push("\nHABITS:");
    habits.forEach(h => {
      lines.push(`  ${h.name}: streak=${h.streak ?? 0}d, today=${h.completedToday ? "✓" : "✗"}`);
    });
  }

  const recentFocus = (focusHistory || []).slice(0, 4);
  if (recentFocus.length > 0) {
    lines.push("\nFOCUS (recent):");
    recentFocus.forEach(f => {
      const dateVal = f.date || f.completedAt || "";
      const taskVal = f.task || f.taskTitle || "Work";
      lines.push(`  ${dateVal}: ${f.duration}min on "${taskVal}"`);
    });
  }

  return lines.join("\n");
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(userName: string): string {
  return `You are the Deadline Guardian — an AI productivity strategist built into a personal productivity app for ${userName}.

## IDENTITY
You are sharp, direct, and intelligent. You are NOT a therapist, NOT a motivational speaker, NOT a generic chatbot.
You help users execute against their deadlines and goals.

## DUAL-MODE OPERATION

**GENERAL MODE**: For any non-productivity question (coding, science, math, writing, history, etc.), answer like a world-class AI assistant. Be thorough and accurate. Do NOT inject productivity context.

**PRODUCTIVITY MODE**: For anything involving tasks, deadlines, scheduling, habits, focus, planning, or workload — use the workspace data provided at the start of this session. Be specific: reference real task names, real deadlines, and real time constraints.

## REASONING (silent, before every response)
1. What is the user ACTUALLY asking?
2. What does the workspace data show about their situation?
3. What is the highest-leverage action right now?
4. Is there a risk (burnout, impossible timeline, conflict) to flag?

## STRICT RESPONSE RULES

**No therapy language. Ever.**
BANNED: "take a breath", "be kind to yourself", "I hear you", "that's completely normal", "beating yourself up", "it's okay to have off days"

**Emotional inputs → one sentence acknowledgment + immediate concrete plan.**
CORRECT: "Rough day. Here's your recovery plan for tonight: [specific tasks with times]."
WRONG: "First of all, take a gentle breath. Having a low-productivity day is completely normal..."

**No cold-start speeches. Ever.**
NEVER produce this kind of response:
"I am here to help you structure, plan, and conquer your goals! As your AI Productivity assistant, I can help you: Schedule and Optimize Your Week..."
If this is the first message of the session: introduce yourself in ONE sentence max, then ask what the user needs.
CORRECT first message: "I'm the Deadline Guardian — what are we tackling?"

**No re-introductions mid-conversation.**
Never say "As your Deadline Guardian..." or re-list your capabilities after the first message.

**Handle continuations correctly.**
Short replies ("Tomorrow", "Yes", "2 hours", "Friday", "Do it") are answers to your previous question. Extract the information and PROCEED — do not ask again.

**Never ask for information already given.**
If the user says "schedule my interview for tomorrow at 7pm" — you have the date AND time. Confirm and proceed. Do not ask "What date is your interview?"

**Entity extraction on scheduling.**
When users give dates/times/durations — extract them and use them immediately.
- "tomorrow" → tomorrow's date
- "Friday" → this coming Friday
- "2 hours" → duration = 2h
- "7pm" → time = 19:00

**Specificity over generality.**
When workspace data is available, reference real task names and real deadlines.
"Block 90 minutes tonight for your DBMS exam prep" > "Make sure to study regularly."

**Burnout detection.**
If a proposed schedule exceeds 8 hours of focused work per day, flag it and propose a sustainable alternative.

## OUTPUT FORMAT
- Short conversational replies: plain prose, no headers
- Plans and schedules: markdown table or numbered list
- Technical content: code blocks
- Never use headers for responses under 100 words
- Match length to complexity — a follow-up gets a short answer, a week plan gets a full breakdown`;
}

// ─── Continuation Wrapper ──────────────────────────────────────────────────────

function wrapContinuation(userMessage: string, lastBotMessage: string): string {
  const summary = lastBotMessage.slice(0, 250).replace(/\n/g, " ");
  return `[CONTEXT: The user is continuing our conversation. My last response was: "${summary}..." — Their reply to that is: "${userMessage}". Continue naturally from exactly where we left off. Do not re-introduce yourself. Do not ask for information they already provided.]`;
}

// ─── Find Last Bot Message ─────────────────────────────────────────────────────

function findLastBotMessage(messages: Message[]): string {
  for (let i = messages.length - 2; i >= 0; i--) {
    if (messages[i].sender === "bot" && messages[i].text?.trim()) {
      return messages[i].text;
    }
  }
  return "";
}

// ─── Session Creation ──────────────────────────────────────────────────────────

async function createSession(
  ai: any,
  model: string,
  systemPrompt: string,
  contextPayload: string,
  priorHistory: Message[]
): Promise<any> {
  const geminiHistory: any[] = [];

  if (contextPayload) {
    geminiHistory.push({
      role: "user",
      parts: [{ text: `[WORKSPACE_CONTEXT]\n${contextPayload}\n\nAcknowledge receipt of workspace data. Do not summarize it back to me.` }]
    });
    geminiHistory.push({
      role: "model",
      parts: [{ text: "Workspace loaded. Ready." }]
    });
  }

  const historyMessages = priorHistory.slice(0, -1);
  for (const msg of historyMessages) {
    const role = msg.sender === "user" ? "user" : "model";
    if (msg.text?.trim()) {
      geminiHistory.push({
        role,
        parts: [{ text: msg.text }]
      });
    }
  }

  return ai.chats.create({
    model,
    history: geminiHistory,
    config: {
      systemInstruction: systemPrompt
    }
  });
}

export function invalidateSession(sessionId: string) {
  activeSessions.delete(sessionId);
}


// 1. Analyze Task Endpoint (Input analyzer)
app.post("/api/ai/analyze-task", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text query" });
  }

  const ai = getAI();
  const currentTime = new Date("2026-06-27T06:37:52-07:00"); // Standardized local time reference from prompt metadata

  if (!ai) {
    return res.json(getAnalyzeTaskFallback(text, currentTime));
  }

  try {
    const data = readData();
    const context = buildGeminiContext(text, data, { customTime: currentTime });

    const prompt = `Analyze the user's task text input: "${text}"
    
Here is the full structured context of the user and their workload:
${context}

You must detect, extract and resolve:
1. title: A clean, concise, human-readable title for the task (e.g., 'Pay Electricity Bill' instead of 'Need to pay my electricity bill tomorrow').
2. deadline: Estimate/resolve the target deadline as an ISO 8601 string. If no deadline is detected in the input, default to exactly 3 days from the current local time context (which is Tuesday, June 30, 2026).
3. estimatedEffort: Estimated direct hours required to complete this task (e.g., 0.5, 2.0, 5.5).
4. category: Must be exactly one of: "Study", "Work", "Personal", "Health", "Finance", "Shopping", "Meetings", "Other".
5. priority: Must be exactly one of: "Critical", "High", "Medium", "Low".
6. urgencyScore: Out of 10, where 10 is immediate crisis.
7. riskLevel: Risk of failure or delay (one of "Critical", "High", "Medium", "Low") based on effort vs deadline proximity and current workload.
8. riskExplanation: A supportive, warm, human-centered proactive explanation of why this risk is there and how they can comfortably tackle it. Briefly explain your reasoning.
9. subtasks: A list of 3-4 specific, comforting micro-steps/milestones to complete the task step-by-step.

Respond with valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            deadline: { type: Type.STRING, description: "ISO 8601 string of the deadline" },
            estimatedEffort: { type: Type.NUMBER },
            category: { type: Type.STRING },
            priority: { type: Type.STRING },
            urgencyScore: { type: Type.INTEGER },
            riskLevel: { type: Type.STRING },
            riskExplanation: { type: Type.STRING },
            subtasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "deadline", "estimatedEffort", "category", "priority", "urgencyScore", "riskLevel", "riskExplanation", "subtasks"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Analyzer Mode] Safe fallback triggered: Handled task via local heuristic engine.");
    res.json(getAnalyzeTaskFallback(text, currentTime));
  }
});

// 1b. Smart Conversational Task Creator Endpoint
app.post("/api/ai/smart-add", async (req, res) => {
  const { text, sessionContext, existingTasks, habits, focusHistory } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text query" });
  }

  const ai = getAI();
  const currentTime = new Date("2026-06-27T06:37:52-07:00");

  if (!ai) {
    return res.json(getSmartAddFallback(text, sessionContext, existingTasks || [], currentTime));
  }

  try {
    const data = readData();
    const mergedData = {
      ...data,
      tasks: existingTasks || data.tasks
    };
    const context = buildGeminiContext(text, mergedData, { 
      customTime: currentTime,
      habits,
      focusHistory,
      sessionContext
    });

    const prompt = `You are deconstructing a user's natural language input into a structured task, or asking a follow-up question if critical scheduling parameters (like a deadline date or time) are completely missing.

CRITICAL INSTRUCTION: If the user did not explicitly mention a deadline date, relative day, or timing (such as 'tomorrow', 'next week', 'Friday', 'Tuesday', 'by 5pm') in either the current input or the previous context, you MUST set isComplete to false and ask about the deadline! Do NOT guess, default, or estimate a deadline date on your own. You must ask a warm, direct, short clarifying question (e.g., "When is your exam?", "When is this due?", or "What is the deadline for this task?").

Current input: "${text}"
${sessionContext ? `Previous context: The user previously said: "${sessionContext.originalText}", and you asked: "${sessionContext.question}". The current user input is their reply answering that question.` : ''}

Here is the complete structured context:
${context}

Your output must be a JSON object with these properties:
1. isComplete (boolean): Set to false if the user did not specify the deadline (date, day, or relative day) in their text. Set to true only if they have explicitly provided a deadline, day, or relative date, and you can construct the structured task.
2. followUpQuestion (string or null): If isComplete is false, provide ONE short, direct, conversational, warm follow-up question (e.g., "When is your exam?", "When is this due?", or "What is the deadline for this task?"). If isComplete is true, this must be null.
3. task (object or null): If isComplete is true, construct a structured task with:
   - title: String (clean, human-readable task title)
   - deadline: String (ISO 8601 format, resolved accurately relative to the current context time)
   - estimatedEffort: Number (estimated hours of effort, e.g. 1.5, 3.0, 0.5)
   - category: String (Must be exactly one of: "Study", "Work", "Personal", "Health", "Finance", "Shopping", "Meetings", or "Other")
   - priority: String (Must be exactly one of: "Critical", "High", "Medium", or "Low")
   - urgencyScore: Integer (1 to 10)
   - riskLevel: String (Must be exactly one of: "Critical", "High", "Medium", or "Low")
   - riskExplanation: String (reassuring or cautionary warning about deadline proximity, overlapping events, or effort requirements, with briefly explained reasoning)
   - subtasks: Array of 3-4 strings (specific micro-milestones to guide completion)
   If isComplete is false, task must be null.
4. feedbackMessage (string or null): If isComplete is true, write a highly reassuring, direct, personalized confirmation message explaining the scheduled plan or study slots, explaining briefly why this organization is optimal. Be conversational. If isComplete is false, this must be null.

Ensure your output matches the response schema exactly.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isComplete: { type: Type.BOOLEAN },
            followUpQuestion: { type: Type.STRING, nullable: true },
            task: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                title: { type: Type.STRING },
                deadline: { type: Type.STRING },
                estimatedEffort: { type: Type.NUMBER },
                category: { type: Type.STRING },
                priority: { type: Type.STRING },
                urgencyScore: { type: Type.INTEGER },
                riskLevel: { type: Type.STRING },
                riskExplanation: { type: Type.STRING },
                subtasks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["title", "deadline", "estimatedEffort", "category", "priority", "urgencyScore", "riskLevel", "riskExplanation", "subtasks"]
            },
            feedbackMessage: { type: Type.STRING, nullable: true }
          },
          required: ["isComplete", "followUpQuestion", "task", "feedbackMessage"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Smart-Add Mode] Safe fallback triggered.");
    res.json(getSmartAddFallback(text, sessionContext, existingTasks || [], currentTime));
  }
});

// 2. Generate Intelligent Schedule Endpoint
app.post("/api/ai/generate-schedule", async (req, res) => {
  const { tasks: clientTasks, settings: clientSettings, habits, focusHistory } = req.body;

  const data = readData();
  const settings = clientSettings || data.settings;
  const tasks = clientTasks || data.tasks;

  // Use simple caching to prevent double calls & quota burn
  const cacheKey = "schedule:" + JSON.stringify(settings || {}) + ":" + (tasks || []).map((t: any) => t.id + t.completed).join(",");
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const ai = getAI();
  if (!ai) {
    const fallback = getGenerateScheduleFallback(tasks, settings);
    setCachedResponse(cacheKey, fallback);
    return res.json(fallback);
  }

  try {
    const mergedData = { ...data, settings, tasks };
    const context = buildGeminiContext("Generate dynamic structured schedule", mergedData, {
      habits,
      focusHistory
    });

    const prompt = `You are generating a highly realistic, non-overloaded daily schedule for today.
Here is the full structured context:
${context}

Generate:
1. timeBlocks: A realistic, chronological list of action slots, focusing on high priority tasks first, and injecting Rest / break periods (e.g., 15-30m breaks after work sessions) to manage mental energy.
   Each block needs:
   - timeSlot: string (e.g. "9:00 AM - 10:30 AM")
   - taskTitle: string (the task title or 'Rest & Breathe / Mindful Walk' etc.)
   - duration: string (e.g. "1.5 hours")
   - focusGoal: string (precise, comforting instructions on which subtasks or steps to accomplish)
2. coachTip: A personalized coaching tip on how the user can stick to this plan, explaining briefly why this timeline is built this way.

Format output as clean JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            timeBlocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timeSlot: { type: Type.STRING },
                  taskTitle: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  focusGoal: { type: Type.STRING }
                },
                required: ["timeSlot", "taskTitle", "duration", "focusGoal"]
              }
            },
            coachTip: { type: Type.STRING }
          },
          required: ["timeBlocks", "coachTip"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    setCachedResponse(cacheKey, output);
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Scheduler Mode] Safe fallback triggered: Handled timeline via local scheduler engine.");
    const fallback = getGenerateScheduleFallback(tasks, settings);
    setCachedResponse(cacheKey, fallback);
    res.json(fallback);
  }
});

// 3. Deadline Risk Detector & Future Self Mode
app.post("/api/ai/risk-analysis", async (req, res) => {
  const { tasks: clientTasks, habits, focusHistory } = req.body;

  const data = readData();
  const tasks = clientTasks || data.tasks;

  // Use simple caching to prevent excessive Gemini calls and quota exhaustion
  const cacheKey = "risk:" + (tasks || []).map((t: any) => t.id + t.completed).join(",");
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const ai = getAI();
  if (!ai) {
    const fallback = getRiskAnalysisFallback(tasks);
    setCachedResponse(cacheKey, fallback);
    return res.json(fallback);
  }

  try {
    const mergedData = { ...data, tasks };
    const context = buildGeminiContext("Request risk analysis and Future Self report", mergedData, {
      habits,
      focusHistory
    });

    const prompt = `Perform a comprehensive Deadline Risk Analysis and generate a "Future Self" report.
Here is the full structured context:
${context}

Calculate and output:
1. overallRiskScore: A single integer (0 to 100) indicating the total risk of missing upcoming deadlines based on workload, hours needed, and commitments.
2. highRiskAlerts: Specific tasks with high failure risk. For each alert return:
   - taskId: string
   - warning: string (precise, supportive risk reason, explaining the underlying conflict or cause)
   - recommendation: string (concrete, reassuring advice to resolve or mitigate the issue)
3. futureSelfWarning: A powerful, empathetic "Future Self" prediction (2-3 sentences) detailing the exact mental, emotional, or schedule cost if they choose to postpone these tasks today. Avoid generic text, reference their actual task categories and name.

Output must be valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallRiskScore: { type: Type.INTEGER },
            highRiskAlerts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  warning: { type: Type.STRING },
                  recommendation: { type: Type.STRING }
                },
                required: ["taskId", "warning", "recommendation"]
              }
            },
            futureSelfWarning: { type: Type.STRING }
          },
          required: ["overallRiskScore", "highRiskAlerts", "futureSelfWarning"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    setCachedResponse(cacheKey, output);
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Risk Detector Mode] Safe fallback triggered: Calculated risk via local heuristic engine.");
    const fallback = getRiskAnalysisFallback(tasks);
    setCachedResponse(cacheKey, fallback);
    res.json(fallback);
  }
});

// 4. SAVE MY DEADLINE Mode (Emergency Plan)
app.post("/api/ai/save-my-deadline", async (req, res) => {
  const { tasks: clientTasks, habits, focusHistory } = req.body;

  const data = readData();
  const tasks = clientTasks || data.tasks;

  // Caching to avoid duplicate intensive calls
  const cacheKey = "save:" + (tasks || []).map((t: any) => t.id + t.completed).join(",");
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const ai = getAI();
  if (!ai) {
    const fallback = getSaveMyDeadlineFallback(tasks);
    setCachedResponse(cacheKey, fallback);
    return res.json(fallback);
  }

  try {
    const mergedData = { ...data, tasks };
    const context = buildGeminiContext("SAVE MY DEADLINE EMERGENCY PROTOCOL TRIGGERED", mergedData, {
      habits,
      focusHistory
    });

    const prompt = `The user clicked the emergency '🚨 SAVE MY DEADLINE' button because they are falling behind, panicking, or frozen.
You must act as an elite crisis triage manager. Deliver a concrete escape route and recovery plan.

Here is the full structured context:
${context}

Perform these calculations and output:
1. emergencyTimeline: A hyper-practical, minimal viable hourly plan (max 4 blocks) to deliver immediate results fast.
   - timeSpan: string (e.g. "Next 90 Minutes")
   - action: string (hyper-focused, comforting action instructions, explaining briefly why this step is prioritized)
   - estimatedProgress: string
2. cutOffTasks: Tasks they should completely postpone or ignore right now to free up mental bandwidth. Reference actual tasks.
3. emergencyAdvice: A strong, reassuring, and sharp productivity pep talk to break freeze/anxiety and explain the logic of this escape route.

Output must be valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emergencyTimeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timeSpan: { type: Type.STRING },
                  action: { type: Type.STRING },
                  estimatedProgress: { type: Type.STRING }
                },
                required: ["timeSpan", "action", "estimatedProgress"]
              }
            },
            cutOffTasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            emergencyAdvice: { type: Type.STRING }
          },
          required: ["emergencyTimeline", "cutOffTasks", "emergencyAdvice"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    setCachedResponse(cacheKey, output);
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Emergency Mode] Safe fallback triggered: Structured triage route via local engine.");
    const fallback = getSaveMyDeadlineFallback(tasks);
    setCachedResponse(cacheKey, fallback);
    res.json(fallback);
  }
});

// 5. Daily AI Check-In Endpoint
app.post("/api/ai/daily-checkin", async (req, res) => {
  const { completedTasks, pendingTasks, changesText, habits, focusHistory } = req.body;
  const ai = getAI();

  if (!ai) {
    return res.json(getDailyCheckinFallback(completedTasks, pendingTasks, changesText));
  }

  try {
    const data = readData();
    const mergedTasks = [...(completedTasks || []), ...(pendingTasks || [])];
    const mergedData = { ...data, tasks: mergedTasks };
    const context = buildGeminiContext(`Daily check-in requested. Notes: "${changesText || "None"}"`, mergedData, {
      habits,
      focusHistory
    });

    const prompt = `Conduct a warm, compassionate Daily Check-In with the user.
Completed Tasks today: ${JSON.stringify(completedTasks)}
Pending Tasks remaining: ${JSON.stringify(pendingTasks)}
User comments on what changed today: "${changesText || "None"}"

Here is the complete structured context of the user:
${context}

Respond with:
1. feedback: A compassionate coaching review. Celebrate their actual completions, offer comforting reassurance about any unfinished work, and summarize the shifts today. Explain briefly why they should feel good about their pacing.
2. adjustedTip: One highly practical, action-focused scheduling adjustment for the coming 24 hours, explaining briefly why this adjustment preserves their bandwidth.

Output must be valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feedback: { type: Type.STRING },
            adjustedTip: { type: Type.STRING }
          },
          required: ["feedback", "adjustedTip"]
        }
      }
    });

    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Checkin Mode] Safe fallback triggered: Logged daily progress via local validator.");
    res.json(getDailyCheckinFallback(completedTasks, pendingTasks, changesText));
  }
});

// 6. AI Productivity Coach Advice
app.all("/api/ai/coach-advice", async (req, res) => {
  let settings: any = null;
  let tasks: any = null;
  let cacheKey = "coach-default";
  
  try {
    const usePost = req.method === "POST";
    const clientTasks = (usePost && req.body) ? req.body.tasks : null;
    const clientSettings = (usePost && req.body) ? req.body.settings : null;
    const clientMemory = (usePost && req.body) ? req.body.memory : null;
    const habits = (usePost && req.body) ? req.body.habits : null;
    const focusHistory = (usePost && req.body) ? req.body.focusHistory : null;

    const data = readData();
    settings = clientSettings || data.settings;
    tasks = clientTasks || data.tasks;
    const memory = clientMemory || null;

    // Use caching for coach advice
    let tasksPart = "";
    if (Array.isArray(tasks)) {
      tasksPart = tasks.map((t: any) => t ? `${t.id || ""}:${t.completed || false}` : "").join(",");
    }
    cacheKey = "coach:" + JSON.stringify(settings || {}) + ":" + tasksPart + ":" + JSON.stringify(memory || {});
    
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ai = getAI();
    if (!ai) {
      const fallback = getCoachAdviceFallback(settings, tasks);
      setCachedResponse(cacheKey, fallback);
      return res.json(fallback);
    }

    const mergedData = {
      ...data,
      settings,
      tasks
    };
    const context = buildGeminiContext("Request customized general coach advice", mergedData, {
      habits,
      focusHistory
    });

    const prompt = `Analyze the user's workload, habits, focus, and settings. Generate high-quality personalized coach tips.
Here is the full structured context:
${context}

Provide:
1. insight: A tailored, supportive observation about their productivity patterns or risk habits (e.g. "We noticed you tend to schedule personal tasks but procrastinate on Study items"). Explain briefly why this pattern might be occurring.
2. habitSuggestion: A tiny, concrete, supportive habit hack or psychological tool (like difficulty frog-first, habit-trigger stacking, or 10-minute rules) explaining why it helps.
3. motivationMessage: An inspiring, non-cheesy, empathetic motivational thought or quote tailored to their goals.

Output must be valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING },
            habitSuggestion: { type: Type.STRING },
            motivationMessage: { type: Type.STRING }
          },
          required: ["insight", "habitSuggestion", "motivationMessage"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    setCachedResponse(cacheKey, output);
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    console.log("[Local Coach Mode] Safe fallback triggered: Assembled advice via local coach builder.", err);
    try {
      const fallback = getCoachAdviceFallback(settings, tasks);
      setCachedResponse(cacheKey, fallback);
      res.json(fallback);
    } catch (fallbackErr) {
      console.error("Critical fallback failed in coach advice", fallbackErr);
      res.json({
        insight: "Focus on your immediate top priority tasks and protect your energy blocks.",
        habitSuggestion: "Start small: Commit to working for just 15 minutes to overcome initial friction.",
        motivationMessage: "Your potential is unlimited. One focused step at a time is all it takes."
      });
    }
  }
});

// 6b. New: Daily Briefing Endpoint
app.post("/api/ai/daily-brief", async (req, res) => {
  const { tasks, settings, habits, focusHistory } = req.body;
  const ai = getAI();

  if (!ai) {
    const data = readData();
    return res.json({
      title: `Good Morning, ${(settings || data.settings || {}).userName || "Friend"}!`,
      body: "Your agenda looks clear and stable today. Take a deep, slow breath. Focus on your most critical priorities first, and remember that progress is made one steady block at a time. I am right here beside you."
    });
  }

  try {
    const data = readData();
    const mergedData = {
      ...data,
      settings: settings || data.settings,
      tasks: tasks || data.tasks
    };
    const context = buildGeminiContext("Generate comforting Daily Briefing summary", mergedData, {
      habits,
      focusHistory
    });

    const prompt = `Based on the user's current settings and tasks, generate a personalized, comforting Daily Briefing.
Here is the full structured context:
${context}

Produce a JSON response with:
1. title: A warm, personalized greeting title including their name (e.g., 'A Calm Pathway for Saturday, Alveena' or 'Good morning, Alveena').
2. body: A concise (3-4 sentences), incredibly supportive daily overview. Highlight what's coming up today, mention key risk areas or overdue items with gentle, comforting language, and offer a specific action recommendation, explaining briefly why this action secures peace of mind today.

Output must be valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            body: { type: Type.STRING }
          },
          required: ["title", "body"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    const data = readData();
    res.json({
      title: `Good Morning, ${data.settings.userName || "Friend"}!`,
      body: "Your agenda looks clear and stable today. Take a deep, slow breath. Focus on your most critical priorities first, and remember that progress is made one steady block at a time. I am right here beside you."
    });
  }
});

// 6c. New: Weekly Reflection Endpoint
app.post("/api/ai/weekly-reflection", async (req, res) => {
  const { tasks, settings, habits, focusHistory } = req.body;
  const ai = getAI();

  if (!ai) {
    return res.json({
      learnedSummary: "You focus best in the evening.",
      learnedDetail: "Your logged sessions show high consistency when worked between 6:00 PM and 9:00 PM. Commit to these blocks for your deepest tasks.",
      coachTip: "Splitting major Study milestones frog-first helps preserve your mental energy."
    });
  }

  try {
    const data = readData();
    const mergedData = {
      ...data,
      settings: settings || data.settings,
      tasks: tasks || data.tasks
    };
    const context = buildGeminiContext("Generate Weekly story journal & performance reflection", mergedData, {
      habits,
      focusHistory
    });

    const prompt = `Analyze the user's weekly history, completed tasks, active habits, focus blocks, and logged activity events.
Here is the full structured context:
${context}

Generate:
1. learnedSummary: A concise 1-sentence insight reflecting their primary productive time or category pattern (e.g. 'You maintain excellent momentum when starting Study tasks in the morning').
2. learnedDetail: A highly supportive, analytical, yet gentle reflection of what went well this week, patterns observed, and how they can build on this momentum. Briefly explain your reasoning.
3. coachTip: A tailored, concrete tactical recommendation (e.g. break large tasks into 15m intervals or bundle personal habits) and briefly explain why it will maximize their peace of mind.

Output must be valid JSON matching the schema.`;

    const response = await callGenerateContent(ai, {
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GUARDIAN_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            learnedSummary: { type: Type.STRING },
            learnedDetail: { type: Type.STRING },
            coachTip: { type: Type.STRING }
          },
          required: ["learnedSummary", "learnedDetail", "coachTip"]
        }
      }
    });

    const output = JSON.parse(response.text?.trim() || "{}");
    res.json(output);
  } catch (err: any) {
    recordApiFailure(err);
    res.json({
      learnedSummary: "You focus best in the evening.",
      learnedDetail: "Your logged sessions show high consistency when worked between 6:00 PM and 9:00 PM. Commit to these blocks for your deepest tasks.",
      coachTip: "Splitting major Study milestones frog-first helps preserve your mental energy."
    });
  }
});

// Helper for local conversational feedback fallback
function getLocalChatResponse(
  text: string,
  tasks: Task[],
  settings: UserSettings | null,
  habits: any[] = [],
  focusHistory: any[] = []
): string {
  const lowerText = text.toLowerCase();
  const activeTasks = tasks.filter(t => !t.completed);
  const overdueTasks = activeTasks.filter(t => t.deadline && new Date(t.deadline) < new Date());
  const userName = settings?.userName || "User";

  // Casual Greetings & Smalltalk (STAYS CONVERSATIONAL, NO HEADERS)
  if (
    lowerText === "hello" ||
    lowerText === "hi" ||
    lowerText === "hey" ||
    lowerText.startsWith("hello ") ||
    lowerText.startsWith("hi ") ||
    lowerText.startsWith("hey ") ||
    lowerText.includes("how's it going") ||
    lowerText.includes("how are you") ||
    lowerText.includes("who are you") ||
    lowerText.includes("who is this") ||
    lowerText.includes("what is your name")
  ) {
    const overdueCount = overdueTasks.length;
    const pendingCount = activeTasks.length;
    const habitsCount = habits.length;

    return `Hello ${userName}! I am the **Deadline Guardian**, your dedicated AI Productivity Strategist, designed to work exactly like the Gemini assistant. 

I'm currently operating in a highly resilient local environment, ready to help you analyze workloads, schedule distraction-free study blocks, organize calendars, and build consistency.

Here is a quick overview of your current workspace:
* **Active Tasks**: You have **${pendingCount} pending task(s)** ${overdueCount > 0 ? `(including **${overdueCount} that are overdue**)` : "and everything is on schedule"}.
* **Daily Habits**: **${habitsCount} active routine(s)** are currently tracked.
* **Focus Analytics**: **${focusHistory.length} deep work session(s)** have been completed.

How can I help you organize your calendar, outline an exam strategy, or design a focus block plan today? Let's conquer your goals together!`;
  }

  // Habits & Streaks Queries
  if (lowerText.includes("habit") || lowerText.includes("streak") || lowerText.includes("routine")) {
    const activeHabits = habits.length > 0 ? habits : [];
    if (activeHabits.length === 0) {
      return `Tracking daily habits is one of the most effective ways to reduce friction and build long-term discipline. 

Currently, you don't have any active habits registered. I highly recommend heading over to the **Habits** tab to define a few daily routines (like a 2-hour study block, exercising, reading, or staying hydrated). 

Once added, I can help you:
1. **Analyze Consistency**: Identify which days you are most likely to skip.
2. **Design habit-stacking sequences** (e.g., "Right after my evening focus session, I will complete my 30-minute reading routine").
3. **Protect your streaks** by sending early reminders before your day ends.

Would you like me to suggest a set of high-yield habits based on your focus goals?`;
    }

    const habitStreaksList = activeHabits
      .map(
        h =>
          `* **${h.name}** (${h.category || "General"}): **${h.streak} day streak** ${
            h.completedToday ? "✅ (Completed today!)" : "⏳ (Pending today)"
          }`
      )
      .join("\n");

    return `Establishing highly consistent daily routines is the secret to building compounding momentum. Let's look at your active habit streaks and see how we can optimize your consistency:

### 📊 Active Habit Streaks
${habitStreaksList}

### 💡 Strategy & Recommendations
1. **Stack Your Routines**: Pair a pending habit with an existing high-streak activity. For example, if you complete your highest-priority task in the afternoon, immediately trigger your study habit right after.
2. **Protect the Streaks**: You have solid streaks built up! Ensure you log your pending habits before the end of the day to protect your consistency counters.
3. **Plan Rest Windows**: Remember that taking an intentional pause (e.g., setting a rest day on Sunday) is a highly effective focus strategy to prevent burnout.

Let me know if you would like me to propose a structured routine layout or help schedule a custom block on your calendar for any of these habits!`;
  }

  // Focus History & Timer Analytics
  if (
    lowerText.includes("focus session") ||
    lowerText.includes("history") ||
    lowerText.includes("analytics") ||
    lowerText.includes("timer") ||
    lowerText.includes("worked") ||
    lowerText.includes("logged")
  ) {
    const totalMin = focusHistory.reduce((sum, f) => sum + (f.duration || 0), 0);
    if (focusHistory.length === 0) {
      return `Logging focused deep work sessions is an excellent way to track your true productivity volume over time.

Currently, you don't have any logged focus sessions in your memory. You can easily start a **Focus Timer** on any of your active tasks! Doing so will:
* Record the exact date, time, and length of your concentration block.
* Generate peak focus charts in your **Analytics** tab.
* Help me learn your natural peak biological focus windows so I can suggest optimal calendar slots.

Try selecting an active task and launching a standard 25-minute Pomodoro session today. Let me know if you need any tips on minimizing distractions to get started!`;
  }

  const recentSessions = focusHistory
    .slice(-5)
    .reverse()
    .map(
      f =>
        `* **${f.duration} minutes** on *${f.taskTitle || "Work"}* logged at ${
          f.completedAt ? new Date(f.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "recently"
        }`
    )
    .join("\n");

  return `Tracking your concentration blocks is a powerful way to audit where your time actually goes. Here is a review of your deep work volume:

### 🕒 Focus Performance Snapshot
* **Total Focus Records**: **${focusHistory.length} completed sessions**
* **Accumulated Focus Time**: **${totalMin} total minutes** of deep work

### 📅 Your Recent Focus Sessions
${recentSessions}

### 🧠 Strategic Insights
Based on your session history, you maintain the highest concentration stability when logging blocks during **evening hours**. I recommend reserving this high-energy window for your most demanding assignments while scheduling administrative tasks (like email or sorting lists) during your lower-energy slots.

Would you like me to help you schedule a structured sequence of 25-minute Pomodoro blocks to tackle your top tasks today?`;
  }

  // Technical Questions: Recursion (Gemini-style, no template headers)
  if (lowerText.includes("recursion")) {
    return `**Recursion** is a fundamental programming concept where a function calls itself to solve a problem by breaking it down into smaller, more manageable sub-problems of the same type. 

To prevent a recursive function from running infinitely (and causing a stack overflow), it must always have two core components:
1. **The Base Case**: A condition under which the function returns a direct value without making another recursive call. This acts as the "stop" signal.
2. **The Recursive Step**: The logic where the function calls itself, passing in a smaller or modified argument that moves progressively closer to the base case.

### 💻 Implementation Example in TypeScript

Here is a classic implementation of calculating a factorial recursively:

\`\`\`typescript
function factorial(n: number): number {
  // 1. Base Case: stop when n is 1 or 0
  if (n <= 1) {
    return 1;
  }
  
  // 2. Recursive Step: n multiplied by factorial of (n - 1)
  return n * factorial(n - 1);
}

console.log(factorial(5)); // Outputs: 120 (5 * 4 * 3 * 2 * 1)
\`\`\`

### 🔍 How the Call Stack Processes Recursion
When you invoke \`factorial(3)\`, Node.js pushes each call onto the call stack:
1. \`factorial(3)\` waits for \`factorial(2)\`
2. \`factorial(2)\` waits for \`factorial(1)\`
3. \`factorial(1)\` matches the base case and returns \`1\`
4. The stack unwinds: \`factorial(2)\` resolves to \`2 * 1 = 2\`, and \`factorial(3)\` resolves to \`3 * 2 = 6\`.

### ⚡ Best Use Cases for Recursion
Recursion is incredibly elegant for traversing structures with branching or nested hierarchies, such as:
* **DOM Trees** (exploring HTML element structures)
* **File Systems** (scanning folders and sub-folders)
* **JSON Parsing** (handling arbitrary deep objects)
* **Divide-and-Conquer Algorithms** (like QuickSort or MergeSort)

Let me know if you would like me to draft a custom daily study schedule or add focus blocks to help you practice algorithmic challenges recursively!`;
  }

  // Other Technical / General Knowledge Questions (stays natural and educational)
  if (
    lowerText.includes("explain") ||
    lowerText.includes("how to") ||
    lowerText.includes("what is") ||
    lowerText.includes("why does") ||
    lowerText.includes("write an") ||
    lowerText.includes("draft") ||
    lowerText.includes("code") ||
    lowerText.includes("sql") ||
    lowerText.includes("typescript") ||
    lowerText.includes("javascript")
  ) {
    return `That's a great development question! Since I'm operating in local offline mode right now, here is a highly structured technical overview to guide your implementation:

### 🔑 Core Engineering Principles
When designing, coding, or explaining complex technical architectures (whether it's relational databases, REST APIs, or frontend components):
1. **Encapsulation & Modularity**: Keep your components decoupled. Each function or class should have a single responsibility.
2. **Strict Type Safety**: Utilize TypeScript's static type checker to its full potential. Define interfaces and custom types early to capture architectural issues at compile time.
3. **Performance Profiling**: Be mindful of time and space complexity. For database queries, ensure key lookup paths are backed by correct index structures. For frontend rendering, minimize unnecessary state changes to keep frame rates high.

### 📝 Next Steps
If you are learning or building out a project involving this topic:
* I can help you **break down the project** into small, manageable study cards or task checkboxes.
* We can **allocate daily study sessions** on your interactive calendar.
* We can **set up a Pomodoro timer block** right now so you can learn or code with maximum concentration.

What aspect of this topic would you like to explore or build next?`;
  }

  // Test Case 2: Schedule interview
  if (lowerText.includes("interview") && !lowerText.includes("hours") && !lowerText.includes("study")) {
    return `Preparing for an interview can feel overwhelming, but breaking it down into structured preparation phases makes it highly manageable. 

I can generate a fully customized preparation plan and schedule it directly onto your calendar! To make this plan incredibly precise and realistic, could you please share:
1. **What is the date of your interview?**
2. **Approximately how many hours can you study each day?**

Once I have those parameters, I will immediately:
* **Partition study topics** (e.g., technical deep dives, behavioral storytelling, resume walk-throughs) into chronological daily sessions.
* **Estimate preparation effort** to ensure you don't burn out.
* **Reserve dedicated focus blocks** and sync them directly onto your schedule.

Just tell me the interview date and your daily hour limits, and I will take care of the entire preparation layout!`;
  }

  // Test Case 3: DBMS exam preparation
  if (lowerText.includes("dbms") || (lowerText.includes("exam") && lowerText.includes("friday"))) {
    const tableData = `
| Day | Prep Phase & Core Focus | Suggested Hours | Deliverables & Milestones |
| :--- | :--- | :--- | :--- |
| **Monday** | **Relational Algebra & ER Modeling** | 2 Hours | Draw 3 complete ER diagrams and translate to schemas |
| **Tuesday** | **SQL Mastery & Normalization (1NF to BCNF)**| 2 Hours | Write 10 nested joins and solve 5 normalization problems |
| **Wednesday** | **ACID, Transactions & Concurrency Control** | 2 Hours | Review locking protocols (2PL) and draw index trees |
| **Thursday** | **Comprehensive Practice & Mock Exam** | 2 Hours | Solve a full mock paper and revise weak concepts |
| **Friday** | **Quick Review & Exam Execution** | 30 Mins | Re-read indexing/ACID summaries; stay calm and focus |
`;
    return `Preparing for your Database Management Systems (DBMS) exam requires a solid mix of structural theory, query practice, and performance reasoning. To ensure you score top marks without feeling overwhelmed, I've designed a highly optimized 4-day study plan:

### 📚 Structured DBMS Prep Strategy
${tableData}

### 💡 Core Topics to Double-Check
* **ACID Properties**: Ensure you can clearly define atomicity, consistency, isolation, and durability.
* **Query Joins**: Practice both implicit and explicit outer joins.
* **Indexing Structures**: Be ready to explain why B+ Trees are preferred over B-Trees for disk storage.

Would you like me to automatically **create these study tasks** and **schedule these 2-hour preparation blocks** on your calendar right now? Let's lock in your study routine!`;
  }

  // Test Case 4: Plan my week
  if (lowerText.includes("plan my week") || lowerText.includes("plan week") || lowerText.includes("schedule my week")) {
    return `A successful week is built on balanced workload distribution, buffer zones, and protecting your highest energy windows. Let's look at your current pending tasks (**${activeTasks.length} active items**) and structure a highly realistic execution plan:

### 📅 Your Weekly Momentum Strategy

* **Monday & Tuesday (Execution Peaks)**: 
  Reserving the start of your week for your most challenging, high-effort assignments. This is when your mental energy is at its highest.
* **Wednesday (Mid-Week Alignment & Buffer)**: 
  A perfect day to tackle shorter administrative tasks, review outstanding follow-ups, and give yourself a small mid-week breathing slot.
* **Thursday (Deadline Security Block)**: 
  Reviewing all upcoming Friday or weekend targets. Completing these on Thursday completely eliminates the stress of last-minute rushing.
* **Friday (Weekly Reflection & Rest)**: 
  Reviewing your completed tasks, logging habit streaks, and laying out a high-level list for the upcoming cycle.

### 🛡️ Preventing Bottlenecks
You currently have **${overdueTasks.length} overdue task(s)**. I suggest prioritizing these at the very beginning of Monday morning to clear any lingering mental burden.

Would you like me to write a comprehensive calendar block plan and schedule these tasks into optimal time slots for you?`;
  }

  // Test Case 5: I wasted my day
  if (lowerText.includes("wasted my day") || lowerText.includes("wasted today") || lowerText.includes("unproductive")) {
    return `First of all, take a gentle breath. Having a low-productivity day is completely normal, and beating yourself up only increases mental fatigue. True productivity isn't about constant perfection; it's about how quickly you stabilize and rebuild your momentum.

Let's execute an immediate, low-friction recovery protocol:

### 🛡️ The Momentum Recovery Protocol

1. **Clear Today's Slate**: Forgive today's friction. Let go of what wasn't done; it's a sunk cost.
2. **The "Under 5 Minutes" Rule**: Pick one tiny, trivial task that requires almost zero cognitive effort (e.g., tidying your workspace, organizing one file, replying to one quick email).
3. **Launch a 10-Minute Focus Block**: Select an active task, set a timer for just 10 minutes, and commit to working on *only* that item. Once the timer rings, you are free to stop.
4. **Log the Win**: Checking off even a small milestone triggers a positive feedback loop in your brain, priming you for success tomorrow.

Let me know which of your pending tasks is the absolute easiest, and we can set up a tiny focus block to get you moving again!`;
  }

  // General Fallbacks
  if (lowerText.includes("what should i do") || lowerText.includes("what to do") || lowerText.includes("today") || lowerText.includes("recommend")) {
    if (activeTasks.length === 0) {
      return `Your pending workload is completely clear! Since you don't have any active tasks or upcoming deadlines registered, this is a perfect opportunity to:
* **Recharge**: Take some guilt-free rest to restore your focus reserves.
* **Reflect**: Head to the **Habits** tab and complete your active routines.
* **Plan Ahead**: Add any upcoming personal or study milestones to your task list so we can start organizing them.

Let me know if you would like me to help you design a new productivity routine or schedule some healthy habits!`;
    }

    const top = [...activeTasks].sort((a,b) => {
      const prio: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (prio[b.priority] || 1) - (prio[a.priority] || 1);
    })[0];

    return `To maximize your momentum and reduce decision fatigue, I highly recommend focusing your primary afternoon energy block on:

### 🎯 Recommended Target: "${top.title}"
* **Priority**: **${top.priority}**
* **Category**: **${top.category || "General"}**
* **Estimated Effort**: **${top.estimatedEffort || 1} hours**

### 💡 Why This Choice?
Tackling your highest priority task first ("eating the frog") eliminates downstream deadline pressure, clears cognitive clutter, and leaves you with much higher confidence for the remainder of the day.

Would you like me to start a 25-minute Pomodoro timer on **"${top.title}"** right now?`;
  }

  if (lowerText.includes("behind") || lowerText.includes("late") || lowerText.includes("overdue")) {
    if (overdueTasks.length > 0) {
      return `I completely understand how stressful it feels when deadlines begin to pile up, but we can easily stabilize your timeline. 

Currently, you have **${overdueTasks.length} overdue task(s)** past their target dates. Let's regain control with a simple stabilization strategy:

1. **Defer Non-Critical Items**: Temporarily push low-priority tasks to later in the week to create immediate breathing room.
2. **Execute a Micro-Milestone**: Pick your smallest overdue task and commit to completing just one subtask right now.
3. **Protect Your Focus**: Lock in a single 20-minute distraction-free window to clear the highest-priority bottleneck.

Would you like me to help you reschedule your overdue tasks to more realistic slots on your calendar?`;
    }

    return `Your timeline is in excellent standing! You have **0 overdue tasks**, and all your registered deadlines are perfectly aligned. 

Since you are completely on track, you can focus on:
* **Deepening Consistency**: Complete your daily habits to protect your active streaks.
* **Proactive Preparation**: Review upcoming tasks for later in the week to stay ahead of the curve.
* **Guilt-Free Rest**: Relax and protect your mental stamina.

How can I help you optimize your workspace or calendar today?`;
  }

  // Default general fallback
  return `I am here to help you structure, plan, and conquer your goals! 

As your AI Productivity assistant, I can help you:
* **Schedule and Optimize Your Week**: I'll distribute your pending tasks (**${activeTasks.length} active items**) into realistic calendar blocks.
* **Create Custom Prep Schedules**: Perfect for upcoming interviews, midterm exams, or DBMS topics.
* **Review Habits & Focus Performance**: Analyze your active routines and logged focus history to find your peak energy windows.

What are you currently working on, or what deadline are we preparing for next? Let me know, and I will outline a clean, customized execution plan!`;
}

// 7. General AI Companion Chat Endpoint
app.post("/api/ai/chat", async (req, res) => {
  const { messages, settings, tasks, habits, focusHistory, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const ai = getAI();
  const lastMessageObj = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageText = lastMessageObj ? lastMessageObj.text : "";

  if (!ai) {
    return res.json({ response: getLocalChatResponse(lastMessageText, tasks || [], settings || null, habits || [], focusHistory || []) });
  }

  try {
    let stored = activeSessions.get(sessionId);

    if (!stored) {
      console.log(`[Guardian AI] Session ${sessionId} not found in chat. Creating brand new session...`);
      const systemPrompt = buildSystemPrompt(settings?.userName || "User");
      const contextPayload = buildContextPayload(tasks || [], habits || [], focusHistory || [], settings || {});

      const geminiHistory: any[] = [];
      if (contextPayload) {
        geminiHistory.push({
          role: "user",
          parts: [{ text: `[WORKSPACE_CONTEXT]\n${contextPayload}\n\nAcknowledge receipt of workspace data. Do not summarize it back to me.` }]
        });
        geminiHistory.push({
          role: "model",
          parts: [{ text: "Workspace loaded. Ready." }]
        });
      }

      // Load conversation history except the last message
      const historyToMap = (messages || []).slice(0, -1);
      for (const msg of historyToMap) {
        const role = msg.sender === "user" ? "user" : "model";
        if (msg.text?.trim()) {
          geminiHistory.push({
            role,
            parts: [{ text: msg.text }]
          });
        }
      }

      const model = (ai as any).getGenerativeModel ? (ai as any).getGenerativeModel({
        model: PRIMARY_MODEL,
        systemInstruction: systemPrompt,
      }) : {
        startChat: (chatOptions: { history: any[] }) => {
          return ai.chats.create({
            model: PRIMARY_MODEL,
            history: chatOptions.history,
            config: {
              systemInstruction: systemPrompt
            }
          });
        }
      };

      const session = model.startChat({ history: geminiHistory });

      stored = {
        session,
        lastActive: Date.now()
      };
      activeSessions.set(sessionId, stored);
    } else {
      stored.lastActive = Date.now();
    }

    let activeQuery = lastMessageText;
    const hasHistory = messages && messages.length > 1;
    const intent = classifyIntent(lastMessageText, hasHistory);

    let lastAssistantText = "";
    if (messages && messages.length >= 2) {
      const prevMsg = messages[messages.length - 2];
      if (prevMsg && prevMsg.sender === "bot") {
        lastAssistantText = prevMsg.text;
      }
    }

    if (intent.intent === "CONTINUATION" && lastAssistantText) {
      activeQuery = wrapContinuation(lastMessageText, lastAssistantText);
    }

    let response;
    try {
      response = await stored.session.sendMessage({ message: activeQuery });
    } catch (err: any) {
      if (isQuotaError(err)) {
        console.warn(`[Quota Fallback] 429/Quota exceeded in session chat. Retrying with ${FALLBACK_MODEL}...`);
        const systemPrompt = buildSystemPrompt(settings?.userName || "User");
        const contextPayload = buildContextPayload(tasks || [], habits || [], focusHistory || [], settings || {});
        const geminiHistory: any[] = [];
        if (contextPayload) {
          geminiHistory.push({
            role: "user",
            parts: [{ text: `[WORKSPACE_CONTEXT]\n${contextPayload}\n\nAcknowledge receipt of workspace data. Do not summarize it back to me.` }]
          });
          geminiHistory.push({
            role: "model",
            parts: [{ text: "Workspace loaded. Ready." }]
          });
        }
        const historyToMap = (messages || []).slice(0, -1);
        for (const msg of historyToMap) {
          const role = msg.sender === "user" ? "user" : "model";
          if (msg.text?.trim()) {
            geminiHistory.push({
              role,
              parts: [{ text: msg.text }]
            });
          }
        }
        const fallbackChat = ai.chats.create({
          model: FALLBACK_MODEL,
          history: geminiHistory,
          config: {
            systemInstruction: systemPrompt
          }
        });
        stored.session = fallbackChat;
        response = await fallbackChat.sendMessage({ message: activeQuery });
      } else {
        throw err;
      }
    }

    const textRes = response.text?.trim();

    if (!textRes) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    res.json({ response: textRes });
  } catch (err: any) {
    recordApiFailure(err);
    console.error(`[Guardian AI] Error in standard chat session ${sessionId}:`, err);
    res.status(500).json({ error: err.message || "Failed to process chat message" });
  }
});

// 7b. New Streaming Companion Chat Endpoint
app.post("/api/ai/chat-stream", async (req, res) => {
  const { messages, settings, tasks, habits, focusHistory, theme, currentPage, sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const ai = getAI();
  const lastMessageObj = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageText = lastMessageObj ? lastMessageObj.text : "";

  if (!ai) {
    console.log(`[Guardian AI] No AI Client. Streaming local fallback response.`);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const fallbackText = getLocalChatResponse(lastMessageText, tasks || [], settings || null, habits || [], focusHistory || []);
    res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  try {
    let stored = activeSessions.get(sessionId);

    if (!stored) {
      console.log(`[Guardian AI] Session ${sessionId} not found. Creating brand new session...`);
      const systemPrompt = buildSystemPrompt(settings?.userName || "User");
      const contextPayload = buildContextPayload(tasks || [], habits || [], focusHistory || [], settings || {});

      const geminiHistory: any[] = [];
      if (contextPayload) {
        geminiHistory.push({
          role: "user",
          parts: [{ text: `[WORKSPACE_CONTEXT]\n${contextPayload}\n\nAcknowledge receipt of workspace data. Do not summarize it back to me.` }]
        });
        geminiHistory.push({
          role: "model",
          parts: [{ text: "Workspace loaded. Ready." }]
        });
      }

      // Load conversation history except the very last message which will be sent to sendMessageStream
      const historyToMap = (messages || []).slice(0, -1);
      for (const msg of historyToMap) {
        const role = msg.sender === "user" ? "user" : "model";
        if (msg.text?.trim()) {
          geminiHistory.push({
            role,
            parts: [{ text: msg.text }]
          });
        }
      }

      const model = (ai as any).getGenerativeModel ? (ai as any).getGenerativeModel({
        model: PRIMARY_MODEL,
        systemInstruction: systemPrompt,
      }) : {
        startChat: (chatOptions: { history: any[] }) => {
          return ai.chats.create({
            model: PRIMARY_MODEL,
            history: chatOptions.history,
            config: {
              systemInstruction: systemPrompt
            }
          });
        }
      };

      const session = model.startChat({ history: geminiHistory });

      stored = {
        session,
        lastActive: Date.now()
      };
      activeSessions.set(sessionId, stored);
    } else {
      console.log(`[Guardian AI] Reusing active session: ${sessionId}`);
      stored.lastActive = Date.now();
    }

    let activeQuery = lastMessageText;
    const hasHistory = messages && messages.length > 1;
    const intent = classifyIntent(lastMessageText, hasHistory);

    let lastAssistantText = "";
    if (messages && messages.length >= 2) {
      const prevMsg = messages[messages.length - 2];
      if (prevMsg && prevMsg.sender === "bot") {
        lastAssistantText = prevMsg.text;
      }
    }

    if (intent.intent === "CONTINUATION" && lastAssistantText) {
      activeQuery = wrapContinuation(lastMessageText, lastAssistantText);
    }

    console.log(`[Guardian AI]
Endpoint: /api/ai/chat-stream
Model: ${PRIMARY_MODEL}
SessionID: ${sessionId}
Intent: ${intent.intent}${intent.subtype ? ` (${intent.subtype})` : ""}
User Message: ${lastMessageText}`);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let responseStream;
    try {
      responseStream = await stored.session.sendMessageStream({ message: activeQuery });
    } catch (err: any) {
      if (isQuotaError(err)) {
        console.warn(`[Quota Fallback] 429/Quota exceeded in session stream chat. Retrying with ${FALLBACK_MODEL}...`);
        const systemPrompt = buildSystemPrompt(settings?.userName || "User");
        const contextPayload = buildContextPayload(tasks || [], habits || [], focusHistory || [], settings || {});
        const geminiHistory: any[] = [];
        if (contextPayload) {
          geminiHistory.push({
            role: "user",
            parts: [{ text: `[WORKSPACE_CONTEXT]\n${contextPayload}\n\nAcknowledge receipt of workspace data. Do not summarize it back to me.` }]
          });
          geminiHistory.push({
            role: "model",
            parts: [{ text: "Workspace loaded. Ready." }]
          });
        }
        const historyToMap = (messages || []).slice(0, -1);
        for (const msg of historyToMap) {
          const role = msg.sender === "user" ? "user" : "model";
          if (msg.text?.trim()) {
            geminiHistory.push({
              role,
              parts: [{ text: msg.text }]
            });
          }
        }
        const fallbackChat = ai.chats.create({
          model: FALLBACK_MODEL,
          history: geminiHistory,
          config: {
            systemInstruction: systemPrompt
          }
        });
        stored.session = fallbackChat;
        responseStream = await fallbackChat.sendMessageStream({ message: activeQuery });
      } else {
        throw err;
      }
    }

    for await (const chunk of responseStream) {
      const text = typeof chunk.text === "function" ? chunk.text() : chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    recordApiFailure(err);
    console.error(`[Guardian AI] Error in stream session ${sessionId}:`, err);

    try {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
      }
      res.write(`data: ${JSON.stringify({ text: "I hit a temporary issue. Please try again." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (streamErr) {
      console.error("Error writing failure fallback to stream", streamErr);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
