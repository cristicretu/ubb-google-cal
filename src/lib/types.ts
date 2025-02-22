export interface Subject {
  day: string;
  time: string;
  frequency?: string;
  room: string;
  group: string;
  type: string;
  name: string;
  professor: string;
}

export interface Group {
  id: string;
  name: string;
  year: string;
}

export interface ScheduleEvent {
  summary: string;
  location: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
}
