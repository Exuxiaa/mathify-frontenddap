"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/(shared)/icons";
import { COLOR_MAP } from "@/app/(shared)/primitives";
import { SectionHeader, CategorySearch, StudentFooter } from "@/app/(shared)/chrome";
import { notify } from "@/app/(shared)/toast";
import { api, type CourseSummary, ApiError } from "@/core/api";

// All Courses catalog. Data is the real GET /api/courses feed, joined with the
// student's enrollments (GET /api/students/me/enrollments, best-effort) so each
// card shows the right action. The Enroll button posts to the proposed
// POST /api/courses/{id}/enroll; until that endpoint ships it surfaces a toast.

const AllCourseCard = ({
  course, enrolled, enrolling, onEnroll,
}: {
  course: CourseSummary;
  enrolled: boolean;
  enrolling: boolean;
  onEnroll: (id: string) => void;
}) => {
  const c = COLOR_MAP[course.color] || COLOR_MAP.green;
  const detailHref = `/courses/${course.id}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <Link href={detailHref} style={{ textDecoration: "none", display: "block" }}>
        <div style={{ position: "relative", height: 120, background: c.bg, overflow: "hidden", borderBottom: "1px solid var(--line)" }}>
          <span className="serif" style={{ position: "absolute", left: 14, top: -24, fontSize: 160, color: c.deep, opacity: 0.2, fontWeight: 600, lineHeight: 1, pointerEvents: "none" }}>{course.glyph}</span>
          <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
            {enrolled ? (
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--green-soft)", color: "var(--green-deep)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon.Check/> ENROLLED</span>
            ) : course.status === "new" ? (
              <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--ink)", color: "var(--paper)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>NEW</span>
            ) : null}
          </div>
          <div style={{ position: "absolute", left: 14, bottom: 12 }}>
            <span className="mono" style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(255,253,247,0.7)", backdropFilter: "blur(4px)", fontSize: 11, fontWeight: 700, color: c.deep }}>
              {course.track.toUpperCase()}
            </span>
          </div>
        </div>
      </Link>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <Link href={detailHref} style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ margin: "0 0 5px", fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.25 }}>{course.title}</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.45 }}>{course.description}</p>
        </Link>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--ink-3)", marginTop: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon.Book/> {course.totalLessons} lessons</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon.Clock/> {course.estimatedHours}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--amber-deep)" }}><Icon.Bolt/> {course.xpReward} XP</span>
        </div>
        <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {enrolled ? (
            <Link href={detailHref} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px 16px", borderRadius: 12, background: "var(--green)", color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none", boxShadow: "0 2px 0 var(--green-deep)" }}>
              Continue <Icon.Arrow/>
            </Link>
          ) : (
            <button onClick={() => onEnroll(course.id)} disabled={enrolling}
               style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "11px 16px", borderRadius: 12, background: enrolling ? "var(--bg-2)" : "var(--ink)", color: enrolling ? "var(--ink-3)" : "var(--paper)", fontWeight: 700, fontSize: 13, border: "none", cursor: enrolling ? "default" : "pointer", fontFamily: "inherit" }}>
              {enrolling ? "Enrolling…" : <>Enroll <Icon.Plus/></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AllCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.listCourses()
      .then((data) => { if (alive) setCourses(data); })
      .catch((e: unknown) => { if (alive) setError(e instanceof ApiError ? e.message : "Could not load courses."); });
    // Enrollments are best-effort — the catalog is public, so a 401/empty just
    // means everything shows the Enroll action.
    api.listEnrollments()
      .then((enr) => { if (alive) setEnrolledIds(new Set(enr.map((e) => e.courseId))); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const onEnroll = (id: string) => {
    if (enrollingId) return;
    setEnrollingId(id);
    api.enroll(id)
      .then(() => {
        setEnrolledIds((prev) => new Set(prev).add(id));
        notify("Enrolled — find it in My Library");
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          notify("Please sign in to enroll");
          router.push("/login");
        } else {
          notify("Couldn't enroll right now — please try again");
        }
      })
      .finally(() => setEnrollingId(null));
  };

  const all = courses ?? [];
  const filtered = query.trim()
    ? all.filter((c) => c.track.toLowerCase().includes(query.toLowerCase()))
    : all;

  return (
    <main style={{ width: 1280, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-3)" }}>
          COURSE CATALOG{courses ? ` · ${all.length} COURSES` : ""}
        </span>
        <h1 style={{ margin: "4px 0 0", fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
          Every topic, <span className="serif" style={{ color: "var(--green-deep)" }}>your way</span>.
        </h1>
      </div>

      <div style={{ marginBottom: 48 }}>
        <SectionHeader
          eyebrow={`ALL COURSES${courses ? ` · ${all.length} AVAILABLE` : ""}`}
          title="All Courses"
          right={<CategorySearch value={query} onChange={setQuery}/>}
        />
        {error ? (
          <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--rose)", fontSize: 14 }}>{error}</div>
        ) : !courses ? (
          <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--ink-3)", fontSize: 14 }}>Loading courses…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--ink-3)", fontSize: 14 }}>
            {query.trim() ? <>No courses found for &ldquo;{query}&rdquo;.</> : "No courses available yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {filtered.map((c) => (
              <AllCourseCard key={c.id} course={c} enrolled={enrolledIds.has(c.id)} enrolling={enrollingId === c.id} onEnroll={onEnroll}/>
            ))}
          </div>
        )}
      </div>

      <StudentFooter label="All Courses" links={[
        { label: "My library",        href: "/courses" },
        { label: "Back to dashboard", href: "/dashboard" },
      ]}/>
    </main>
  );
}
