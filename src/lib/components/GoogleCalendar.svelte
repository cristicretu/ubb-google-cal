<script lang="ts">
  import { onMount } from "svelte";
  import {
    selectedSubjects,
    schedule,
    selectedSemigroup,
    selectedGroup,
  } from "../stores";
  import type { Subject, ScheduleEvent } from "../types";

  let tokenClient: any;
  let gsiInited = false;
  let isSignedIn = false;
  let selectedSubjectsValue: Set<string>;
  let scheduleValue: Subject[];
  let selectedSemigroupValue: "1" | "2" | null;
  let selectedGroupValue: string;
  let isAddingEvents = false;
  let accessToken: string | null = null;
  let initError: string | null = null;
  let isLoadingFromStorage = false;
  let previousGroupValue: string = "";
  let previousSemigroupValue: "1" | "2" | null = undefined;

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!CLIENT_ID) {
    console.error("Missing VITE_GOOGLE_CLIENT_ID environment variable");
    initError =
      "Google Calendar integration is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.";
  }

  selectedSubjects.subscribe((value) => (selectedSubjectsValue = value));
  schedule.subscribe((value) => (scheduleValue = value));
  selectedSemigroup.subscribe((value) => (selectedSemigroupValue = value));
  selectedGroup.subscribe((value) => (selectedGroupValue = value));

  // Reactive statement to compute selected subjects for preview
  $: selectedSchedulePreview = scheduleValue.filter(
    (subject) =>
      selectedSubjectsValue.has(subject.name) &&
      isSubjectForSelectedSemigroup(subject),
  );

  // Create unique storage key based on group and semigroup
  $: storageKey = `ubb-cal-selections-${selectedGroupValue}-${selectedSemigroupValue || "common"}`;

  // Save selections to localStorage whenever they change (but not when loading)
  $: if (selectedSubjectsValue && selectedGroupValue && !isLoadingFromStorage) {
    saveSelectionsToStorage();
  }

  // Handle group/semigroup changes
  $: if (selectedGroupValue !== undefined && selectedSemigroupValue !== undefined) {
    handleGroupOrSemigroupChange();
  }

  onMount(async () => {
    try {
      // Load the GIS script
      await loadScript("https://accounts.google.com/gsi/client");

      // Wait for the google object to be available
      await waitForGoogleObject();

      // Initialize the client
      initializeGsiClient();

      // Initialize tracking variables and load saved selections after a short delay
      setTimeout(() => {
        previousGroupValue = selectedGroupValue;
        previousSemigroupValue = selectedSemigroupValue;
        if (selectedGroupValue && selectedSemigroupValue !== undefined) {
          loadSelectionsFromStorage();
        }
      }, 100);
    } catch (error) {
      console.error("Error during Google Sign-In setup:", error);
    }
  });

  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  }

  function waitForGoogleObject(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for google object"));
      }, 10000); // 10 second timeout

      const checkGoogle = () => {
        if (typeof (window as any).google !== "undefined") {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkGoogle, 100);
        }
      };

      checkGoogle();
    });
  }

  function initializeGsiClient() {
    if (!CLIENT_ID) {
      console.error("Cannot initialize GSI client: Missing CLIENT_ID");
      return;
    }

    if (!(window as any).google?.accounts?.oauth2) {
      console.error("Google OAuth2 client not available");
      return;
    }

    try {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: "https://www.googleapis.com/auth/calendar",
        callback: handleTokenResponse,
      });
      gsiInited = true;
    } catch (error) {
      console.error("Error initializing GSI client:", error);
      initError =
        "Failed to initialize Google Calendar integration. Please try refreshing the page.";
    }
  }

  function handleTokenResponse(response: any) {
    if (response.access_token) {
      accessToken = response.access_token;
      isSignedIn = true;
    }
  }

  async function handleAuthClick() {
    if (!gsiInited) {
      console.error("Google API not initialized");
      return;
    }

    try {
      if (!isSignedIn) {
        tokenClient.requestAccessToken();
      } else {
        if (accessToken) {
          await fetch(
            `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
            {
              method: "POST",
            },
          );
        }
        accessToken = null;
        isSignedIn = false;
      }
    } catch (error) {
      console.error("Error during authentication:", error);
    }
  }

  async function makeCalendarRequest(
    method: string,
    endpoint: string,
    data?: any,
  ) {
    if (!accessToken) return null;

    let url = `https://www.googleapis.com/calendar/v3/${endpoint}`;

    // For GET requests, convert data to URL parameters
    if (method === "GET" && data) {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...(method !== "GET" && data ? { body: JSON.stringify(data) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    return method === "DELETE" ? null : response.json();
  }

  function isSubjectForSelectedSemigroup(subject: Subject): boolean {
    // First check if this subject belongs to our group
    if (
      !subject.group.startsWith(selectedGroupValue) &&
      !subject.group.startsWith("IE2")
    ) {
      return false;
    }

    // If no semigroup is selected, only return subjects without a specific semigroup
    if (!selectedSemigroupValue) {
      return !subject.group.includes("/");
    }

    // Return subjects that either:
    // 1. Don't have a specific semigroup (e.g., "923" or "IE2")
    // 2. Match the selected semigroup (e.g., "923/1" for semigroup "1")
    const groupParts = subject.group.split("/");

    // Common classes (like "IE2" or "923") are always included
    if (groupParts.length === 1) {
      return true;
    }

    // For subgroups (like "923/1"), strictly match the semigroup
    return groupParts[1] === selectedSemigroupValue;
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
        (daysUntilTarget <= 0 ? daysUntilTarget + 7 : daysUntilTarget),
    );
    return today;
  }

  async function addToCalendar() {
    if (!isSignedIn || isAddingEvents || !accessToken) return;

    try {
      isAddingEvents = true;

      // Get existing events
      const existingEvents = await makeCalendarRequest(
        "GET",
        "calendars/primary/events",
        {
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          singleEvents: false,
        },
      );

      const existingEventKeys = new Set(
        existingEvents?.items
          ?.filter((event) => event.description?.startsWith("Professor:"))
          .map((event) => {
            const summary = event.summary;
            const time = event.start.dateTime.split("T")[1].substring(0, 5);
            const day = new Date(event.start.dateTime).getDay();
            return `${summary}-${day}-${time}`;
          }) || [],
      );

      // Filter subjects
      const selectedSchedule = scheduleValue.filter(
        (subject) =>
          selectedSubjectsValue.has(subject.name) &&
          isSubjectForSelectedSemigroup(subject),
      );

      if (selectedSchedule.length === 0) {
        alert("No subjects selected for the current semigroup");
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const subject of selectedSchedule) {
        try {
          const event = createCalendarEvent(subject);
          const eventKey = `${event.summary}-${getNextDayOccurrence(subject.day).getDay()}-${subject.time.split("-")[0]}`;

          if (existingEventKeys.has(eventKey)) {
            console.log("Skipping duplicate event:", event);
            skippedCount++;
            continue;
          }

          await makeCalendarRequest("POST", "calendars/primary/events", event);
          successCount++;
          existingEventKeys.add(eventKey);
        } catch (err) {
          console.error("Error adding event:", err);
          errorCount++;
        }
      }

      alert(
        `Added ${successCount} events to calendar` +
          (skippedCount > 0
            ? `\nSkipped ${skippedCount} existing events`
            : "") +
          (errorCount > 0 ? `\nFailed to add ${errorCount} events` : ""),
      );
    } catch (error) {
      console.error("Error adding events:", error);
      alert("Failed to add events to calendar. Please try again.");
    } finally {
      isAddingEvents = false;
    }
  }

  function handleGroupOrSemigroupChange() {
    // Check if group or semigroup actually changed
    const groupChanged = previousGroupValue !== selectedGroupValue;
    const semigroupChanged = previousSemigroupValue !== selectedSemigroupValue;
    
    if (groupChanged || semigroupChanged) {
      // Save current selections to the previous storage key before switching
      if (previousGroupValue && !isLoadingFromStorage) {
        const previousStorageKey = `ubb-cal-selections-${previousGroupValue}-${previousSemigroupValue || "common"}`;
        try {
          if (typeof window !== "undefined" && selectedSubjectsValue.size > 0) {
            const selectionsArray = Array.from(selectedSubjectsValue);
            localStorage.setItem(previousStorageKey, JSON.stringify(selectionsArray));
          }
        } catch (error) {
          console.warn("Failed to save previous selections:", error);
        }
      }
      
      // Update tracking variables
      previousGroupValue = selectedGroupValue;
      previousSemigroupValue = selectedSemigroupValue;
      
      // Load selections for the new group/semigroup combination
      loadSelectionsFromStorage();
    }
  }

  function saveSelectionsToStorage() {
    try {
      if (typeof window !== "undefined" && storageKey && selectedSubjectsValue.size > 0) {
        const selectionsArray = Array.from(selectedSubjectsValue);
        localStorage.setItem(storageKey, JSON.stringify(selectionsArray));
      }
    } catch (error) {
      console.warn("Failed to save selections to localStorage:", error);
    }
  }

  function loadSelectionsFromStorage() {
    try {
      if (typeof window !== "undefined" && storageKey) {
        isLoadingFromStorage = true;
        const savedSelections = localStorage.getItem(storageKey);
        if (savedSelections) {
          const selectionsArray: string[] = JSON.parse(savedSelections);
          const selectionsSet = new Set<string>(selectionsArray);

          // Only update if the current selections are different
          if (!setsEqual(selectedSubjectsValue, selectionsSet)) {
            selectedSubjects.set(selectionsSet);
          }
        } else {
          // No saved selections for this group/semigroup, clear current selections
          selectedSubjects.set(new Set<string>());
        }
        isLoadingFromStorage = false;
      }
    } catch (error) {
      console.warn("Failed to load selections from localStorage:", error);
      isLoadingFromStorage = false;
    }
  }

  function setsEqual(set1: Set<string>, set2: Set<string>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  function clearStorageForGroup() {
    try {
      if (typeof window !== "undefined") {
        // Clear any existing storage keys for this group
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            key.startsWith(`ubb-cal-selections-${selectedGroupValue}-`)
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      }
    } catch (error) {
      console.warn("Failed to clear storage:", error);
    }
  }

  async function removeAppEvents() {
    if (!isSignedIn || !accessToken) return;

    try {
      const response = await makeCalendarRequest(
        "GET",
        "calendars/primary/events",
        {
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          singleEvents: false,
        },
      );

      const appEvents = response.items?.filter(
        (event) =>
          event.description?.startsWith("Professor:") &&
          event.recurrence?.[0]?.startsWith("RRULE:FREQ=WEEKLY") &&
          (event.summary?.includes("(Curs)") ||
            event.summary?.includes("(Laborator)") ||
            event.summary?.includes("(Seminar)")),
      );

      if (!appEvents?.length) {
        alert("No events found that were created by this app");
        return;
      }

      const confirmed = confirm(
        `Found ${appEvents.length} recurring events created by this app. Delete them?`,
      );
      if (!confirmed) return;

      let deletedCount = 0;
      let errorCount = 0;

      for (const event of appEvents) {
        try {
          await makeCalendarRequest(
            "DELETE",
            `calendars/primary/events/${event.id}`,
          );
          deletedCount++;
        } catch (err) {
          console.error("Error deleting event:", err);
          errorCount++;
        }
      }

      alert(
        `Deleted ${deletedCount} recurring events${errorCount > 0 ? `. Failed to delete ${errorCount} events.` : ""}`,
      );
    } catch (error) {
      console.error("Error removing events:", error);
      alert("Failed to remove events. Please try again.");
    }
  }
</script>

<div class="calendar-integration">
  {#if initError}
    <div class="error">{initError}</div>
  {:else if !gsiInited}
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
          <!-- Preview Section -->
          {#if selectedSchedulePreview.length > 0}
            <div class="section">
              <h3>2. Selected subjects preview:</h3>
              <div class="preview-container">
                {#each selectedSchedulePreview as subject}
                  <div class="preview-item">
                    <div class="subject-info">
                      <div class="subject-name">{subject.name}</div>
                      <div class="subject-details">
                        <span class="subject-type">{subject.type}</span>
                        <span class="subject-professor"
                          >Prof. {subject.professor}</span
                        >
                      </div>
                    </div>
                    <div class="schedule-info">
                      <div class="schedule-day">{subject.day}</div>
                      <div class="schedule-time">{subject.time}</div>
                      {#if subject.frequency}
                        <div class="schedule-frequency">
                          {subject.frequency}
                        </div>
                      {/if}
                    </div>
                    <div class="location-info">
                      <div class="subject-room">{subject.room}</div>
                      <div class="subject-group">{subject.group}</div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="section">
            <h3>
              {selectedSchedulePreview.length > 0 ? "3." : "2."} Add to calendar:
            </h3>
            {#if selectedSubjectsValue.size > 0}
              <div class="calendar-actions">
                <button
                  class="add-button"
                  on:click={addToCalendar}
                  disabled={isAddingEvents}
                >
                  {isAddingEvents
                    ? "Adding events..."
                    : `Add ${selectedSchedulePreview.length} Subject${selectedSchedulePreview.length !== 1 ? "s" : ""} to Calendar`}
                </button>
                <button
                  class="clear-selections-button"
                  on:click={() => {
                    selectedSubjects.set(new Set());
                    clearStorageForGroup();
                  }}
                  title="Clear all selections for this group/semigroup"
                >
                  Clear Selections
                </button>
              </div>
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

  .clear-selections-button {
    background-color: #6c757d;
    color: white;
    font-size: 0.9rem;
  }

  .calendar-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }

  button:not(:disabled):hover {
    opacity: 0.9;
  }

  .error {
    color: #dc3545;
    padding: 1rem;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 0.25rem;
    margin-bottom: 1rem;
  }

  .preview-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem;
    background-color: white;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
  }

  .preview-item {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background-color: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 0.25rem;
    align-items: center;
  }

  .subject-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .subject-name {
    font-weight: 600;
    color: #212529;
    font-size: 0.95rem;
  }

  .subject-details {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: #6c757d;
  }

  .subject-type {
    background-color: #e7f3ff;
    color: #0056b3;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .subject-professor {
    font-style: italic;
  }

  .schedule-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }

  .schedule-day {
    font-weight: 600;
    color: #495057;
    font-size: 0.9rem;
  }

  .schedule-time {
    font-weight: 700;
    color: #28a745;
    font-size: 1rem;
  }

  .schedule-frequency {
    font-size: 0.75rem;
    color: #6c757d;
    font-style: italic;
  }

  .location-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: right;
  }

  .subject-room {
    font-weight: 600;
    color: #495057;
    font-size: 0.9rem;
  }

  .subject-group {
    font-size: 0.8rem;
    color: #6c757d;
    background-color: #e9ecef;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    align-self: flex-end;
  }

  @media (max-width: 768px) {
    .preview-item {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .schedule-info,
    .location-info {
      text-align: left;
    }

    .subject-group {
      align-self: flex-start;
    }
  }
</style>
