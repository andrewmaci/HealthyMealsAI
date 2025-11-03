# OpenRouter Service Implementation Plan

## 1. Service Description

The OpenRouter service is responsible for managing all interactions with the OpenRouter API to perform LLM-based operations. This service will provide a type-safe, robust interface for sending chat completion requests with support for structured JSON responses, error handling, retry logic, and quota management.

### Core Responsibilities

1. **API Communication**: Handle HTTP requests to OpenRouter endpoints
2. **Message Management**: Structure system and user messages according to OpenRouter specifications
3. **Response Handling**: Parse and validate both streaming and non-streaming responses
4. **Schema Management**: Support structured JSON responses via `response_format` with JSON Schema validation
5. **Error Management**: Handle API errors, network failures, and rate limiting with appropriate retry logic
6. **Security**: Manage API keys securely and prevent exposure of sensitive data

### Integration Points

- Will be imported and used by services that require AI generation (e.g., recipe generation, adaptation proposals)
- Should follow the functional export pattern established in existing services
- Must integrate with the project's error handling and logging patterns

---

## 2. Service Structure

The OpenRouter service should be implemented as a collection of exported functions (following the pattern in `recipe.service.ts` and `profile.service.ts`) rather than a class-based approach.

### File Location

```
src/lib/services/openrouter.service.ts
```

### Core Components

1. **Configuration Management**: Environment-based configuration
2. **Request Builder**: Functions to construct OpenRouter API requests
3. **Response Parser**: Functions to parse and validate API responses
4. **Error Handler**: Custom error class and error handling utilities
5. **Retry Logic**: Exponential backoff implementation
6. **Public API**: High-level functions for chat completions

---

## 3. Configuration

### Environment Variables

Create or update `.env` file with:

```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=nvidia/nemotron-nano-12b-v2-vl:free
OPENROUTER_REQUEST_TIMEOUT_MS=60000
OPENROUTER_MAX_RETRIES=3
```

### Configuration Interface

```typescript
interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
}
```

### Configuration Validation

The service should validate configuration on first use and throw early if required values are missing:

```typescript
const getOpenRouterConfig = (): OpenRouterConfig => {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new OpenRouterServiceError({
      code: 'configuration_error',
      message: 'OPENROUTER_API_KEY environment variable is required',
    });
  }
  
  return {
    apiKey: apiKey.trim(),
    baseUrl: import.meta.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultModel: import.meta.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet',
    requestTimeoutMs: parseInt(import.meta.env.OPENROUTER_REQUEST_TIMEOUT_MS || '60000', 10),
    maxRetries: parseInt(import.meta.env.OPENROUTER_MAX_RETRIES || '3', 10),
  };
};
```

---

## 4. Type Definitions

### Message Types

```typescript
/**
 * Represents a chat message with role and content
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * System message configuration
 */
export interface SystemMessageConfig {
  content: string;
}

/**
 * User message configuration
 */
export interface UserMessageConfig {
  content: string;
}
```

### Model Parameters

```typescript
/**
 * Parameters for model generation
 */
export interface ModelParameters {
  /**
   * Controls randomness. Lower values = more focused, higher = more creative
   * Range: 0.0 to 2.0
   * Default: 1.0
   */
  temperature?: number;

  /**
   * Maximum tokens to generate in response
   * Default: 1000
   */
  max_tokens?: number;

  /**
   * Nucleus sampling threshold
   * Range: 0.0 to 1.0
   * Default: 1.0
   */
  top_p?: number;

  /**
   * Frequency penalty
   * Range: -2.0 to 2.0
   * Default: 0
   */
  frequency_penalty?: number;

  /**
   * Presence penalty
   * Range: -2.0 to 2.0
   * Default: 0
   */
  presence_penalty?: number;
}
```

### JSON Schema Types

```typescript
/**
 * JSON Schema definition for structured responses
 */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Response format configuration for structured JSON output
 */
export interface ResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: boolean;
    schema: JsonSchema;
  };
}
```

### Request/Response Types

```typescript
/**
 * Chat completion request configuration
 */
export interface ChatCompletionRequest {
  /**
   * Model identifier (e.g., 'nvidia/nemotron-nano-12b-v2-vl:free')
   */
  model: string;

  /**
   * Array of chat messages
   */
  messages: ChatMessage[];

  /**
   * Optional response format for structured JSON output
   */
  response_format?: ResponseFormat;

  /**
   * Model generation parameters
   */
  parameters?: ModelParameters;

  /**
   * Enable streaming responses
   * Default: false
   */
  stream?: boolean;
}

/**
 * Usage information from API response
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Chat completion response from OpenRouter
 */
export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  }>;
  usage?: TokenUsage;
  created: number;
}

/**
 * Parsed structured response
 */
export interface StructuredChatResponse<T = unknown> {
  /**
   * Parsed JSON content matching the provided schema
   */
  data: T;

  /**
   * Token usage information
   */
  usage?: TokenUsage;

  /**
   * Model that generated the response
   */
  model: string;

  /**
   * Finish reason
   */
  finishReason: string | null;
}

/**
 * Simple text response
 */
export interface TextChatResponse {
  /**
   * Generated text content
   */
  content: string;

  /**
   * Token usage information
   */
  usage?: TokenUsage;

  /**
   * Model that generated the response
   */
  model: string;

  /**
   * Finish reason
   */
  finishReason: string | null;
}
```

---

## 5. Error Handling

### Error Codes

```typescript
export type OpenRouterErrorCode =
  | 'configuration_error'        // Missing or invalid configuration
  | 'network_error'              // Network/connection issues
  | 'timeout_error'              // Request timeout
  | 'authentication_error'       // Invalid API key (401)
  | 'rate_limit_error'           // Rate limit exceeded (429)
  | 'quota_exceeded_error'       // Account quota exceeded (402)
  | 'invalid_request_error'      // Malformed request (400)
  | 'model_not_found_error'      // Model doesn't exist (404)
  | 'server_error'               // OpenRouter server error (5xx)
  | 'json_parse_error'           // Failed to parse JSON response
  | 'schema_validation_error'    // Response doesn't match schema
  | 'unknown_error';             // Unexpected error
```

### Custom Error Class

```typescript
interface OpenRouterErrorOptions {
  code: OpenRouterErrorCode;
  message: string;
  cause?: unknown;
  statusCode?: number;
  retryable?: boolean;
}

export class OpenRouterServiceError extends Error {
  public readonly code: OpenRouterErrorCode;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(options: OpenRouterErrorOptions) {
    super(options.message);
    this.name = 'OpenRouterServiceError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}
```

### Error Mapping

```typescript
/**
 * Maps HTTP status codes to appropriate error codes
 */
const mapHttpStatusToErrorCode = (status: number): OpenRouterErrorCode => {
  switch (status) {
    case 400:
      return 'invalid_request_error';
    case 401:
      return 'authentication_error';
    case 402:
      return 'quota_exceeded_error';
    case 404:
      return 'model_not_found_error';
    case 429:
      return 'rate_limit_error';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'server_error';
    default:
      return 'unknown_error';
  }
};

/**
 * Determines if an error is retryable based on error code
 */
const isRetryableError = (code: OpenRouterErrorCode): boolean => {
  return ['network_error', 'timeout_error', 'rate_limit_error', 'server_error'].includes(code);
};
```

### Error Scenarios

#### 1. Network Errors
**Scenario**: Connection timeout, DNS failure, no network

**Handling**:
```typescript
catch (error) {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    throw new OpenRouterServiceError({
      code: 'network_error',
      message: 'Failed to connect to OpenRouter API',
      cause: error,
      retryable: true,
    });
  }
}
```

#### 2. Authentication Errors (401)
**Scenario**: Invalid or missing API key

**Handling**:
```typescript
if (response.status === 401) {
  throw new OpenRouterServiceError({
    code: 'authentication_error',
    message: 'Invalid OpenRouter API key',
    statusCode: 401,
    retryable: false,
  });
}
```

#### 3. Rate Limiting (429)
**Scenario**: Too many requests in time window

**Handling**:
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('retry-after');
  throw new OpenRouterServiceError({
    code: 'rate_limit_error',
    message: `Rate limit exceeded. Retry after: ${retryAfter || 'unknown'}`,
    statusCode: 429,
    retryable: true,
  });
}
```

#### 4. Quota Exceeded (402)
**Scenario**: Account has insufficient credits

**Handling**:
```typescript
if (response.status === 402) {
  throw new OpenRouterServiceError({
    code: 'quota_exceeded_error',
    message: 'OpenRouter account quota exceeded',
    statusCode: 402,
    retryable: false,
  });
}
```

#### 5. Invalid Request (400)
**Scenario**: Malformed request body or parameters

**Handling**:
```typescript
if (response.status === 400) {
  const errorData = await response.json().catch(() => ({}));
  throw new OpenRouterServiceError({
    code: 'invalid_request_error',
    message: errorData.error?.message || 'Invalid request to OpenRouter API',
    statusCode: 400,
    retryable: false,
    cause: errorData,
  });
}
```

#### 6. Model Not Found (404)
**Scenario**: Requested model doesn't exist

**Handling**:
```typescript
if (response.status === 404) {
  throw new OpenRouterServiceError({
    code: 'model_not_found_error',
    message: `Model '${model}' not found`,
    statusCode: 404,
    retryable: false,
  });
}
```

#### 7. Server Errors (5xx)
**Scenario**: OpenRouter internal server error

**Handling**:
```typescript
if (response.status >= 500) {
  throw new OpenRouterServiceError({
    code: 'server_error',
    message: `OpenRouter server error (${response.status})`,
    statusCode: response.status,
    retryable: true,
  });
}
```

#### 8. Timeout Errors
**Scenario**: Request exceeds timeout threshold

**Handling**:
```typescript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new OpenRouterServiceError({
      code: 'timeout_error',
      message: `Request timeout after ${timeoutMs}ms`,
      retryable: true,
    }));
  }, timeoutMs);
});
```

#### 9. JSON Parse Errors
**Scenario**: Response is not valid JSON

**Handling**:
```typescript
try {
  const data = await response.json();
} catch (error) {
  throw new OpenRouterServiceError({
    code: 'json_parse_error',
    message: 'Failed to parse OpenRouter API response',
    cause: error,
    retryable: false,
  });
}
```

#### 10. Schema Validation Errors
**Scenario**: Response doesn't match expected JSON schema

**Handling**:
```typescript
try {
  const parsedData = JSON.parse(content);
  // Perform schema validation here
} catch (error) {
  throw new OpenRouterServiceError({
    code: 'schema_validation_error',
    message: 'Response does not match expected schema',
    cause: error,
    retryable: false,
  });
}
```

---

## 6. Retry Logic Implementation

### Exponential Backoff Strategy

```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: OpenRouterServiceError) => boolean;
}

/**
 * Calculates delay for retry attempt using exponential backoff with jitter
 */
const calculateRetryDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  
  // Add jitter (random factor between 0.5 and 1.5)
  const jitter = 0.5 + Math.random();
  
  // Cap at maxDelay
  return Math.min(exponentialDelay * jitter, maxDelayMs);
};

/**
 * Executes a function with retry logic
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  let lastError: OpenRouterServiceError | undefined;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof OpenRouterServiceError)) {
        throw error;
      }
      
      lastError = error;
      
      // Don't retry if error is not retryable or we've exhausted retries
      if (!options.shouldRetry(error) || attempt === options.maxRetries) {
        throw error;
      }
      
      // Calculate and wait for retry delay
      const delay = calculateRetryDelay(attempt, options.baseDelayMs, options.maxDelayMs);
      
      console.warn('OpenRouter request failed, retrying...', {
        attempt: attempt + 1,
        maxRetries: options.maxRetries,
        errorCode: error.code,
        delayMs: delay,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
```

### Default Retry Configuration

```typescript
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,      // 1 second
  maxDelayMs: 30000,      // 30 seconds
  shouldRetry: (error) => error.retryable,
};
```

---

## 7. Public API Methods

### 7.1 Create Chat Completion (Text Response)

```typescript
/**
 * Creates a chat completion request and returns text response
 * 
 * @param messages - Array of chat messages
 * @param options - Optional request configuration
 * @returns Promise resolving to text response
 * 
 * @example
 * ```typescript
 * const response = await createChatCompletion([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'What is TypeScript?' }
 * ], {
 *   model: 'nvidia/nemotron-nano-12b-v2-vl:free',
 *   parameters: { temperature: 0.7, max_tokens: 500 }
 * });
 * console.log(response.content);
 * ```
 */
export const createChatCompletion = async (
  messages: ChatMessage[],
  options?: {
    model?: string;
    parameters?: ModelParameters;
  },
): Promise<TextChatResponse> => {
  // Implementation details in step-by-step section
};
```

### 7.2 Create Structured Chat Completion (JSON Response)

```typescript
/**
 * Creates a chat completion with structured JSON response
 * 
 * @param messages - Array of chat messages
 * @param responseFormat - JSON schema definition for response
 * @param options - Optional request configuration
 * @returns Promise resolving to structured data
 * 
 * @example
 * ```typescript
 * interface Recipe {
 *   title: string;
 *   ingredients: string[];
 *   instructions: string[];
 * }
 * 
 * const response = await createStructuredChatCompletion<Recipe>(
 *   [
 *     { role: 'system', content: 'You generate recipes.' },
 *     { role: 'user', content: 'Create a pasta recipe.' }
 *   ],
 *   {
 *     type: 'json_schema',
 *     json_schema: {
 *       name: 'recipe_response',
 *       strict: true,
 *       schema: {
 *         type: 'object',
 *         properties: {
 *           title: { type: 'string' },
 *           ingredients: { type: 'array', items: { type: 'string' } },
 *           instructions: { type: 'array', items: { type: 'string' } }
 *         },
 *         required: ['title', 'ingredients', 'instructions'],
 *         additionalProperties: false
 *       }
 *     }
 *   }
 * );
 * console.log(response.data.title);
 * ```
 */
export const createStructuredChatCompletion = async <T = unknown>(
  messages: ChatMessage[],
  responseFormat: ResponseFormat,
  options?: {
    model?: string;
    parameters?: ModelParameters;
  },
): Promise<StructuredChatResponse<T>> => {
  // Implementation details in step-by-step section
};
```

### 7.3 Helper: Build System Message

```typescript
/**
 * Creates a system message
 * 
 * @param content - System message content
 * @returns ChatMessage with role 'system'
 * 
 * @example
 * ```typescript
 * const systemMsg = buildSystemMessage('You are a recipe expert.');
 * ```
 */
export const buildSystemMessage = (content: string): ChatMessage => ({
  role: 'system',
  content,
});
```

### 7.4 Helper: Build User Message

```typescript
/**
 * Creates a user message
 * 
 * @param content - User message content
 * @returns ChatMessage with role 'user'
 * 
 * @example
 * ```typescript
 * const userMsg = buildUserMessage('Create a healthy recipe.');
 * ```
 */
export const buildUserMessage = (content: string): ChatMessage => ({
  role: 'user',
  content,
});
```

### 7.5 Helper: Validate JSON Schema

```typescript
/**
 * Validates a JSON schema for correctness
 * 
 * @param schema - JSON schema to validate
 * @throws OpenRouterServiceError if schema is invalid
 * 
 * @example
 * ```typescript
 * validateJsonSchema({
 *   type: 'object',
 *   properties: { name: { type: 'string' } },
 *   required: ['name'],
 *   additionalProperties: false
 * });
 * ```
 */
export const validateJsonSchema = (schema: JsonSchema): void => {
  // Implementation details in step-by-step section
};
```

---

## 8. Private Implementation Methods

### 8.1 Build Request Payload

```typescript
/**
 * Constructs the request payload for OpenRouter API
 */
const buildRequestPayload = (request: ChatCompletionRequest): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
  };

  if (request.response_format) {
    payload.response_format = request.response_format;
  }

  if (request.parameters) {
    Object.assign(payload, request.parameters);
  }

  if (request.stream !== undefined) {
    payload.stream = request.stream;
  }

  return payload;
};
```

### 8.2 Execute HTTP Request

```typescript
/**
 * Executes HTTP POST request to OpenRouter API with timeout
 */
const executeRequest = async (
  endpoint: string,
  payload: Record<string, unknown>,
  config: OpenRouterConfig,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://healthymeals.ai',  // Optional: your site URL
        'X-Title': 'HealthyMealsAI',                 // Optional: your app name
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenRouterServiceError({
        code: 'timeout_error',
        message: `Request timeout after ${config.requestTimeoutMs}ms`,
        cause: error,
        retryable: true,
      });
    }

    throw new OpenRouterServiceError({
      code: 'network_error',
      message: 'Network request failed',
      cause: error,
      retryable: true,
    });
  }
};
```

### 8.3 Handle Error Response

```typescript
/**
 * Processes error responses from OpenRouter API
 */
const handleErrorResponse = async (response: Response): Promise<never> => {
  const errorCode = mapHttpStatusToErrorCode(response.status);
  const retryable = isRetryableError(errorCode);

  let errorMessage = `OpenRouter API error (${response.status})`;
  let errorDetails: unknown;

  try {
    errorDetails = await response.json();
    if (typeof errorDetails === 'object' && errorDetails !== null && 'error' in errorDetails) {
      const apiError = errorDetails as { error: { message?: string } };
      if (apiError.error?.message) {
        errorMessage = apiError.error.message;
      }
    }
  } catch {
    // Failed to parse error response, use default message
  }

  throw new OpenRouterServiceError({
    code: errorCode,
    message: errorMessage,
    statusCode: response.status,
    retryable,
    cause: errorDetails,
  });
};
```

### 8.4 Parse Chat Response

```typescript
/**
 * Parses standard chat completion response
 */
const parseChatResponse = (apiResponse: ChatCompletionResponse): TextChatResponse => {
  const choice = apiResponse.choices[0];
  
  if (!choice || !choice.message) {
    throw new OpenRouterServiceError({
      code: 'json_parse_error',
      message: 'Invalid response structure from OpenRouter',
      retryable: false,
    });
  }

  return {
    content: choice.message.content,
    usage: apiResponse.usage,
    model: apiResponse.model,
    finishReason: choice.finish_reason,
  };
};
```

### 8.5 Parse Structured Response

```typescript
/**
 * Parses structured JSON response and validates against schema
 */
const parseStructuredResponse = <T>(
  apiResponse: ChatCompletionResponse,
  expectedSchema: JsonSchema,
): StructuredChatResponse<T> => {
  const choice = apiResponse.choices[0];
  
  if (!choice || !choice.message) {
    throw new OpenRouterServiceError({
      code: 'json_parse_error',
      message: 'Invalid response structure from OpenRouter',
      retryable: false,
    });
  }

  let parsedData: T;
  
  try {
    parsedData = JSON.parse(choice.message.content) as T;
  } catch (error) {
    throw new OpenRouterServiceError({
      code: 'json_parse_error',
      message: 'Failed to parse JSON response',
      cause: error,
      retryable: false,
    });
  }

  // Basic schema validation (can be enhanced with a library like Ajv)
  try {
    validateResponseAgainstSchema(parsedData, expectedSchema);
  } catch (error) {
    throw new OpenRouterServiceError({
      code: 'schema_validation_error',
      message: 'Response does not match expected schema',
      cause: error,
      retryable: false,
    });
  }

  return {
    data: parsedData,
    usage: apiResponse.usage,
    model: apiResponse.model,
    finishReason: choice.finish_reason,
  };
};
```

### 8.6 Validate Response Against Schema

```typescript
/**
 * Performs basic validation of data against JSON schema
 * For production, consider using a library like Ajv for comprehensive validation
 */
const validateResponseAgainstSchema = (data: unknown, schema: JsonSchema): void => {
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null) {
      throw new Error(`Expected object, got ${typeof data}`);
    }

    const dataObj = data as Record<string, unknown>;

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in dataObj)) {
          throw new Error(`Missing required property: ${requiredProp}`);
        }
      }
    }

    // Validate properties (basic check)
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in dataObj) {
          validateResponseAgainstSchema(dataObj[key], propSchema);
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      throw new Error(`Expected array, got ${typeof data}`);
    }

    if (schema.items) {
      for (const item of data) {
        validateResponseAgainstSchema(item, schema.items);
      }
    }
  } else if (schema.type === 'string') {
    if (typeof data !== 'string') {
      throw new Error(`Expected string, got ${typeof data}`);
    }
  } else if (schema.type === 'number') {
    if (typeof data !== 'number') {
      throw new Error(`Expected number, got ${typeof data}`);
    }
  } else if (schema.type === 'boolean') {
    if (typeof data !== 'boolean') {
      throw new Error(`Expected boolean, got ${typeof data}`);
    }
  }
  // Additional type checks can be added as needed
};
```

### 8.7 Validate Messages

```typescript
/**
 * Validates message array before sending to API
 */
const validateMessages = (messages: ChatMessage[]): void => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new OpenRouterServiceError({
      code: 'invalid_request_error',
      message: 'Messages array cannot be empty',
      retryable: false,
    });
  }

  for (const [index, message] of messages.entries()) {
    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
      throw new OpenRouterServiceError({
        code: 'invalid_request_error',
        message: `Invalid role at message index ${index}: ${message.role}`,
        retryable: false,
      });
    }

    if (typeof message.content !== 'string' || message.content.trim().length === 0) {
      throw new OpenRouterServiceError({
        code: 'invalid_request_error',
        message: `Empty or invalid content at message index ${index}`,
        retryable: false,
      });
    }
  }
};
```

---

## 9. Security Considerations

### 9.1 API Key Management

**Best Practices**:

1. **Never commit API keys to version control**
   - Use `.env` files
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **API Key Storage**
   ```typescript
   // ✅ GOOD: Load from environment
   const apiKey = import.meta.env.OPENROUTER_API_KEY;
   
   // ❌ BAD: Hardcoded key
   const apiKey = 'sk-or-v1-abcd1234...';
   ```

3. **Validate on startup**
   ```typescript
   if (!apiKey || apiKey.includes('your_api_key_here')) {
     throw new Error('Valid OPENROUTER_API_KEY required');
   }
   ```

### 9.2 Sanitization and Input Validation

**User Input**:

1. **Sanitize user messages**
   ```typescript
   const sanitizeUserInput = (input: string): string => {
     // Remove control characters
     const cleaned = input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
     
     // Trim whitespace
     return cleaned.trim();
   };
   ```

2. **Limit message length**
   ```typescript
   const MAX_MESSAGE_LENGTH = 10000;
   
   const validateMessageLength = (content: string): void => {
     if (content.length > MAX_MESSAGE_LENGTH) {
       throw new OpenRouterServiceError({
         code: 'invalid_request_error',
         message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
         retryable: false,
       });
     }
   };
   ```

### 9.3 Rate Limiting

**Implementation Strategies**:

1. **Track usage per user**
   ```typescript
   // Store in database or cache
   interface UserQuota {
     userId: string;
     requestCount: number;
     windowStart: Date;
   }
   ```

2. **Implement quota checks before API calls**
   ```typescript
   const checkUserQuota = async (userId: string): Promise<void> => {
     // Check against daily/hourly limits
     // Throw error if exceeded
   };
   ```

### 9.4 Logging and Monitoring

**Safe Logging**:

```typescript
/**
 * Logs request/response without exposing sensitive data
 */
const logApiCall = (
  messages: ChatMessage[],
  response: TextChatResponse | StructuredChatResponse,
  durationMs: number,
): void => {
  console.log('OpenRouter API call completed', {
    messageCount: messages.length,
    model: response.model,
    tokensUsed: response.usage?.total_tokens,
    durationMs,
    finishReason: response.finishReason,
    // ❌ DO NOT log: API keys, full message content, user PII
  });
};
```

**Error Logging**:

```typescript
const logApiError = (error: OpenRouterServiceError, context: Record<string, unknown>): void => {
  console.error('OpenRouter API error', {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    retryable: error.retryable,
    ...context,
    // ❌ DO NOT log: API keys, sensitive user data
  });
};
```

### 9.5 Content Filtering

**Basic Content Checks**:

```typescript
/**
 * Checks for potentially problematic content patterns
 */
const validateContentSafety = (content: string): void => {
  // Example: Block attempts to inject system instructions
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /system:\s*you\s+are/i,
    // Add more patterns as needed
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      throw new OpenRouterServiceError({
        code: 'invalid_request_error',
        message: 'Content contains potentially unsafe patterns',
        retryable: false,
      });
    }
  }
};
```

### 9.6 HTTPS Only

**Ensure secure connections**:

```typescript
const ensureSecureConnection = (url: string): void => {
  if (!url.startsWith('https://')) {
    throw new OpenRouterServiceError({
      code: 'configuration_error',
      message: 'OpenRouter base URL must use HTTPS',
      retryable: false,
    });
  }
};
```

---

## 10. Step-by-Step Implementation Plan

### Step 1: Setup and Configuration

**Tasks**:

1. Create service file: `src/lib/services/openrouter.service.ts`
2. Add environment variables to `.env`:
   ```bash
   OPENROUTER_API_KEY=your_key_here
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   OPENROUTER_DEFAULT_MODEL=nvidia/nemotron-nano-12b-v2-vl:free
   OPENROUTER_REQUEST_TIMEOUT_MS=60000
   OPENROUTER_MAX_RETRIES=3
   ```
3. Update `.env.example` with the same variables (without actual key)
4. Ensure `.env` is in `.gitignore`

**Deliverable**: Configuration system ready

---

### Step 2: Define Type Definitions

**Tasks**:

1. Add interface definitions for:
   - `ChatMessage`
   - `ModelParameters`
   - `JsonSchema`
   - `ResponseFormat`
   - `ChatCompletionRequest`
   - `ChatCompletionResponse`
   - `TokenUsage`
   - `TextChatResponse`
   - `StructuredChatResponse<T>`
   - `OpenRouterConfig`
   - `RetryOptions`

2. Add all types to the top of `openrouter.service.ts`

**Deliverable**: Complete type system for the service

---

### Step 3: Implement Error Handling

**Tasks**:

1. Define `OpenRouterErrorCode` type
2. Create `OpenRouterServiceError` class
3. Implement `mapHttpStatusToErrorCode` function
4. Implement `isRetryableError` function

**Code**:

```typescript
export type OpenRouterErrorCode = /* ... as defined in section 5 */;

interface OpenRouterErrorOptions {
  code: OpenRouterErrorCode;
  message: string;
  cause?: unknown;
  statusCode?: number;
  retryable?: boolean;
}

export class OpenRouterServiceError extends Error {
  public readonly code: OpenRouterErrorCode;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(options: OpenRouterErrorOptions) {
    super(options.message);
    this.name = 'OpenRouterServiceError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

const mapHttpStatusToErrorCode = (status: number): OpenRouterErrorCode => {
  // Implementation from section 5
};

const isRetryableError = (code: OpenRouterErrorCode): boolean => {
  return ['network_error', 'timeout_error', 'rate_limit_error', 'server_error'].includes(code);
};
```

**Deliverable**: Complete error handling system

---

### Step 4: Implement Configuration Management

**Tasks**:

1. Create `getOpenRouterConfig` function
2. Add validation for required configuration
3. Implement secure URL validation

**Code**:

```typescript
const getOpenRouterConfig = (): OpenRouterConfig => {
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new OpenRouterServiceError({
      code: 'configuration_error',
      message: 'OPENROUTER_API_KEY environment variable is required',
    });
  }

  const baseUrl = import.meta.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  
  if (!baseUrl.startsWith('https://')) {
    throw new OpenRouterServiceError({
      code: 'configuration_error',
      message: 'OpenRouter base URL must use HTTPS',
    });
  }

  return {
    apiKey: apiKey.trim(),
    baseUrl,
    defaultModel: import.meta.env.OPENROUTER_DEFAULT_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free',
    requestTimeoutMs: parseInt(import.meta.env.OPENROUTER_REQUEST_TIMEOUT_MS || '60000', 10),
    maxRetries: parseInt(import.meta.env.OPENROUTER_MAX_RETRIES || '3', 10),
  };
};
```

**Deliverable**: Secure configuration loading

---

### Step 5: Implement Retry Logic

**Tasks**:

1. Implement `calculateRetryDelay` function
2. Implement `withRetry` function
3. Define `DEFAULT_RETRY_OPTIONS`

**Code**: As defined in section 6

**Deliverable**: Exponential backoff retry system

---

### Step 6: Implement Core Private Methods

**Tasks**:

1. `validateMessages` - Validate message array
2. `validateMessageLength` - Check message length limits
3. `sanitizeUserInput` - Clean user input
4. `buildRequestPayload` - Construct API request
5. `executeRequest` - Execute HTTP request with timeout
6. `handleErrorResponse` - Process error responses

**Order**: Implement in the order listed above

**Deliverable**: Core internal utilities

---

### Step 7: Implement Response Parsing

**Tasks**:

1. `parseChatResponse` - Parse text responses
2. `validateResponseAgainstSchema` - Basic schema validation
3. `parseStructuredResponse` - Parse and validate JSON responses

**Code**: As defined in section 8

**Deliverable**: Response parsing and validation

---

### Step 8: Implement Helper Functions

**Tasks**:

1. `buildSystemMessage` - Create system messages
2. `buildUserMessage` - Create user messages
3. `validateJsonSchema` - Validate JSON schemas

**Code**:

```typescript
export const buildSystemMessage = (content: string): ChatMessage => ({
  role: 'system',
  content,
});

export const buildUserMessage = (content: string): ChatMessage => ({
  role: 'user',
  content,
});

export const validateJsonSchema = (schema: JsonSchema): void => {
  if (!schema.type) {
    throw new OpenRouterServiceError({
      code: 'invalid_request_error',
      message: 'JSON schema must have a type property',
      retryable: false,
    });
  }

  if (schema.type === 'object') {
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      throw new OpenRouterServiceError({
        code: 'invalid_request_error',
        message: 'Object schema must define properties',
        retryable: false,
      });
    }
  }
};
```

**Deliverable**: Public helper utilities

---

### Step 9: Implement Main Public API - Text Completion

**Tasks**:

1. Implement `createChatCompletion` function
2. Integrate validation, retry logic, and error handling
3. Add logging

**Code**:

```typescript
export const createChatCompletion = async (
  messages: ChatMessage[],
  options?: {
    model?: string;
    parameters?: ModelParameters;
  },
): Promise<TextChatResponse> => {
  const config = getOpenRouterConfig();
  const model = options?.model || config.defaultModel;

  // Validate input
  validateMessages(messages);

  // Build request
  const request: ChatCompletionRequest = {
    model,
    messages,
    parameters: options?.parameters,
    stream: false,
  };

  const payload = buildRequestPayload(request);

  // Execute with retry logic
  const startTime = Date.now();
  
  const response = await withRetry(
    async () => {
      const httpResponse = await executeRequest('/chat/completions', payload, config);
      
      if (!httpResponse.ok) {
        await handleErrorResponse(httpResponse);
      }

      let apiResponse: ChatCompletionResponse;
      try {
        apiResponse = await httpResponse.json();
      } catch (error) {
        throw new OpenRouterServiceError({
          code: 'json_parse_error',
          message: 'Failed to parse API response',
          cause: error,
          retryable: false,
        });
      }

      return parseChatResponse(apiResponse);
    },
    {
      ...DEFAULT_RETRY_OPTIONS,
      maxRetries: config.maxRetries,
    },
  );

  const durationMs = Date.now() - startTime;
  
  console.log('OpenRouter chat completion', {
    model,
    messageCount: messages.length,
    tokensUsed: response.usage?.total_tokens,
    durationMs,
  });

  return response;
};
```

**Deliverable**: Working text completion API

---

### Step 10: Implement Structured Completion API

**Tasks**:

1. Implement `createStructuredChatCompletion` function
2. Add schema validation
3. Integrate with retry and error handling

**Code**:

```typescript
export const createStructuredChatCompletion = async <T = unknown>(
  messages: ChatMessage[],
  responseFormat: ResponseFormat,
  options?: {
    model?: string;
    parameters?: ModelParameters;
  },
): Promise<StructuredChatResponse<T>> => {
  const config = getOpenRouterConfig();
  const model = options?.model || config.defaultModel;

  // Validate input
  validateMessages(messages);
  validateJsonSchema(responseFormat.json_schema.schema);

  // Build request
  const request: ChatCompletionRequest = {
    model,
    messages,
    response_format: responseFormat,
    parameters: options?.parameters,
    stream: false,
  };

  const payload = buildRequestPayload(request);

  // Execute with retry logic
  const startTime = Date.now();
  
  const response = await withRetry(
    async () => {
      const httpResponse = await executeRequest('/chat/completions', payload, config);
      
      if (!httpResponse.ok) {
        await handleErrorResponse(httpResponse);
      }

      let apiResponse: ChatCompletionResponse;
      try {
        apiResponse = await httpResponse.json();
      } catch (error) {
        throw new OpenRouterServiceError({
          code: 'json_parse_error',
          message: 'Failed to parse API response',
          cause: error,
          retryable: false,
        });
      }

      return parseStructuredResponse<T>(apiResponse, responseFormat.json_schema.schema);
    },
    {
      ...DEFAULT_RETRY_OPTIONS,
      maxRetries: config.maxRetries,
    },
  );

  const durationMs = Date.now() - startTime;
  
  console.log('OpenRouter structured completion', {
    model,
    schemaName: responseFormat.json_schema.name,
    messageCount: messages.length,
    tokensUsed: response.usage?.total_tokens,
    durationMs,
  });

  return response;
};
```

**Deliverable**: Working structured completion API

---

### Step 11: Add Documentation and Examples

**Tasks**:

1. Add JSDoc comments to all public functions
2. Create usage examples in comments
3. Document error codes and their meanings

**Deliverable**: Well-documented service

---

### Step 12: Testing

**Tasks**:

1. **Manual Testing**:
   - Test with valid API key
   - Test with invalid API key (should get auth error)
   - Test text completion
   - Test structured completion
   - Test retry logic (temporarily use invalid model)

2. **Error Scenario Testing**:
   - Network timeout
   - Invalid model
   - Invalid schema
   - Empty messages

3. **Integration Testing**:
   - Use service in recipe generation
   - Use service in adaptation proposals

**Test Checklist**:
- [ ] Configuration loads correctly
- [ ] Text completion works
- [ ] Structured completion works
- [ ] Schema validation catches errors
- [ ] Retry logic activates on failures
- [ ] Error codes map correctly
- [ ] Timeout handling works
- [ ] Logging is safe (no API keys logged)

**Deliverable**: Tested and verified service

---

### Step 13: Integration with Existing Services

**Tasks**:

1. **Update `adaptation.service.ts`**:
   - Replace `generateMockProposal` with OpenRouter service call
   - Create appropriate system and user messages
   - Define JSON schema for adaptation responses

2. **Example Integration**:
   ```typescript
   import {
     createStructuredChatCompletion,
     buildSystemMessage,
     buildUserMessage,
     type ResponseFormat,
   } from './openrouter.service';

   const generateAdaptationProposal = async (
     recipe: RecipeDTO,
     goal: AdaptationGoal,
     allergens: string[],
     dislikedIngredients: string[],
   ): Promise<{ recipeText: string; macros: RecipeMacroDTO; explanation: string }> => {
     const systemMessage = buildSystemMessage(
       'You are a culinary expert that adapts recipes based on dietary requirements.'
     );

     const userMessage = buildUserMessage(
       `Adapt this recipe:\n${recipe.recipeText}\n\nGoal: ${goal}\nAllergens to avoid: ${allergens.join(', ')}\nDisliked ingredients: ${dislikedIngredients.join(', ')}`
     );

     const responseFormat: ResponseFormat = {
       type: 'json_schema',
       json_schema: {
         name: 'recipe_adaptation',
         strict: true,
         schema: {
           type: 'object',
           properties: {
             recipeText: { type: 'string' },
             macros: {
               type: 'object',
               properties: {
                 kcal: { type: 'number' },
                 protein: { type: 'number' },
                 carbs: { type: 'number' },
                 fat: { type: 'number' },
               },
               required: ['kcal', 'protein', 'carbs', 'fat'],
               additionalProperties: false,
             },
             explanation: { type: 'string' },
           },
           required: ['recipeText', 'macros', 'explanation'],
           additionalProperties: false,
         },
       },
     };

     const response = await createStructuredChatCompletion<{
       recipeText: string;
       macros: RecipeMacroDTO;
       explanation: string;
     }>(
       [systemMessage, userMessage],
       responseFormat,
       { parameters: { temperature: 0.7, max_tokens: 2000 } }
     );

     return response.data;
   };
   ```

**Deliverable**: OpenRouter service integrated into application

---

### Step 14: Monitoring and Optimization

**Tasks**:

1. **Add metrics tracking**:
   - Track API call duration
   - Track token usage
   - Track error rates

2. **Cost optimization**:
   - Monitor token consumption
   - Adjust `max_tokens` based on use case
   - Consider caching for identical requests

3. **Performance optimization**:
   - Tune timeout values
   - Adjust retry parameters based on observed behavior

**Deliverable**: Production-ready, monitored service

---

## 11. Example Usage Scenarios

### Example 1: Simple Text Generation

```typescript
import { createChatCompletion, buildSystemMessage, buildUserMessage } from './openrouter.service';

const generateRecipeIdea = async (cuisine: string): Promise<string> => {
  const response = await createChatCompletion([
    buildSystemMessage('You are a creative chef.'),
    buildUserMessage(`Suggest a ${cuisine} recipe idea.`),
  ], {
    parameters: { temperature: 0.8, max_tokens: 300 },
  });

  return response.content;
};
```

### Example 2: Structured Recipe Generation

```typescript
import { createStructuredChatCompletion, buildSystemMessage, buildUserMessage } from './openrouter.service';
import type { ResponseFormat } from './openrouter.service';

interface RecipeOutput {
  title: string;
  servings: number;
  ingredients: Array<{ item: string; amount: string }>;
  instructions: string[];
  macros: { kcal: number; protein: number; carbs: number; fat: number };
}

const generateRecipe = async (requirements: string): Promise<RecipeOutput> => {
  const systemMsg = buildSystemMessage(
    'You are a professional chef and nutritionist. Generate complete recipes with accurate nutritional information.'
  );

  const userMsg = buildUserMessage(
    `Create a recipe that meets these requirements: ${requirements}`
  );

  const responseFormat: ResponseFormat = {
    type: 'json_schema',
    json_schema: {
      name: 'recipe_output',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Recipe title' },
          servings: { type: 'number', description: 'Number of servings' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                amount: { type: 'string' },
              },
              required: ['item', 'amount'],
              additionalProperties: false,
            },
          },
          instructions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Step-by-step instructions',
          },
          macros: {
            type: 'object',
            properties: {
              kcal: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
            },
            required: ['kcal', 'protein', 'carbs', 'fat'],
            additionalProperties: false,
          },
        },
        required: ['title', 'servings', 'ingredients', 'instructions', 'macros'],
        additionalProperties: false,
      },
    },
  };

  const response = await createStructuredChatCompletion<RecipeOutput>(
    [systemMsg, userMsg],
    responseFormat,
    {
      parameters: {
        temperature: 0.7,
        max_tokens: 2000,
      },
    },
  );

  return response.data;
};
```

### Example 3: Multi-turn Conversation

```typescript
import { createChatCompletion, buildSystemMessage, buildUserMessage, type ChatMessage } from './openrouter.service';

const conductRecipeConsultation = async (): Promise<string> => {
  const messages: ChatMessage[] = [
    buildSystemMessage('You are a helpful cooking assistant.'),
    buildUserMessage('I want to make pasta.'),
    { role: 'assistant', content: 'Great! What type of pasta dish are you interested in? Creamy, tomato-based, or something else?' },
    buildUserMessage('Creamy and high-protein.'),
  ];

  const response = await createChatCompletion(messages, {
    parameters: { temperature: 0.7, max_tokens: 500 },
  });

  return response.content;
};
```

### Example 4: Error Handling in Application

```typescript
import {
  createChatCompletion,
  OpenRouterServiceError,
  buildSystemMessage,
  buildUserMessage,
} from './openrouter.service';

const generateWithErrorHandling = async (prompt: string): Promise<string> => {
  try {
    const response = await createChatCompletion([
      buildSystemMessage('You are a helpful assistant.'),
      buildUserMessage(prompt),
    ]);

    return response.content;
  } catch (error) {
    if (error instanceof OpenRouterServiceError) {
      switch (error.code) {
        case 'authentication_error':
          console.error('Invalid API key configuration');
          throw new Error('Service configuration error. Please contact support.');

        case 'rate_limit_error':
          console.error('Rate limit exceeded');
          throw new Error('Too many requests. Please try again later.');

        case 'quota_exceeded_error':
          console.error('Account quota exceeded');
          throw new Error('Service quota exceeded. Please contact support.');

        case 'timeout_error':
          console.error('Request timeout');
          throw new Error('Request took too long. Please try again.');

        default:
          console.error('OpenRouter error:', error);
          throw new Error('Failed to generate response. Please try again.');
      }
    }

    console.error('Unexpected error:', error);
    throw new Error('An unexpected error occurred.');
  }
};
```

---

## 12. Advanced Features (Optional Enhancements)

### 12.1 Streaming Responses

For real-time response streaming (future enhancement):

```typescript
export const createStreamingChatCompletion = async function* (
  messages: ChatMessage[],
  options?: {
    model?: string;
    parameters?: ModelParameters;
  },
): AsyncGenerator<string, void, unknown> {
  // Implementation for streaming responses
  // Yields chunks as they arrive
};
```

### 12.2 Response Caching

For identical requests:

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();

const getCacheKey = (messages: ChatMessage[], model: string): string => {
  return JSON.stringify({ messages, model });
};
```

### 12.3 Request Batching

For multiple concurrent requests:

```typescript
export const batchChatCompletions = async (
  requests: Array<{ messages: ChatMessage[]; options?: object }>,
): Promise<TextChatResponse[]> => {
  // Execute multiple requests in parallel with rate limiting
};
```

### 12.4 Token Counting

For cost estimation:

```typescript
export const estimateTokenCount = (text: string): number => {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
};
```

---

## 13. Checklist for Completion

### Implementation Checklist

- [ ] Environment configuration setup
- [ ] Type definitions complete
- [ ] Error handling implemented
- [ ] Configuration validation working
- [ ] Retry logic with exponential backoff
- [ ] HTTP request execution with timeout
- [ ] Error response handling
- [ ] Message validation
- [ ] Request payload building
- [ ] Text response parsing
- [ ] Structured response parsing
- [ ] Schema validation (basic)
- [ ] Helper functions (buildSystemMessage, buildUserMessage)
- [ ] Public API: createChatCompletion
- [ ] Public API: createStructuredChatCompletion
- [ ] JSDoc documentation
- [ ] Usage examples in comments

### Security Checklist

- [ ] API keys not committed to version control
- [ ] HTTPS-only connections
- [ ] Input sanitization
- [ ] Message length limits
- [ ] Safe logging (no secrets logged)
- [ ] Content validation
- [ ] Rate limiting considerations

### Testing Checklist

- [ ] Text completion test
- [ ] Structured completion test
- [ ] Error handling tests
- [ ] Retry logic test
- [ ] Timeout test
- [ ] Schema validation test
- [ ] Invalid API key test
- [ ] Integration with existing services

### Documentation Checklist

- [ ] Function signatures documented
- [ ] Examples provided
- [ ] Error codes documented
- [ ] Configuration options documented
- [ ] Security best practices documented

---

## 14. Maintenance and Future Considerations

### Monitoring

1. **Track key metrics**:
   - Request success/failure rates
   - Average response times
   - Token consumption
   - Error code distribution

2. **Set up alerts**:
   - High error rates
   - Quota approaching limit
   - Unusual latency

### Updates

1. **Keep OpenRouter API compatibility**:
   - Monitor OpenRouter API changes
   - Update types and error codes as needed

2. **Model updates**:
   - Test with new models as they become available
   - Update default model as better options emerge

### Optimization

1. **Cost optimization**:
   - Monitor token usage patterns
   - Optimize prompts for efficiency
   - Implement caching for repeated requests

2. **Performance optimization**:
   - Tune timeout and retry parameters
   - Consider parallel requests for batch operations
   - Profile and optimize hot paths

---

## 15. Conclusion

This implementation plan provides a comprehensive guide for building a robust, secure, and maintainable OpenRouter service that:

1. **Follows existing patterns**: Uses functional exports like other services in the codebase
2. **Handles errors gracefully**: Comprehensive error handling with retry logic
3. **Supports structured responses**: Full JSON Schema support for type-safe AI responses
4. **Prioritizes security**: API key management, input validation, and safe logging
5. **Provides clear interfaces**: Well-typed, documented public API

By following this plan step-by-step, you will create a production-ready service that integrates seamlessly with the HealthyMealsAI application and provides a solid foundation for all LLM-based features.

### Next Steps

1. Begin with Step 1 (Setup and Configuration)
2. Proceed sequentially through Steps 2-14
3. Use the checklist in Section 13 to track progress
4. Refer to the examples in Section 11 for usage patterns
5. Consider advanced features in Section 12 for future enhancements

Good luck with the implementation! 🚀

