# Transitioning to a Cross-Platform Web & Mobile Architecture

To support both Web and Mobile (iOS/Android) using your existing React codebase, the recommended path is moving to a **Shared Logic Monorepo**. This allows you to write your database queries, authentication, and business logic once and use them in both your current Web app and a new React Native app.

## Proposed Strategy: Monorepo with Shared Core

We will transform the project into a structure like this:
- `/packages/shared`: (Types, Supabase Client, Auth/Data Services)
- `/apps/web`: (Your existing React + Tailwind project)
- `/apps/mobile`: (New React Native + Expo project)

---

## User Review Required

> [!IMPORTANT]
> **React vs React Native UI**: React uses HTML elements (`<div>`, `<span>`), while React Native uses native components (`<View>`, `<Text>`). You cannot simply copy-paste your UI code. You must rewrite the "View" layer while sharing the "Logic" layer.

> [!TIP]
> **Expo**: I recommend using **Expo** for the mobile app. It's the most modern way to build React Native apps, offering easier setup, over-the-air updates, and excellent developer tools.

---

## Proposed Roadmap

### Phase 1: Logic Extraction (The "Shared" Package)
The biggest task is moving logic out of `App.tsx` into standalone services.
- **Types**: Move all interfaces from `src/sms/types.ts` to a shared location.
- **Supabase**: Centralize the client and all data-fetching functions (e.g., `fetchStudents`, `saveAttendance`) so both platforms can import them.
- **Auth**: Ensure `authService.ts` is platform-agnostic.

### Phase 2: Monorepo Infrastructure
- Initialize **Turborepo** or **NX** to manage the workspace.
- Configure build tools to allow `apps/web` and `apps/mobile` to import from `packages/shared`.

### Phase 3: Mobile App Development (Expo)
- Initialize a new Expo project.
- Implement the "Mobile First" navigation (using `react-navigation` or `expo-router`).
- Recreate screens using React Native primitives (`View`, `Text`, `FlatList`) while calling the shared Supabase services.

---

## Open Questions

1. **Styling Preference**: Your current web app uses specific CSS/Tailwind patterns. For mobile, would you like to use **NativeWind** (Tailwind for React Native) to keep styling consistency across platforms?
2. **Offline Requirements**: Do you need the mobile app to work offline (e.g., taking attendance in areas without Wi-Fi and syncing later)? This would require adding a local database like SQLite or WatermelonDB to the shared package.
3. **Deployment**: Are you prepared to manage Apple App Store and Google Play Store accounts, or is this primarily for internal/sideloading use?

---

## Verification Plan

### Technical Validation
- Ensure `packages/shared` builds successfully as a standalone TypeScript package.
- Verify that a simple "Sign In" flow works on both the browser (Web) and an iOS/Android Simulator (Mobile) using the same code from `packages/shared`.

### Manual Testing
- Deploy a "Staging" web branch and an "Expo Go" preview link to test side-by-side.
