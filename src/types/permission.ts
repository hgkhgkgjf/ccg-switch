// Permission request types from daemon (via Tauri events)

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export interface AskUserQuestionRequest {
  requestId: string;
  toolName: string;
  questions: Question[];
  timestamp: string;
  cwd: string;
}

export interface AllowedPrompt {
  tool: string;
  prompt: string;
}

export interface PlanApprovalRequest {
  requestId: string;
  toolName: string;
  plan: string;
  allowedPrompts: AllowedPrompt[];
  timestamp: string;
  cwd: string;
}
