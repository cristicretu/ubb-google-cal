import type { Subject, Group } from "../types";
import { schedules } from "../data/schedules";

// List of CORS proxies to try in order
const CORS_PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://thingproxy.freeboard.io/fetch/",
];

const BASE_URL = "https://www.cs.ubbcluj.ro/files/orar/2025-1/tabelar";

// Cache for responses
const cache = new Map<string, any>();

async function fetchWithCorsProxy(url: string): Promise<Response> {
  let lastError;

  // Try each proxy in order
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url));
      if (response.ok) {
        return response;
      }
      lastError = `HTTP error! status: ${response.status}`;
    } catch (error) {
      lastError = error;
      continue; // Try next proxy
    }
  }

  throw new Error(`All CORS proxies failed. Last error: ${lastError}`);
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  delay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithCorsProxy(url);
      if (response.ok) {
        return response;
      }
      if (response.status === 429) {
        // Wait longer if we're being rate limited
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
}

export async function fetchSchedule(timetableCode: string): Promise<Subject[]> {
  if (!timetableCode || typeof timetableCode !== "string") {
    throw new Error("Invalid timetable code");
  }

  const cacheKey = `schedule-${timetableCode}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const response = await fetchWithRetry(`${BASE_URL}/${timetableCode}.html`);
    const html = await response.text();
    const subjects = parseScheduleHtml(html);
    cache.set(cacheKey, subjects);
    return subjects;
  } catch (error) {
    console.error("Error fetching schedule:", error);

    // Use pre-fetched data as fallback
    if (schedules[timetableCode]) {
      console.log(`Using pre-fetched data for ${timetableCode}`);
      return schedules[timetableCode];
    }

    return [];
  }
}

export async function fetchGroups(timetableCode: string): Promise<Group[]> {
  if (!timetableCode || typeof timetableCode !== "string") {
    throw new Error("Invalid timetable code");
  }

  const cacheKey = `groups-${timetableCode}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const response = await fetchWithRetry(`${BASE_URL}/${timetableCode}.html`);
    const html = await response.text();
    const groups = parseGroupsFromHtml(html, timetableCode);
    cache.set(cacheKey, groups);
    return groups;
  } catch (error) {
    console.error(`Error fetching groups for ${timetableCode}:`, error);

    // Use pre-fetched data as fallback
    if (schedules[timetableCode]) {
      console.log(`Using pre-fetched data for ${timetableCode}`);
      const groupSet = new Set<string>();

      // Extract groups from pre-fetched schedule
      schedules[timetableCode].forEach((subject: Subject) => {
        if (subject.group && subject.group !== timetableCode) {
          const baseGroup = subject.group.split("/")[0];
          if (baseGroup && baseGroup.length > 0) {
            groupSet.add(baseGroup);
          }
        }
      });

      return Array.from(groupSet)
        .sort()
        .map((id) => ({
          id,
          name: `Grupa ${id}`,
          year: timetableCode,
        }));
    }

    return [];
  }
}

function parseScheduleHtml(html: string): Subject[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  const subjects: Subject[] = [];

  rows.forEach((row, index) => {
    if (index === 0) return; // Skip header row

    const cells = row.querySelectorAll("td");
    if (cells.length >= 7) {
      const subject: Subject = {
        day: cells[0].textContent?.trim() || "",
        time: cells[1].textContent?.trim() || "",
        frequency: cells[2].textContent?.trim() || undefined,
        room: cells[3].textContent?.trim() || "",
        group: cells[4].textContent?.trim() || "",
        type: cells[5].textContent?.trim() || "",
        name: cells[6].textContent?.trim() || "",
        professor: cells[7].textContent?.trim() || "",
      };

      if (subject.day && subject.time && subject.name) {
        subjects.push(subject);
      }
    }
  });

  return subjects;
}

function parseGroupsFromHtml(html: string, timetableCode: string): Group[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  const groupSet = new Set<string>();

  rows.forEach((row, index) => {
    if (index === 0) return; // Skip header row

    const cells = row.querySelectorAll("td");
    if (cells.length >= 5) {
      const groupCell = cells[4].textContent?.trim() || "";
      // Accept any group format that's not the timetable code itself
      if (groupCell && groupCell !== timetableCode) {
        const baseGroup = groupCell.split("/")[0];
        if (baseGroup && baseGroup.length > 0) {
          groupSet.add(baseGroup);
        }
      }
    }
  });

  return Array.from(groupSet)
    .sort()
    .map((id) => ({
      id,
      name: `Grupa ${id}`,
      year: timetableCode,
    }));
}
