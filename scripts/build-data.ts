// Scrapes every timetable for the current semester into static files:
//   public/data/index.json        programs + semester
//   public/data/<CODE>.json       one timetable
//   public/cal/<CODE>/<group>[-1|-2].ics   subscribable calendars
// Only rewrites files whose content changed, so the daily CI run stays quiet.
import fs from "node:fs";
import path from "node:path";
import { fetchPrograms, fetchTimetable, forSemigroup, hasSemigroups, semesterOf, slug } from "../src/lib/timetable.js";
import { SEMESTERS, toICS } from "../src/lib/calendar.js";

const sem = process.argv[2] ?? semesterOf();
if (!SEMESTERS[sem]) {
  console.error(`No calendar for semester ${sem}. Add its dates to SEMESTERS in src/lib/calendar.ts.`);
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "../public");
const written = new Set<string>();
let changed = 0;

function write(rel: string, content: string) {
  const file = path.join(root, rel);
  written.add(file);
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  changed++;
}

// Fixed DTSTAMP so .ics files only change when the timetable does.
const stamp = new Date(SEMESTERS[sem].teaching[0][0] + "T00:00:00Z");

const programs = await fetchPrograms(sem);
const failed: string[] = [];

await Promise.all(
  programs.map(async (p) => {
    try {
      const t = await fetchTimetable(p.code, sem);
      write(`data/${p.code}.json`, JSON.stringify(t) + "\n");
      for (const [group, classes] of Object.entries(t.groups)) {
        const label = `${p.code} ${group}`;
        write(`cal/${p.code}/${slug(group)}.ics`, toICS(`UBB ${label}`, sem, classes, stamp));
        if (hasSemigroups(classes, group))
          for (const sg of [1, 2] as const)
            write(
              `cal/${p.code}/${slug(group)}-${sg}.ics`,
              toICS(`UBB ${label}/${sg}`, sem, forSemigroup(classes, group, sg), stamp),
            );
      }
    } catch (e) {
      failed.push(`${p.code}: ${(e as Error).message}`);
    }
  }),
);

write(
  "data/index.json",
  JSON.stringify({ sem, programs: programs.filter((p) => !failed.some((f) => f.startsWith(p.code + ":"))) }) + "\n",
);

// Drop files for groups/programs that no longer exist.
for (const dir of ["data", "cal"]) {
  const walk = (d: string): string[] =>
    fs.existsSync(d)
      ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
        )
      : [];
  for (const f of walk(path.join(root, dir)))
    if (!written.has(f) && !failed.some((x) => f.includes(`/${x.split(":")[0]}`))) {
      fs.rmSync(f);
      changed++;
    }
}

console.log(`${sem}: ${programs.length} programs, ${changed} files changed`);
if (failed.length) {
  console.error("failed:\n  " + failed.join("\n  "));
  if (failed.length === programs.length) process.exit(1);
}
