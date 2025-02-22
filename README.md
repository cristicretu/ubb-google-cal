# UBB Schedule Manager

A Svelte application that helps UBB students manage their class schedule by integrating with Google Calendar.

## Features

- Select your student group
- Choose which subjects to add to your calendar
- Automatically creates recurring calendar events
- Handles bi-weekly (odd/even week) schedules
- Easy Google Calendar integration

## Prerequisites

Before you can use this application, you'll need:

1. Node.js (v14 or higher)
2. A Google Cloud Platform account
3. A Google Calendar API key and Client ID

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd ubb-schedule-manager
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a Google Cloud Platform project and enable the Google Calendar API:
   - Go to the [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Enable the Google Calendar API
   - Create OAuth 2.0 credentials (Client ID and API Key)
   - Add your domain to the authorized JavaScript origins

4. Configure the application:
   - Open `src/lib/components/GoogleCalendar.svelte`
   - Replace the empty CLIENT_ID and API_KEY constants with your credentials:
   ```typescript
   const CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
   const API_KEY = 'your-api-key';
   ```

5. Start the development server:
```bash
pnpm dev
```

## Usage

1. Open the application in your browser
2. Select your group from the dropdown menu
3. Choose which subjects you want to add to your calendar
4. Click "Sign in with Google" to authenticate
5. Click "Add Selected Subjects to Calendar" to create the events

## Development

The application is built with:
- Svelte
- TypeScript
- Google Calendar API

Key files:
- `src/App.svelte` - Main application component
- `src/lib/components/` - UI components
- `src/lib/stores.ts` - Svelte stores and schedule data
- `src/lib/types.ts` - TypeScript interfaces

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
