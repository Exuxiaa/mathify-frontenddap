"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, Logo } from "@/app/(shared)/icons";
import { StatCardShell, StatLabel } from "@/app/(shared)/primitives";
import { useStudent } from "@/app/(shared)/student";
import { timeAgo } from "@/app/(shared)/format";
import { api, type Dashboard, type ContinueLearning, type UpNextStep, type DashboardQuest, type DashboardAchievement } from "@/core/api";

// Today page. Wired to the aggregate GET /api/me/dashboard feed (proposed
// endpoint — see API_DOCUMENTATION.md). Until the backend ships it the page
// falls back to FALLBACK_DASHBOARD so it still renders fully; the fetch simply
// swaps in real numbers when the endpoint answers. Name/level still come from
// the shared student context (GET /api/me).

const FALLBACK_DASHBOARD: Dashboard = {
  goal: { targetXp: 50, earnedXp: 36 },
  continueLearning: {
    courseId: "", courseTitle: "Calculus", track: "Calculus", level: 8,
    chapterId: "", chapterTitle: "Derivatives",
    lessonId: "", lessonTitle: "The chain rule, intuitively",
    lessonDescription: "Functions inside functions — a nested gear system. Six minutes of reading, then four practice problems.",
    stepIndex: 3, stepCount: 7, progressPercent: 43, xpReward: 24, estimatedMinutes: 6, pausedAt: null,
  },
  upNext: [
    { id: "1", type: "PRACTICE", title: "Practice: chain rule drills", meta: "8 problems · 12 XP", xp: 12 },
    { id: "2", type: "VIDEO", title: "Video: visualising d/dx of sin(x²)", meta: "3:48 · 10 XP", xp: 10 },
    { id: "3", type: "QUIZ", title: "Quick check: 5-question quiz", meta: "5 min · 16 XP", xp: 16 },
  ],
  streak: { current: 12, history: [3, 4, 3, 5, 6, 5, 7, 6, 8, 7, 9, 8, 9, 10] },
  weeklyXp: { days: [180, 240, 220, 320, 300, 460, 520], total: 2480, deltaPercent: 12 },
  hearts: { current: 5, max: 5 },
  quests: [
    { id: "q1", scope: "DAILY", color: "green", title: "Finish today's plan", description: "Complete the 3 remaining steps", progress: 4, total: 7, reward: "20 XP" },
    { id: "q2", scope: "DAILY", color: "amber", title: "Earn 50 XP today", description: "Any combination of lessons + practice", progress: 36, total: 50, reward: "+1 gem" },
    { id: "q3", scope: "WEEKLY", color: "blue", title: "Practice for 5 days", description: "3 of 5 done · ends Sunday", progress: 3, total: 5, reward: "Streak Freeze" },
    { id: "q4", scope: "WEEKLY", color: "plum", title: "Master one new node", description: "Algebra in progress", progress: 7, total: 12, reward: "Achievement" },
  ],
  achievements: {
    earnedCount: 12,
    recent: [
      { id: "a1", name: "Algebra Apprentice", description: "Finished Basic Algebra", earnedAt: "2 days ago", color: "green" },
      { id: "a2", name: "30-Day Climber", description: "30 day streak reached", earnedAt: "17 days ago", color: "amber" },
      { id: "a3", name: "Sharp Eye", description: "20 quick checks in a row", earnedAt: "last week", color: "blue" },
      { id: "a4", name: "Theorem Hunter", description: "50 lessons completed", earnedAt: "3 wks ago", color: "plum" },
    ],
    upcoming: [
      { id: "u1", name: "Calculus Cadet", requirement: "Finish Derivatives" },
      { id: "u2", name: "100-Day Climber", requirement: "53 more days" },
    ],
  },
};

const PALETTE = {
  green: { bg: "var(--green-soft)", fg: "var(--green-deep)", bar: "var(--green)" },
  blue: { bg: "var(--blue-soft)", fg: "var(--blue-deep)", bar: "var(--blue)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber-deep)", bar: "var(--amber)" },
  plum: { bg: "var(--plum-soft)", fg: "var(--plum)", bar: "var(--plum)" },
} as const;
type PaletteKey = keyof typeof PALETTE;
const CYCLE: PaletteKey[] = ["green", "amber", "blue", "plum"];
const palette = (color: string | undefined, i: number) =>
  (color && color in PALETTE ? PALETTE[color as PaletteKey] : PALETTE[CYCLE[i % CYCLE.length]]);

const STEP_ICON: Record<string, ReactNode> = {
  PRACTICE: <Icon.Target/>, VIDEO: <Icon.Play/>, QUIZ: <Icon.Sparkle/>, LESSON: <Icon.Book/>,
};
const STEP_COLOR: PaletteKey[] = ["amber", "blue", "plum"];
const ACHIEVEMENT_ICONS = [<Icon.Trophy key="t"/>, <Icon.Flame key="f"/>, <Icon.Target key="g"/>, <Icon.Star key="s"/>];
const earnedLabel = (s: string) => (/\d{4}-\d{2}-\d{2}/.test(s) ? timeAgo(s) : s);

const Greeting = ({ goalPct, lessonTitle }: { goalPct: number; lessonTitle: string }) => {
  const student = useStudent();
  return (
    <section style={{ position: "relative", padding: "36px 0 8px" }}>
      <span className="serif" style={{ position: "absolute", top: 24, right: "8%", fontSize: 64, color: "var(--amber)", opacity: 0.18, fontWeight: 600, pointerEvents: "none" }}>∑</span>
      <span className="serif" style={{ position: "absolute", bottom: 0, right: "24%", fontSize: 44, color: "var(--blue)", opacity: 0.16, fontWeight: 600, pointerEvents: "none" }}>π</span>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 640 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 10 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()} · DAY {student.streak || 1}
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
            Welcome back, {student.name || "there"}.{" "}
            <span className="serif" style={{ color: "var(--green-deep)", fontWeight: 500 }}>{lessonTitle}</span>{" "}
            is waiting.
          </h1>
          <p style={{ margin: "14px 0 0", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 540 }}>
            You&rsquo;re <b style={{ color: "var(--ink)" }}>{goalPct}%</b> through today&rsquo;s goal
            {student.streak > 0 && <span> and on a <b style={{ color: "var(--ink)" }}>{student.streak}-day</b> streak</span>}.
            Three quick lessons and you&rsquo;re done.
          </p>
        </div>
      </div>
    </section>
  );
};

const UpNextRow = ({ step, i }: { step: UpNextStep; i: number }) => {
  const c = PALETTE[STEP_COLOR[i % STEP_COLOR.length]];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)", cursor: "pointer" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{STEP_ICON[step.type] ?? <Icon.Book/>}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 700 }}>{String(i + 4).padStart(2, "0")}</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.title}</div>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{step.meta}</div>
      </div>
      <Icon.Arrow style={{ color: "var(--ink-3)" }}/>
    </div>
  );
};

const ContinueCard = ({ cont, upNext }: { cont: ContinueLearning | null; upNext: UpNextStep[] }) => {
  const student = useStudent();
  const paused = cont?.pausedAt ? timeAgo(cont.pausedAt) : null;
  const resumeHref = cont && cont.courseId
    ? `/courses/${cont.courseId}${cont.chapterId ? `/${cont.chapterId}/modules` : ""}`
    : "/courses";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-[18px] mt-[28px]">
      <div style={{ position: "relative", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 24, padding: 28, boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
        <span className="serif" style={{ position: "absolute", top: -30, right: -10, fontSize: 220, color: "var(--green)", opacity: 0.07, fontWeight: 600, pointerEvents: "none", lineHeight: 1 }}>ƒ′</span>
        {cont ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, position: "relative" }}>
              <span style={{ padding: "5px 10px", borderRadius: 999, background: "var(--blue-soft)", color: "var(--blue-deep)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>PICK UP WHERE YOU LEFT OFF</span>
              {paused && <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>· paused {paused}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", marginBottom: 10, position: "relative", flexWrap: "wrap" }}>
              <span>Level {cont.level || student.level || 1} · {cont.track}</span><span>›</span><span>{cont.chapterTitle}</span><span>›</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>Lesson {String(cont.stepIndex).padStart(2, "0")}</span>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, position: "relative" }}>{cont.lessonTitle}</h2>
            <p style={{ margin: 0, fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 520, position: "relative" }}>{cont.lessonDescription}</p>
            <div style={{ display: "flex", gap: 18, marginTop: 18, fontSize: 13, color: "var(--ink-3)", position: "relative" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon.Clock/> {cont.estimatedMinutes} min read</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--amber-deep)" }}><Icon.Bolt/> +{cont.xpReward} XP</span>
            </div>
            <div style={{ marginTop: 22, padding: "18px 20px", borderRadius: 16, background: "var(--bg)", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 6 }}>
                  <span>STEP {cont.stepIndex} OF {cont.stepCount}</span><span>{cont.progressPercent}% done</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: cont.stepCount }).map((_, n) => (
                    <div key={n} style={{ flex: 1, height: 8, borderRadius: 999, background: n < cont.stepIndex - 1 ? "var(--green)" : n === cont.stepIndex - 1 ? "var(--blue)" : "var(--line)" }}/>
                  ))}
                </div>
              </div>
              <Link href={resumeHref} style={{ padding: "14px 22px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 2px 0 var(--green-deep), 0 8px 18px -6px rgba(31,138,91,0.5)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Continue <Icon.Arrow/>
              </Link>
            </div>
          </>
        ) : (
          <div style={{ position: "relative", padding: "8px 0" }}>
            <span style={{ padding: "5px 10px", borderRadius: 999, background: "var(--green-soft)", color: "var(--green-deep)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>READY WHEN YOU ARE</span>
            <h2 style={{ margin: "14px 0 8px", fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>Start your first lesson</h2>
            <p style={{ margin: "0 0 18px", fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: 520 }}>You have nothing in progress yet. Browse the catalog and enroll in a course to begin.</p>
            <Link href="/all-courses" style={{ padding: "13px 22px", borderRadius: 12, background: "var(--green)", color: "white", fontWeight: 700, fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 2px 0 var(--green-deep)" }}>
              Browse courses <Icon.Arrow/>
            </Link>
          </div>
        )}
      </div>
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 24, padding: 24, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Up next today</h3>
          <Link href="/plans" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>See plan ↗</Link>
        </div>
        <div style={{ display: "grid", gap: 10, flex: 1 }}>
          {upNext.length > 0 ? upNext.map((s, i) => <UpNextRow key={s.id} step={s} i={i}/>)
            : <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "12px 0" }}>Nothing queued — you&rsquo;re all caught up.</div>}
        </div>
        <button style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px dashed var(--line)", background: "transparent", color: "var(--ink-2)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon.Plus/> Add a topic to today&rsquo;s plan
        </button>
      </div>
    </div>
  );
};

const StreakCard = ({ streak }: { streak: Dashboard["streak"] }) => {
  const max = Math.max(1, ...streak.history);
  return (
    <StatCardShell>
      <StatLabel icon={<Icon.Flame/>} color="var(--amber-soft)" deep="var(--amber-deep)" label="STREAK"/>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{streak.current}</span>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>days</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, marginTop: 14 }}>
        {streak.history.map((v, i) => {
          const intensity = v / max;
          const today = i === streak.history.length - 1;
          return <div key={i} style={{ flex: 1, height: 14 + intensity * 30, borderRadius: 4, background: today ? "var(--amber)" : `oklch(${0.95 - intensity * 0.32} 0.10 65)`, border: today ? "2px solid var(--amber-deep)" : "none" }}/>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>
        <span>{streak.history.length >= 14 ? "2 weeks" : `${streak.history.length} days`}</span><span style={{ fontWeight: 600, color: "var(--amber-deep)" }}>1 freeze available</span>
      </div>
    </StatCardShell>
  );
};

const sparkPath = (days: number[], w = 168, h = 50, pad = 4) => {
  if (days.length === 0) return { line: "", area: "", last: { x: w, y: h } };
  const max = Math.max(1, ...days);
  const n = days.length;
  const pts = days.map((v, i) => ({
    x: n === 1 ? w : (i / (n - 1)) * w,
    y: h - pad - (v / max) * (h - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area, last: pts[pts.length - 1] };
};

const XPCard = ({ weekly }: { weekly: Dashboard["weeklyXp"] }) => {
  const { line, area, last } = useMemo(() => sparkPath(weekly.days), [weekly.days]);
  return (
    <StatCardShell>
      <StatLabel icon={<Icon.Bolt/>} color="var(--green-soft)" deep="var(--green-deep)" label="WEEKLY XP"/>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{weekly.total > 0 ? weekly.total.toLocaleString() : "0"}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: weekly.deltaPercent >= 0 ? "var(--green-deep)" : "var(--rose)" }}>{weekly.deltaPercent >= 0 ? "+" : ""}{weekly.deltaPercent}%</span>
      </div>
      <svg viewBox="0 0 168 50" style={{ width: "100%", height: 50, marginTop: 14 }}>
        <path d={line} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={area} fill="var(--green)" opacity="0.12"/>
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--green)"/>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
        <span>Mon</span><span>Sun</span>
      </div>
    </StatCardShell>
  );
};

const HeartsCard = ({ hearts }: { hearts: Dashboard["hearts"] }) => (
  <StatCardShell>
    <StatLabel icon={<Icon.Heart/>} color="var(--rose-soft)" deep="var(--rose)" label="HEARTS"/>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{hearts.current}</span>
      <span style={{ fontSize: 13, color: "var(--ink-3)" }}>/ {hearts.max} full</span>
    </div>
    <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
      {Array.from({ length: hearts.max }).map((_, i) => (
        <div key={i} style={{ width: 36, height: 36, borderRadius: 10, background: i < hearts.current ? "var(--rose-soft)" : "var(--bg-2)", color: i < hearts.current ? "var(--rose)" : "var(--ink-3)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon.Heart/></div>
      ))}
    </div>
    <p style={{ margin: "auto 0 0", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>Wrong answers cost a heart. Refill by practicing easier topics, or wait 30 min.</p>
  </StatCardShell>
);

const GoalCard = ({ goal }: { goal: Dashboard["goal"] }) => {
  const pct = goal.targetXp > 0 ? Math.min(100, Math.round((goal.earnedXp / goal.targetXp) * 100)) : 0;
  const r = 36, circ = 2 * Math.PI * r, offset = circ * (1 - pct / 100);
  const remaining = Math.max(0, goal.targetXp - goal.earnedXp);
  return (
    <StatCardShell>
      <StatLabel icon={<Icon.Target/>} color="var(--blue-soft)" deep="var(--blue-deep)" label="DAILY GOAL"/>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
        <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="10"/>
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--blue)" strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 48 48)"/>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{goal.earnedXp}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>/ {goal.targetXp} XP</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{remaining > 0 ? `${remaining} XP to go` : "Goal complete!"}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>{remaining > 0 ? "One short lesson or a quick practice round will finish today." : "Nicely done — come back tomorrow to keep the streak alive."}</div>
        </div>
      </div>
    </StatCardShell>
  );
};

const QuestRow = ({ quest, i }: { quest: DashboardQuest; i: number }) => {
  const c = palette(quest.color, i);
  const pct = quest.total > 0 ? Math.round((quest.progress / quest.total) * 100) : 0;
  return (
    <div style={{ padding: 16, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: c.bg, color: c.fg, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>{quest.scope}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>{quest.progress} / {quest.total}</span>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{quest.title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{quest.description}</div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c.bar }}/>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
        <Icon.Sparkle style={{ color: c.fg }}/><span>Reward: <b>{quest.reward}</b></span>
      </div>
    </div>
  );
};

const QuestsPanel = ({ quests }: { quests: DashboardQuest[] }) => (
  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 24, padding: 24, boxShadow: "var(--shadow-sm)" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em" }}>Quests</h3>
          <span style={{ padding: "3px 8px", borderRadius: 999, background: "var(--bg-2)", color: "var(--ink-2)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>{quests.length} ACTIVE</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Small targets that compound. Resets at midnight, weekly on Monday.</p>
      </div>
      <a href="#" style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-deep)" }}>All quests ↗</a>
    </div>
    {quests.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
        {quests.map((q, i) => <QuestRow key={q.id} quest={q} i={i}/>)}
      </div>
    ) : (
      <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "8px 0" }}>No active quests right now.</div>
    )}
  </div>
);

const AchievementBadge = ({ ach, i }: { ach: DashboardAchievement; i: number }) => {
  const c = palette(ach.color, i);
  return (
    <div style={{ padding: 14, borderRadius: 14, background: "var(--bg)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {ach.glyph ? <span className="serif" style={{ fontSize: 20, fontWeight: 600 }}>{ach.glyph}</span> : ACHIEVEMENT_ICONS[i % ACHIEVEMENT_ICONS.length]}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em" }}>{ach.name}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{ach.description}</div>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{earnedLabel(ach.earnedAt)}</div>
    </div>
  );
};

const AchievementsCard = ({ achievements }: { achievements: Dashboard["achievements"] }) => (
  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 24, padding: 24, boxShadow: "var(--shadow-sm)" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.015em" }}>Achievements</h3>
          <span style={{ padding: "3px 8px", borderRadius: 999, background: "var(--amber-soft)", color: "var(--amber-deep)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>{achievements.earnedCount} EARNED</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Badges for milestones, not for showing up.</p>
      </div>
      <a href="#" style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-deep)" }}>Trophy case ↗</a>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px] mb-[14px]">
      {achievements.recent.map((a, i) => <AchievementBadge key={a.id} ach={a} i={i}/>)}
    </div>
    {achievements.upcoming.length > 0 && (
      <div style={{ padding: 14, borderRadius: 14, background: "var(--bg)", border: "1px dashed var(--line)" }}>
        <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.06em", marginBottom: 8 }}>NEXT UP</div>
        <div style={{ display: "flex", gap: 16 }}>
          {achievements.upcoming.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-2)", color: "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Lock/></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{l.requirement}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard>(FALLBACK_DASHBOARD);

  useEffect(() => {
    let alive = true;
    api.getDashboard()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { /* endpoint not live yet / no session — keep the fallback view */ });
    return () => { alive = false; };
  }, []);

  const goalPct = data.goal.targetXp > 0 ? Math.min(100, Math.round((data.goal.earnedXp / data.goal.targetXp) * 100)) : 0;
  const lessonTitle = data.continueLearning?.lessonTitle ?? "Your next lesson";

  return (
    <main className="px-4 sm:px-6 lg:px-7 pb-20" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <Greeting goalPct={goalPct} lessonTitle={lessonTitle}/>
      <ContinueCard cont={data.continueLearning} upNext={data.upNext}/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mt-[18px]">
        <StreakCard streak={data.streak}/>
        <XPCard weekly={data.weeklyXp}/>
        <HeartsCard hearts={data.hearts}/>
        <GoalCard goal={data.goal}/>
      </div>
      <div className="mt-[18px]">
        <QuestsPanel quests={data.quests}/>
      </div>
      <div className="mt-[18px]">
        <AchievementsCard achievements={data.achievements}/>
      </div>
      <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Logo/><span>Mathify · v2.4</span></div>
        <div style={{ display: "flex", gap: 18 }}>
          <a href="#" style={{ color: "var(--ink-3)" }}>Help</a>
          <a href="#" style={{ color: "var(--ink-3)" }}>Settings</a>
          <a href="#" style={{ color: "var(--ink-3)" }}>What&rsquo;s new</a>
        </div>
      </div>
    </main>
  );
}
