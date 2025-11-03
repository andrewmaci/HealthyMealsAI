# Authentication Architecture Specification - HealthyMealsAI

## Executive Summary

This document specifies the architecture for implementing user registration, login, and password recovery functionality for the HealthyMealsAI application using Supabase Auth integrated with Astro 5. The authentication system will enforce that all application functionality requires authenticated users, while maintaining compatibility with existing features including recipe management, profile settings, and AI adaptations.

**Core Requirements (from PRD):**
- US-001: User signs up
- US-002: User signs in
- US-003: User signs out (partially implemented)
- US-004: Access control for recipes
- US-005: Session expiration

**Key Design Principles:**
1. Server-side session management using Supabase Auth with secure cookies
2. Middleware-based route protection and authentication checks
3. Clear separation between authenticated and public routes
4. Graceful error handling and user feedback
5. Seamless integration with existing recipe and profile functionality

**MVP Scope Decisions:**
- **Email Confirmation:** DISABLED for MVP to enable immediate sign-up and sign-in per US-001 acceptance criteria ("account is created and I am signed in")
- **Timezone Capture:** Automatically detected from browser during sign-up and stored in profile; user can update in profile settings later
- **Password Recovery:** Included in MVP as essential security feature
- **Social Sign-In:** Out of scope for MVP (future enhancement)

---

## 1. USER INTERFACE ARCHITECTURE

### 1.1 Page Structure Overview

#### 1.1.1 Public Pages (Unauthenticated Access)
These pages are accessible without authentication:

**Landing Page (`/`)**
- **Current State:** Renders `Welcome.astro` component
- **Modifications Required:**
  - If user is authenticated → redirect to `/recipes`
  - If user is not authenticated → display landing page with sign-in/sign-up CTAs
  - Add hero section highlighting app value proposition
  - Include prominent "Sign In" and "Sign Up" buttons in header
  - Optional: Add feature highlights, testimonials, or demo content

**Sign-In Page (`/auth/signin`)**
- **Purpose:** User login interface
- **Components:**
  - Page: `src/pages/auth/signin.astro`
  - Form Component: `src/components/auth/SignInForm.tsx` (React)
- **Behavior:**
  - If already authenticated → redirect to `/recipes`
  - Display email/password form with validation
  - Show "Forgot Password?" link to recovery flow
  - Show "Don't have an account? Sign Up" link to registration
  - Handle authentication errors with inline messages

**Sign-Up Page (`/auth/signup`)**
- **Purpose:** New user registration interface
- **Components:**
  - Page: `src/pages/auth/signup.astro`
  - Form Component: `src/components/auth/SignUpForm.tsx` (React)
- **Behavior:**
  - If already authenticated → redirect to `/recipes`
  - Display email/password/confirm password form with validation
  - Show password strength indicator
  - Show "Already have an account? Sign In" link
  - Handle registration errors with inline messages
  - After successful registration → redirect to email confirmation notice or auto-login (depending on Supabase email confirmation settings)

**Password Recovery Request Page (`/auth/recover`)**
- **Purpose:** Initiate password reset flow
- **Components:**
  - Page: `src/pages/auth/recover.astro`
  - Form Component: `src/components/auth/RecoverPasswordForm.tsx` (React)
- **Behavior:**
  - Display email input field
  - Show success message after submission (regardless of email existence for security)
  - Link back to sign-in page

**Password Reset Page (`/auth/reset`)**
- **Purpose:** Complete password reset with token
- **Components:**
  - Page: `src/pages/auth/reset.astro`
  - Form Component: `src/components/auth/ResetPasswordForm.tsx` (React)
- **Behavior:**
  - Validate reset token from URL parameters
  - Display new password / confirm password form
  - Show success/error messages
  - Redirect to sign-in after successful reset

**Email Confirmation Page (`/auth/confirm`)**
- **Purpose:** Handle email confirmation callbacks from Supabase
- **Components:**
  - Page: `src/pages/auth/confirm.astro`
- **Behavior:**
  - Extract and validate token from URL
  - Call Supabase confirmation API
  - Show success/error message
  - Redirect to sign-in or recipes page

#### 1.1.2 Protected Pages (Authenticated Access Required)
All existing application pages require authentication:

- `/recipes` - Recipe list view
- `/recipes/new` - Create new recipe
- `/recipes/[id]` - Recipe detail view
- `/recipes/[id]/edit` - Edit recipe
- `/profile` - User profile and preferences

**Modifications Required:**
- No UI changes needed to existing protected pages
- Add authentication check in middleware (automatic redirect if not authenticated)
- Add user navigation/profile menu in layout header

### 1.2 Layout and Navigation

#### 1.2.1 Public Layout
**Component:** `src/layouts/PublicLayout.astro` (new)

**Structure:**
- Minimal header with app logo/name
- No navigation menu
- Optional footer with links (Privacy Policy, Terms of Service)
- Used by all `/auth/*` pages and public landing page

**Responsibilities:**
- Consistent branding across public pages
- Redirect logic if user is authenticated (handled in individual pages)

#### 1.2.2 Authenticated Layout
**Component:** `src/layouts/Layout.astro` (existing, to be extended)

**Current State:**
- Basic HTML structure with title and global styles
- No navigation or user menu

**Required Extensions:**
- Add navigation header with:
  - App logo/name (link to `/recipes`)
  - Main navigation links (Recipes, Profile)
  - User menu dropdown (top-right) with:
    - User email display
    - Profile Settings link
    - Sign Out button
- Inject user session data from `Astro.locals.session`
- Pass authentication state to client components via props or context

**Responsibilities:**
- Provide consistent navigation across authenticated pages
- Display user identity
- Handle sign-out action
- Responsive design for mobile/desktop

### 1.3 Authentication Component Architecture

#### 1.3.1 React Form Components (Client-Side Interactivity)

All authentication forms are React components with `client:load` directive for full interactivity.

**Component: SignInForm.tsx**

**Location:** `src/components/auth/SignInForm.tsx`

**Props:**
```typescript
interface SignInFormProps {
  redirectUrl?: string; // Where to redirect after successful login
}
```

**State Management:**
```typescript
interface SignInFormState {
  email: string;
  password: string;
  isSubmitting: boolean;
  error: string | null;
}
```

**Validation Rules:**
- Email: Required, valid email format
- Password: Required, minimum 6 characters

**Error Scenarios:**
- Invalid credentials → "Invalid email or password"
- Account not confirmed → "Please confirm your email address"
- Too many attempts → "Too many login attempts. Please try again later"
- Network/server error → "Unable to sign in. Please try again"

**User Flow:**
1. User enters email and password
2. Client-side validation on blur and submit
3. Disable form during submission (show loading state)
4. POST to `/api/auth/signin`
5. On success: redirect to `redirectUrl` or `/recipes`
6. On error: display inline error message, re-enable form

**Accessibility:**
- Proper label associations
- Error messages announced to screen readers
- Keyboard navigation support
- Focus management

---

**Component: SignUpForm.tsx**

**Location:** `src/components/auth/SignUpForm.tsx`

**Props:**
```typescript
interface SignUpFormProps {
  redirectUrl?: string;
}
```

**State Management:**
```typescript
interface SignUpFormState {
  email: string;
  password: string;
  confirmPassword: string;
  timezone: string; // Auto-detected from browser
  isSubmitting: boolean;
  error: string | null;
  passwordStrength: 'weak' | 'medium' | 'strong';
}
```

**Timezone Detection:**
On component mount, automatically detect timezone using:
```typescript
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Example: "America/New_York", "Europe/London", "Asia/Tokyo"
```

**Validation Rules:**
- Email: Required, valid email format, not already registered (server-side check)
- Password: Required, minimum 8 characters, at least one uppercase, one lowercase, one number
- Confirm Password: Required, must match password

**Error Scenarios:**
- Email already exists → "An account with this email already exists"
- Password too weak → "Password must be at least 8 characters with uppercase, lowercase, and numbers"
- Passwords don't match → "Passwords do not match"
- Network/server error → "Unable to create account. Please try again"

**User Flow:**
1. User enters email, password, and password confirmation
2. Real-time password strength indicator updates
3. Client-side validation on blur and submit
4. Disable form during submission
5. Detect timezone from browser using `Intl.DateTimeFormat().resolvedOptions().timeZone`
6. POST to `/api/auth/signup` with email, password, and detected timezone
7. On success (MVP - no email confirmation):
   - User is immediately signed in (auto-login)
   - Redirect to `/recipes`
   - Profile completion prompt will appear if allergens/dislikes are empty (existing US-013 functionality)
8. On error: display inline error message, re-enable form

**Note:** Per US-001 acceptance criteria ("account is created and I am signed in"), email confirmation is DISABLED for MVP to enable immediate sign-up and sign-in.

**UI Elements:**
- Password strength meter (visual bar: red/yellow/green)
- Show/hide password toggle buttons
- Terms of Service checkbox (optional for MVP)

---

**Component: RecoverPasswordForm.tsx**

**Location:** `src/components/auth/RecoverPasswordForm.tsx`

**State Management:**
```typescript
interface RecoverPasswordFormState {
  email: string;
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
}
```

**Validation Rules:**
- Email: Required, valid email format

**User Flow:**
1. User enters email address
2. Client-side validation
3. POST to `/api/auth/recover`
4. Always show success message (security: don't reveal if email exists)
5. Display: "If an account exists with this email, you will receive password reset instructions"

---

**Component: ResetPasswordForm.tsx**

**Location:** `src/components/auth/ResetPasswordForm.tsx`

**Props:**
```typescript
interface ResetPasswordFormProps {
  token: string; // From URL query parameter
}
```

**State Management:**
```typescript
interface ResetPasswordFormState {
  password: string;
  confirmPassword: string;
  isSubmitting: boolean;
  error: string | null;
  isSuccess: boolean;
}
```

**Validation Rules:**
- Same password validation as SignUpForm
- Must provide valid token (validated server-side)

**Error Scenarios:**
- Invalid/expired token → "This password reset link is invalid or has expired"
- Passwords don't match → "Passwords do not match"
- Password too weak → "Password must be at least 8 characters with uppercase, lowercase, and numbers"

**User Flow:**
1. Token validated on page load (if invalid, show error immediately)
2. User enters new password and confirmation
3. Client-side validation
4. POST to `/api/auth/reset` with token and new password
5. On success: show success message and redirect to sign-in after 3 seconds
6. On error: display error message, allow retry

---

#### 1.3.2 Shared UI Components

**Component: AuthFormLayout**

**Location:** `src/components/auth/AuthFormLayout.tsx`

**Purpose:** Consistent layout wrapper for all auth forms

**Structure:**
- Centered card design
- App logo at top
- Form title
- Form content (children)
- Footer with alternative action links
- Consistent spacing and styling

**Props:**
```typescript
interface AuthFormLayoutProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

---

**Component: FormField**

**Location:** `src/components/auth/FormField.tsx`

**Purpose:** Reusable form field with label, input, and error display

**Props:**
```typescript
interface FormFieldProps {
  label: string;
  type: 'text' | 'email' | 'password';
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}
```

**Features:**
- Floating label or traditional label (design decision)
- Show/hide password toggle for password fields
- Error message display with red border
- Disabled state styling

---

**Component: PasswordStrengthMeter**

**Location:** `src/components/auth/PasswordStrengthMeter.tsx`

**Purpose:** Visual indicator of password strength

**Props:**
```typescript
interface PasswordStrengthMeterProps {
  password: string;
}
```

**Logic:**
- Weak: < 8 characters or missing required character types
- Medium: 8+ characters with 2 character types
- Strong: 8+ characters with all 3 types (uppercase, lowercase, number) + optional special char

**Display:**
- Color-coded bar (red/yellow/green)
- Text label below ("Weak", "Medium", "Strong")

---

#### 1.3.3 Component Interaction Patterns

**Form Submission Pattern:**
All auth forms follow this pattern:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Clear previous errors
  setError(null);
  
  // Client-side validation
  const validationError = validateFields();
  if (validationError) {
    setError(validationError);
    return;
  }
  
  // Set loading state
  setIsSubmitting(true);
  
  try {
    // API call
    const response = await fetch('/api/auth/[endpoint]', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* form data */ }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'An error occurred');
    }
    
    // Success: redirect or show success message
    window.location.href = redirectUrl;
  } catch (err) {
    setError(err.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

**State Persistence:**
- No form state persistence in localStorage (security concern for passwords)
- Email can be pre-filled from URL query param for email confirmation flows

**Error Display:**
- Inline errors below form fields for field-specific issues
- Global error banner at top of form for submission errors
- Use `InlineError` component pattern from existing `RecipeForm`

### 1.4 Astro Page Components

All auth pages are Astro components that:
1. Check authentication state
2. Redirect if appropriate
3. Render React form components
4. Use PublicLayout

**Pattern for auth pages:**

```astro
---
// src/pages/auth/signin.astro
import PublicLayout from '../../layouts/PublicLayout.astro';
import SignInForm from '../../components/auth/SignInForm';

// Check if user is already authenticated
const session = Astro.locals.session;
if (session?.user?.id) {
  return Astro.redirect('/recipes');
}

const redirectUrl = Astro.url.searchParams.get('redirect') || '/recipes';
---

<PublicLayout title="Sign In - HealthyMealsAI">
  <SignInForm client:load redirectUrl={redirectUrl} />
</PublicLayout>
```

### 1.5 User Navigation and Session Display

**Location:** `src/components/layout/Header.tsx` (new component for authenticated layout)

**Props:**
```typescript
interface HeaderProps {
  userEmail: string;
  currentPath: string;
}
```

**Structure:**
- Left: Logo and app name (link to /recipes)
- Center: Navigation links (Recipes, Profile)
- Right: User dropdown menu

**User Menu Contents:**
- User email display (truncated if long)
- Divider
- "Profile Settings" link → `/profile`
- "Sign Out" button → triggers logout flow

**Sign Out Flow:**
1. User clicks "Sign Out" in dropdown
2. Confirm action (optional, or direct action)
3. POST to `/api/auth/logout`
4. On success: redirect to landing page `/`
5. On error: show error toast, remain on current page

**Mobile Responsive:**
- Hamburger menu for small screens
- Full navigation for desktop

**Integration with Layout.astro:**
```astro
---
// src/layouts/Layout.astro (extended)
import Header from '../components/layout/Header';

const session = Astro.locals.session;
const userEmail = session?.user?.email || '';
const currentPath = Astro.url.pathname;
---

<!doctype html>
<html lang="en">
  <head>
    <!-- existing head content -->
  </head>
  <body>
    {userEmail && (
      <Header client:load userEmail={userEmail} currentPath={currentPath} />
    )}
    <main>
      <slot />
    </main>
  </body>
</html>
```

### 1.6 Error Messages and Validation

#### 1.6.1 Client-Side Validation Messages

**Email Field:**
- Empty: "Email is required"
- Invalid format: "Please enter a valid email address"

**Password Field (Sign In):**
- Empty: "Password is required"
- Too short: "Password must be at least 6 characters"

**Password Field (Sign Up / Reset):**
- Empty: "Password is required"
- Too short: "Password must be at least 8 characters"
- Missing uppercase: "Password must contain at least one uppercase letter"
- Missing lowercase: "Password must contain at least one lowercase letter"
- Missing number: "Password must contain at least one number"

**Confirm Password Field:**
- Empty: "Please confirm your password"
- Mismatch: "Passwords do not match"

#### 1.6.2 Server-Side Error Messages

**Sign In Errors:**
- `400`: "Invalid email or password format"
- `401`: "Invalid email or password"
- `403`: "Please confirm your email address before signing in"
- `429`: "Too many login attempts. Please try again in a few minutes"
- `500`: "Unable to sign in. Please try again later"

**Sign Up Errors:**
- `400`: "Invalid email or password format"
- `409`: "An account with this email already exists"
- `500`: "Unable to create account. Please try again later"

**Password Recovery Errors:**
- `400`: "Invalid email format"
- `500`: "Unable to send recovery email. Please try again later"
- Note: Always show success message to user regardless of whether email exists

**Password Reset Errors:**
- `400`: "Invalid or expired reset link"
- `400`: "Invalid password format"
- `500`: "Unable to reset password. Please try again later"

#### 1.6.3 Session Expiration Handling

**Scenario:** User session expires while browsing

**Detection:**
- API calls return 401 Unauthorized
- Middleware redirects to sign-in page

**User Experience:**
1. User attempts action (e.g., save recipe)
2. Session is expired
3. API returns 401
4. Frontend intercepts 401 response
5. Show toast: "Your session has expired. Please sign in again"
6. Redirect to `/auth/signin?redirect=[current-path]`
7. After successful sign-in, redirect back to intended page

**Implementation in API Client:**
```typescript
// src/lib/api.ts (extend existing)
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
  });
  
  if (response.status === 401) {
    // Session expired
    const currentPath = window.location.pathname;
    window.location.href = `/auth/signin?redirect=${encodeURIComponent(currentPath)}`;
    throw new Error('Session expired');
  }
  
  return response;
}
```

### 1.7 Profile Completion Flow

**Scenario:** New user signs up and needs to complete profile

**Location:** Profile page (`/profile`)

**Current Behavior:**
- `ProfileCompletionPrompt.tsx` already exists
- Shows prompt when allergens/dislikes are empty

**Integration with Auth:**
1. User completes sign-up
2. Auto-login (if enabled)
3. Redirect to `/recipes`
4. System detects incomplete profile (handled by existing component)
5. Non-blocking prompt encourages profile completion
6. User clicks "Complete Profile" → navigate to `/profile`

**No changes needed** - existing profile flow handles this per US-013

---

## 2. BACKEND LOGIC

### 2.1 API Endpoints

#### 2.1.1 Sign-In Endpoint

**File:** `src/pages/api/auth/signin.ts`

**Method:** `POST`

**Request Body:**
```typescript
interface SignInRequestBody {
  email: string;
  password: string;
}
```

**Validation Schema (Zod):**
```typescript
import { z } from 'zod';

const SignInRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
```

**Response:**
- Success (200): `{ success: true }`
- Bad Request (400): `{ error: 'Invalid email or password format' }`
- Unauthorized (401): `{ error: 'Invalid email or password' }`
- Too Many Requests (429): `{ error: 'Too many login attempts' }`
- Server Error (500): `{ error: 'Unable to sign in' }`

**Implementation Flow:**
1. Parse and validate request body with Zod
2. Call `locals.supabase.auth.signInWithPassword({ email, password })`
3. If successful:
   - Session cookie is automatically set by Supabase
   - Check if user profile exists in profiles table
   - If no profile exists, create one with user.id
   - Return success response
4. If failed:
   - Log error (no sensitive data)
   - Map Supabase error to user-friendly message
   - Return appropriate error response

**Error Handling:**
- Invalid credentials → 401
- Unconfirmed email → 403 (if email confirmation is enabled)
- Rate limiting → 429 (handled by Supabase)
- Database error → 500
- All errors logged with user ID (if available) and timestamp

**Session Management:**
- Supabase automatically manages session cookies
- Session duration: 1 hour (configurable in Supabase)
- Refresh token: 7 days (configurable)

---

#### 2.1.2 Sign-Up Endpoint

**File:** `src/pages/api/auth/signup.ts`

**Method:** `POST`

**Request Body:**
```typescript
interface SignUpRequestBody {
  email: string;
  password: string;
  timezone: string; // Auto-detected from browser (e.g., "America/New_York")
}
```

**Validation Schema (Zod):**
```typescript
const SignUpRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  timezone: z.string().min(1, 'Timezone is required'),
});
```

**Response:**
- Success (201): `{ success: true }`
- Bad Request (400): `{ error: 'Invalid email or password format' }` or `{ error: 'Invalid timezone' }`
- Conflict (409): `{ error: 'Email already registered' }`
- Server Error (500): `{ error: 'Unable to create account' }`

**Implementation Flow:**
1. Parse and validate request body with Zod (email, password, timezone)
2. Call `locals.supabase.auth.signUp({ email, password, options: { emailRedirectTo: null } })`
   - Note: For MVP, Supabase email confirmation should be DISABLED in project settings
3. If successful:
   - User created in Supabase auth.users table
   - Session automatically created (auto-login) - session cookie is set
   - Create profile in profiles table with values from sign-up:
     - id: user.id from Supabase
     - allergens: []
     - disliked_ingredients: []
     - timezone: timezone from request body (auto-detected from browser)
   - Emit analytics event: `user_registered` with userId and timezone
   - Return `{ success: true }`
4. If failed:
   - Log error (no sensitive data)
   - Map Supabase error to user-friendly message
   - Return appropriate error response

**Note:** Per US-001 acceptance criteria and PRD section 3.2 requirement to "capture and store user timezone," timezone is automatically detected client-side and included in sign-up request.

**Error Handling:**
- Email already exists → 409
- Invalid email format → 400
- Weak password → 400
- Database error creating profile → 500 (rollback user creation if possible)

**Profile Creation Transaction:**
Since user creation happens in Supabase and profile creation in our database, we need to handle the case where user is created but profile creation fails:

```typescript
// Pseudo-code pattern
try {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (authError) throw authError;
  
  // Create profile with timezone from request
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      allergens: [],
      disliked_ingredients: [],
      timezone: timezone, // Auto-detected from browser during sign-up
    });
  
  if (profileError) {
    // Profile creation failed - log error
    // User can still sign in, profile will be created on first sign-in via ensureProfileExists helper
    console.error('Failed to create profile for new user', {
      userId: authData.user.id,
      error: profileError,
    });
  }
  
  // Emit analytics event
  emitAnalyticsEvent('user_registered', {
    userId: authData.user.id,
    timestamp: new Date().toISOString(),
    timezone: timezone,
  });
  
  return { success: true };
} catch (error) {
  // Handle errors
}
```

---

#### 2.1.3 Logout Endpoint (Existing - Modifications)

**File:** `src/pages/api/auth/logout.ts` (already exists)

**Current Implementation:** Already correct

**Method:** `POST`

**Modifications Required:**
- None - existing implementation is correct
- Already checks for authenticated user
- Already calls `supabase.auth.signOut()`
- Already handles errors appropriately

**Response:**
- Success (204): No content
- Unauthorized (401): `{ error: 'Unauthorized' }`
- Server Error (500): `{ error: 'Failed to sign out' }`

---

#### 2.1.4 Password Recovery Endpoint

**File:** `src/pages/api/auth/recover.ts`

**Method:** `POST`

**Request Body:**
```typescript
interface RecoverPasswordRequestBody {
  email: string;
}
```

**Validation Schema (Zod):**
```typescript
const RecoverPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});
```

**Response:**
- Always Success (200): `{ success: true }` (don't reveal if email exists)

**Implementation Flow:**
1. Parse and validate request body
2. Call `locals.supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://[domain]/auth/reset' })`
3. Always return success response (security: don't reveal if email exists)
4. If Supabase call fails internally, log error but still return success to user

**Configuration:**
- Reset link expiry: 1 hour (configurable in Supabase)
- Email template customization: In Supabase dashboard
- Redirect URL: Must be whitelisted in Supabase project settings

**Error Handling:**
- All Supabase errors logged but not exposed to user
- Always return success to prevent email enumeration

---

#### 2.1.5 Password Reset Endpoint

**File:** `src/pages/api/auth/reset.ts`

**Method:** `POST`

**Request Body:**
```typescript
interface ResetPasswordRequestBody {
  token: string;
  password: string;
}
```

**Validation Schema (Zod):**
```typescript
const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});
```

**Response:**
- Success (200): `{ success: true }`
- Bad Request (400): `{ error: 'Invalid or expired reset link' }` or `{ error: 'Invalid password format' }`
- Server Error (500): `{ error: 'Unable to reset password' }`

**Implementation Flow:**
1. Parse and validate request body
2. Extract token and verify it's valid
3. Call `locals.supabase.auth.updateUser({ password })`
   - Note: In Supabase, the token is sent in headers/cookies by the client after clicking the reset link
4. If successful:
   - Password updated
   - Old sessions invalidated (Supabase handles this)
   - Return success response
5. If failed:
   - Log error
   - Return appropriate error message

**Error Handling:**
- Invalid/expired token → 400
- Weak password → 400
- Supabase error → 500

---

#### 2.1.6 Email Confirmation Handler

**File:** `src/pages/api/auth/confirm.ts`

**Method:** `GET`

**Query Parameters:**
- `token_hash`: Confirmation token from email link
- `type`: Confirmation type (e.g., 'signup', 'email_change')

**Response:**
- Success (200): `{ success: true }`
- Bad Request (400): `{ error: 'Invalid or expired confirmation link' }`
- Server Error (500): `{ error: 'Unable to confirm email' }`

**Implementation Flow:**
1. Extract token_hash and type from query parameters
2. Call `locals.supabase.auth.verifyOtp({ token_hash, type })`
3. If successful:
   - User email confirmed
   - User can now sign in
   - Create session (auto-login)
   - Return success
4. If failed:
   - Return error

**Note:** This endpoint is called by the email confirmation link sent by Supabase.

---

### 2.2 Middleware Enhancement

**File:** `src/middleware/index.ts` (modify existing)

**Current State:**
- Creates default session with DEFAULT_USER_ID
- Injects supabase client into locals

**Required Changes:**
1. Extract session from Supabase cookies
2. If session exists, attach to locals
3. If session doesn't exist, check if route requires auth
4. If route requires auth and no session → redirect to sign-in
5. If route is auth page and session exists → redirect to recipes

**Implementation Structure:**

```typescript
import { defineMiddleware } from "astro:middleware";
import { createServerClient } from '@supabase/ssr';

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/recover',
  '/auth/reset',
  '/auth/confirm',
];

// Define API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/recover',
  '/api/auth/reset',
  '/api/auth/confirm',
  '/api/health',
];

export const onRequest = defineMiddleware(async (context, next) => {
  // Create Supabase server client with cookie handling
  const supabase = createServerClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_KEY,
    {
      cookies: {
        get: (key) => context.cookies.get(key)?.value,
        set: (key, value, options) => {
          context.cookies.set(key, value, options);
        },
        remove: (key, options) => {
          context.cookies.delete(key, options);
        },
      },
    }
  );
  
  // Attach supabase client to locals
  context.locals.supabase = supabase;
  
  // Get session from Supabase
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session?.user) {
    // User is authenticated
    context.locals.session = {
      user: {
        id: session.user.id,
        email: session.user.email,
      },
    };
  } else {
    // No session
    context.locals.session = null;
  }
  
  const pathname = context.url.pathname;
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isPublicApiRoute = PUBLIC_API_ROUTES.some(route => 
    pathname.startsWith(route)
  );
  const isAuthRoute = pathname.startsWith('/auth/');
  
  // If user is authenticated and trying to access auth pages
  if (session && isAuthRoute) {
    return context.redirect('/recipes');
  }
  
  // If user is not authenticated and trying to access protected route
  if (!session && !isPublicRoute && !isPublicApiRoute) {
    // Redirect to sign-in with return URL
    const redirectUrl = encodeURIComponent(pathname);
    return context.redirect(`/auth/signin?redirect=${redirectUrl}`);
  }
  
  // Continue to route
  return next();
});
```

**Key Responsibilities:**
1. **Session Extraction:** Get session from Supabase cookies
2. **Session Attachment:** Attach session data to `context.locals.session`
3. **Route Protection:** Block unauthenticated access to protected routes
4. **Redirect Logic:** Redirect authenticated users away from auth pages
5. **Cookie Management:** Handle Supabase cookie operations

**Environment Variables Required:**
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase anon/public key

### 2.3 Type Definitions Update

**File:** `src/env.d.ts` (modify existing)

**Current State:**
```typescript
interface Locals {
  supabase: SupabaseClient;
  session?: {
    user: {
      id: string;
    };
  };
}
```

**Required Changes:**
```typescript
interface Locals {
  supabase: SupabaseClient;
  session: {
    user: {
      id: string;
      email: string;
    };
  } | null; // Explicitly null when not authenticated
}
```

**Reason for Change:**
- Add email to session for display in UI
- Make session explicitly nullable for better type safety

### 2.4 Data Model Considerations

#### 2.4.1 User Authentication (Supabase Auth)

**Table:** `auth.users` (managed by Supabase)

**Relevant Fields:**
- `id`: UUID, primary key
- `email`: string, unique
- `encrypted_password`: string (hashed)
- `email_confirmed_at`: timestamp (null if unconfirmed)
- `created_at`: timestamp
- `updated_at`: timestamp
- `last_sign_in_at`: timestamp

**Configuration:**
- Email confirmation: **DISABLED for MVP** (per US-001 requirement for immediate sign-in)
- Password min length: 8 characters
- Rate limiting: Enabled (default: 5 requests per hour for sign-up, 10 for sign-in)

#### 2.4.2 User Profile (Application Database)

**Table:** `public.profiles` (already exists)

**Current Schema:**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allergens TEXT[] DEFAULT '{}',
  disliked_ingredients TEXT[] DEFAULT '{}',
  timezone TEXT, -- Auto-detected from browser during sign-up, editable in profile settings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Note:** Per PRD section 3.2, timezone is captured during sign-up (auto-detected from browser using `Intl.DateTimeFormat().resolvedOptions().timeZone`) and can be updated later in profile settings per US-010/US-063.

**Row Level Security (RLS):**

Current state: RLS is disabled for testing (see migration `20251022120000_disable_rls_for_testing.sql`)

**Required RLS Policies (when re-enabled):**

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (during sign-up)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

#### 2.4.3 Recipes Table (Already Exists)

**RLS Policies Required (when re-enabled):**

```sql
-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Users can view their own recipes
CREATE POLICY "Users can view own recipes"
  ON recipes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own recipes
CREATE POLICY "Users can insert own recipes"
  ON recipes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own recipes
CREATE POLICY "Users can update own recipes"
  ON recipes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own recipes
CREATE POLICY "Users can delete own recipes"
  ON recipes
  FOR DELETE
  USING (auth.uid() = user_id);
```

#### 2.4.4 Adaptation Logs Table (Already Exists)

**RLS Policies Required (when re-enabled):**

```sql
-- Enable RLS
ALTER TABLE adaptation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own adaptation logs
CREATE POLICY "Users can view own adaptation logs"
  ON adaptation_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own adaptation logs
CREATE POLICY "Users can insert own adaptation logs"
  ON adaptation_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 2.5 Service Layer Modifications

#### 2.5.1 Recipe Service (Existing - Modifications)

**File:** `src/lib/services/recipe.service.ts`

**Current Behavior:**
- Uses `userId` parameter (currently defaults to DEFAULT_USER_ID)
- Already filters recipes by user_id

**Required Changes:**
- None - already correctly scoped to user_id
- Remove DEFAULT_USER_ID fallback in API endpoints once auth is enforced

**Note:** With RLS enabled, even if userId is compromised, database enforces access control.

#### 2.5.2 Profile Service (Existing - Modifications)

**File:** `src/lib/services/profile.service.ts`

**Current Behavior:**
- Reads/updates profile by user_id

**Required Changes:**
- Ensure profile creation during sign-up (handled in sign-up endpoint)
- Add fallback to create profile if it doesn't exist (for users who signed up before profile table existed)

**Profile Creation Helper:**
```typescript
export async function ensureProfileExists(
  supabase: SupabaseClient,
  userId: string,
  timezone?: string // Optional: detected timezone if available
): Promise<void> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (fetchError && fetchError.code === 'PGRST116') {
    // Profile doesn't exist, create it
    // This handles cases where profile creation failed during sign-up
    // or for users who existed before profile table was created
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        allergens: [],
        disliked_ingredients: [],
        timezone: timezone || null, // Use provided timezone or null as fallback
      });
    
    if (insertError) {
      console.error('Failed to create profile', { userId, error: insertError });
      throw new Error('Failed to create user profile');
    }
  } else if (fetchError) {
    throw fetchError;
  }
  // Profile exists, do nothing
}
```

**Usage:** Call this during sign-in if profile doesn't exist, or at the start of protected API routes as a safety check.

### 2.6 Error Handling Strategy

#### 2.6.1 Authentication Errors

**Supabase Error Mapping:**

```typescript
function mapAuthError(error: AuthError): { status: number; message: string } {
  switch (error.message) {
    case 'Invalid login credentials':
      return { status: 401, message: 'Invalid email or password' };
    case 'Email not confirmed':
      return { status: 403, message: 'Please confirm your email address' };
    case 'User already registered':
      return { status: 409, message: 'Email already registered' };
    case 'Password should be at least 8 characters':
      return { status: 400, message: 'Password must be at least 8 characters' };
    default:
      console.error('Unmapped auth error', { error });
      return { status: 500, message: 'An unexpected error occurred' };
  }
}
```

#### 2.6.2 API Error Response Pattern

All API endpoints return consistent error structure:

```typescript
interface ErrorResponse {
  error: string; // User-friendly message
  details?: Record<string, any>; // Optional validation details
}
```

**Example:**
```json
{
  "error": "Invalid email or password format",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email format"]
    }
  }
}
```

#### 2.6.3 Logging Strategy

**What to Log:**
- All authentication attempts (success and failure)
- Session creation and destruction
- Password reset requests
- Email confirmation events
- Authorization failures

**What NOT to Log:**
- Passwords (plain or hashed)
- Password reset tokens
- Session tokens
- Personally identifiable information in error messages

**Log Format:**
```typescript
console.log('Auth event', {
  event: 'signin_attempt',
  userId: user?.id,
  email: user?.email, // Only log if needed for debugging
  success: true,
  timestamp: new Date().toISOString(),
  ip: request.headers.get('x-forwarded-for'), // Optional
});
```

### 2.7 Server-Side Rendering Considerations

**Current Setup:**
- `output: "server"` in astro.config.mjs (correct for authentication)
- Node adapter with standalone mode

**No changes required** - current setup supports SSR which is necessary for:
1. Middleware-based session management
2. Server-side redirects
3. Secure cookie handling
4. API endpoints

**Pages that require SSR:**
- All auth pages (to check session and redirect)
- All protected pages (to verify authentication)

**API endpoints:**
- All already have `export const prerender = false` (correct)

---

## 3. AUTHENTICATION SYSTEM

### 3.1 Supabase Auth Integration

#### 3.1.1 Supabase Configuration

**Environment Variables:**
```env
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_KEY=[anon-public-key]
```

**Supabase Project Settings:**

**Auth Settings:**
- Site URL: `https://[production-domain]` or `http://localhost:3000` for dev
- Redirect URLs (whitelist):
  - `http://localhost:3000/auth/confirm`
  - `https://[production-domain]/auth/confirm`
  - `http://localhost:3000/auth/reset`
  - `https://[production-domain]/auth/reset`

**Email Templates:**
Customize in Supabase Dashboard > Authentication > Email Templates

1. **Confirmation Email:**
   - Subject: "Confirm your email for HealthyMealsAI"
   - Body: Include confirmation link with token
   - Link format: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`

2. **Password Recovery Email:**
   - Subject: "Reset your password for HealthyMealsAI"
   - Body: Include reset link with token
   - Link format: `{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery`

3. **Email Change Confirmation:**
   - Subject: "Confirm your new email"
   - Link format: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`

**Rate Limiting:**
- Sign-up: 5 attempts per hour per IP
- Sign-in: 10 attempts per hour per email
- Password recovery: 5 requests per hour per email

**Session Duration:**
- Access token: 1 hour (default, configurable)
- Refresh token: 7 days (default, configurable)
- Remember me: Optional (not in MVP)

#### 3.1.2 Cookie Management

**Supabase Cookies:**
Supabase Auth uses httpOnly cookies for session management:

- `sb-access-token`: Access token (short-lived)
- `sb-refresh-token`: Refresh token (longer-lived)

**Cookie Settings:**
- httpOnly: true (prevents JavaScript access)
- secure: true (HTTPS only in production)
- sameSite: 'lax' (CSRF protection)
- path: '/' (available across entire site)

**Cookie Handling in Middleware:**
Uses `@supabase/ssr` package for proper cookie management in Astro:

```typescript
import { createServerClient } from '@supabase/ssr';

// In middleware
const supabase = createServerClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    cookies: {
      get: (key) => context.cookies.get(key)?.value,
      set: (key, value, options) => {
        context.cookies.set(key, value, {
          ...options,
          secure: import.meta.env.PROD, // Only secure in production
          httpOnly: true,
          sameSite: 'lax',
        });
      },
      remove: (key, options) => {
        context.cookies.delete(key, options);
      },
    },
  }
);
```

#### 3.1.3 Session Management

**Session Lifecycle:**

1. **Session Creation:**
   - User signs in via `signInWithPassword()`
   - Supabase creates session and sets cookies
   - Session contains: user data, access token, refresh token

2. **Session Validation:**
   - On each request, middleware calls `supabase.auth.getSession()`
   - If access token is expired but refresh token is valid, Supabase auto-refreshes
   - If both tokens are expired, session is null → redirect to sign-in

3. **Session Refresh:**
   - Automatic via Supabase SDK
   - Refresh happens before access token expiry
   - New tokens are set in cookies

4. **Session Termination:**
   - User calls sign-out endpoint
   - `supabase.auth.signOut()` invalidates session
   - Cookies are cleared
   - Redirect to landing page

**Handling Concurrent Sessions:**
- Multiple devices: Supabase supports multiple concurrent sessions by default
- Security: Can be configured to limit or revoke old sessions

**Session Expiration Flow:**
1. User's session expires (no valid refresh token)
2. Middleware detects no session
3. Redirect to `/auth/signin?redirect=[current-path]`
4. User signs in
5. Redirect back to original page

#### 3.1.4 Client-Side Authentication State

**For React Components:**

**Option 1: Pass session as prop from Astro page**
```astro
---
// In protected Astro page
const session = Astro.locals.session;
---

<Layout>
  <SomeComponent client:load session={session} />
</Layout>
```

**Option 2: Fetch session from client (if needed)**
Not recommended for initial render (causes layout shift), but useful for session checks after actions:

```typescript
// In React component
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const checkSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!session) {
    // Redirect to sign-in
    window.location.href = '/auth/signin';
  }
};
```

**Recommendation for MVP:**
Pass session data as props from Astro pages to avoid hydration issues and unnecessary client-side checks.

### 3.2 Password Security

#### 3.2.1 Password Requirements

**Validation Rules:**
- Minimum length: 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- Optional: Special character recommendation (not enforced in MVP)

**Implementation:**
- Client-side validation in forms (instant feedback)
- Server-side validation in API endpoints (security)
- Supabase also enforces minimum 8 characters

#### 3.2.2 Password Hashing

**Handled by Supabase:**
- Uses bcrypt algorithm
- Automatic salting
- Password never stored in plain text
- Password never exposed in API responses

**Application Responsibility:**
- Never log passwords
- Never send passwords in GET requests
- Always use HTTPS for password transmission (enforced in production)

#### 3.2.3 Password Reset Security

**Flow:**
1. User requests password reset
2. Supabase generates secure token and sends email
3. Token is valid for 1 hour
4. Token can only be used once
5. User clicks link, lands on reset page with token
6. User submits new password
7. Supabase validates token and updates password
8. All existing sessions are invalidated

**Security Measures:**
- Tokens are cryptographically secure (random)
- Tokens expire after 1 hour
- Tokens are single-use
- Rate limiting prevents abuse (5 requests per hour per email)

### 3.3 Account Recovery

#### 3.3.1 Forgotten Password Flow

**User Flow:**
1. User navigates to `/auth/signin`
2. Clicks "Forgot Password?" link
3. Redirected to `/auth/recover`
4. Enters email address
5. Submits form
6. Receives success message (always, regardless of email existence)
7. Checks email for reset link
8. Clicks reset link in email
9. Redirected to `/auth/reset?token_hash=[token]&type=recovery`
10. Enters new password twice
11. Submits form
12. Password updated, redirected to sign-in
13. Signs in with new password

**Email Not Found:**
- Still show success message
- Don't reveal if email exists (security: prevent email enumeration)
- No email is sent if account doesn't exist

#### 3.3.2 Email Confirmation Flow

**MVP Decision: Email Confirmation is DISABLED**

Per US-001 acceptance criteria ("account is created and I am signed in"), email confirmation is disabled for MVP to enable immediate user sign-up and access.

**MVP Flow:**
1. User signs up via `/auth/signup`
2. Account is immediately created and user is signed in (auto-login)
3. Session cookie is set
4. User is redirected to `/recipes`
5. No email confirmation required

**Post-MVP Enhancement (Future):**

If email confirmation is enabled in production:
1. User signs up via `/auth/signup`
2. Account created but email is unconfirmed
3. Confirmation email sent with link
4. User checks email
5. Clicks confirmation link
6. Redirected to `/auth/confirm?token_hash=[token]&type=signup`
7. Token validated, email confirmed
8. User can now sign in

**If User Tries to Sign In Before Confirmation (Post-MVP):**
- Sign-in fails with message: "Please confirm your email address"
- Option to resend confirmation email

**Configuration:**
For MVP, ensure in Supabase Dashboard > Authentication > Settings:
- "Enable email confirmations" is set to DISABLED

### 3.4 Security Considerations

#### 3.4.1 CSRF Protection

**Built-in Protection:**
- Supabase cookies use `sameSite: 'lax'` (prevents CSRF)
- API endpoints require valid session cookie
- No custom CSRF tokens needed with proper cookie settings

**Additional Measures:**
- All state-changing operations use POST (not GET)
- Origin and Referer headers validated by Supabase

#### 3.4.2 XSS Protection

**Prevention Measures:**
- React automatically escapes output (prevents XSS)
- Never use `dangerouslySetInnerHTML` with user input
- httpOnly cookies prevent JavaScript access to session tokens
- Content-Security-Policy header (future enhancement)

#### 3.4.3 SQL Injection Protection

**Prevention Measures:**
- Supabase uses parameterized queries (prevents SQL injection)
- All database access goes through Supabase SDK
- No raw SQL with user input in application code
- RLS enforces access control at database level

#### 3.4.4 Rate Limiting

**Supabase Built-in Rate Limiting:**
- Sign-up: 5 attempts per hour per IP
- Sign-in: 10 attempts per hour per email
- Password recovery: 5 requests per hour per email

**Application Rate Limiting (Future Enhancement):**
- Consider adding rate limiting middleware for API endpoints
- Use libraries like `express-rate-limit` or implement custom logic

#### 3.4.5 Brute Force Protection

**Supabase Protection:**
- Account lockout after repeated failed sign-in attempts
- Exponential backoff on repeated failures
- Email notifications for suspicious activity (configurable)

**Application Level:**
- Display clear error messages without revealing if email exists
- Log failed authentication attempts for monitoring

#### 3.4.6 Session Hijacking Prevention

**Protection Measures:**
- httpOnly cookies (can't be accessed by JavaScript)
- Secure cookies in production (HTTPS only)
- sameSite cookies (CSRF protection)
- Session expiration after inactivity
- Refresh token rotation (handled by Supabase)

**Best Practices:**
- Always use HTTPS in production
- Short-lived access tokens (1 hour)
- Invalidate sessions on password change
- Option to view active sessions (future enhancement)

#### 3.4.7 Data Privacy

**Sensitive Data Handling:**
- Passwords: Never logged, stored only as bcrypt hash
- Email: Logged only for debugging, not exposed in client
- Session tokens: Never logged, stored only in httpOnly cookies
- Personal data: Compliant with profiles table (allergens, dislikes)

**Logging Policy:**
- Log authentication events (sign-in, sign-up, sign-out)
- Log user IDs for traceability
- Never log passwords, tokens, or sensitive data
- Implement log rotation and retention policy

#### 3.4.8 HTTPS Enforcement

**Production:**
- Enforce HTTPS for all connections
- Redirect HTTP to HTTPS (web server level)
- Set secure flag on cookies
- Use HSTS header (future enhancement)

**Development:**
- HTTP acceptable on localhost
- Secure cookie flag disabled

### 3.5 User Experience Considerations

#### 3.5.1 Loading States

**During Authentication:**
- Show spinner or loading indicator
- Disable form submit button
- Display "Signing in..." text
- Prevent duplicate submissions

**After Sign-In:**
- Brief "Redirecting..." message
- Immediate redirect to intended destination
- No flash of unauthenticated content

#### 3.5.2 Error Recovery

**Clear Error Messages:**
- Specific errors for common issues
- Actionable guidance (e.g., "Try again" or "Forgot password?")
- Avoid technical jargon

**Retry Mechanisms:**
- Failed sign-in → allow immediate retry
- Network error → show retry button
- Session expired → automatic redirect to sign-in with return URL

#### 3.5.3 Accessibility

**Form Accessibility:**
- Proper label associations (`htmlFor` attribute)
- Error messages announced to screen readers (`aria-live`)
- Focus management (focus on first error field)
- Keyboard navigation support (Tab order)
- High contrast error colors (WCAG AA compliance)

**Password Visibility:**
- Toggle button to show/hide password
- Accessible label for toggle (e.g., "Show password")
- Icon or text change on toggle

#### 3.5.4 Mobile Responsiveness

**Forms:**
- Touch-friendly input sizes (min 44x44px tap targets)
- Proper input types (`type="email"` for email keyboard)
- Avoid tiny text or buttons
- Single-column layout on mobile

**Navigation:**
- Hamburger menu for authenticated layout
- Easy access to sign-out

### 3.6 Integration with Existing Features

#### 3.6.1 Recipe Management

**Changes Required:**
- Remove DEFAULT_USER_ID fallback in API endpoints
- All recipe operations now use authenticated user's ID
- RLS ensures data isolation between users

**No Changes to:**
- Recipe CRUD operations
- Recipe form components
- Recipe list/detail views

#### 3.6.2 Profile Management

**Changes Required:**
- Ensure profile exists for new users (handled in sign-up)
- Profile operations now require authentication (already scoped to userId)

**No Changes to:**
- ProfileSettings component
- Profile form logic
- Profile API endpoints (already correctly scoped)

#### 3.6.3 AI Adaptation Flow

**Changes Required:**
- All adaptation requests require authenticated user
- Quota tracked per authenticated user (already implemented)

**No Changes to:**
- Adaptation wizard UI
- Adaptation API logic
- Quota calculation (already per-user)

#### 3.6.4 Analytics

**Changes Required:**
- Add authentication events to analytics:
  - `user_registered`: Emitted on successful sign-up
  - `user_signin`: Emitted on successful sign-in
  - `user_signout`: Emitted on sign-out
- All existing events continue to use authenticated user ID

**Event Structure:**
```typescript
{
  event: 'user_registered',
  userId: string,
  timestamp: string (UTC),
  timezone: string | null,
}
```

---

## 4. IMPLEMENTATION CHECKLIST

### 4.1 Phase 1: Core Authentication

**Backend:**
- [ ] Install `@supabase/ssr` package
- [ ] Update middleware for session management and route protection
- [ ] Create sign-in API endpoint (`/api/auth/signin`)
- [ ] Create sign-up API endpoint (`/api/auth/signup`)
- [ ] Update logout API endpoint if needed
- [ ] Create password recovery endpoint (`/api/auth/recover`)
- [ ] Create password reset endpoint (`/api/auth/reset`)
- [ ] Update `env.d.ts` type definitions

**Frontend:**
- [ ] Create PublicLayout component
- [ ] Create SignInForm component
- [ ] Create SignUpForm component
- [ ] Create sign-in page (`/auth/signin`)
- [ ] Create sign-up page (`/auth/signup`)
- [ ] Update landing page with auth checks and CTAs

**Testing:**
- [ ] Test sign-up flow
- [ ] Test sign-in flow
- [ ] Test sign-out flow
- [ ] Test middleware redirects
- [ ] Test protected routes

### 4.2 Phase 2: Password Recovery

**Backend:**
- [ ] Configure Supabase password recovery email template
- [ ] Test password recovery email delivery

**Frontend:**
- [ ] Create RecoverPasswordForm component
- [ ] Create ResetPasswordForm component
- [ ] Create recovery page (`/auth/recover`)
- [ ] Create reset page (`/auth/reset`)
- [ ] Add "Forgot Password?" link to sign-in page

**Testing:**
- [ ] Test password recovery request
- [ ] Test password reset with valid token
- [ ] Test password reset with invalid/expired token

### 4.3 Phase 3: Email Confirmation (OUT OF SCOPE FOR MVP)

**Note:** Email confirmation is explicitly DISABLED for MVP per US-001 acceptance criteria. This phase is for post-MVP implementation only.

**Backend (Post-MVP):**
- [ ] Configure Supabase email confirmation settings (enable in dashboard)
- [ ] Create email confirmation endpoint (`/api/auth/confirm`)
- [ ] Configure confirmation email template
- [ ] Update sign-up flow to handle requiresConfirmation response

**Frontend (Post-MVP):**
- [ ] Create confirmation page (`/auth/confirm`)
- [ ] Create confirmation notice page (after sign-up)
- [ ] Update sign-up form to handle confirmation required state

**Testing (Post-MVP):**
- [ ] Test sign-up with email confirmation
- [ ] Test confirmation link
- [ ] Test sign-in before confirmation (should fail with appropriate message)

### 4.4 Phase 4: UI Enhancements

**Frontend:**
- [ ] Create authenticated Header component
- [ ] Update Layout.astro with Header
- [ ] Create user menu dropdown
- [ ] Add password strength meter to sign-up
- [ ] Add show/hide password toggles
- [ ] Implement responsive design for mobile

**Testing:**
- [ ] Test user menu on desktop
- [ ] Test navigation on mobile
- [ ] Test all interactive elements

### 4.5 Phase 5: Security Hardening

**Backend:**
- [ ] Enable RLS on all tables
- [ ] Test RLS policies
- [ ] Review and test error messages (no sensitive data leaks)
- [ ] Implement comprehensive logging

**Frontend:**
- [ ] Ensure all auth forms use HTTPS in production
- [ ] Test session expiration handling
- [ ] Test concurrent session management

**Configuration:**
- [ ] Configure Supabase rate limiting
- [ ] Configure Supabase email templates
- [ ] Set up redirect URLs in Supabase
- [ ] Configure session duration settings

### 4.6 Phase 6: Integration Testing

**End-to-End Scenarios:**
- [ ] New user: sign-up → complete profile → create recipe → adapt recipe
- [ ] Existing user: sign-in → view recipes → sign-out
- [ ] Password recovery: forgot password → receive email → reset → sign-in
- [ ] Session expiration: stay inactive → attempt action → redirect to sign-in → sign in → continue action
- [ ] Multiple devices: sign in on two devices → sign out on one → verify other still works

**Error Scenarios:**
- [ ] Invalid credentials
- [ ] Duplicate email sign-up
- [ ] Expired password reset token
- [ ] Network errors during auth

---

## 5. CONFIGURATION AND DEPLOYMENT

### 5.1 Environment Variables

**Development (.env.local):**
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=[local-anon-key]
OPENROUTER_API_KEY=[your-key]
```

**Production (.env):**
```env
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_KEY=[anon-public-key]
OPENROUTER_API_KEY=[your-key]
```

### 5.2 Supabase Configuration

**Auth Settings:**
1. Navigate to Supabase Dashboard > Authentication > Settings
2. Set Site URL to production domain (or `http://localhost:3000` for development)
3. Add redirect URLs to whitelist:
   - Password reset: `http://localhost:3000/auth/reset` (dev), `https://[domain]/auth/reset` (prod)
4. Configure email templates:
   - Password recovery email (required for MVP)
   - Email confirmation (not needed for MVP, but configure for future)
5. Set rate limiting thresholds (use defaults: 5 sign-ups/hour, 10 sign-ins/hour)
6. Configure session duration (use defaults: 1 hour access token, 7 days refresh token)
7. **DISABLE email confirmation** for MVP (per US-001 requirement)

**Database:**
1. Run RLS enable migration when ready for production
2. Test RLS policies thoroughly
3. Set up database backups

### 5.3 Deployment Considerations

**Pre-Deployment:**
- [ ] Test all auth flows in staging environment
- [ ] Verify HTTPS is enforced
- [ ] Confirm secure cookies are enabled
- [ ] Test email delivery from Supabase
- [ ] Review error messages for sensitive data

**Post-Deployment:**
- [ ] Monitor authentication logs
- [ ] Check for unusual sign-up patterns
- [ ] Monitor error rates
- [ ] Verify session expiration is working

---

## 6. TESTING STRATEGY

### 6.1 Unit Tests

**Backend:**
- API endpoint validation (Zod schemas)
- Error mapping functions
- Profile creation helper

**Frontend:**
- Form validation logic
- Password strength calculation
- Error message display

### 6.2 Integration Tests

**Backend:**
- Sign-up flow (create user + profile)
- Sign-in flow (validate credentials + create session)
- Sign-out flow (invalidate session)
- Password recovery flow
- Middleware session extraction and redirects

**Frontend:**
- Form submission and error handling
- Navigation after authentication
- Session expiration detection

### 6.3 End-to-End Tests

**Critical Paths:**
1. New user registration → profile creation → recipe creation
2. User sign-in → view recipes → adapt recipe → sign-out
3. Password recovery → reset password → sign in
4. Session expiration → redirect → sign in → return to page

**Tools:**
- Playwright or Cypress for E2E tests
- Manual testing for edge cases

### 6.4 Security Testing

**Checklist:**
- [ ] Test CSRF protection (try forged requests)
- [ ] Test SQL injection in all inputs
- [ ] Test XSS in all form fields
- [ ] Test session hijacking scenarios
- [ ] Test rate limiting (brute force)
- [ ] Test password requirements enforcement
- [ ] Test RLS policies (try to access other users' data)

---

## 7. DOCUMENTATION REQUIREMENTS

### 7.1 User Documentation

**Help Articles:**
1. How to create an account
2. How to sign in
3. How to reset your password
4. How to update your profile
5. Security and privacy information

**Location:**
- Optional: `/help` page or external documentation site
- Not required for MVP, but helpful for users

### 7.2 Developer Documentation

**Code Comments:**
- Document authentication flow in middleware
- Document session management approach
- Document security considerations

**README Updates:**
- Add authentication setup instructions
- Document environment variables
- Include Supabase configuration steps

### 7.3 API Documentation

**Authentication Endpoints:**
Document all auth endpoints with:
- Request format
- Response format
- Error codes and messages
- Example requests

**Location:**
- Add to README or create separate API.md file

---

## 8. MIGRATION PLAN

### 8.1 Migrating Existing Users

**Current State:**
- Application uses DEFAULT_USER_ID for all users
- No real user accounts exist

**Migration Strategy:**

**Option 1: Fresh Start (Recommended for MVP)**
1. Launch authentication system
2. Require all users to create accounts
3. No data migration needed (no production users yet)

**Option 2: Migrate Existing Data (If Production Users Exist)**
1. Create migration script to:
   - Create user account for each unique user_id in database
   - Generate temporary passwords
   - Send welcome emails with password reset links
2. Run migration in production
3. Notify users to reset passwords

**Recommendation:**
Since this is MVP, assume Option 1 (fresh start).

### 8.2 Database Migrations

**Required Migrations:**

**Migration 1: Enable RLS (when ready)**
```sql
-- File: supabase/migrations/[timestamp]_enable_rls.sql

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Enable RLS on recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recipes"
  ON recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipes"
  ON recipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes"
  ON recipes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes"
  ON recipes FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS on adaptation_logs
ALTER TABLE adaptation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON adaptation_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON adaptation_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Migration 2: Remove Default User (Optional)**
```sql
-- File: supabase/migrations/[timestamp]_remove_default_user.sql

-- Delete any data associated with DEFAULT_USER_ID
DELETE FROM adaptation_logs WHERE user_id = '73b4e11b-0ee9-446a-ae8d-6a7d051ac56d';
DELETE FROM recipes WHERE user_id = '73b4e11b-0ee9-446a-ae8d-6a7d051ac56d';
DELETE FROM profiles WHERE id = '73b4e11b-0ee9-446a-ae8d-6a7d051ac56d';
```

---

## 9. MONITORING AND ANALYTICS

### 9.1 Authentication Metrics

**Key Metrics to Track:**
- Sign-up conversion rate (visits to sign-up page vs. completed registrations)
- Sign-in success rate
- Failed sign-in attempts per user
- Password recovery requests
- Session duration (average time between sign-in and sign-out)
- Daily/monthly active users

### 9.2 Error Monitoring

**Errors to Monitor:**
- Authentication failures (by reason)
- Session creation failures
- Profile creation failures
- Password reset failures
- Middleware errors

**Tools:**
- Console logs (structured logging)
- Error tracking service (e.g., Sentry) - future enhancement
- Supabase logs and dashboard

### 9.3 Security Monitoring

**Security Events to Monitor:**
- Repeated failed sign-in attempts (potential brute force)
- Unusual sign-up patterns (potential bot activity)
- Password reset requests without subsequent sign-in (potential abuse)
- Unauthorized access attempts (401/403 responses)

**Alerting:**
- Set up alerts for unusual patterns
- Review security logs regularly

---

## 10. FUTURE ENHANCEMENTS

**Post-MVP Features:**
1. Social sign-in (Google, GitHub)
2. Multi-factor authentication (2FA)
3. Remember me checkbox (extended session)
4. Session management page (view and revoke active sessions)
5. Account deletion
6. Email change with confirmation
7. Resend confirmation email option
8. Rate limiting at application level
9. CAPTCHA for sign-up/sign-in
10. Privacy policy and terms of service pages
11. Cookie consent banner (GDPR compliance)
12. Audit log for security events

---

## 11. SUMMARY

This authentication architecture provides:

1. **Secure Authentication:** Leveraging Supabase Auth with industry-standard security practices
2. **Seamless Integration:** Minimal changes to existing application code
3. **User-Friendly Flows:** Clear sign-up, sign-in, and recovery processes
4. **Robust Error Handling:** Comprehensive validation and user feedback
5. **Scalable Foundation:** Ready for future enhancements like social sign-in and 2FA

**Key Components:**
- **Middleware:** Session management and route protection
- **API Endpoints:** Sign-in, sign-up, logout, password recovery/reset
- **React Forms:** Interactive client-side components for all auth flows
- **Astro Pages:** Server-rendered auth pages with redirect logic
- **Supabase Integration:** Cookie-based session management with automatic refresh

**Security Features:**
- httpOnly secure cookies
- Row Level Security (RLS) for data isolation
- Rate limiting and brute force protection
- Password strength requirements
- CSRF and XSS protection

This specification ensures compatibility with all existing features (recipes, profiles, AI adaptations) while enforcing authentication requirements across the entire application.

---

## 12. ALIGNMENT WITH PRD

### Key Requirements Mapping

This authentication specification directly implements the following PRD requirements:

**Section 3.1 - Authentication and Authorization:**
- ✓ Users can create accounts, sign in, and sign out (US-001, US-002, US-003)
- ✓ Users can only access and modify their own recipes and profile data (US-004 via RLS and middleware)
- ✓ Sessions must expire or be revocable; re-authentication required afterwards (US-005 via Supabase session management)

**Section 3.2 - User Profile and Preferences:**
- ✓ The application should capture and store user timezone for quota resets and analytics
  - **Implementation:** Timezone is auto-detected from browser using `Intl.DateTimeFormat().resolvedOptions().timeZone` during sign-up
  - User can update timezone in profile settings (US-010)

**Section 3.8 - Analytics and Instrumentation:**
- ✓ Additional authentication events added: `user_registered`, `user_signin`, `user_signout`
- All events include UTC timestamps and user timezone metadata as required by PRD

### Design Decisions Aligned with PRD

**1. Immediate Sign-In After Sign-Up (US-001)**
- PRD Requirement: "account is created and I am signed in"
- Implementation: Email confirmation DISABLED for MVP, auto-login enabled
- Rationale: Enables immediate user access as specified in acceptance criteria

**2. Timezone Capture (PRD Section 3.2, US-063)**
- PRD Requirement: "capture and store user timezone"
- Implementation: Auto-detected from browser during sign-up, stored in profile
- Rationale: Fulfills requirement to capture timezone while maintaining good UX (no manual selection required)

**3. Profile Completion Prompt (US-013)**
- PRD Requirement: "non-blocking prompt encouraging completion"
- Implementation: Existing `ProfileCompletionPrompt.tsx` component works with new auth flow
- No changes needed - users are redirected to `/recipes` after sign-up, where prompt appears if allergens/dislikes empty

**4. Session Expiration (US-005)**
- PRD Requirement: "inactive sessions to expire so that access is secure"
- Implementation: 1-hour access token with automatic refresh via 7-day refresh token
- Middleware redirects expired sessions to sign-in with return URL

### No Conflicts Identified

After thorough comparison, no conflicts exist between PRD and this authentication specification. All user stories (US-001 through US-005, US-010, US-013, US-063) can be fully implemented as specified.

**Areas of Clarification Added:**
1. Email confirmation explicitly disabled for MVP
2. Timezone capture mechanism specified (auto-detection vs manual entry)
3. Profile creation timing and fallback handling defined
4. Analytics events for authentication added to complement existing events

