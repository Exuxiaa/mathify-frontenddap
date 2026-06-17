# API Documentation
> Mathify JAX-RS API, Base URL: `/api`, Version: v1

## Table of Contents
- [Overview](#overview)
- [Error Responses](#error-responses)
- [Endpoints](#endpoints)
  - [AuthResource](#authresource)
  - [CourseResource](#courseresource)
  - [QuizResource](#quizresource)

## Overview
- **Base URL:** `http://localhost:8080/api` (or relative `/api` on the server)
- **Authentication method:** Token/Session based. Endpoints marked as `@Secured` require an authenticated context (typically via server session established after `/auth/login`).
- **Common headers:** `Content-Type: application/json`, `Accept: application/json`

## Error Responses
The API uses standardized error responses across all endpoints.

**Success format:** `200 OK` or `201 Created` depending on the operation.
**Error format:** `ErrorResponse` object.

```json
{
  "error": "Validation Failed",
  "details": "idToken is required"
}
```

**Common HTTP Status Codes:**
| Status | Condition |
|--------|-----------|
| `400`  | Validation failed (e.g., missing required fields handled by `@Valid`) |
| `401`  | Unauthorized (Missing or invalid authentication) |
| `404`  | Resource not found |
| `500`  | Internal Server Error |

---

## Endpoints

### AuthResource
Authentication and session management.

#### `POST /api/auth/login`
**Description:** Authenticates a user using an identity token (e.g., Firebase ID token) and establishes a session.

**Authentication:** Not Required

**Request Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Request Body Fields:**
| Field     | Type   | Required | Validation        | Description |
|-----------|--------|----------|-------------------|-------------|
| idToken   | String | Yes      | NotBlank          | Identity token for login |

**Response — Success:**
- Status: `200 OK`
```json
{
  "role": "STUDENT",
  "message": "Login successful"
}
```

**Response — Error:**
| Status | Condition              |
|--------|------------------------|
| 400    | `idToken` is missing or blank |
| 401    | Invalid or expired token |

**Example cURL:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_FIREBASE_ID_TOKEN"}'
```

#### `POST /api/auth/logout`
**Description:** Logs the user out and invalidates the session.

**Authentication:** Not Required

**Response — Success:**
- Status: `200 OK`
```json
{
  "message": "Logged out"
}
```

**Example cURL:**
```bash
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Content-Type: application/json"
```

---
### CourseResource
Retrieve course catalog and details.

#### `GET /api/courses`
**Description:** Retrieves a list of all course summary cards for the library grid.

**Authentication:** Not Required

**Response — Success:**
- Status: `200 OK`
```json
[
  {
    "id": "c-k2",
    "title": "Early Elementary Math (K-2)",
    "description": "Early Math curriculum",
    "track": "Early Math",
    "level": "Beginner",
    "levelNum": 1,
    "color": "green",
    "glyph": "∑",
    "totalLessons": 9,
    "estimatedHours": "5h",
    "xpReward": 1000,
    "status": "new"
  }
]
```

**Example cURL:**
```bash
curl -X GET http://localhost:8080/api/courses \
  -H "Accept: application/json"
```

#### `GET /api/courses/{id}`
**Description:** Retrieves the full details of a specific course, including its prerequisites and chapters.

**Authentication:** Required (`@Secured`)

**Path Parameters:**
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | String | Yes      | Course ID |

**Response — Success:**
- Status: `200 OK`
```json
{
  "courseId": "c-k2",
  "title": "Early Elementary Math (K-2)",
  "description": "Early Math curriculum",
  "category": "Early Math",
  "prerequisite": [],
  "chapters": [
    {
      "chapterId": "ch-k2-u1",
      "title": "Counting and Cardinality"
    }
  ]
}
```

**Response — Error:**
| Status | Condition              |
|--------|------------------------|
| 401    | Unauthorized (Session missing or invalid) |
| 404    | Course not found       |

**Example cURL:**
```bash
curl -X GET http://localhost:8080/api/courses/c-k2 \
  -H "Accept: application/json" \
  -H "Cookie: JSESSIONID=YOUR_SESSION_ID"
```

---
### QuizResource
Retrieve quiz details and exercises.

#### `GET /api/quizzes/{id}`
**Description:** Retrieves a specific quiz and all of its associated questions.

**Authentication:** Required (`@Secured`)

**Path Parameters:**
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | String | Yes      | Quiz ID |

**Response — Success:**
- Status: `200 OK`
```json
{
  "quizId": "q-l-k2-u1-1",
  "title": "Exercises: Counting to 10",
  "passingScore": 2,
  "questions": [
    {
      "questionId": "q-0-98183fcd",
      "prompt": "If you have 4 apples and 3 bananas, how many fruits do you have in total?",
      "points": 10,
      "type": "MULTIPLE_CHOICE"
    }
  ]
}
```

**Response — Error:**
| Status | Condition              |
|--------|------------------------|
| 401    | Unauthorized (Session missing or invalid) |
| 404    | Quiz not found         |

**Example cURL:**
```bash
curl -X GET http://localhost:8080/api/quizzes/q-l-k2-u1-1 \
  -H "Accept: application/json" \
  -H "Cookie: JSESSIONID=YOUR_SESSION_ID"
```

---

## ⚠️ Session cookie requirement (auth fix)

The frontend talks to the backend **same-origin** through a Next.js proxy (`/api/*` → backend), so the session cookie set by `POST /api/auth/login` must be storable by the browser on the proxy origin.

**Problem observed:** every response currently sends `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` (an invalid CORS combination) — indicating the session cookie is issued for cross-site use, i.e. `Set-Cookie: …; SameSite=None; Secure`. A `Secure` cookie is **dropped by the browser over `http://localhost`**, so the session never persists and every `@Secured` call 401s right after login.

**Frontend mitigation (already shipped):** `app/api/auth/login/route.ts` proxies the login and rewrites the backend's `Set-Cookie` (strips `Secure` over http, downgrades `SameSite=None`→`Lax`, drops `Domain`) so the session sticks in dev.

**Recommended backend fix:** in non-HTTPS/dev profiles, issue the session cookie as `Set-Cookie: JSESSIONID=…; Path=/; HttpOnly; SameSite=Lax` (no `Secure`). For production over HTTPS, `SameSite=None; Secure` is fine since the proxy is same-origin. Also drop the `Access-Control-Allow-Origin: *` + `Allow-Credentials: true` combo (use a concrete allowed origin, or omit CORS entirely now that calls are same-origin).

---

# Proposed Endpoints (to implement)
> Drafted by the frontend; not yet implemented. The client already consumes these with graceful fallback. Shapes can be adjusted — update `core/api.ts` to match.

### MeResource (extend existing `GET /api/me`)
Add billing/subscription fields to the current `Me` payload so premium status can be shown in the nav, profile menu, and Plans page.

```jsonc
{
  "name": "Ada Lovelace",
  "initial": "A",
  "streak": 12,
  "xp": 2480,
  "level": 8,
  "plan": "ANNUAL",            // "FREE" | "MONTHLY" | "ANNUAL"  (NEW)
  "premium": true,              // convenience flag, true for any paid plan (NEW)
  "planRenewsAt": "2026-12-01T00:00:00Z"  // ISO-8601, null on FREE (NEW)
}
```
If `premium` is omitted, the client derives it as `plan !== "FREE"`.

### DashboardResource — `GET /api/me/dashboard`
**Auth:** Required (`@Secured`). One aggregate feed backing the Today page. Every section is rendered with a static fallback until this ships, so partial rollouts are safe.

```jsonc
{
  "goal": { "targetXp": 50, "earnedXp": 36 },
  "continueLearning": {                 // null when nothing is in progress
    "courseId": "ab16…", "courseTitle": "Differential Calculus", "track": "Calculus", "level": 8,
    "chapterId": "ch-…", "chapterTitle": "Derivatives",
    "lessonId": "l-…",   "lessonTitle": "The chain rule, intuitively",
    "lessonDescription": "Functions inside functions — a nested gear system.",
    "stepIndex": 3, "stepCount": 7,     // stepIndex is 1-based
    "progressPercent": 43, "xpReward": 24, "estimatedMinutes": 6,
    "pausedAt": "2026-06-17T03:10:00Z"  // ISO-8601 or null
  },
  "upNext": [
    { "id": "s1", "type": "PRACTICE", "title": "Practice: chain rule drills", "meta": "8 problems · 12 XP", "xp": 12 }
    // type: "LESSON" | "PRACTICE" | "VIDEO" | "QUIZ"
  ],
  "streak":   { "current": 12, "history": [3,4,3,5,6,5,7,6,8,7,9,8,9,10] },  // intensity per day, oldest→newest
  "weeklyXp": { "days": [180,240,220,320,300,460,520], "total": 2480, "deltaPercent": 12 },
  "hearts":   { "current": 5, "max": 5 },
  "quests": [
    { "id": "q1", "scope": "DAILY", "title": "Finish today's plan", "description": "Complete the 3 remaining steps",
      "progress": 4, "total": 7, "reward": "20 XP", "color": "green" }   // color: green|blue|amber|plum|rose (optional)
  ],
  "achievements": {
    "earnedCount": 12,
    "recent":   [ { "id": "a1", "name": "Algebra Apprentice", "description": "Finished Basic Algebra",
                    "earnedAt": "2026-06-15T12:00:00Z", "color": "green", "glyph": "" } ],  // earnedAt ISO or humanized
    "upcoming": [ { "id": "u1", "name": "Calculus Cadet", "requirement": "Finish Derivatives" } ]
  }
}
```

### ChapterResource — `GET /api/chapters/{chapterId}/lessons`
**Auth:** Required (`@Secured`). Lessons within a chapter, backing the chapter modules page. Falls back to a placeholder note until live.

```jsonc
{
  "chapterId": "ch-k2-u1",
  "title": "Counting and Cardinality",
  "lessons": [
    { "id": "l-1", "title": "Counting to 10", "type": "READING",  // READING|VIDEO|PRACTICE|QUIZ
      "estimatedMinutes": 6, "xpReward": 24, "status": "COMPLETED" } // LOCKED|AVAILABLE|IN_PROGRESS|COMPLETED
  ],
  "quizId": "q-l-k2-u1-1"   // end-of-chapter quiz id, or null
}
```

### QuizResource — answer options + grading
**1. Add `options` to each question on `GET /api/quizzes/{id}`** (correctness never exposed pre-grade):
```jsonc
{
  "questionId": "q-0-98183fcd", "prompt": "…", "points": 10, "type": "MULTIPLE_CHOICE",
  "options": [ { "id": "o-a", "text": "7" }, { "id": "o-b", "text": "12" } ]   // NEW
}
```
The quiz renders read-only until every question carries `options`; then it becomes interactive.

**2. `POST /api/quizzes/{id}/attempts`** — grade a submission. **Auth:** Required.

**Request:**
```jsonc
{ "answers": [ { "questionId": "q-0-98183fcd", "optionId": "o-a" } ] }
```
**Response — `200 OK`:**
```jsonc
{
  "score": 20, "totalPoints": 30, "correctCount": 2, "questionCount": 3,
  "passed": true, "passingScore": 2,
  "results": [
    { "questionId": "q-0-98183fcd", "correct": true, "earnedPoints": 10, "correctOptionId": "o-a" }
  ]
}
```

### CourseResource — `POST /api/courses/{id}/enroll`
**Auth:** Required. Enrolls the current student; returns the created enrollment (same shape as `GET /api/students/me/enrollments` items). Used by the All Courses "Enroll" button.
- `201 Created`: `{ "courseId": "c-k2", "status": "NOT_STARTED", "lastAccessedAt": null, "progressPercent": 0 }`
- `401` not signed in · `404` course not found · `409` already enrolled (treated as success by the client).

### NotificationResource — `GET /api/me/notifications`
**Auth:** Required (best-effort on the client; empty/401 → empty bell).
```jsonc
{
  "unread": 2,
  "items": [
    { "id": "n1", "title": "New badge unlocked", "body": "Algebra Apprentice", "icon": "Trophy",  // Icon key
      "link": "/dashboard", "read": false, "createdAt": "2026-06-17T02:00:00Z" }
  ]
}
```
- `POST /api/me/notifications/{id}/read` — mark one read.
- `POST /api/me/notifications/read-all` — mark all read.

### BillingResource — `POST /api/billing/checkout`
**Auth:** Required. Starts a Midtrans checkout for a paid plan. The Plans CTA redirects the browser to `redirectUrl` (falls back to a "coming soon" toast on error).

**Request:** `{ "planId": "ANNUAL" }`  → **Response:** `{ "redirectUrl": "https://app.midtrans.com/snap/…", "token": "…", "orderId": "…" }`

### Still static (no contract yet)
- Admin dashboard, and lesson-detail content (the lessons feed above lists steps but there's no per-lesson reading/video payload route yet).
