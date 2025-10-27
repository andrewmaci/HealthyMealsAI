As a senior frontend developer, your task is to create a detailed implementation plan for a new view in a web application. This plan should be comprehensive and clear enough for another frontend developer to implement the view correctly and efficiently.

First, review the following information:

1. Product Requirements Document (PRD):
<prd>

</prd>

2. View Description:
<view_description>
Profile Settings View
- View Path: `/profile`
- Main Purpose: To allow users to manage their dietary preferences and timezone.
- Key Information to Display:
  - Current lists of allergens and disliked ingredients.
  - The user's selected timezone.
  - A non-blocking prompt to complete the profile if preferences are empty.
- Key View Components:
  - `ProfileForm`: A form containing the preference fields.
  - `TagInput`: A custom component for adding and removing allergens and disliked ingredients.
  - `TimezoneSelect`: A dropdown populated with IANA timezone identifiers.
- UX, Accessibility, and Security Considerations:
  - UX: Tag-based inputs for list management. A toast notification confirms successful updates.
  - Accessibility: All form elements are labeled and keyboard-accessible.
  - Security: Protected route.
</view_description>

3. User Stories:
<user_stories>
US-010
Title: View profile
Description: As a user, I want to view my profile so that I can see my allergens and dislikes.
Acceptance Criteria:
- When I open profile settings, then my saved allergens and disliked ingredients are displayed along with my timezone.

US-011
Title: Update allergens
Description: As a user, I want to update my list of allergens so that AI avoids them.
Acceptance Criteria:
- When I add or remove allergens and save, then the profile persists and an event profile_updated is emitted.

US-012
Title: Update disliked ingredients
Description: As a user, I want to update disliked ingredients so that AI avoids them.
Acceptance Criteria:
- When I add or remove disliked ingredients and save, then the profile persists and an event profile_updated is emitted.

US-013
Title: Profile completion prompt
Description: As a user, I want a prompt to complete my profile so that AI adaptations can respect my preferences.
Acceptance Criteria:
- When my allergens/dislikes are empty, then I see a non-blocking prompt encouraging completion.
US-063
Title: Timezone handling for quota reset
Description: As a user, I want quota reset at my local midnight.
Acceptance Criteria:
- The system stores my timezone and resets daily quota at my local midnight; timestamps are stored in UTC with timezone metadata.
US-050
Title: Emit analytics events
Description: As a product team, we want key events emitted for measurement.
Acceptance Criteria:
- Events profile_updated, recipe_created, ai_requested, ai_succeeded, ai_accepted are emitted with UTC timestamp and user timezone; failures are logged.
</user_stories>

4. Endpoint Description:
<endpoint_description>
GET /api/profile
- Retrieve the authenticated user’s profile; auto-provision default row if missing. Success: 200; Errors: 401, 500.

PUT /api/profile
- Update allergens, disliked ingredients, and timezone. Success: 200; Errors: 400, 401, 409, 500.
</endpoint_description>

5. Endpoint Implementation:
<endpoint_implementation>
@.ai/enpoint-plans/GET-profile-implementation-plan.md
@.ai/enpoint-plans/PUT-profile-implementation-plan.md
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

The final output should be in English and saved in a file named `.ai/profile-view-implementation-plan.md`. Do not include any analysis and planning in the final output.

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


