// pnpm test: checks the calendar math and that every generated .ics expands to the right dates.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { occurrences, teachingWeeks, toICS, weekOf } from "../src/lib/calendar.js";
import { forSemigroup, hasSemigroups, parseTimetable, semesterOf, slug, type Class } from "../src/lib/timetable.js";

const sem = "2026-1";
const mk = (o: Partial<Class>): Class => ({
  day: 0, start: 8, end: 10, week: 0, room: "L1", formation: "931", kind: "Curs",
  subject: "Retele", teacher: "Prof. X", ...o,
});

// Semester shape: 12 + 2 teaching weeks, numbering continues after Christmas.
const weeks = teachingWeeks(sem);
assert.equal(weeks.length, 14);
assert.equal(weeks[0].monday.toISOString().slice(0, 10), "2026-09-28");
assert.equal(weeks[12].monday.toISOString().slice(0, 10), "2027-01-04");
assert.equal(weeks[12].week, 13);

assert.equal(weekOf(sem, new Date("2026-10-09T12:00:00")), 2);
assert.equal(weekOf(sem, new Date("2026-12-25T12:00:00")), null);

assert.equal(semesterOf(new Date("2026-10-09")), "2026-1");
assert.equal(semesterOf(new Date("2027-01-20")), "2026-1");
assert.equal(semesterOf(new Date("2027-03-01")), "2026-2");

// Weekly Monday class: 14 Mondays, none in the break.
const mon = occurrences(mk({}), sem).map((o) => o.date);
assert.equal(mon.length, 14);
assert.ok(!mon.some((d) => d >= "2026-12-21" && d <= "2027-01-03"));

// Tuesday 1 Dec is a holiday.
const tue = occurrences(mk({ day: 1 }), sem).map((o) => o.date);
assert.ok(!tue.includes("2026-12-01"));
assert.equal(tue.length, 13);

// Odd weeks: 1,3,...,13. Week 13 is 4 Jan, after the break.
const odd = occurrences(mk({ week: 1 }), sem);
assert.deepEqual(odd.map((o) => o.week), [1, 3, 5, 7, 9, 11, 13]);
assert.equal(odd.at(-1)!.date, "2027-01-04");
const even = occurrences(mk({ week: 2 }), sem);
assert.deepEqual(even.map((o) => o.week), [2, 4, 6, 8, 10, 12, 14]);

// Wednesday 6 and Thursday 7 Jan are off.
assert.ok(!occurrences(mk({ day: 2 }), sem).some((o) => o.date === "2027-01-06"));
assert.ok(!occurrences(mk({ day: 3 }), sem).some((o) => o.date === "2027-01-07"));

// Saturday classes work.
assert.equal(occurrences(mk({ day: 5 }), sem)[0].date, "2026-10-03");

// Semigroups.
const g = [mk({ formation: "931" }), mk({ formation: "931/1" }), mk({ formation: "931/2" }), mk({ formation: "IE3" })];
assert.deepEqual(forSemigroup(g, "931", 1).map((c) => c.formation), ["931", "931/1", "IE3"]);
assert.deepEqual(forSemigroup(g, "931", 2).map((c) => c.formation), ["931", "931/2", "IE3"]);
assert.equal(forSemigroup(g, "931", 0).length, 4);
assert.ok(hasSemigroups(g, "931"));
// Master groups can be named "243/1" themselves: no further split.
const m = [mk({ formation: "243/1" }), mk({ formation: "MaBD1" })];
assert.ok(!hasSemigroups(m, "243/1"));
assert.equal(slug("243/1"), "243_1");

// Parser: diacritics already decoded, semigroup rows, entities.
const html = `<title>Anul 3</title><h1>Grupa 931</h1><table><tr><th>x</th></tr>
<tr><td>Sambata</td><td class="bloc">8-11</td><td>sapt. 2</td><td><a>L1</a></td><td>931/2</td><td>Seminar</td><td><a>Programare &icirc;n C</a></td><td>Lect. Ș</td></tr></table>`;
const t = parseTimetable("X", html);
assert.deepEqual(t.groups["931"][0], {
  day: 5, start: 8, end: 11, week: 2, room: "L1", formation: "931/2", kind: "Seminar",
  subject: "Programare &icirc;n C", teacher: "Lect. Ș",
});

// .ics: expand RRULE/EXDATE/RDATE ourselves and compare with occurrences().
function expand(ics: string): Map<string, string[]> {
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `long line: ${line}`);
  const unfolded = ics.replace(/\r\n /g, "");
  const out = new Map<string, string[]>();
  for (const ev of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const get = (k: string) => ev.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "m"))?.[1]?.trim() ?? "";
    const ymd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const start = ymd(get("DTSTART"));
    const interval = Number(get("RRULE").match(/INTERVAL=(\d+)/)![1]);
    const until = ymd(get("RRULE").match(/UNTIL=(\d{8})/)![1]);
    const ex = new Set(get("EXDATE").split(",").filter(Boolean).map(ymd));
    const dates: string[] = [];
    for (let t = Date.parse(start); new Date(t).toISOString().slice(0, 10) <= until; t += interval * 7 * 86_400_000) {
      const d = new Date(t).toISOString().slice(0, 10);
      if (!ex.has(d)) dates.push(d);
    }
    dates.push(...get("RDATE").split(",").filter(Boolean).map(ymd));
    out.set(get("UID"), dates.sort());
  }
  return out;
}

const classes = [mk({}), mk({ day: 1, week: 1 }), mk({ day: 3, week: 2, subject: "Șăîâț, with; commas" })];
const ics = toICS("test", sem, classes);
assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
const expanded = [...expand(ics).values()];
classes.forEach((c, i) => assert.deepEqual(expanded[i], occurrences(c, sem).map((o) => o.date)));
assert.ok(ics.includes("Șăîâț\\, with\\; commas"));

// Every generated file in public/cal must expand to exactly its timetable's dates.
const pub = path.resolve(import.meta.dirname, "../public");
let files = 0;
if (fs.existsSync(path.join(pub, "data/index.json"))) {
  const { sem: s, programs } = JSON.parse(fs.readFileSync(path.join(pub, "data/index.json"), "utf8"));
  for (const p of programs) {
    const tt = JSON.parse(fs.readFileSync(path.join(pub, `data/${p.code}.json`), "utf8"));
    for (const [group, cls] of Object.entries<Class[]>(tt.groups)) {
      const ics = fs.readFileSync(path.join(pub, `cal/${p.code}/${slug(group)}.ics`), "utf8");
      const got = [...expand(ics).values()];
      const want = cls.map((c) => occurrences(c, s).map((o) => o.date)).filter((d) => d.length);
      assert.deepEqual(got, want, `${p.code}/${group}`);
      files++;
    }
  }
}

console.log(`ok (${files} generated calendars checked)`);
