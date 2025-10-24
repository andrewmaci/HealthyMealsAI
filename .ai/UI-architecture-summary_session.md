<conversation_summary>
<decisions>
Authentication UI: Use the supabase-auth-ui library, but configured for email and password authentication only, excluding social providers for the MVP.
State Management: A simple, lightweight approach using React Context and Hooks will be used for global state management (e.g., user session, profile). Caching libraries like TanStack Query will be avoided for now to prioritize simplicity.
Navigation: A persistent header component will be present in all authenticated views, providing links to "My Recipes," "Profile," and a user menu with a "Sign Out" option.
Profile Form: The UI for managing allergens and disliked ingredients will use a tag-based input field for a better user experience.
Recipe List Page: This view will include a search bar, a button to open a filter modal/drawer, sorting controls, and pagination at the bottom.
Adaptation Flow: A multi-step "wizard" modal will guide the user through selecting a goal, reviewing the AI-generated proposal side-by-side with the original, and accepting the changes.
Error Handling: A combination of non-intrusive toast notifications for general API errors and inline error messages for form field validation will be implemented.
Loading States: Simple loading indicators will be used: skeleton loaders for initial page/component rendering and inline spinners within buttons for user-initiated actions.
Confirmation Dialogs: Critical actions like deleting a recipe or accepting an adaptation will be protected by a modal AlertDialog to prevent accidental user actions.
Quota Display: The remaining daily adaptation quota will be displayed next to the "Adapt with AI" button, which will be disabled with an informative tooltip when the quota is zero.
Security: Client-side route guards will protect authenticated routes, redirecting unauthorized users to the login page.
Responsiveness: The application will follow a mobile-first design approach, using vertical stacking and tabbed interfaces on smaller screens for complex views.
Accessibility: High priority will be given to accessibility, ensuring all form inputs have labels, keyboard focus is managed in modals, and ARIA live regions are used for dynamic announcements.
</decisions>
<matched_recommendations>
Implement a persistent header with clear navigation links ("My Recipes", "Profile") and a user avatar menu for sign-out.
Utilize a client-side state management solution with React Context and Hooks for global state like user session and profile data.
Employ a dual strategy for error handling: toast notifications for general errors and inline messages for form-specific validation.
Implement client-side route guards to protect authenticated views and automatically redirect unauthenticated users to a login page.
Design the "Adapt with AI" flow as a multi-step "wizard" modal to guide the user from goal selection to proposal review and acceptance.
Use a tag-based input component for managing lists of allergens and disliked ingredients on the profile page.
For recipes that have been adapted, display the lastAdaptationExplanation in a distinct notification box to inform the user.
Use modal AlertDialog components for critical confirmation steps like deleting a recipe or accepting an AI adaptation to prevent accidental actions.
Encapsulate API logic and the firing of related analytics events within custom React hooks to improve maintainability.
On the recipe detail page, display the remaining adaptation quota next to the "Adapt with AI" button, disabling it and adding a tooltip when the quota is exhausted.
</matched_recommendations>
<ui_architecture_planning_summary>
The UI architecture for the HealthyMealsAI MVP will be built on a foundation of simplicity, accessibility, and a mobile-first responsive design. The structure is designed to directly support the user stories and API endpoints defined in the project documentation.
Key Views and User Flows:
Authentication: Handled via supabase-auth-ui for simple email/password login and registration flows.
Main Layout: An AppLayout component will contain a persistent header for consistent navigation across authenticated sections.
Recipe Management: A RecipeList view will display user recipes with support for searching, filtering, and sorting. Users can navigate to a RecipeDetail view or a RecipeForm for creating and editing.
Profile Management: A ProfileForm will allow users to manage their allergens, disliked ingredients, and timezone settings.
AI Adaptation: This core flow will be managed within a multi-step AdaptationWizard modal, which handles goal selection, loading states, proposal comparison, and acceptance, interacting with the /api/recipes/{id}/adaptations endpoints.
API Integration and State Management:
The application will forgo complex caching libraries in favor of a simpler state management strategy using React Context and custom Hooks.
Custom hooks will encapsulate API fetch logic (e.g., useCreateRecipe, useFetchProfile) and will be responsible for triggering corresponding analytics events upon success. This co-locates related logic and ensures consistency.
Responsiveness, Accessibility, and Security:
Responsiveness: A mobile-first approach will ensure usability on all screen sizes, with layouts adapting via vertical stacking and tabbed interfaces where necessary.
Accessibility: A strong focus on a11y includes proper form labeling, keyboard focus management in modals, and the use of ARIA live regions to announce dynamic UI changes to screen readers.
Security: The UI will enforce authorization through client-side route guards that check for an active session. A 401 Unauthorized response from any API call will trigger a redirect to the login page. Critical destructive actions are protected by confirmation modals.
</ui_architecture_planning_summary>
<unresolved_issues>
There are no major unresolved issues. The planning phase has established a clear and agreed-upon direction for the UI architecture. Decisions were made to consciously defer certain complexities, such as advanced empty states (beyond the recipe list) and client-side caching, to align with the MVP's goal of simplicity and rapid development.
</unresolved_issues>
</conversation_summary>