<script lang="ts">
  import { classKey, DAY_EN, forSemigroup, hasSemigroups as splits, slug, type Class, type Program, type Timetable } from "./lib/timetable";
  import { toICS, weekOf } from "./lib/calendar";

  type Index = { sem: string; programs: Program[] };

  const KIND = { Curs: "lecture", Seminar: "seminar", Laborator: "lab" } as const;
  const LS = "ubb-schedule";

  let index = $state<Index | null>(null);
  let table = $state<Timetable | null>(null);
  let error = $state("");
  let query = $state("");
  let copied = $state(false);

  // Selection lives in the URL so links are shareable; the last one is remembered.
  // ?timetable=IE2 is the old link format, still floating around.
  const url = new URLSearchParams(location.search);
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(LS) ?? "{}"); } catch { return {}; }
  })();
  let code = $state<string>(url.get("p") ?? url.get("timetable") ?? saved.p ?? "");
  let group = $state<string>(url.get("g") ?? saved.g ?? "");
  let semigroup = $state<0 | 1 | 2>(Number(url.get("sg") ?? saved.sg ?? 0) as 0 | 1 | 2);
  let hidden = $state<Set<string>>(new Set((url.get("hide") ?? saved.hide ?? "").split(",").filter(Boolean)));

  fetch("/data/index.json")
    .then((r) => r.json())
    .then((d: Index) => {
      index = d;
      code = d.programs.find((p) => p.code.toLowerCase() === code.toLowerCase())?.code ?? "";
    })
    .catch(() => (error = "couldn't load the timetable list."));

  $effect(() => {
    if (!code || !index) return;
    const want = code;
    fetch(`/data/${want}.json`)
      .then((r) => r.json())
      .then((t: Timetable) => {
        if (want !== code) return;
        table = t;
        const names = Object.keys(t.groups);
        if (!t.groups[group]) group = names.length === 1 ? names[0] : "";
      })
      .catch(() => (error = `couldn't load ${want}.`));
  });

  $effect(() => {
    const q = new URLSearchParams();
    if (code) q.set("p", code);
    if (group) q.set("g", group);
    if (semigroup) q.set("sg", String(semigroup));
    if (hidden.size) q.set("hide", [...hidden].join(","));
    history.replaceState(null, "", q.size ? `?${q}` : location.pathname);
    try {
      localStorage.setItem(LS, JSON.stringify({ p: code, g: group, sg: semigroup, hide: [...hidden].join(",") }));
    } catch {}
  });

  const sem = $derived(index?.sem ?? "");
  const thisWeek = $derived(sem ? weekOf(sem) : null);
  const program = $derived(index?.programs.find((p) => p.code === code));
  const hasSemigroups = $derived(!!table && !!group && splits(table.groups[group] ?? [], group));
  const sg = $derived(hasSemigroups ? semigroup : 0);
  const classes = $derived(
    table && group
      ? forSemigroup(table.groups[group] ?? [], group, sg).toSorted((a, b) => a.day - b.day || a.start - b.start)
      : [],
  );
  const days = $derived(
    [0, 1, 2, 3, 4, 5].map((d) => ({ d, list: classes.filter((c) => c.day === d) })).filter((x) => x.list.length),
  );
  const chosen = $derived(classes.filter((c) => !hidden.has(classKey(c))));
  const label = $derived(`${code} ${group}${sg ? `/${sg}` : ""}`);

  const programs = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const rows = new Map<string, { level: string; name: string; ps: Program[] }>();
    for (const p of index?.programs ?? []) {
      if (q && !`${p.code} ${p.name}`.toLowerCase().includes(q)) continue;
      const k = `${p.level}|${p.name}`;
      if (!rows.has(k)) rows.set(k, { level: p.level, name: p.name, ps: [] });
      rows.get(k)!.ps.push(p);
    }
    return [...rows.values()];
  });

  const file = $derived(`cal/${code}/${slug(group)}${sg ? `-${sg}` : ""}.ics`);
  const httpsUrl = $derived(`${location.origin}/${file}`);
  const webcal = $derived(httpsUrl.replace(/^https?:/, "webcal:"));

  function pick(p: Program) {
    code = p.code;
    group = "";
    hidden = new Set();
    query = "";
  }

  function toggle(c: Class) {
    const k = classKey(c);
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    hidden = next;
  }

  function download() {
    const blob = new Blob([toICS(`UBB ${label}`, sem, chosen)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ubb-${label.replace(/[ /]/g, "-")}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
  }

  const hh = (h: number) => String(h).padStart(2, "0");
  const notThisWeek = (c: Class) => !!c.week && thisWeek !== null && thisWeek % 2 !== c.week % 2;
</script>

<main>
  <header>
    <h1><a href="/">ubb schedule</a></h1>
    <p class="dim">
      your ubb timetable in google calendar, apple calendar or outlook. stays in sync.
      {#if sem}
        <br />semester {sem.replace("-", " / ")} ·
        {#if thisWeek}week {thisWeek} ({thisWeek % 2 ? "odd" : "even"}){:else}no classes this week{/if}
      {/if}
    </p>
  </header>

  {#if error}<p class="err">{error}</p>{/if}

  {#if !program}
    <section>
      <h2>1. your program</h2>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="search" placeholder="search: IE, informatica, inteligenta, master..." bind:value={query} autocomplete="off" spellcheck="false" autofocus />
      {#if !index && !error}<p class="dim">loading...</p>{/if}
      {#each ["Licenta", "Master"] as level (level)}
        {@const rows = programs.filter((r) => r.level === level)}
        {#if rows.length}
          <h3>{level === "Licenta" ? "bachelor" : "master"}</h3>
          <ul class="programs">
            {#each rows as r (r.name)}
              <li>
                <span class="pname">{r.name}</span>
                <span class="years">
                  {#each r.ps as p (p.code)}
                    <button class="chip" onclick={() => pick(p)} title={p.code}>{p.year ? `year ${p.year}` : p.code}</button>
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      {/each}
      {#if index && !programs.length}<p class="dim">nothing matches "{query}".</p>{/if}
    </section>
  {:else}
    <section>
      <h2>1. program</h2>
      <p>
        <b>{program.code}</b> · {program.name}{program.year ? `, year ${program.year}` : ""}
        <button class="link" onclick={() => { code = ""; group = ""; table = null; }}>change</button>
      </p>
    </section>

    {#if table}
      <section>
        <h2>2. group</h2>
        <div class="row">
          {#each Object.keys(table.groups) as g (g)}
            <button class="chip" class:on={g === group} onclick={() => (group = g)}>{g}</button>
          {/each}
        </div>
        {#if group && hasSemigroups}
          <div class="row">
            <span class="dim">semigroup</span>
            {#each [1, 2, 0] as const as s (s)}
              <button class="chip" class:on={semigroup === s} onclick={() => (semigroup = s)}>{s ? `${group}/${s}` : "both"}</button>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if group && classes.length}
      <section>
        <h2>3. your week <span>· uncheck what you skip</span></h2>
        {#each days as { d, list } (d)}
          <h3>{DAY_EN[d].toLowerCase()}</h3>
          <ul class="week">
            {#each list as c, i (i)}
              <li class:off={hidden.has(classKey(c))} class:other={notThisWeek(c)}>
                <label>
                  <input type="checkbox" checked={!hidden.has(classKey(c))} onchange={() => toggle(c)} />
                  <span class="time">{hh(c.start)}-{hh(c.end)}</span>
                  <span class="what">
                    <span class="subj">{c.subject}</span>
                    <span class="dim">
                      {KIND[c.kind] ?? c.kind} · {c.room} · {c.teacher}{c.week ? ` · ${c.week === 1 ? "odd" : "even"} weeks only` : ""}{c.formation !== group ? ` · ${c.formation}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        {/each}
        {#if thisWeek}<p class="dim small">grey time = not happening this week.</p>{/if}
      </section>

      <section>
        <h2>4. add it</h2>
        <p>subscribe once. when the faculty changes the timetable, your calendar follows.</p>
        <div class="row">
          <a class="btn" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener">google calendar</a>
          <a class="btn" href={webcal}>apple calendar</a>
          <a class="btn" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(`UBB ${label}`)}`} target="_blank" rel="noopener">outlook</a>
          <button class="btn" onclick={copy}>{copied ? "copied" : "copy link"}</button>
        </div>
        {#if hidden.size}
          <p class="dim small">
            the subscription has every class of {group}{sg ? `/${sg}` : ""}. for only the {chosen.length} you kept, download the file below. a downloaded file is a one-time copy and won't update.
          </p>
        {/if}
        <div class="row">
          <button class="btn" onclick={download}>download .ics ({chosen.length} classes)</button>
        </div>
        <details>
          <summary>how it works</summary>
          <ul class="how">
            <li><b>google</b>: the button opens "add calendar" in google calendar on the web. it then shows up on your phone too. google re-checks subscriptions every 12-24h.</li>
            <li><b>apple</b>: on iphone or mac the link opens the subscribe dialog.</li>
            <li><b>.ics file</b>: google calendar → settings → import & export → import.</li>
            <li>christmas break and public holidays are left out. week 1 starts on the first teaching monday and odd/even weeks keep counting after the break, like the faculty does.</li>
            <li>timetable is re-read from the faculty site every day.</li>
          </ul>
        </details>
      </section>
    {:else if group && table}
      <p class="dim">no classes for {group}.</p>
    {/if}
  {/if}

  <footer class="dim">
    data: <a href={`https://www.cs.ubbcluj.ro/files/orar/${sem}/tabelar/index.html`}>cs.ubbcluj.ro</a>, refreshed daily ·
    <a href="https://github.com/cristicretu/ubb-google-cal">source</a> ·
    <a href="https://cristicretu.github.io/ubb">labs &amp; exams for every course</a> ·
    <a href="https://cn-exam-sand.vercel.app">networks exam practice</a>
  </footer>
</main>

<style>
  main { max-width: 760px; margin: 0 auto; padding: 40px 16px 64px; }
  header h1 { font-size: 14px; margin: 0 0 4px; }
  header h1 a { color: inherit; }
  h2 { font-size: 14px; font-weight: 400; color: var(--dim); margin: 32px 0 10px; }
  h3 { font-size: 13px; font-weight: 400; color: var(--dim); margin: 16px 0 4px; }
  p { margin: 0 0 10px; }
  .dim { color: var(--dim); }
  .small { font-size: 12px; }
  .err { color: var(--bad); }
  input[type="search"] {
    width: 100%; padding: 10px 0; font: inherit; color: inherit; background: transparent;
    border: 0; border-bottom: 1px solid var(--line); outline: 0; border-radius: 0;
  }
  input[type="search"]:focus { border-bottom-color: var(--fg); }
  ul { list-style: none; margin: 0; padding: 0; }
  .programs li {
    display: flex; gap: 12px; align-items: center; justify-content: space-between;
    padding: 6px 0; border-top: 1px solid var(--line); flex-wrap: wrap;
  }
  .pname { flex: 1; min-width: 220px; }
  .years, .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .row { margin: 8px 0; }
  button { font: inherit; color: inherit; cursor: pointer; }
  .chip, .btn {
    display: inline-flex; align-items: center; min-height: 36px; padding: 6px 10px;
    background: transparent; color: var(--fg); border: 1px solid var(--line); border-radius: 0; text-decoration: none;
  }
  .chip:hover, .btn:hover { border-color: var(--fg); text-decoration: none; }
  .chip.on { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .link { background: none; border: 0; color: var(--hi); padding: 0 0 0 8px; }
  .week li { border-top: 1px solid var(--line); }
  .week label { display: flex; gap: 12px; padding: 8px 0; cursor: pointer; align-items: baseline; }
  .week input { margin: 0; accent-color: var(--fg); }
  .time { flex: none; font-variant-numeric: tabular-nums; }
  .what { display: flex; flex-direction: column; min-width: 0; }
  .subj { overflow-wrap: anywhere; }
  .week li.other .time { color: var(--dim); }
  .week li.off .subj { text-decoration: line-through; color: var(--dim); }
  details { margin-top: 16px; }
  summary { cursor: pointer; color: var(--dim); }
  .how li { padding: 4px 0; }
  footer { margin-top: 48px; font-size: 12px; }
</style>
