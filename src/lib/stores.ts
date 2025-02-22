import { writable } from "svelte/store";
import type { Subject, Group } from "./types";
import { fetchGroups, fetchSchedule } from "./services/schedule";

// Initialize stores with empty arrays
export const schedule = writable<Subject[]>([]);
export const groups = writable<Group[]>([]);
export const selectedGroup = writable<string>("");
export const selectedSubjects = writable<Set<string>>(new Set());
export const selectedSemigroup = writable<"1" | "2" | null>(null);

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

// Complete schedule data for group 923
export const scheduleData: Subject[] = [
  {
    day: "Luni",
    time: "8-10",
    room: "L338",
    group: "923/1",
    type: "Laborator",
    name: "Inteligenta artificiala",
    professor: "C.d.asociat CAPILNAS Matei",
  },
  {
    day: "Luni",
    time: "10-12",
    room: "L002",
    group: "923/2",
    type: "Laborator",
    name: "Inteligenta artificiala",
    professor: "C.d.asociat CAPILNAS Matei",
  },
  {
    day: "Luni",
    time: "10-12",
    room: "L439",
    group: "923/1",
    type: "Laborator",
    name: "Medii de proiectare si programare",
    professor: "C.d.asociat ONITA Andrei",
  },
  {
    day: "Luni",
    time: "14-16",
    room: "2/I",
    group: "IE2",
    type: "Curs",
    name: "Ingineria sistemelor soft",
    professor: "Lect. ZSIGMOND Imre",
  },
  {
    day: "Luni",
    time: "16-18",
    room: "2/I",
    group: "IE2",
    type: "Curs",
    name: "Programare Web",
    professor: "Conf. STERCA Adrian",
  },
  {
    day: "Marti",
    time: "8-10",
    room: "2/I",
    group: "IE2",
    type: "Curs",
    name: "Inteligenta artificiala",
    professor: "Lect. MIHOC Tudor",
  },
  {
    day: "Marti",
    time: "12-14",
    frequency: "sapt. 1",
    room: "L343",
    group: "923/1",
    type: "Laborator",
    name: "Ingineria sistemelor soft",
    professor: "Lect. ZSIGMOND Imre",
  },
  {
    day: "Marti",
    time: "12-14",
    frequency: "sapt. 2",
    room: "L343",
    group: "923/2",
    type: "Laborator",
    name: "Ingineria sistemelor soft",
    professor: "Lect. ZSIGMOND Imre",
  },
  {
    day: "Marti",
    time: "14-16",
    room: "A323",
    group: "923",
    type: "Seminar",
    name: "Limba engleza (1)",
    professor: "C.d.asociat POPESCU Raluca",
  },
  {
    day: "Marti",
    time: "14-16",
    room: "DPPD-204",
    group: "IE2",
    type: "Seminar",
    name: "Didactica Informaticii",
    professor: "Drd. MAIER Mariana",
  },
  {
    day: "Miercuri",
    time: "10-12",
    frequency: "sapt. 2",
    room: "C335",
    group: "923",
    type: "Seminar",
    name: "Ingineria sistemelor soft",
    professor: "Lect. ZSIGMOND Imre",
  },
  {
    day: "Miercuri",
    time: "12-14",
    frequency: "sapt. 2",
    room: "L307",
    group: "923/1",
    type: "Laborator",
    name: "Sisteme de gestiune a bazelor de date",
    professor: "Lect. POP Emilia",
  },
  {
    day: "Miercuri",
    time: "12-14",
    room: "L321",
    group: "923/2",
    type: "Laborator",
    name: "Programare Web",
    professor: "Lect. BADARINZA Ioan",
  },
  {
    day: "Miercuri",
    time: "14-16",
    frequency: "sapt. 1",
    room: "L307",
    group: "923/2",
    type: "Laborator",
    name: "Sisteme de gestiune a bazelor de date",
    professor: "Lect. POP Emilia",
  },
  {
    day: "Miercuri",
    time: "16-18",
    room: "L321",
    group: "923/1",
    type: "Laborator",
    name: "Programare Web",
    professor: "C.d.asociat MORARU Dora",
  },
  {
    day: "Joi",
    time: "10-12",
    room: "2/I",
    group: "IE2",
    type: "Curs",
    name: "Sisteme de gestiune a bazelor de date",
    professor: "Lect. SURDU Sabina",
  },
  {
    day: "Joi",
    time: "12-14",
    room: "2/I",
    group: "IE2",
    type: "Curs",
    name: "Medii de proiectare si programare",
    professor: "Lect. MIRCEA Ioan Gabriel",
  },
  {
    day: "Joi",
    time: "14-16",
    frequency: "sapt. 2",
    room: "5/I",
    group: "923",
    type: "Seminar",
    name: "Sisteme de gestiune a bazelor de date",
    professor: "Drd. COSTE Claudia Ioana",
  },
  {
    day: "Joi",
    time: "18-20",
    room: "L339",
    group: "923/2",
    type: "Laborator",
    name: "Medii de proiectare si programare",
    professor: "C.d.asociat TRUTA Diana",
  },
  {
    day: "Vineri",
    time: "8-10",
    room: "DPPD-205",
    group: "IE2",
    type: "Curs",
    name: "Didactica Informaticii",
    professor: "Conf. MAGDAS Ioana",
  },
];
