As a senior frontend developer, your task is to create a detailed implementation plan for a new view in a web application. This plan should be comprehensive and clear enough for another frontend developer to implement the view correctly and efficiently.

First, review the following information:

1. Product Requirements Document (PRD):
<prd>
@.ai/prd.md
</prd>

2. View Description:
<view_description>
Recipe Detail View
- View Path: `/recipes/:id`
- Main Purpose: To show the complete details of a single recipe and provide actions for management and adaptation.
- Key Information to Display:
  - Full recipe details: `title`, `servings`, all `macros`, and `recipeText`.
  - `lastAdaptationExplanation` if the recipe was previously adapted.
  - Remaining daily adaptation quota.
- Key View Components:
  - `RecipeDisplay`: Renders the formatted recipe details.
  - `AdaptationButton`: The "Adapt with AI" button, which shows the remaining quota and is disabled if quota is 0.
  - `AdaptationWizard`: The multi-step modal for the AI adaptation flow.
  - `AlertDialog`: For confirming recipe deletion.
  - `NotificationBox`: To display the `lastAdaptationExplanation`.
- UX, Accessibility, and Security Considerations:
  - UX: Tooltip on disabled `AdaptationButton` explains why it's disabled. `recipeText` should be formatted for readability.
  - Accessibility: Clear heading structure. Modals will trap focus.
  - Security: Protected route. Handle 404 when recipe not found or not owned by the user.
</view_description>

3. User Stories:
<user_stories>
US-022
Title: View recipe detail
Description: As a user, I want to view a recipe’s full text and macros.
Acceptance Criteria:
- When I open a recipe, then I can read recipe_text and see per-serving macros and servings.
US-024
Title: Delete recipe with confirmation
Description: As a user, I want to delete a recipe only after confirming to avoid accidental loss.
Acceptance Criteria:
- When I click delete, then I see a confirmation; confirming deletes the recipe; canceling aborts.
US-033
Title: Daily quota display and enforcement
Description: As a user, I want to see and respect my remaining daily adaptations.
Acceptance Criteria:
- Remaining adaptations are displayed; when 0, the Adapt with AI action is disabled with a tooltip.
- Quota decrements only on successful AI responses (ai_succeeded), resets at user-local midnight.

US-034
Title: Handle successful AI response
Description: As a user, I want to review the AI’s proposed recipe and macros before saving.
Acceptance Criteria:
- The modal shows proposed recipe_text, proposed macros, and explanation; the Original recipe panel is collapsible.
- Event ai_succeeded is emitted when a valid JSON response is received.

US-035
Title: Manually override proposed macros
Description: As a user, I want to adjust macros before saving.
Acceptance Criteria:
- I can edit macros; validation enforces non-negative numbers; invalid entries block saving with messages.

US-036
Title: Accept adaptation with overwrite confirmation
Description: As a user, I want to confirm acceptance and overwrite my recipe.
Acceptance Criteria:
- When I click Accept, then a confirmation dialog appears; confirming overwrites the recipe; event ai_accepted is emitted; canceling closes the dialog without changes.

US-037
Title: Decline or cancel adaptation
Description: As a user, I want to exit without changes if I am not satisfied.
Acceptance Criteria:
- Closing the modal or selecting decline leaves the recipe unchanged and does not decrement quota.

US-038
Title: Handle errors and timeouts
Description: As a user, I want clear guidance on errors and the ability to retry.
Acceptance Criteria:
- On AI error/timeout/invalid schema, then I see an error state with retry guidance; failed attempts do not decrement quota.

US-039
Title: Validate AI response schema
Description: As a system, I must accept only valid AI JSON responses.
Acceptance Criteria:
- Responses not matching { recipe_text, macros: { kcal, protein, carbs, fat }, explanation } are rejected with an error message and logged; no quota decrement.
US-060
Title: Display safety disclaimers
Description: As a user, I want safety notices so that I understand limitations.
Acceptance Criteria:
- The adaptation modal shows a persistent notice; the results view includes a footer notice.

US-061
Title: Prevent duplicate submissions
Description: As a user, I want the app to prevent accidental duplicate adaptation requests.
Acceptance Criteria:
- While a request is in-flight, the submit button is disabled and duplicate requests are ignored.

US-062
Title: Overwrite without versioning
Description: As a user, I understand that acceptance overwrites the recipe and cannot be undone.
Acceptance Criteria:
- After accepting, the previous version is not retained; no rollback or history is available.
US-050
Title: Emit analytics events
Description: As a product team, we want key events emitted for measurement.
Acceptance Criteria:
- Events profile_updated, recipe_created, ai_requested, ai_succeeded, ai_accepted are emitted with UTC timestamp and user timezone; failures are logged.
</user_stories>

4. Endpoint Description:
<endpoint_description>
GET /api/recipes/{id}
- Retrieve a specific recipe owned by the user. Success: 200; Errors: 401, 404, 500.

DELETE /api/recipes/{id}
- Permanently delete recipe. Success: 204; Errors: 401, 404, 409, 500.

GET /api/adaptations/quota
- Return remaining daily adaptation quota. Success: 200; Errors: 401, 500.

POST /api/recipes/{id}/adaptations
- Initiate AI adaptation; enforces daily quota; returns proposal. Success: 200/202; Errors: 400, 401, 403, 409, 422, 429, 500.

POST /api/recipes/{id}/adaptations/accept
- Persist accepted adaptation by overwriting recipe content/macros and storing explanation. Success: 200; Errors: 400, 401, 404, 409, 422, 500.

Optional: GET /api/recipes/{id}/adaptations
- Fetch paginated adaptation history. Success: 200; Errors: 401, 404, 500.
</endpoint_description>

5. Endpoint Implementation:
<endpoint_implementation>
@.ai/enpoint-plans/GET-recipe-implementation-plan.md
@.ai/enpoint-plans/DELETE-recipe-implementation-plan.md
@.ai/enpoint-plans/GET-adaptations-quota-implementation-plan.md
@.ai/enpoint-plans/POST-recipe-adaptations-implementation-plan.md
@.ai/enpoint-plans/POST-recipe-adaptations-accept-implementation-plan.md
@.ai/enpoint-plans/GET-recipe-adaptations-implementation-plan.md
</endpoint_implementation>

6. Type Definitions:
<type_definitions>
@src/types.ts
</type_definitions>

7. Tech Stack:
<tech_stack>
@.ai/tech-stack.md
</tech_stack>

Before creating the final implementation plan, conduct analysis and planning inside <implementation_breakdown> tags in your thinking block. This section can be quite long, as it's important to be thorough.

In your implementation breakdown, execute the following steps:
1. For each input section (PRD, User Stories, Endpoint Description, Endpoint Implementation, Type Definitions, Tech Stack):
  - Summarize key points
 - List any requirements or constraints
 - Note any potential challenges or important issues
2. Extract and list key requirements from the PRD
3. List all needed main components, along with a brief description of their purpose, needed types, handled events, and validation conditions
4. Create a high-level component tree diagram
5. Identify required DTOs and custom ViewModel types for each view component. Explain these new types in detail, breaking down their fields and associated types.
6. Identify potential state variables and custom hooks, explaining their purpose and how they'll be used
7. List required API calls and corresponding frontend actions
8. Map each user story to specific implementation details, components, or functions
9. List user interactions and their expected outcomes
10. List conditions required by the API and how to verify them at the component level
11. Identify potential error scenarios and suggest how to handle them
12. List potential challenges related to implementing this view and suggest possible solutions

After conducting the analysis, provide an implementation plan in Markdown format with the following sections:

1. Overview: Brief summary of the view and its purpose.
2. View Routing: Specify the path where the view should be accessible.
3. Component Structure: Outline of main components and their hierarchy.
4. Component Details: For each component, describe:
 - Component description, its purpose and what it consists of
 - Main HTML elements and child components that build the component
 - Handled events
 - Validation conditions (detailed conditions, according to API)
 - Types (DTO and ViewModel) required by the component
 - Props that the component accepts from parent (component interface)
5. Types: Detailed description of types required for view implementation, including exact breakdown of any new types or view models by fields and types.
6. State Management: Detailed description of how state is managed in the view, specifying whether a custom hook is required.
7. API Integration: Explanation of how to integrate with the provided endpoint. Precisely indicate request and response types.
8. User Interactions: Detailed description of user interactions and how to handle them.
9. Conditions and Validation: Describe what conditions are verified by the interface, which components they concern, and how they affect the interface state
10. Error Handling: Description of how to handle potential errors or edge cases.
11. Implementation Steps: Step-by-step guide for implementing the view.

Ensure your plan is consistent with the PRD, user stories, and includes the provided tech stack.

The final output should be in English and saved in a file named `.ai/recipe-detail-view-implementation-plan.md`. Do not include any analysis and planning in the final output.

Here's an example of what the output file should look like (content is to be replaced):

```markdown
# View Implementation Plan [View Name]

## 1. Overview
[Brief description of the view and its purpose]

## 2. View Routing
[Path where the view should be accessible]

## 3. Component Structure
[Outline of main components and their hierarchy]

## 4. Component Details
### [Component Name 1]
- Component description [description]
- Main elements: [description]
- Handled interactions: [list]
- Handled validation: [list, detailed]
- Types: [list]
- Props: [list]

### [Component Name 2]
...

## 5. Types
[Detailed description of required types]

## 6. State Management
[Description of state management in the view]

## 7. API Integration
[Explanation of integration with provided endpoint, indication of request and response types]

## 8. User Interactions
[Detailed description of user interactions]

## 9. Conditions and Validation
[Detailed description of conditions and their validation]

## 10. Error Handling
[Description of handling potential errors]

## 11. Implementation Steps
1. [Step 1]
2. [Step 2]
3. [...]
```


