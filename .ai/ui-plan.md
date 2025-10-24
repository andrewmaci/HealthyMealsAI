# UI Architecture for HealthyMealsAI

## 1. UI Structure Overview

The UI architecture for HealthyMealsAI is designed as a single-page application (SPA) to provide a fluid and responsive user experience. It follows a component-based model, enabling reusability and maintainability. The structure is centered around a set of distinct views that map directly to the application's core functionalities as defined in the PRD and supported by the API plan.

Unauthenticated users are directed to dedicated views for signing in or creating an account. Once authenticated, users are presented with a main application layout featuring a persistent header for consistent navigation. Client-side routing manages transitions between views, while a global state management system (using React Context and Hooks) handles the user session, profile data, and other shared states.

The architecture prioritizes security through client-side route guards, UX through clear, multi-step workflows for complex tasks like AI adaptation, and accessibility by adhering to best practices for forms, modals, and dynamic content.

## 2. View List

### 1. Sign In View
- **View Path:** `/login`
- **Main Purpose:** To allow existing users to authenticate and access their account.
- **Key Information to Display:** Email and password input fields, a "Sign In" button, and a link to the Sign Up view.
- **Key View Components:**
  - `AuthForm`: A component leveraging `supabase-auth-ui` for the form interface.
- **UX, Accessibility, and Security Considerations:**
  - **UX:** Clear error messages for invalid credentials.
  - **Accessibility:** All form fields will have associated labels and support keyboard navigation.
  - **Security:** The view is for unauthenticated users only. Successful login redirects to the Recipe List view.

### 2. Sign Up View
- **View Path:** `/signup`
- **Main Purpose:** To allow new users to create an account.
- **Key Information to Display:** Email and password input fields, a "Sign Up" button, and a link to the Sign In view.
- **Key View Components:**
  - `AuthForm`: A component leveraging `supabase-auth-ui`.
- **UX, Accessibility, and Security Considerations:**
  - **UX:** Inline validation for password strength and email format.
  - **Accessibility:** Proper labeling for all inputs.
  - **Security:** The view is for unauthenticated users only. Successful sign-up logs the user in and redirects to the Recipe List view.

### 3. Recipe List View (Dashboard)
- **View Path:** `/recipes` (or `/` for authenticated users)
- **Main Purpose:** To display a paginated list of the user's recipes and serve as the main entry point to the app.
- **Key Information to Display:**
  - A list of recipe cards, each showing title and key macros.
  - Pagination controls (page number, next/previous buttons).
  - An empty state message with a "Create Recipe" call-to-action if the user has no recipes.
- **Key View Components:**
  - `SearchBar`: To filter recipes by title or content.
  - `FilterButton`: Opens a modal for advanced filtering by macro ranges.
  - `SortControls`: Dropdown to sort recipes by creation date, update date, or title.
  - `RecipeCard`: A summary component for a single recipe in the list.
  - `Pagination`: Navigates through pages of recipes.
  - `EmptyState`: Component displayed when no recipes match the criteria.
- **UX, Accessibility, and Security Considerations:**
  - **UX:** Skeleton loaders indicate when recipes are being fetched. The search and filter state should be reflected in the UI.
  - **Accessibility:** The list is navigable via keyboard, and pagination controls have ARIA labels.
  - **Security:** This is a protected route. API calls are scoped to the authenticated user via RLS.

### 4. Recipe Detail View
- **View Path:** `/recipes/:id`
- **Main Purpose:** To show the complete details of a single recipe and provide actions for management and adaptation.
- **Key Information to Display:**
  - Full recipe details: `title`, `servings`, all `macros`, and `recipeText`.
  - `lastAdaptationExplanation` if the recipe was previously adapted.
  - Remaining daily adaptation quota.
- **Key View Components:**
  - `RecipeDisplay`: Renders the formatted recipe details.
  - `AdaptationButton`: The "Adapt with AI" button, which shows the remaining quota and is disabled if quota is 0.
  - `AdaptationWizard`: The multi-step modal for the AI adaptation flow.
  - `AlertDialog`: For confirming recipe deletion.
  - `NotificationBox`: To display the `lastAdaptationExplanation`.
- **UX, Accessibility, and Security Considerations:**
  - **UX:** A tooltip on the disabled `AdaptationButton` explains why it's disabled (quota exhausted). The `recipeText` should be formatted for readability.
  - **Accessibility:** The view has a clear heading structure. Modals will trap focus.
  - **Security:** This is a protected route. The view must handle cases where the recipe is not found or does not belong to the user (404).

### 5. Recipe Form View (Create/Edit)
- **View Path:** `/recipes/new`, `/recipes/:id/edit`
- **Main Purpose:** To allow users to create a new recipe or update an existing one.
- **Key Information to Display:** A form with input fields for all recipe properties.
- **Key View Components:**
  - `RecipeForm`: A comprehensive form with fields for `title`, `servings`, `macros` (kcal, protein, carbs, fat), and `recipeText`.
  - `CharacterCounter`: Live counter for the `recipeText` field.
  - `InlineError`: Displays validation messages next to invalid fields.
- **UX, Accessibility, and Security Considerations:**
  - **UX:** Inline validation provides immediate feedback. The submit button should show a loading state on submission.
  - **Accessibility:** All form fields have labels. Error messages are associated with their inputs using `aria-describedby`.
  - **Security:** This is a protected route. Input is validated on the client and server to prevent invalid data submission.

### 6. Profile Settings View
- **View Path:** `/profile`
- **Main Purpose:** To allow users to manage their dietary preferences and timezone.
- **Key Information to Display:**
  - Current lists of allergens and disliked ingredients.
  - The user's selected timezone.
  - A non-blocking prompt to complete the profile if preferences are empty.
- **Key View Components:**
  - `ProfileForm`: A form containing the preference fields.
  - `TagInput`: A custom component for adding and removing allergens and disliked ingredients.
  - `TimezoneSelect`: A dropdown populated with IANA timezone identifiers.
- **UX, Accessibility, and Security Considerations:**
  - **UX:** Using a tag-based input is more user-friendly for list management than a simple text area. A toast notification confirms successful profile updates.
  - **Accessibility:** All form elements are labeled and keyboard-accessible.
  - **Security:** This is a protected route.

## 3. User Journey Map

The user journey is designed to be intuitive, guiding users from authentication to the core features of recipe management and AI adaptation.

1.  **Onboarding & First Entry:**
    - A new user lands on the `/signup` page, creates an account, and is automatically logged in.
    - A returning user visits `/login` and signs in.
    - Upon successful authentication, the user is redirected to the **Recipe List View** (`/recipes`).
    - If the user has no recipes, they see an empty state with a "Create Recipe" button.

2.  **Core Use Case: Recipe Creation and Adaptation:**
    - From the **Recipe List View**, the user clicks "Create Recipe," which navigates them to the **Recipe Form View** (`/recipes/new`).
    - The user fills out the recipe details and saves it. On success, they are redirected to the new recipe's **Recipe Detail View** (`/recipes/:id`).
    - On the **Recipe Detail View**, the user clicks the "Adapt with AI" button.
    - The **Adaptation Wizard** modal opens:
      - **Step 1:** The user selects one of the four adaptation goals and optionally adds notes.
      - **Step 2:** After submitting, a loading state is shown. On a successful response from the AI, the view transitions to a side-by-side comparison of the original and proposed `recipeText` and `macros`, along with the AI's `explanation`.
      - **Step 3:** The user can manually edit the proposed macros.
      - **Step 4:** The user clicks "Accept." An `AlertDialog` appears to confirm the overwrite action.
    - Upon confirmation, the original recipe is updated. The modal closes, and the **Recipe Detail View** refreshes to show the new recipe content and the `lastAdaptationExplanation`.

3.  **Profile Management:**
    - The user clicks on their profile icon in the navigation header and selects "Profile."
    - They are taken to the **Profile Settings View** (`/profile`).
    - Here, they can add/remove allergens and disliked ingredients and update their timezone.
    - Saving the form updates their profile, and a success toast appears. This information will be used in future adaptation requests.

4.  **Sign Out:**
    - The user clicks their profile icon in the header and selects "Sign Out."
    - Their session is terminated, and they are redirected to the **Sign In View** (`/login`).

## 4. Layout and Navigation Structure

The application uses a main layout for all authenticated views to provide consistent navigation and structure.

- **Public Layout:** A minimal layout used for the `Sign In` and `Sign Up` views, with no global navigation.
- **Main App Layout (Authenticated):**
  - **Persistent Header:** Contains the application logo, primary navigation links, and a user menu.
    - **Navigation Links:**
      - **"My Recipes":** A link to the **Recipe List View** (`/recipes`).
    - **User Menu:** An avatar dropdown that contains:
      - **"Profile":** A link to the **Profile Settings View** (`/profile`).
      - **"Sign Out":** A button to log the user out.
  - **Main Content Area:** A central region where the active view component is rendered.
  - **Global Notifications:** A container for toast notifications that appear for events like API errors or successful updates.

This structure ensures that users can easily access the main sections of the application from anywhere once they are logged in.

## 5. Key Components

These are reusable components that form the building blocks of the UI, ensuring consistency and promoting maintainability.

- **`AuthForm`:** A wrapper around `supabase-auth-ui` configured for email/password authentication, used in both the Sign In and Sign Up views.
- **`RecipeCard`:** A component used in the Recipe List view to display a summary of a recipe, including its title and key macros. It acts as a link to the Recipe Detail view.
- **`AdaptationWizard`:** A multi-step modal component that encapsulates the entire AI adaptation flow, from goal selection to proposal review and acceptance. It manages its own internal state for each step.
- **`AlertDialog`:** A modal dialog used to get user confirmation for critical, destructive actions like deleting a recipe or overwriting one with an AI adaptation.
- **`TagInput`:** A custom form control for the Profile Settings view that allows users to easily add and remove items from a list (e.g., allergens, disliked ingredients).
- **`CharacterCounter`:** A small utility component that displays the remaining characters allowed for a text input, used for `recipeText` and adaptation `notes`.
- **`ToastNotification`:** A non-intrusive notification element used to display global messages, such as API errors or success confirmations.
- **`SkeletonLoader`:** A component used to indicate loading states for content-heavy areas like the Recipe List, improving the perceived performance.
