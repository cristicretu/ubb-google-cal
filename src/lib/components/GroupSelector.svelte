<script lang="ts">
  import { selectedGroup } from "../stores";
  import { groups } from "../stores";

  function handleGroupChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedGroup.set(select.value);
  }
</script>

<div class="group-selector">
  <label for="group-select">Select your group:</label>
  <select id="group-select" on:change={handleGroupChange} class="select">
    <option value="">Choose a group</option>
    {#each groups as group}
      <option value={group.id}>
        {group.name}
      </option>
    {/each}
  </select>
</div>

<style>
  .group-selector {
    margin: 1rem 0;
  }

  .select {
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #ccc;
    width: 200px;
    margin-left: 1rem;
  }

  label {
    font-weight: bold;
  }
</style>
