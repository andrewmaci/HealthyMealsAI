# HealthyMealsAI

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-22.14.0-green.svg)
![Astro](https://img.shields.io/badge/Astro-5.13.7-orange.svg)
![React](https://img.shields.io/badge/React-19.1.1-blue.svg)

An MVP web application that helps users adapt culinary recipes to their personal nutritional needs and dietary requirements. HealthyMealsAI enables users to create and manage text-based recipes, define dietary preferences and macro targets, and generate AI-assisted adaptations that align recipes with individual goals.

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

HealthyMealsAI streamlines the process of adapting online recipes to specific dietary needs by capturing user preferences and macro goals, then using AI to produce feasible adaptations that are as close as possible to targets, with transparent explanations and versioning for easy comparison and restoration.

### Target Users

- Athletes who need precise macro and calorie control
- Users with dietary constraints (allergens, intolerances, dislikes)
- Anyone looking to customize recipes to their nutritional goals

### Key Capabilities

- **Recipe Management**: Create, read, update, and delete text-based recipes with macro tracking
- **User Profiles**: Define dietary preferences including allergens, intolerances, dislikes, preferred cuisines, and macro/calorie targets
- **AI-Powered Adaptation**: Generate recipe adaptations against a single goal per run (reduce calories, increase protein, adjust macro ratio, remove allergens/dislikes)
- **Version Control**: Track recipe versions with restore capability, maintaining history of AI adaptations
- **Authentication**: Secure email/password authentication via Supabase
- **Analytics**: Track user behavior and key product metrics

### Problem Solved

Adapting online recipes to specific dietary needs is time-consuming and error-prone. Users must manually reconcile allergens/dislikes, macro targets, and calorie constraints—often resulting in compromises or repeated trial-and-error. HealthyMealsAI addresses:

- Difficulty removing allergens/disliked ingredients while maintaining palatability
- Effortful macro alignment (calories, protein, carbs, fat)
- Uncertainty about differences vs. the original recipe and why changes were made
- Lack of simple history/restore for iterative experimentation
- No central place to store personal recipes and preferences

## Tech Stack

### Frontend

- **[Astro 5](https://astro.build/)** - Fast, efficient static site generation with minimal JavaScript
- **[React 19](https://react.dev/)** - Interactive UI components where needed
- **[TypeScript 5](https://www.typescriptlang.org/)** - Static typing and enhanced IDE support
- **[Tailwind CSS 4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Shadcn/ui](https://ui.shadcn.com/)** - Accessible React component library

### Backend

- **[Supabase](https://supabase.com/)** - Comprehensive Backend-as-a-Service
  - PostgreSQL database
  - Built-in user authentication
  - Real-time subscriptions
  - Open-source with self-hosting capabilities

### AI Integration

- **[OpenRouter.ai](https://openrouter.ai/)** - AI model aggregation service
  - Access to multiple AI providers (OpenAI, Anthropic, Google, etc.)
  - Cost optimization through model selection
  - Built-in financial limits on API keys

### CI/CD and Hosting

- **GitHub Actions** - Continuous integration and deployment pipelines
- **DigitalOcean** - Application hosting via Docker containers

## Getting Started Locally

### Prerequisites

- **Node.js**: Version 22.14.0 (specified in `.nvmrc`)
- **npm**: Comes with Node.js
- **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
- **OpenRouter API Key**: Sign up at [openrouter.ai](https://openrouter.ai)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/HealthyMealsAI.git
   cd HealthyMealsAI
   ```

2. **Install Node.js (using nvm recommended)**

   ```bash
   nvm install
   nvm use
   ```

   Or manually install Node.js 22.14.0 from [nodejs.org](https://nodejs.org)

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Set up environment variables**

   Create a `.env` file in the project root:

   ```env
   # Supabase Configuration
   PUBLIC_SUPABASE_URL=your_supabase_project_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # OpenRouter AI Configuration
   OPENROUTER_API_KEY=your_openrouter_api_key

   # Application Configuration
   PUBLIC_APP_URL=http://localhost:4321
   ```

5. **Set up Supabase**

   - Create a new Supabase project
   - Run the database migrations (once available)
   - Configure authentication providers (email/password)
   - Copy your project URL and API keys to the `.env` file

6. **Start the development server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:4321`

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server with hot module replacement |
| `npm run build` | Build the application for production |
| `npm run preview` | Preview the production build locally |
| `npm run astro` | Run Astro CLI commands |
| `npm run lint` | Check code for linting errors |
| `npm run lint:fix` | Automatically fix linting errors where possible |
| `npm run format` | Format code using Prettier |

## Project Scope

### MVP Features (Included)

#### Authentication & Access Control
- Sign up, log in, and log out using Supabase email/password
- Protected routes for recipe management, adaptation, and preferences
- Secure session management with unauthorized user redirection

#### User Preferences & Targets
- Save allergens, intolerances, disliked ingredients, and preferred cuisines
- Define macro/calorie targets (treated as range goals ±10%)
- Keyword/synonym matching for allergens and dislikes
- Hard-block conflicts on save and AI proposals

#### Recipe Management (Text-only)
- Create, read, update, and delete recipes
- Required fields: title, servings, ingredients_text, steps_text, per-serving macros
- Operational limits: max 30 ingredients, 20 steps, 2,000 characters per step
- Basic validation for required fields and limits

#### AI Adaptation
- Select exactly one goal per adaptation run:
  - Reduce calories
  - Increase protein
  - Adjust macro ratio
  - Remove allergens/dislikes
- Limit of 10 AI adaptations per user per day
- Returns: adapted recipe, explanation of changes, before/after diff with macro deltas
- Closest feasible adaptation when targets cannot be fully met
- 30-second timeout with friendly error handling and exponential backoff

#### Version Control
- Auto-named versions: `v{n} · {goal} · {timestamp}`
- View latest 5 versions per recipe
- Restore any prior version without deleting others

#### Validation & Blocks
- Required per-serving macros with basic formatting and plausibility checks
- Hard-block allergen/dislike conflicts when saving or accepting adaptations
- Actionable error messages for validation failures

#### Analytics & KPI
- Instrumented events: `sign_up`, `prefs_completed`, `recipe_created`, `ai_suggested`, `ai_accepted`, `recipe_saved`
- Weekly KPI view/dashboard in Supabase
- Weekly "recipe generated" metric: `ai_accepted` OR `recipe_created` within 7 days

### Out of Scope for MVP

The following features are intentionally excluded from the initial MVP release:

- Importing recipes from URLs
- Rich media support (photos, videos)
- Sharing or social features
- Email verification and password complexity policies
- Advanced rate limiting
- Complex analytics dashboards and alerts
- Internationalization (i18n)
- Extensive accessibility specifications
- Complex cuisine taxonomies

## Project Status

**Current Status**: 🚧 Early Development / MVP Phase

This project is currently in active development as a Minimum Viable Product (MVP). Core features are being implemented according to the Product Requirements Document.

### Success Metrics

The following metrics will be tracked to measure product success:

- **Preferences Completion Rate**: Target 90% of signed-up users complete dietary preferences (`prefs_completed / sign_up`)
- **Weekly Recipe Generation**: Target 75% of users generate ≥1 recipe/week (`ai_accepted` OR `recipe_created` within 7-day window)
- **AI Adaptation Acceptance Rate**: Percentage of adaptation proposals accepted (`ai_accepted / ai_suggested`)
- **Reliability Indicators**: Proportion of requests within caps and under 30s timeout

### Non-Functional Requirements

- **Reliability**: Enforce operational caps and adaptation/day quota
- **Performance**: Adaptation timeout at 30 seconds
- **Usability**: Clear explanations, diffs, and restore affordances
- **Security**: Supabase authentication, protected routes, no exposed secrets in client
- **Accessibility/Responsiveness**: Baseline web standards (to be refined)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: This is an MVP (Minimum Viable Product) release. Features and functionality are subject to change based on user feedback and product requirements. For questions, issues, or contributions, please open an issue on GitHub.
