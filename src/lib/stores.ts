import { writable, get } from "svelte/store";
import type { Subject, Group } from "./types";
import { fetchGroups, fetchSchedule } from "./services/schedule";

// Initialize stores with empty arrays
export const schedule = writable<Subject[]>([]);
export const groups = writable<Group[]>([]);
export const selectedGroup = writable<string>("");
export const selectedSubjects = writable<Set<string>>(new Set());
export const selectedSemigroup = writable<"1" | "2" | null>("1");

// Helper function to get current store value
export function getStoreValue<T>(store: {
  subscribe: (callback: (value: T) => void) => void;
}): T {
  let value: T;
  store.subscribe(($value) => {
    value = $value;
  })();
  return value!;
}

// Initialize groups
fetchGroups().then((fetchedGroups) => {
  groups.set(fetchedGroups);
});

// Update schedule when group is selected
selectedGroup.subscribe(async (group) => {
  if (group) {
    // Find the group object to get the year
    const currentGroups = get(groups);
    const groupObj = currentGroups.find((g) => g.id === group);
    if (groupObj) {
      const subjects = await fetchSchedule(groupObj.year);
      const groupSchedule = subjects.filter(
        (item) => item.group.startsWith(group) || item.group === groupObj.year
      );
      schedule.set(groupSchedule);
    }
  } else {
    schedule.set([]);
  }
});