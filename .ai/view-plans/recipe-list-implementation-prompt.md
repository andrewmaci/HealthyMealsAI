As a senior frontend developer, your task is to create a detailed implementation plan for a new view in a web application. This plan should be comprehensive and clear enough for another frontend developer to implement the view correctly and efficiently.

First, review the following information:

1. Product Requirements Document (PRD):
<prd>
@.ai/prd.md
</prd>

2. View Description:
<view_description>
Recipe List View (Dashboard)
- View Path: `/recipes` (or `/` for authenticated users)
- Main Purpose: To display a paginated list of the user's recipes and serve as the main entry point to the app.
- Key Information to Display:
  - A list of recipe cards, each showing title and key macros.
  - Pagination controls (page number, next/previous buttons).
  - An empty state message with a "Create Recipe" call-to-action if the user has no recipes.
- Key View Components:
  - `SearchBar`: To filter recipes by title or content.
  - `FilterButton`: Opens a modal for advanced filtering by macro ranges.
  - `SortControls`: Dropdown to sort recipes by creation date, update date, or title.
  - `RecipeCard`: A summary component for a single recipe in the list.
  - `Pagination`: Navigates through pages of recipes.
  - `EmptyState`: Component displayed when no recipes match the criteria.
- UX, Accessibility, and Security Considerations:
  - UX: Skeleton loaders indicate when recipes are being fetched. The search and filter state should be reflected in the UI.
  - Accessibility: The list is navigable via keyboard, and pagination controls have ARIA labels.
  - Security: This is a protected route. API calls are scoped to the authenticated user via RLS.
</view_description>

3. User Stories:
<user_stories>
US-021
Title: List recipes with empty state
Description: As a user, I want to see a list of my recipes or an empty state if none exist.
Acceptance Criteria:
- When I have no recipes, then I see an empty-state message and a create button.
- When I have recipes, then I see a list with titles and key details.

US-020
Title: Create recipe
Description: As a user, I want to create a recipe so that I can store it for later.
Acceptance Criteria:
- Given required fields are valid (title, servings, macros non-negative, recipe_text <= 10,000), when I save, then the recipe is created and recipe_created is emitted.
- When inputs are invalid or over limits, then I see errors and cannot save.
</user_stories>

4. Endpoint Description:
<endpoint_description>
GET /api/recipes
- Description: List current user’s recipes with pagination, filtering, and sorting.
- Query params: `page` (int ≥1, default 1); `pageSize` (int 1–50, default 10); `search` (string; title/text ilike); `sortBy` (`created_at` | `updated_at` | `title`, default `updated_at`); `sortOrder` (`asc` | `desc`, default `desc`); `minKcal`, `maxKcal`, `minProtein`, `maxProtein` (numbers for macro range filters).
- Request body: none.
- Response body:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "servings": 4,
      "macros": { "kcal": 450.0, "protein": 30.0, "carbs": 55.0, "fat": 12.0 },
      "recipeText": "string",
      "lastAdaptationExplanation": "string|null",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 23, "totalPages": 3 }
}
```
- Success: 200 OK.
- Errors: 400 Bad Request (invalid pagination/filter); 401 Unauthorized; 500 Internal Server Error.
</endpoint_description>

5. Endpoint Implementation:
<endpoint_implementation>
@.ai/enpoint-plans/GET-recipes-implementation-plan.md
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

The final output should be in English and saved in a file named `.ai/recipes-list-view-implementation-plan.md`. Do not include any analysis and planning in the final output.

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


