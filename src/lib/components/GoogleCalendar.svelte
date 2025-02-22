<script lang="ts">
  import { onMount } from "svelte";
  import { selectedSubjects, schedule } from "../stores";
  import type { Subject, ScheduleEvent } from "../types";

  let gapi: any;
  let isSignedIn = false;
  let selectedSubjectsValue: Set<string>;
  let scheduleValue: Subject[];

  const CLIENT_ID = import.meta.env.CLIENT_ID;
  const API_KEY = import.meta.env.API_KEY;
  const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
  const SCOPES = "https://www.googleapis.com/auth/calendar";

  selectedSubjects.subscribe((value) => (selectedSubjectsValue = value));
  schedule.subscribe((value) => (scheduleValue = value));

  onMount(async () => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    document.body.appendChild(script);

    script.onload = () => {
      gapi = window.gapi;
      gapi.load("client:auth2", initializeGapiClient);
    };
  });

  async function initializeGapiClient() {
    await gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: [DISCOVERY_DOC],
      scope: SCOPES,
    });

    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
  }

  function updateSigninStatus(signedIn: boolean) {
    isSignedIn = signedIn;
  }

  function handleAuthClick() {
    if (!isSignedIn) {
      gapi.auth2.getAuthInstance().signIn();
    } else {
      gapi.auth2.getAuthInstance().signOut();
    }
  }

  function createCalendarEvent(subject: Subject): ScheduleEvent {
    const [startHour, endHour] = subject.time.split("-");
    const now = new Date();
    const nextOccurrence = getNextDayOccurrence(subject.day);

    const event: ScheduleEvent = {
      summary: `${subject.name} (${subject.type})`,
      location: subject.room,
      description: `Professor: ${subject.professor}\nGroup: ${subject.group}`,
      start: {
        dateTime: `${nextOccurrence.toISOString().split("T")[0]}T${startHour}:00`,
        timeZone: "Europe/Bucharest",
      },
      end: {
        dateTime: `${nextOccurrence.toISOString().split("T")[0]}T${endHour}:00`,
        timeZone: "Europe/Bucharest",
      },
    };

    if (subject.frequency) {
      event.recurrence = [
        `RRULE:FREQ=WEEKLY;COUNT=14${subject.frequency === "sapt. 1" ? ";INTERVAL=2" : ";INTERVAL=2;BYDAY=2"}`,
      ];
    } else {
      event.recurrence = ["RRULE:FREQ=WEEKLY;COUNT=14"];
    }

    return event;
  }

  function getNextDayOccurrence(day: string) {
    const daysMap: { [key: string]: number } = {
      Luni: 1,
      Marti: 2,
      Miercuri: 3,
      Joi: 4,
      Vineri: 5,
    };

    const today = new Date();
    const targetDay = daysMap[day];
    const currentDay = today.getDay();
    const daysUntilTarget = targetDay - currentDay;

    today.setDate(
      today.getDate() +
        (daysUntilTarget <= 0 ? daysUntilTarget + 7 : daysUntilTarget)
    );
    return today;
  }

  async function addToCalendar() {
    if (!isSignedIn) return;

    const selectedSchedule = scheduleValue.filter((subject) =>
      selectedSubjectsValue.has(subject.name)
    );

    for (const subject of selectedSchedule) {
      const event = createCalendarEvent(subject);
      try {
        await gapi.client.calendar.events.insert({
          calendarId: "primary",
          resource: event,
        });
      } catch (err) {
        console.error("Error adding event to calendar:", err);
      }
    }
  }
</script>

<div class="calendar-integration">
  <button class="auth-button" on:click={handleAuthClick}>
    {isSignedIn ? "Sign Out" : "Sign In with Google"}
  </button>

  {#if isSignedIn && selectedSubjectsValue.size > 0}
    <button class="add-button" on:click={addToCalendar}>
      Add Selected Subjects to Calendar
    </button>
  {/if}
</div>

<style>
  .calendar-integration {
    margin: 2rem 0;
    display: flex;
    gap: 1rem;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    font-weight: bold;
  }

  .auth-button {
    background-color: #4285f4;
    color: white;
  }

  .add-button {
    background-color: #34a853;
    color: white;
  }

  button:hover {
    opacity: 0.9;
  }
</style>
