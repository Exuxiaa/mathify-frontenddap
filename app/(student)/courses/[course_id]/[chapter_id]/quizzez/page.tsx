"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/app/(shared)/icons";
import { api, type Quiz, type QuizAttemptResult, type QuizQuestionResult, ApiError } from "@/core/api";

// Chapter quiz, wired to GET /api/quizzes/{id} (the [chapter_id] segment is the
// quiz id) and the proposed POST /api/quizzes/{id}/attempts grader. When the
// backend returns answer `options`, the quiz is fully interactive: pick an
// answer per question, submit, and see a graded result. If options are absent
// (endpoint not updated yet) it gracefully degrades to a read-only preview.

const TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
};

export default function QuizPage({ params }: { params: Promise<{ course_id: string; chapter_id: string }> }) {
  const { course_id, chapter_id } = use(params);
  return <QuizView key={chapter_id} course_id={course_id} chapter_id={chapter_id} />;
}

function QuizView({ course_id, chapter_id }: { course_id: string; chapter_id: string }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  useEffect(() => {
    let alive = true;
    api.getQuiz(chapter_id)
      .then((data) => { if (alive) setQuiz(data); })
      .catch((e: unknown) => { if (alive) setError(e instanceof ApiError ? { status: e.status, message: e.message } : { message: "Could not load this quiz." }); });
    return () => { alive = false; };
  }, [chapter_id]);

  const totalPoints = quiz?.questions.reduce((a, q) => a + q.points, 0) ?? 0;
  // Interactive only when every question carries answer options.
  const interactive = !!quiz && quiz.questions.length > 0 && quiz.questions.every((q) => (q.options?.length ?? 0) > 0);
  const answeredCount = quiz ? quiz.questions.filter((q) => answers[q.questionId]).length : 0;
  const allAnswered = !!quiz && answeredCount === quiz.questions.length;
  const resultById = useMemo(() => {
    const m = new Map<string, QuizQuestionResult>();
    result?.results.forEach((r) => m.set(r.questionId, r));
    return m;
  }, [result]);

  const select = (questionId: string, optionId: string) => {
    if (result) return; // locked after grading
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const submit = async () => {
    if (!quiz || !allAnswered || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = quiz.questions.map((q) => ({ questionId: q.questionId, optionId: answers[q.questionId] }));
      const res = await api.submitQuiz(quiz.quizId, payload);
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Could not submit your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => { setResult(null); setAnswers({}); setSubmitError(null); };

  const optionStyle = (questionId: string, optionId: string) => {
    const selected = answers[questionId] === optionId;
    const base = { display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left" as const, padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--line)", background: "var(--paper)", cursor: result ? "default" : "pointer", fontFamily: "inherit", fontSize: 14, color: "var(--ink)" };
    if (!result) {
      return selected ? { ...base, borderColor: "var(--ink)", background: "var(--bg-2)", fontWeight: 600 } : base;
    }
    const r = resultById.get(questionId);
    const isCorrectOption = r?.correctOptionId === optionId;
    if (isCorrectOption) return { ...base, borderColor: "var(--green)", background: "var(--green-soft)", color: "var(--green-deep)", fontWeight: 700 };
    if (selected) return { ...base, borderColor: "var(--rose)", background: "var(--rose-soft)", color: "var(--rose)", fontWeight: 700 };
    return { ...base, opacity: 0.6 };
  };

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "28px 28px 80px" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)", marginBottom: 20, flexWrap: "wrap" }}>
        <Link href={`/courses/${course_id}`} style={{ color: "var(--ink-3)", fontWeight: 600 }}>Course</Link>
        <span>›</span>
        <Link href={`/courses/${course_id}/${chapter_id}/modules`} style={{ color: "var(--ink-3)", fontWeight: 600 }}>Chapter</Link>
        <span>›</span>
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>Quiz</span>
      </nav>

      {error ? (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--ink-3)" }}>
          <div style={{ color: error.status === 404 ? "var(--ink)" : "var(--rose)", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {error.status === 404 ? "Quiz not found" : error.status === 401 ? "Please sign in to take this quiz" : "Something went wrong"}
          </div>
          <p style={{ fontSize: 14, margin: "0 0 18px" }}>{error.message}</p>
          <Link href={`/courses/${course_id}/${chapter_id}/modules`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, background: "var(--green)", color: "white", fontWeight: 700, fontSize: 14 }}>
            Back to chapter <Icon.Arrow/>
          </Link>
        </div>
      ) : !quiz ? (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--ink-3)", fontSize: 14 }}>Loading quiz…</div>
      ) : (
        <>
          <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", background: "var(--ink)", color: "var(--paper)", padding: "32px 36px", boxShadow: "var(--shadow-lg)", marginBottom: 28 }}>
            <span className="serif" style={{ position: "absolute", right: -10, top: -50, fontSize: 240, lineHeight: 1, color: "var(--rose)", opacity: 0.14, fontWeight: 600, pointerEvents: "none" }}>?</span>
            <div style={{ position: "relative" }}>
              <span className="mono" style={{ padding: "4px 10px", background: "rgba(255,255,255,0.12)", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>QUIZ</span>
              <h1 style={{ margin: "14px 0 18px", fontSize: "clamp(24px,3vw,34px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{quiz.title}</h1>
              <div style={{ display: "flex", gap: 22, fontSize: 13, color: "rgba(255,253,247,0.7)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon.Target/> {quiz.questions.length} questions</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--amber)" }}><Icon.Bolt/> {totalPoints} points</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon.Check/> Pass: {quiz.passingScore}</span>
              </div>
            </div>
          </div>

          {result && (
            <div style={{ marginBottom: 24, padding: "22px 24px", borderRadius: 18, background: result.passed ? "var(--green-soft)" : "var(--rose-soft)", border: `1.5px solid ${result.passed ? "var(--green)" : "var(--rose)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: result.passed ? "var(--green)" : "var(--rose)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {result.passed ? <Icon.Trophy/> : <Icon.Target/>}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: result.passed ? "var(--green-deep)" : "var(--rose)" }}>
                    {result.passed ? "Passed!" : "Not quite — try again"}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 2 }}>
                    Scored <b>{result.score}</b> / {result.totalPoints} points · {result.correctCount} of {result.questionCount} correct · pass mark {result.passingScore}
                  </div>
                </div>
                <button onClick={retry} style={{ padding: "11px 18px", borderRadius: 12, border: "none", background: "var(--ink)", color: "var(--paper)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Try again <Icon.Arrow/>
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {quiz.questions.map((q, i) => {
              const r = resultById.get(q.questionId);
              return (
                <div key={q.questionId} style={{ padding: "18px 20px", borderRadius: 16, background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 26, height: 26, borderRadius: 999, background: "var(--bg-2)", color: "var(--ink-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 6, background: "var(--rose-soft)", color: "var(--rose)", fontSize: 11, fontWeight: 700 }}>{TYPE_LABEL[q.type] || q.type}</span>
                    {r && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: r.correct ? "var(--green-soft)" : "var(--rose-soft)", color: r.correct ? "var(--green-deep)" : "var(--rose)" }}>
                        {r.correct ? <><Icon.Check/> +{r.earnedPoints}</> : "Incorrect"}
                      </span>
                    )}
                    <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--amber-deep)", fontWeight: 700 }}>{q.points} pts</span>
                  </div>
                  <p style={{ margin: "0 0 14px", fontSize: 15, color: "var(--ink)", lineHeight: 1.5 }}>{q.prompt}</p>

                  {interactive && q.options ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {q.options.map((opt) => (
                        <button key={opt.id} type="button" onClick={() => select(q.questionId, opt.id)} disabled={!!result} style={optionStyle(q.questionId, opt.id)}>
                          <span style={{ width: 22, height: 22, borderRadius: 999, border: "1.5px solid currentColor", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: answers[q.questionId] === opt.id || (result && resultById.get(q.questionId)?.correctOptionId === opt.id) ? 1 : 0.4 }}>
                            {(answers[q.questionId] === opt.id || (result && resultById.get(q.questionId)?.correctOptionId === opt.id)) && <span style={{ width: 10, height: 10, borderRadius: 999, background: "currentColor" }}/>}
                          </span>
                          <span style={{ flex: 1 }}>{opt.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {interactive ? (
            <div style={{ marginTop: 20 }}>
              {submitError && (
                <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 12, background: "var(--rose-soft)", border: "1px solid var(--rose)", color: "var(--rose)", fontSize: 13, fontWeight: 600 }}>{submitError}</div>
              )}
              {!result && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <button onClick={submit} disabled={!allAnswered || submitting}
                          style={{ padding: "14px 24px", borderRadius: 13, border: "none", background: allAnswered ? "var(--green)" : "var(--bg-2)", color: allAnswered ? "white" : "var(--ink-3)", fontWeight: 700, fontSize: 15, cursor: allAnswered && !submitting ? "pointer" : "default", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: allAnswered ? "0 2px 0 var(--green-deep)" : "none" }}>
                    {submitting ? "Submitting…" : <>Submit answers <Icon.Arrow/></>}
                  </button>
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{answeredCount} / {quiz.questions.length} answered</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 14, background: "var(--amber-soft)", border: "1px solid var(--amber)", fontSize: 13, color: "var(--amber-deep)", lineHeight: 1.5 }}>
              Answer choices aren&rsquo;t available from the API yet — this is a read-only preview of the quiz.
            </div>
          )}

          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)" }}>
            <span>Mathify · Quiz</span>
            <Link href={`/courses/${course_id}/${chapter_id}/modules`} style={{ color: "var(--ink-3)" }}>Back to chapter</Link>
          </div>
        </>
      )}
    </main>
  );
}
