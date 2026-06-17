// Typed client for the Mathify JAX-RS backend (see API_DOCUMENTATION.md).
//
// All requests are same-origin to `/api/*` and proxied to the backend by the
// rewrite in next.config.ts. That keeps the JSESSIONID session cookie working
// without CORS, so every call sends `credentials: "include"`.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

export type Role = "STUDENT" | "ADMIN" | (string & {});

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  track: string;
  level: string;
  levelNum: number;
  color: string;
  glyph: string;
  totalLessons: number;
  estimatedHours: string;
  xpReward: number;
  status: string;
}

export interface CourseChapter {
  chapterId: string;
  title: string;
}

export interface CourseDetail {
  courseId: string;
  title: string;
  description: string;
  category: string;
  prerequisite: string[];
  chapters: CourseChapter[];
}

export type QuizQuestionType = "MULTIPLE_CHOICE" | (string & {});

/** A selectable answer choice. Correctness is never exposed before grading. */
export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  questionId: string;
  prompt: string;
  points: number;
  type: QuizQuestionType;
  /** Answer choices. Absent until the backend exposes them (PROPOSED). */
  options?: QuizOption[];
}

export interface Quiz {
  quizId: string;
  title: string;
  passingScore: number;
  questions: QuizQuestion[];
}

// ── Quiz grading (proposed POST /api/quizzes/{id}/attempts) ─────────────────
export interface QuizAnswer {
  questionId: string;
  optionId: string;
}

export interface QuizQuestionResult {
  questionId: string;
  correct: boolean;
  earnedPoints: number;
  /** The right choice, so the UI can show it after grading. Optional. */
  correctOptionId?: string;
}

export interface QuizAttemptResult {
  /** Points earned. */
  score: number;
  totalPoints: number;
  correctCount: number;
  questionCount: number;
  passed: boolean;
  passingScore: number;
  results: QuizQuestionResult[];
}

export interface LoginResponse {
  role: Role;
  message: string;
}

export type PlanId = "FREE" | "MONTHLY" | "ANNUAL" | (string & {});

/** Current user's profile + progress, reshaped by the backend MeResource. */
export interface Me {
  name: string;
  initial: string;
  streak: number;
  xp: number;
  level: number;
  /** Billing plan the student is on. Treated as "FREE" when the backend omits it. */
  plan?: PlanId;
  /** Convenience flag: true for any paid plan. Defaults to false when omitted. */
  premium?: boolean;
  /** ISO-8601 renewal/expiry for paid plans; null or omitted on FREE. */
  planRenewsAt?: string | null;
}

// ── Dashboard (proposed GET /api/me/dashboard) ──────────────────────────────
// Single aggregate feed backing the Today page. Every section is optional-by-
// fallback on the client, so the page degrades gracefully until the backend
// ships this endpoint.

export type StepType = "LESSON" | "PRACTICE" | "VIDEO" | "QUIZ" | (string & {});

/** The "pick up where you left off" lesson; null when nothing is in progress. */
export interface ContinueLearning {
  courseId: string;
  courseTitle: string;
  track: string;
  level: number;
  chapterId: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonDescription: string;
  /** 1-based position of the current step within the lesson. */
  stepIndex: number;
  stepCount: number;
  progressPercent: number;
  xpReward: number;
  estimatedMinutes: number;
  pausedAt: string | null;
}

export interface UpNextStep {
  id: string;
  type: StepType;
  title: string;
  /** Pre-formatted secondary line, e.g. "8 problems · 12 XP". */
  meta: string;
  xp: number;
}

export interface DashboardQuest {
  id: string;
  scope: "DAILY" | "WEEKLY" | (string & {});
  title: string;
  description: string;
  progress: number;
  total: number;
  reward: string;
  /** Palette key (green|blue|amber|plum|rose); optional. */
  color?: string;
}

export interface DashboardAchievement {
  id: string;
  name: string;
  description: string;
  /** Humanized or ISO-8601 timestamp the badge was earned. */
  earnedAt: string;
  color?: string;
  glyph?: string;
}

export interface UpcomingAchievement {
  id: string;
  name: string;
  requirement: string;
}

export interface Dashboard {
  /** Daily XP goal ring. */
  goal: { targetXp: number; earnedXp: number };
  continueLearning: ContinueLearning | null;
  upNext: UpNextStep[];
  /** `history` = activity intensity (0..N) per day, oldest→newest. */
  streak: { current: number; history: number[] };
  /** `days` = XP earned per weekday (7 values), `deltaPercent` vs last week. */
  weeklyXp: { days: number[]; total: number; deltaPercent: number };
  hearts: { current: number; max: number };
  quests: DashboardQuest[];
  achievements: {
    earnedCount: number;
    recent: DashboardAchievement[];
    upcoming: UpcomingAchievement[];
  };
}

export type EnrollmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | (string & {});

/** One of the current student's course enrollments (StudentResource). */
export interface Enrollment {
  courseId: string;
  status: EnrollmentStatus;
  /** ISO-8601 timestamp of the last access, or null if never opened. */
  lastAccessedAt: string | null;
  /** 0–100, computed from chapter_progress / chapters. */
  progressPercent: number;
}

/** A course as a node in the prerequisite graph (CourseResource /paths). */
export interface CourseNode {
  id: string;
  title: string;
  track: string;
  levelNum: number;
  /**
   * Named palette key — "green" | "blue" | "amber" | "plum" | "rose" — the same
   * scheme as CourseSummary.color (resolve through COLOR_MAP, not as raw CSS).
   * May be "" when the backend has none.
   */
  color: string;
  /** Display glyph (e.g. "△", "sinθ"); "" when null. */
  glyph: string;
}

/** A directed prerequisite edge: complete `from` before `to`. */
export interface PrereqEdge {
  from: string;
  to: string;
}

/** GET /courses/paths — the whole prerequisite DAG. */
export interface PrereqGraph {
  nodes: CourseNode[];
  edges: PrereqEdge[];
}

/** GET /courses/paths?courseId=X — ordered path (prereqs first, target last). */
export interface LearningPath {
  target: string;
  path: CourseNode[];
}

// ── Chapter lessons (proposed GET /api/chapters/{chapterId}/lessons) ────────
export type LessonType = "READING" | "VIDEO" | "PRACTICE" | "QUIZ" | (string & {});
export type ProgressStatus = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | (string & {});

export interface ChapterLesson {
  id: string;
  title: string;
  type: LessonType;
  estimatedMinutes: number;
  xpReward: number;
  status: ProgressStatus;
}

export interface ChapterContent {
  chapterId: string;
  title: string;
  lessons: ChapterLesson[];
  /** Id of the end-of-chapter quiz, or null. */
  quizId: string | null;
}

// ── Notifications (proposed GET /api/me/notifications) ──────────────────────
export interface Notification {
  id: string;
  title: string;
  body?: string;
  /** Icon key (matches the shared Icon set), e.g. "Flame", "Trophy". */
  icon?: string;
  /** In-app destination to open on click. */
  link?: string;
  read: boolean;
  createdAt?: string;
}

export interface NotificationFeed {
  items: Notification[];
  unread: number;
}

// ── Billing checkout (proposed POST /api/billing/checkout) ──────────────────
export interface CheckoutSession {
  /** URL to redirect the browser to (Midtrans Snap redirect / payment page). */
  redirectUrl: string;
  /** Midtrans Snap token, when using the embedded Snap flow. */
  token?: string;
  orderId?: string;
}

export interface ApiErrorBody {
  error: string;
  details?: string;
}

/** Thrown for any non-2xx response; carries the HTTP status + backend message. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      message = body.details || body.error || message;
    } catch {
      /* non-JSON error body — keep the status message */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  /** Exchange a Firebase ID token for a backend session; returns the user's role. */
  login: (idToken: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  /** Current user's profile + progress (requires a session). */
  getMe: () => request<Me>("/me"),
  /** Aggregate Today-page feed (requires a session). Proposed endpoint. */
  getDashboard: () => request<Dashboard>("/me/dashboard"),
  listCourses: () => request<CourseSummary[]>("/courses"),
  /** The current student's enrollments with per-course progress. */
  listEnrollments: () => request<Enrollment[]>("/students/me/enrollments"),
  getCourse: (id: string) => request<CourseDetail>(`/courses/${encodeURIComponent(id)}`),
  /** The whole prerequisite DAG (every course as a node). */
  getPrereqGraph: () => request<PrereqGraph>("/courses/paths"),
  /** The ordered prerequisite path leading up to one course. */
  getLearningPath: (courseId: string) =>
    request<LearningPath>(`/courses/paths?courseId=${encodeURIComponent(courseId)}`),
  getQuiz: (id: string) => request<Quiz>(`/quizzes/${encodeURIComponent(id)}`),
  /** Submit answers for grading (PROPOSED). */
  submitQuiz: (id: string, answers: QuizAnswer[]) =>
    request<QuizAttemptResult>(`/quizzes/${encodeURIComponent(id)}/attempts`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
  /** Lessons within a chapter (PROPOSED). */
  getChapterLessons: (chapterId: string) =>
    request<ChapterContent>(`/chapters/${encodeURIComponent(chapterId)}/lessons`),
  /** Enroll the current student in a course (PROPOSED). Returns the enrollment. */
  enroll: (courseId: string) =>
    request<Enrollment>(`/courses/${encodeURIComponent(courseId)}/enroll`, { method: "POST" }),
  /** Notification feed for the current student (PROPOSED). */
  getNotifications: () => request<NotificationFeed>("/me/notifications"),
  markNotificationRead: (id: string) =>
    request<void>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<void>("/me/notifications/read-all", { method: "POST" }),
  /** Start a Midtrans checkout for a paid plan (PROPOSED). */
  createCheckout: (planId: string) =>
    request<CheckoutSession>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planId }),
    }),
};
