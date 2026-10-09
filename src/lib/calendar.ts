// Turns weekly classes into dated events and .ics files.
import { classKey, DAY_EN, type Class } from "./timetable.js";

interface Semester {
  // Teaching periods, inclusive, each starting on a Monday. Teaching weeks are
  // numbered across periods, so week parity carries over the holiday break.
  teaching: [string, string][];
  daysOff: string[];
}

// Source: cs.ubbcluj.ro/invatamant/structura-anului-universitar/
export const SEMESTERS: Record<string, Semester> = {
  "2026-1": {
    teaching: [
      ["2026-09-28", "2026-12-20"],
      ["2027-01-04", "2027-01-17"],
    ],
    daysOff: ["2026-12-01", "2027-01-06", "2027-01-07"],
  },
};

const DAY = 86_400_000;
const parse = (s: string) => new Date(s + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface Occurrence {
  date: string; // YYYY-MM-DD, Bucharest local
  week: number; // teaching week number, 1-based
}

export function teachingWeeks(sem: string): { monday: Date; week: number }[] {
  const s = SEMESTERS[sem];
  if (!s) return [];
  const weeks = [];
  let n = 0;
  for (const [from, to] of s.teaching)
    for (let t = parse(from).getTime(); t <= parse(to).getTime(); t += 7 * DAY)
      weeks.push({ monday: new Date(t), week: ++n });
  return weeks;
}

// Teaching week containing `date`, or null during breaks.
export function weekOf(sem: string, date = new Date()): number | null {
  const day = parse(iso(new Date(date.getTime() - date.getTimezoneOffset() * 60_000))).getTime();
  for (const w of teachingWeeks(sem))
    if (day >= w.monday.getTime() && day < w.monday.getTime() + 7 * DAY) return w.week;
  return null;
}

export function occurrences(c: Class, sem: string): Occurrence[] {
  const off = new Set(SEMESTERS[sem]?.daysOff ?? []);
  return teachingWeeks(sem)
    .filter((w) => !c.week || w.week % 2 === c.week % 2)
    .map((w) => ({ date: iso(new Date(w.monday.getTime() + c.day * DAY)), week: w.week }))
    .filter((o) => !off.has(o.date));
}

// --- .ics -----------------------------------------------------------------

const esc = (s: string) => s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");

// RFC 5545: lines longer than 75 octets continue on the next line after a space.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const TZ = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Bucharest",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0300",
  "TZNAME:EEST",
  "DTSTART:19700329T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0200",
  "TZNAME:EET",
  "DTSTART:19701025T040000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const KIND_EN = { Curs: "Lecture", Seminar: "Seminar", Laborator: "Lab" } as const;

export function toICS(name: string, sem: string, classes: Class[], stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const hh = (h: number) => String(h).padStart(2, "0") + "0000";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ubb-schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:Europe/Bucharest",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...TZ,
  ];
  for (const c of classes) {
    // One recurring event per class: a weekly (or bi-weekly) rule from the first
    // to the last occurrence, minus breaks and days off, plus any date the rule misses.
    const dates = occurrences(c, sem).map((o) => o.date);
    if (!dates.length) continue;
    const step = (c.week ? 14 : 7) * DAY;
    const ruled: string[] = [];
    for (let t = parse(dates[0]).getTime(); t <= parse(dates.at(-1)!).getTime(); t += step) ruled.push(iso(new Date(t)));
    const want = new Set(dates);
    const have = new Set(ruled);
    const at = (d: string) => `${d.replace(/-/g, "")}T${hh(c.start)}`;
    const exdates = ruled.filter((d) => !want.has(d)).map(at);
    const rdates = dates.filter((d) => !have.has(d)).map(at);
    const until = `${dates.at(-1)!.replace(/-/g, "")}T235959Z`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.day}-${c.start}-${classKey(c)}-${c.formation.replace("/", "_")}-${sem}@ubb-schedule`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Bucharest:${at(dates[0])}`,
      `DTEND;TZID=Europe/Bucharest:${dates[0].replace(/-/g, "")}T${hh(c.end)}`,
      `RRULE:FREQ=WEEKLY;INTERVAL=${c.week ? 2 : 1};UNTIL=${until}`,
      ...(exdates.length ? [`EXDATE;TZID=Europe/Bucharest:${exdates.join(",")}`] : []),
      ...(rdates.length ? [`RDATE;TZID=Europe/Bucharest:${rdates.join(",")}`] : []),
      `SUMMARY:${esc(`${c.subject} (${KIND_EN[c.kind] ?? c.kind})`)}`,
      `LOCATION:${esc(c.room)}`,
      `DESCRIPTION:${esc(`${c.teacher}\n${c.formation}${c.week ? `\nweek ${c.week === 1 ? "1, 3, 5..." : "2, 4, 6..."}` : ""}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export const dayName = (d: number) => DAY_EN[d];
