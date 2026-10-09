// Scrapes the faculty's "tabelar" timetable pages. Shared by the API and the UI.

export const ORAR = "https://www.cs.ubbcluj.ro/files/orar";

export const DAYS = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata"] as const;
export const DAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type Kind = "Curs" | "Seminar" | "Laborator";

export interface Class {
  day: number; // 0 = Monday
  start: number; // hour, 24h
  end: number;
  week: 0 | 1 | 2; // 0 = every week, 1/2 = odd/even teaching weeks
  room: string;
  formation: string; // "IE3", "931" or "931/1"
  kind: Kind;
  subject: string;
  teacher: string;
}

export interface Timetable {
  code: string;
  title: string;
  groups: Record<string, Class[]>;
}

export interface Program {
  code: string;
  name: string;
  year: number;
  level: "Licenta" | "Master";
}

// "2026-1" for Sep-Feb, "2026-2" for Feb-Sep (named after the year the academic year starts).
export function semesterOf(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 9) return `${y}-1`;
  if (m <= 1) return `${y - 1}-1`;
  if (m === 2 && date.getDate() < 15) return `${y - 1}-1`;
  return `${y - 1}-2`;
}

const decode = (buf: ArrayBuffer) => new TextDecoder("iso-8859-2").decode(buf);

const text = (cell: string) =>
  cell
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ")
    .trim();

async function get(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return decode(await res.arrayBuffer());
}

export function parseIndex(html: string): Program[] {
  const programs: Program[] = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/g) ?? []) {
    const level = /Master/i.test(table) ? "Master" : "Licenta";
    for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells) continue;
      const name = text(cells[0]);
      for (const cell of cells.slice(1)) {
        const m = cell.match(/href="([^"]+)\.html"[^>]*>([^<]*)/);
        if (!m) continue;
        const year = Number(m[2].match(/\d+/)?.[0] ?? 0);
        programs.push({ code: m[1], name, year, level });
      }
    }
  }
  return programs;
}

export function parseTimetable(code: string, html: string): Timetable {
  const title = text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? code);
  const groups: Record<string, Class[]> = {};
  // Each group is an <h1>Grupa X</h1> followed by its table.
  const parts = html.split(/<h1>\s*Grupa\s+/i).slice(1);
  for (const part of parts) {
    const group = text(part.slice(0, part.indexOf("<")));
    const classes: Class[] = [];
    for (const row of part.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const c = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(text);
      if (c.length < 8) continue;
      const day = DAYS.indexOf(c[0] as (typeof DAYS)[number]);
      const [start, end] = c[1].split("-").map(Number);
      if (day < 0 || !start || !end) continue;
      classes.push({
        day,
        start,
        end,
        week: c[2].includes("1") ? 1 : c[2].includes("2") ? 2 : 0,
        room: c[3],
        formation: c[4],
        kind: c[5] as Kind,
        subject: c[6],
        teacher: c[7],
      });
    }
    groups[group] = classes;
  }
  return { code, title, groups };
}

export async function fetchPrograms(sem = semesterOf()): Promise<Program[]> {
  return parseIndex(await get(`${ORAR}/${sem}/tabelar/index.html`));
}

export async function fetchTimetable(code: string, sem = semesterOf()): Promise<Timetable> {
  if (!/^[A-Za-z0-9]+$/.test(code)) throw new Error("bad code");
  return parseTimetable(code, await get(`${ORAR}/${sem}/tabelar/${code}.html`));
}

// Semigroup 1 of group 931 sees "931/1" rows but not "931/2". 0 = both.
// Some master groups are themselves named "243/1", so compare against the group.
export function hasSemigroups(classes: Class[], group: string): boolean {
  return classes.some((c) => c.formation.startsWith(group + "/"));
}

export function forSemigroup(classes: Class[], group: string, semigroup: 0 | 1 | 2): Class[] {
  if (!semigroup) return classes;
  return classes.filter((c) => !c.formation.startsWith(group + "/") || c.formation === `${group}/${semigroup}`);
}

// File-safe name for a group: "243/1" -> "243_1".
export const slug = (group: string) => group.replace(/[^A-Za-z0-9-]/g, "_");

// Short stable id for "this subject, this kind", used to hide things in URLs.
export function classKey(c: Pick<Class, "subject" | "kind">): string {
  let h = 2166136261;
  for (const ch of `${c.subject}|${c.kind}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36).slice(0, 6);
}
