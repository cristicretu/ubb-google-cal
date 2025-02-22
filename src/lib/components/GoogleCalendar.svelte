<script lang="ts">
  import { onMount } from "svelte";
  import { selectedSubjects, schedule } from "../stores";
  import type { Subject, ScheduleEvent } from "../types";

  let tokenClient: any;
  let gapiInited = false;
  let gsiInited = false;
  let isSignedIn = false;
  let selectedSubjectsValue: Set<string>;
  let scheduleValue: Subject[];

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
  const SCOPES = "https://www.googleapis.com/auth/calendar";

  selectedSubjects.subscribe((value) => (selectedSubjectsValue = value));
  schedule.subscribe((value) => (scheduleValue = value));

  onMount(async () => {
    // Load both libraries
    const [gapiScript, gisScript] = await Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]);

    if (gapiScript && gisScript) {
      await initializeGapiClient();
      initializeGsiClient();
    }
  });

  function loadScript(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function initializeGapiClient() {
    try {
      await new Promise((resolve, reject) => {
        (window as any).gapi.load("client", {
          callback: resolve,
          onerror: reject,
        });
      });

      await (window as any).gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });

      gapiInited = true;
    } catch (error) {
      console.error("Error initializing GAPI client:", error);
    }
  }

  function initializeGsiClient() {
    try {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
      });
      gsiInited = true;
    } catch (error) {
      console.error("Error initializing GSI client:", error);
    }
  }

  function handleTokenResponse(response: any) {
    if (response.access_token) {
      isSignedIn = true;
    }
  }

  async function handleAuthClick() {
    if (!gapiInited || !gsiInited) {
      console.error("Google API not initialized");
      return;
    }

    try {
      if (!isSignedIn) {
        // Request an access token
        tokenClient.requestAccessToken();
      } else {
        // Revoke the access token
        const token = (window as any).gapi.client.getToken();
        if (token) {
          (window as any).google.accounts.oauth2.revoke(token.access_token);
          (window as any).gapi.client.setToken(null);
          isSignedIn = false;
        }
      }
    } catch (error) {
      console.error("Error during authentication:", error);
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
        await (window as any).gapi.client.calendar.events.insert({
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
  {#if !gapiInited || !gsiInited}
    <div class="loading">Initializing Google Calendar...</div>
  {:else}
    <button class="auth-button" on:click={handleAuthClick}>
      {isSignedIn ? "Sign Out" : "Sign In with Google"}
    </button>

    {#if isSignedIn && selectedSubjectsValue.size > 0}
      <button class="add-button" on:click={addToCalendar}>
        Add Selected Subjects to Calendar
      </button>
    {/if}
  {/if}
</div>

<style>
  .calendar-integration {
    margin: 2rem 0;
    display: flex;
    gap: 1rem;
  }

  .loading {
    color: #666;
    font-style: italic;
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
