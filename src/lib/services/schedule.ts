import type { Subject, Group } from "../types";
import { schedules } from "../data/schedules";

export async function fetchSchedule(timetableCode: string): Promise<Subject[]> {
  if (!timetableCode || typeof timetableCode !== "string") {
    throw new Error("Invalid timetable code");
  }

  return (schedules as Record<string, Subject[]>)[timetableCode] ?? [];
}

export async function fetchGroups(timetableCode: string): Promise<Group[]> {
  if (!timetableCode || typeof timetableCode !== "string") {
    throw new Error("Invalid timetable code");
  }

  const subjects: Subject[] =
    (schedules as Record<string, Subject[]>)[timetableCode] ?? [];

  const groupSet = new Set<string>();
  subjects.forEach((subject) => {
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
