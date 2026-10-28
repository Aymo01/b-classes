#  B Classes 

B classes — Complete Multi-Stage Design System

Redesign the existing B classes educational platform using a professional, modern, responsive design system with three distinct color identities based on student age.

IMPORTANT: Inspect the existing project before making changes. Do not rebuild the project from scratch. Preserve all existing functionality, authentication, database schemas, APIs, subscriptions, user roles, routes, and educational content.

1. Shared Brand Identity

Create a unified design system shared across the entire platform.

Brand name: B classes

Language: Arabic, with full RTL support.

Layout: Responsive on mobile, tablet, and desktop.

Typography: Use a readable Arabic font such as Cairo or Tajawal, if compatible with the existing project.

Style: Modern educational SaaS platform, clean spacing, rounded cards, subtle shadows, polished icons, smooth transitions.

Keep navigation, logo placement, account controls, and core components consistent across all grade levels.

Use CSS variables and reusable components instead of duplicating entire pages.

2. Grades 1–4: Ocean Playful Theme

Create a cheerful, colorful, child-friendly experience inspired by the ocean.

Color tokens:

Primary: #247BA0

Secondary: #35C9D0

Accent yellow: #FFD166

Coral accent: #FF8C69

Page background: #EAFBFA

Card background: #FFFFFF

Main text: #173B57

Design requirements:

Rounded colorful learning cards.

Friendly educational illustrations and simple playful icons.

Interactive learning activities, games, quizzes, and achievement badges.

Clear progress indicators and positive feedback messages.

Use yellow and coral sparingly to highlight important actions.

Avoid excessive animations, clutter, and distracting backgrounds.

Ensure Arabic text is readable and buttons are easy for children to use.

3. Grades 5–10: Mint Green Modern Theme

Create a fresh, contemporary, youthful design that does not look childish.

Color tokens:

Primary: #245C46

Secondary: #52B788

Mint: #A8E6CF

Light green: #D8F3DC

Page background: #F5F8F5

Card background: #FFFFFF

Main text: #20352C

Design requirements:

Minimal, modern dashboard.

Organized subject and lesson cards.

Progress tracking, assignments, quizzes, study goals, and achievements.

Clear sections for recorded lessons, live sessions, and revision materials where supported.

Use green for primary actions and mint for subtle highlights.

Avoid childish illustrations and overly saturated colors.

4. First and Second Secondary: Black and Lilac Premium Theme

Create a sophisticated, focused academic experience with a premium visual identity.

Color tokens:

Primary background: #17171F

Secondary dark: #282538

Lilac accent: #B99AFF

Light lilac: #E6DAFF

Light page background: #F7F5FC

Main dark text: #302A40

White: #FFFFFF

Design requirements:

Use a dark, premium navigation and header style.

Use lilac for buttons, progress indicators, active states, and key highlights.

Keep content areas readable and visually organized.

Provide a professional layout for recorded lectures, revision sessions, assignments, quizzes, timetables, and academic progress.

Use restrained gradients only where they improve the design.

Avoid making every component dark; maintain readable contrast and comfortable study sessions.

Support both light and dark surfaces where appropriate. Ensure text and interactive elements remain accessible in every theme.

5. Dynamic Grade-Based Theme System

Implement three reusable theme configurations:

elementary: grades 1–4

middle: grades 5–10

secondary: first and second secondary

Apply the correct theme automatically based on the student's actual grade stored in the existing profile or grade-selection system.

Example CSS architecture:

:root {
--brand-primary: #247BA0;
--brand-accent: #35C9D0;
--brand-background: #EAFBFA;
--brand-surface: #FFFFFF;
--brand-text: #173B57;
}

[data-theme="elementary"] {
--brand-primary: #247BA0;
--brand-accent: #35C9D0;
--brand-highlight: #FFD166;
--brand-background: #EAFBFA;
--brand-surface: #FFFFFF;
--brand-text: #173B57;
}

[data-theme="middle"] {
--brand-primary: #245C46;
--brand-accent: #52B788;
--brand-highlight: #A8E6CF;
--brand-background: #F5F8F5;
--brand-surface: #FFFFFF;
--brand-text: #20352C;
}

[data-theme="secondary"] {
--brand-primary: #17171F;
--brand-accent: #B99AFF;
--brand-highlight: #E6DAFF;
--brand-background: #F7F5FC;
--brand-surface: #FFFFFF;
--brand-text: #302A40;
}

Adapt the example to the project's existing framework and styling architecture. Define additional tokens for borders, muted text, focus rings, hover states, and disabled controls.

Do not use these variables as a substitute for integrating the theme into the real application components.

6. Pages to Update

Apply the design system consistently to:

Main landing page.

Grade and stage selection page.

Student dashboard.

Subject and lesson pages.

Recorded and live class pages where available.

Quiz and assignment pages.

Student profile and progress.

Navigation menus, buttons, cards, forms, dialogs, and notifications.

The landing page should showcase all three educational stages with visually distinct cards and clear calls to action.

7. Accessibility and Quality

Maintain accessible color contrast, particularly for text on lilac, mint, yellow, and coral.

Do not use color alone to communicate errors, completion, or status.

Include clear hover, focus, loading, error, success, and disabled states.

Support keyboard navigation and reduced-motion preferences.

Avoid horizontal overflow on mobile.

Use consistent spacing and component sizing.

Keep performance and loading speed in mind.

8. Implementation Instructions

First inspect the current application structure and identify its framework, design system, routes, and existing grade logic.

Then implement the themes using the existing architecture. Reuse components wherever possible and make the theme selection depend on actual student grade data rather than a manually hardcoded demo.

Do not replace working pages with static mockups. Do not introduce fake lesson data or alter the database.

After implementation, verify all three themes, navigation, RTL alignment, responsive behavior, contrast, and existing functionality. Report which components were updated and any remaining issues.

Start with the shared design tokens, landing page, and grade-selection page, then apply the themes throughout the existing platform.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/78faadb9-c9d6-4b13-9ed0-5033a3ef836e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
