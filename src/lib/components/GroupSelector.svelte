<script lang="ts">
  import type { Group } from "../types";
  import { selectedGroup, groups } from "../stores";

  let groupsList: Group[] = [];

  // Subscribe to groups store
  groups.subscribe((value) => {
    groupsList = value;
  });

  function handleGroupChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedGroup.set(select.value);
  }
</script>

<div class="group-selector">
  <label for="group">Select Group:</label>
  <select id="group" on:change={handleGroupChange} value={$selectedGroup}>
    <option value="">Choose a group</option>
    {#each groupsList as group}
      <option value={group.id}>{group.name}</option>
    {/each}
  </select>
</div>

<style>
  .group-selector {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }

  select:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
</style>
