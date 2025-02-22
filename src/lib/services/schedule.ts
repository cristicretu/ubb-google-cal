import type { Subject, Group } from "../types";

const CORS_PROXY = "https://thingproxy.freeboard.io/fetch/";
// Alternative if needed: https://cors-anywhere.herokuapp.com/
const BASE_URL = "https://www.cs.ubbcluj.ro/files/orar/2024-2/tabelar";

// Cache for responses
const cache = new Map<string, any>();

async function fetchWithRetry(
  url: string,
  retries = 3,
  delay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
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

export async function fetchSchedule(year: string): Promise<Subject[]> {
  const cacheKey = `schedule-${year}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const response = await fetchWithRetry(
      `${CORS_PROXY}${BASE_URL}/${year}.html`
    );
    const html = await response.text();
    const subjects = parseScheduleHtml(html);
    cache.set(cacheKey, subjects);
    return subjects;
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return [];
  }
}

export async function fetchGroups(targetYear?: string): Promise<Group[]> {
  // If a specific year is provided, only fetch that one
  const years = targetYear ? [targetYear] : ["IE1", "IE2", "IE3"];
  const groups: Group[] = [];

  for (const year of years) {
    const cacheKey = `groups-${year}`;
    if (cache.has(cacheKey)) {
      groups.push(...cache.get(cacheKey));
      continue;
    }

    try {
      const response = await fetchWithRetry(
        `${CORS_PROXY}${BASE_URL}/${year}.html`
      );
      const html = await response.text();
      const yearGroups = parseGroupsFromHtml(html, year);
      cache.set(cacheKey, yearGroups);
      groups.push(...yearGroups);
    } catch (error) {
      console.error(`Error fetching groups for ${year}:`, error);
    }
  }

  return groups;
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

function parseGroupsFromHtml(html: string, year: string): Group[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // First try to get the group from the title
  const title = doc.querySelector("h1")?.textContent || "";
  const groupMatch = title.match(/Grupa (\d{3})/);
  if (groupMatch) {
    return [
      {
        id: groupMatch[1],
        name: `Grupa ${groupMatch[1]}`,
        year,
      },
    ];
  }

  // Fallback to parsing the table
  const rows = doc.querySelectorAll("tr");
  const groupSet = new Set<string>();

  rows.forEach((row, index) => {
    if (index === 0) return; // Skip header row

    const cells = row.querySelectorAll("td");
    if (cells.length >= 5) {
      const groupCell = cells[4].textContent?.trim() || "";
      if (groupCell && !groupCell.startsWith("IE")) {
        const baseGroup = groupCell.split("/")[0];
        if (baseGroup && /^\d{3}$/.test(baseGroup)) {
          groupSet.add(baseGroup);
        }
      }
    }
  });

  return Array.from(groupSet)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((id) => ({
      id,
      name: `Grupa ${id}`,
      year,
    }));
}
