# ubb schedule

Your UBB Cluj (Mate-Info) timetable in Google Calendar, Apple Calendar or Outlook.

**[ubb-schedule.vercel.app](https://ubb-schedule.vercel.app)**

Pick your program, group and semigroup, then subscribe. The calendar follows the faculty timetable: a GitHub Action re-reads [cs.ubbcluj.ro/files/orar](https://www.cs.ubbcluj.ro/files/orar/) every morning and commits only when something changed.

- every program on the faculty site, bachelor and master
- odd/even weeks counted like the faculty does: week 1 is the first teaching Monday, numbering continues after the Christmas break
- breaks and public holidays left out
- uncheck classes you don't attend and download a `.ics` with only the rest

## How it works

It's a static site. No server, no Google sign-in.

```
scripts/build-data.ts   scrape every timetable -> public/data/*.json + public/cal/<program>/<group>[-<semigroup>].ics
src/lib/timetable.ts    parser (pages are ISO-8859-2)
src/lib/calendar.ts     semester dates, week parity, .ics writer
src/App.svelte          the page
scripts/test.ts         calendar math + checks every generated .ics
```

Old links like `?timetable=IE3` still work.

## New semester

Add its dates to `SEMESTERS` in `src/lib/calendar.ts` from the faculty's [structura anului universitar](https://www.cs.ubbcluj.ro/invatamant/structura-anului-universitar/). Until you do, `pnpm data` refuses to run, so stale weeks never ship.

## Run it

```sh
pnpm i
pnpm data    # scrape
pnpm test
pnpm dev
```

MIT
