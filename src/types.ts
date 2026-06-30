export interface Task {
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

export interface UserSettings {
  userName: string;
  productiveHours: "Morning" | "Afternoon" | "Evening" | "LateNight";
  preferredWorkBlock: number; // minutes
  frequentlyDelayed: string[];
  personalBio: string;
  failureRiskTolerance: "Low" | "Medium" | "High";
}

export interface TimeBlock {
  timeSlot: string;
  taskTitle: string;
  duration: string;
  focusGoal: string;
}

export interface HistoryLog {
  timestamp: string;
  action: string;
  details: string;
}

export interface RiskAnalysis {
  overallRiskScore: number;
  highRiskAlerts: {
    taskId: string;
    warning: string;
    recommendation: string;
  }[];
  futureSelfWarning: string;
}

export interface EmergencyPlan {
  emergencyTimeline: {
    timeSpan: string;
    action: string;
    estimatedProgress: string;
  }[];
  cutOffTasks: string[];
  emergencyAdvice: string;
}

export interface CoachAdvice {
  insight: string;
  habitSuggestion: string;
  motivationMessage: string;
}

export interface SmartAddResponse {
  isComplete: boolean;
  followUpQuestion: string | null;
  task: Partial<Task> | null;
  feedbackMessage: string | null;
}

