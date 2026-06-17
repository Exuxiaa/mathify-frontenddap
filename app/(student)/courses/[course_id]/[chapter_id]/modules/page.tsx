"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/app/(shared)/icons";
import { api, type CourseDetail, type ChapterContent, type ChapterLesson, ApiError } from "@/core/api";

// Chapter modules landing. Wired to the proposed GET /api/chapters/{id}/lessons
// feed; the chapter title still comes from GET /api/courses/{id} for the
// breadcrumb. Until the lessons endpoint ships, the lesson list falls back to a
// short "coming soon" note and the page still routes through to the quiz.

const LESSON_ICON: Record<string, ReactNode> = {
  READING: <Icon.Book/>, VIDEO: <Icon.Play/>, PRACTICE: <Icon.Target/>, QUIZ: <Icon.Sparkle/>,
};

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  COMPLETED:   { label: "Done",        bg: "var(--green-soft)", fg: "var(--green-deep)" },
  IN_PROGRESS: { label: "In progress", bg: "var(--blue-soft)",  fg: "var(--blue-deep)"  },
  AVAILABLE:   { label: "Start",       bg: "var(--bg-2)",       fg: "var(--ink-2)"      },
  LOCKED:      { label: "Locked",      bg: "var(--bg-2)",       fg: "var(--ink-3)"      },
};

const LessonRow = ({ lesson, index }: { lesson: ChapterLesson; index: number }) => {
  const locked = lesson.status === "LOCKED";
  const s = STATUS_STYLE[lesson.status] ?? STATUS_STYLE.AVAILABLE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderRadius: 16, background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", opacity: locked ? 0.6 : 1 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, color: s.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {lesson.status === "COMPLETED" ? <Icon.Check/> : locked ? <Icon.Lock/> : LESSON_ICON[lesson.type] ?? <Icon.Book/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{index + 1}. {lesson.title}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>
          <span className="mono">{(lesson.type || "LESSON").toString().toLowerCase()}</span>
          {lesson.estimatedMinutes > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon.Clock/> {lesson.estimatedMinutes} min</span>}
          {lesson.xpReward > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--amber-deep)" }}><Icon.Bolt/> {lesson.xpReward} XP</span>}
        </div>
      </div>
      <span style={{ padding: "5px 12px", borderRadius: 999, background: s.bg, color: s.fg, fontSize: 12, fontWeight: 700 }}>{s.label}</span>
    </div>
  );
};

export default function ChapterModulesPage({ params }: { params: Promise<{ course_id: string; chapter_id: string }> }) {
  const { course_id, chapter_id } = use(params);
  return <ChapterModulesView key={chapter_id} course_id={course_id} chapter_id={chapter_id} />;
}

function ChapterModulesView({ course_id, chapter_id }: { course_id: string; chapter_id: string }) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getCourse(course_id)
      .then((data) => { if (alive) setCourse(data); })
      .catch((e: unknown) => { if (alive) setError(e instanceof ApiError ? e.message : "Could not load this chapter."); });
    return () => { alive = false; };
  }, [course_id]);

  useEffect(() => {
    let alive = true;
    // Best-effort: the lessons endpoint may not exist yet — fall back silently.
    api.getChapterLessons(chapter_id)
      .then((data) => { if (alive) setContent(data); })
      .catch(() => { /* keep the placeholder */ });
    return () => { alive = false; };
  }, [chapter_id]);

  const chapter = course?.chapters.find((c) => c.chapterId === chapter_id);
  const chapterIndex = course ? course.chapters.findIndex((c) => c.chapterId === chapter_id) : -1;
  const lessons = content?.lessons ?? [];
  const quizId = content?.quizId ?? chapter_id;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 28px 80px" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)", marginBottom: 20, flexWrap: "wrap" }}>
        <Link href="/courses" style={{ color: "var(--ink-3)", fontWeight: 600 }}>Library</Link>
        <span>›</span>
        <Link href={`/courses/${course_id}`} style={{ color: "var(--ink-3)", fontWeight: 600 }}>{course?.title ?? "Course"}</Link>
        <span>›</span>
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{chapter?.title ?? content?.title ?? "Chapter"}</span>
      </nav>

      {error ? (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--rose)", fontSize: 14 }}>{error}</div>
      ) : !course ? (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--ink-3)", fontSize: 14 }}>Loading chapter…</div>
      ) : !chapter ? (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--ink-3)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>Chapter not found</div>
          <Link href={`/courses/${course_id}`} style={{ color: "var(--green-deep)", fontWeight: 700 }}>Back to course</Link>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 28 }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)" }}>
              CHAPTER {chapterIndex + 1}{lessons.length > 0 ? ` · ${lessons.length} LESSONS` : ""}
            </span>
            <h1 style={{ margin: "6px 0 0", fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{chapter.title}</h1>
          </div>

          {lessons.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {lessons.map((l, i) => <LessonRow key={l.id} lesson={l} index={i}/>)}
            </div>
          ) : (
            <div style={{ padding: "20px 22px", borderRadius: 18, background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Icon.Book/>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Lessons</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
                Module content for this chapter isn&rsquo;t available yet. Once the lessons endpoint lands,
                the reading, video and practice steps will appear here.
              </p>
            </div>
          )}

          <Link href={`/courses/${course_id}/${quizId}/quizzez`}
             style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 18, background: "var(--ink)", color: "var(--paper)", textDecoration: "none", boxShadow: "var(--shadow-md)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon.Target/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Chapter quiz</div>
              <div style={{ fontSize: 13, color: "rgba(255,253,247,0.65)" }}>Check what you&rsquo;ve learned</div>
            </div>
            <Icon.Arrow/>
          </Link>
        </>
      )}
    </main>
  );
}
