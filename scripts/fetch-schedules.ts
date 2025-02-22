import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORS_PROXY = "https://corsproxy.io/?";
const BASE_URL = "https://www.cs.ubbcluj.ro/files/orar/2024-2/tabelar";

// All possible timetable codes
const TIMETABLE_CODES = [
  // Mathematics
  "M1",
  "M2",
  "M3",
  // Informatics
  "I1",
  "I2",
  "I3",
  // Mathematics-Informatics
  "MI1",
  "MI2",
  "MI3",
  // Mathematics-Informatics English
  "MIE1",
  "MIE2",
  "MIE3",
  // Informatics English
  "IE1",
  "IE2",
  "IE3",
  // Mathematics-Informatics German
  "MIG1",
  "MIG2",
  "MIG3",
  // Mathematics-Informatics Hungarian
  "MIM1",
  "MIM2",
  // Informatics-Mathematics
  "IM1",
  "IM2",
  "IM3",
  // Informatics-Mathematics Hungarian
  "IIM1",
  "IIM2",
  // Computer Science
  "IG1",
  "IG2",
  "IG3",
  // Applied Informatics
  "IA1",
  "IA2",
  "IA3",
];

async function fetchSchedule(code: string) {
  try {
    const response = await fetch(
      CORS_PROXY + encodeURIComponent(`${BASE_URL}/${code}.html`)
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    return parseScheduleHtml(html);
  } catch (error) {
    console.error(`Failed to fetch schedule for ${code}:`, error);
    return null;
  }
}

function parseScheduleHtml(html: string) {
  const subjects = [];
  const rows = html.match(/<tr[^>]*>.*?<\/tr>/gs);

  if (!rows) return null;

  for (let i = 1; i < rows.length; i++) {
    // Skip header row
    const cells = rows[i].match(/<td[^>]*>(.*?)<\/td>/gs);
    if (cells && cells.length >= 8) {
      const subject = {
        day: cells[0].replace(/<[^>]+>/g, "").trim(),
        time: cells[1].replace(/<[^>]+>/g, "").trim(),
        frequency: cells[2].replace(/<[^>]+>/g, "").trim() || undefined,
        room: cells[3].replace(/<[^>]+>/g, "").trim(),
        group: cells[4].replace(/<[^>]+>/g, "").trim(),
        type: cells[5].replace(/<[^>]+>/g, "").trim(),
        name: cells[6].replace(/<[^>]+>/g, "").trim(),
        professor: cells[7].replace(/<[^>]+>/g, "").trim(),
      };

      if (subject.day && subject.time && subject.name) {
        subjects.push(subject);
      }
    }
  }

  return subjects;
}

async function main() {
  const schedules: Record<string, any> = {};

  // Fetch all schedules concurrently
  const results = await Promise.allSettled(
    TIMETABLE_CODES.map(async (code) => {
      const schedule = await fetchSchedule(code);
      if (schedule) {
        schedules[code] = schedule;
      }
    })
  );

  // Log results
  results.forEach((result, index) => {
    const code = TIMETABLE_CODES[index];
    if (result.status === "fulfilled") {
      console.log(`✅ Successfully fetched ${code}`);
    } else {
      console.error(`❌ Failed to fetch ${code}:`, result.reason);
    }
  });

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, "../src/lib/data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write schedules to file
  const outputPath = path.join(dataDir, "schedules.ts");
  const fileContent = `// Auto-generated at build time
export const schedules = ${JSON.stringify(schedules, null, 2)} as const;
`;

  fs.writeFileSync(outputPath, fileContent);
  console.log(`\nWrote schedules to ${outputPath}`);
}

main().catch(console.error);
