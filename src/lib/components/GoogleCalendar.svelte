<script lang="ts">
  import { onMount } from "svelte";
  import { selectedSubjects, schedule, selectedSemigroup } from "../stores";
  import type { Subject, ScheduleEvent } from "../types";

  let tokenClient: any;
  let gapiInited = false;
  let gsiInited = false;
  let isSignedIn = false;
  let selectedSubjectsValue: Set<string>;
  let scheduleValue: Subject[];
  let selectedSemigroupValue: "1" | "2" | null;
  let isAddingEvents = false;

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
  const SCOPES = "https://www.googleapis.com/auth/calendar";

  selectedSubjects.subscribe((value) => (selectedSubjectsValue = value));
  schedule.subscribe((value) => (scheduleValue = value));
  selectedSemigroup.subscribe((value) => (selectedSemigroupValue = value));

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

  function isSubjectForSelectedSemigroup(subject: Subject): boolean {
    // If no semigroup is selected, only return subjects without a specific semigroup
    if (!selectedSemigroupValue) {
      return !subject.group.includes("/");
    }

    // Return subjects that either:
    // 1. Don't have a specific semigroup (e.g., "923" or "IE2")
    // 2. Match the selected semigroup (e.g., "923/1" for semigroup "1")
    const groupParts = subject.group.split("/");
    return groupParts.length === 1 || groupParts[1] === selectedSemigroupValue;
  }

  function createCalendarEvent(subject: Subject): ScheduleEvent {
    // Parse hours correctly (assuming format like "8-10" or "14-16")
    const [startHour, endHour] = subject.time.split("-");
    const nextOccurrence = getNextDayOccurrence(subject.day);
    const dateStr = nextOccurrence.toISOString().split("T")[0];

    // Ensure hours are properly padded with leading zeros
    const formattedStartHour = startHour.padStart(2, "0");
    const formattedEndHour = endHour.padStart(2, "0");

    const event: ScheduleEvent = {
      summary: `${subject.name} (${subject.type})`,
      location: subject.room,
      description: `Professor: ${subject.professor}\nGroup: ${subject.group}`,
      start: {
        dateTime: `${dateStr}T${formattedStartHour}:00:00`,
        timeZone: "Europe/Bucharest",
      },
      end: {
        dateTime: `${dateStr}T${formattedEndHour}:00:00`,
        timeZone: "Europe/Bucharest",
      },
    };

    // Handle bi-weekly recurrence
    if (subject.frequency) {
      const interval = subject.frequency === "sapt. 1" ? 2 : 2;
      const weekStart = subject.frequency === "sapt. 1" ? "" : ";WKST=MO";
      event.recurrence = [
        `RRULE:FREQ=WEEKLY;COUNT=14;INTERVAL=${interval}${weekStart}`,
      ];
    } else {
      // Regular weekly recurrence
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
    if (!isSignedIn || isAddingEvents) return;

    try {
      isAddingEvents = true;

      // Filter subjects based on both name and semigroup
      const selectedSchedule = scheduleValue.filter(
        (subject) =>
          selectedSubjectsValue.has(subject.name) &&
          isSubjectForSelectedSemigroup(subject)
      );

      if (selectedSchedule.length === 0) {
        alert("No subjects selected for the current semigroup");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const subject of selectedSchedule) {
        try {
          const event = createCalendarEvent(subject);
          console.log("Adding event:", event); // Debug log

          const response = await (
            window as any
          ).gapi.client.calendar.events.insert({
            calendarId: "primary",
            resource: event,
          });

          if (response.status === 200) {
            successCount++;
          } else {
            errorCount++;
            console.error("Error response:", response);
          }
        } catch (err) {
          errorCount++;
          console.error("Error adding event to calendar:", err);
        }
      }

      // Show result to user
      alert(
        `Added ${successCount} events to calendar${
          errorCount > 0 ? `. Failed to add ${errorCount} events.` : ""
        }`
      );
    } finally {
      isAddingEvents = false;
    }
  }

  async function removeAppEvents() {
    if (!isSignedIn) return;

    try {
      // Get events from primary calendar - just look for a week ahead since we use recurrence
      const response = await (window as any).gapi.client.calendar.events.list({
        calendarId: "primary",
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ahead
        showDeleted: false,
        singleEvents: false, // Get recurring events as single instances
        maxResults: 2500,
      });

      const events = response.result.items;
      let deletedCount = 0;
      let errorCount = 0;

      // Filter events created by our app - look for our specific format
      const appEvents = events.filter(
        (event) =>
          event.description?.startsWith("Professor:") &&
          event.recurrence?.[0]?.startsWith("RRULE:FREQ=WEEKLY") &&
          (event.summary?.includes("(Curs)") ||
            event.summary?.includes("(Laborator)") ||
            event.summary?.includes("(Seminar)"))
      );

      if (appEvents.length === 0) {
        alert("No events found that were created by this app");
        return;
      }

      const confirmed = confirm(
        `Found ${appEvents.length} recurring events created by this app. Delete them?`
      );
      if (!confirmed) return;

      for (const event of appEvents) {
        try {
          await (window as any).gapi.client.calendar.events.delete({
            calendarId: "primary",
            eventId: event.id,
          });
          deletedCount++;
        } catch (err) {
          console.error("Error deleting event:", err);
          errorCount++;
        }
      }

      alert(
        `Deleted ${deletedCount} recurring events${errorCount > 0 ? `. Failed to delete ${errorCount} events.` : ""}`
      );
    } catch (error) {
      console.error("Error fetching events:", error);
      alert("Failed to fetch events. Please try again.");
    }
  }
</script>

<div class="calendar-integration">
  {#if !gapiInited || !gsiInited}
    <div class="loading">Initializing Google Calendar...</div>
  {:else}
    <div class="buttons-container">
      <button class="auth-button" on:click={handleAuthClick}>
        {isSignedIn ? "Sign Out" : "Sign In with Google"}
      </button>

      {#if isSignedIn}
        <button class="delete-button" on:click={removeAppEvents}>
          Remove App Events
        </button>
      {/if}
    </div>

    {#if isSignedIn}
      <div class="setup-container">
        <div class="section">
          <h3>1. Select your semigroup:</h3>
          <div class="semigroup-selector">
            <label>
              <input
                type="radio"
                name="semigroup"
                value="1"
                bind:group={$selectedSemigroup}
              />
              Semigroup 1
            </label>
            <label>
              <input
                type="radio"
                name="semigroup"
                value="2"
                bind:group={$selectedSemigroup}
              />
              Semigroup 2
            </label>
            <label>
              <input
                type="radio"
                name="semigroup"
                value={null}
                bind:group={$selectedSemigroup}
              />
              Common classes only
            </label>
          </div>
        </div>

        {#if selectedSemigroupValue !== undefined}
          <div class="section">
            <h3>2. Select subjects and add to calendar:</h3>
            {#if selectedSubjectsValue.size > 0}
              <button
                class="add-button"
                on:click={addToCalendar}
                disabled={isAddingEvents}
              >
                {isAddingEvents
                  ? "Adding events..."
                  : "Add Selected Subjects to Calendar"}
              </button>
            {:else}
              <div class="info-text">Please select some subjects first</div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .calendar-integration {
    margin: 2rem 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .setup-container {
    background-color: #f8f9fa;
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin-top: 1rem;
  }

  .section {
    margin-bottom: 1.5rem;
  }

  .section:last-child {
    margin-bottom: 0;
  }

  h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
  }

  .semigroup-selector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .semigroup-selector label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.5rem;
    background-color: white;
    border-radius: 0.25rem;
    border: 1px solid #dee2e6;
  }

  .semigroup-selector label:hover {
    background-color: #f1f3f5;
  }

  .info-text {
    color: #6c757d;
    font-style: italic;
  }

  .buttons-container {
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

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-button {
    background-color: #4285f4;
    color: white;
  }

  .add-button {
    background-color: #34a853;
    color: white;
  }

  .delete-button {
    background-color: #dc3545;
    color: white;
  }

  button:not(:disabled):hover {
    opacity: 0.9;
  }
</style>
