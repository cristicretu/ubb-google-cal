<script lang="ts">
  import GroupSelector from "./lib/components/GroupSelector.svelte";
  import SubjectSelector from "./lib/components/SubjectSelector.svelte";
  import GoogleCalendar from "./lib/components/GoogleCalendar.svelte";
  import { selectedGroup, schedule, groups } from "./lib/stores";
  import { fetchGroups, fetchSchedule } from "./lib/services/schedule";
  import { onMount } from "svelte";

  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      // Get the timetable code from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const timetableCode = urlParams.get("timetable");

      if (!timetableCode) {
        error =
          "Please provide a timetable code in the URL (e.g., ?timetable=IE2)";
        return;
      }

      const code = timetableCode.toUpperCase();

      // Initialize schedule and groups
      const [fetchedGroups, fetchedSchedule] = await Promise.all([
        fetchGroups(code),
        fetchSchedule(code),
      ]);

      if (fetchedGroups.length === 0 || fetchedSchedule.length === 0) {
        error = `No schedule found for ${code}`;
        return;
      }

      // Initialize stores
      groups.set(fetchedGroups);
      schedule.set(fetchedSchedule);

      // If there's only one group, select it automatically
      if (fetchedGroups.length === 1) {
        selectedGroup.set(fetchedGroups[0].id);
      }
    } catch (e) {
      console.error(e);
      error =
        e instanceof Error
          ? e.message
          : "Failed to load schedule. Please try again later.";
    } finally {
      loading = false;
    }
  });
</script>

<main>
  <h1>UBB Schedule Manager</h1>

  <div class="container">
    {#if loading}
      <div class="loading">Loading schedule...</div>
    {:else if error}
      <div class="error">{error}</div>
    {:else}
      <GroupSelector />

      {#if $selectedGroup}
        <SubjectSelector />
        <GoogleCalendar />
      {/if}
    {/if}
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    background-color: #f5f5f5;
  }

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    color: #333;
    text-align: center;
    margin-bottom: 2rem;
  }

  .container {
    background-color: white;
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
  }

  .error {
    text-align: center;
    padding: 2rem;
    color: #dc3545;
    font-weight: bold;
  }
</style>
