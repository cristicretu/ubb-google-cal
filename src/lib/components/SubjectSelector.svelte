<script lang="ts">
  import { selectedSubjects, schedule } from "../stores";
  import type { Subject } from "../types";

  let subjects: Subject[] = [];
  let uniqueSubjects = new Set<string>();

  // Subscribe to schedule changes
  schedule.subscribe((value) => {
    subjects = value;
    uniqueSubjects = new Set(value.map((s) => s.name));
  });

  function handleSubjectToggle(subject: string) {
    selectedSubjects.update((selected) => {
      const newSelected = new Set(selected);
      if (newSelected.has(subject)) {
        newSelected.delete(subject);
      } else {
        newSelected.add(subject);
      }
      return newSelected;
    });
  }

  function handleSelectAll() {
    selectedSubjects.set(new Set(uniqueSubjects));
  }

  function handleDeselectAll() {
    selectedSubjects.set(new Set());
  }
</script>

<div class="subject-selector">
  <div class="header">
    <h2>Select Subjects</h2>
    <div class="select-all-buttons">
      <button class="select-all" on:click={handleSelectAll}>
        Select All
      </button>
      <button class="deselect-all" on:click={handleDeselectAll}>
        Deselect All
      </button>
    </div>
  </div>
  <div class="subjects-list">
    {#each Array.from(uniqueSubjects) as subject}
      <label class="subject-item">
        <input
          type="checkbox"
          value={subject}
          on:change={() => handleSubjectToggle(subject)}
          checked={$selectedSubjects.has(subject)}
        />
        {subject}
      </label>
    {/each}
  </div>
</div>

<style>
  .subject-selector {
    margin: 2rem 0;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .select-all-buttons {
    display: flex;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    font-weight: bold;
    background-color: #f0f0f0;
  }

  button:hover {
    background-color: #e0e0e0;
  }

  .subjects-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .subject-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #eee;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .subject-item:hover {
    background-color: #f5f5f5;
  }

  h2 {
    margin: 0;
  }
</style>
