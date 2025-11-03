/**
 * OpenRouter Service
 * 
 * Manages all interactions with the OpenRouter API for LLM-based operations.
 * Provides type-safe interfaces for chat completions with support for:
 * - Text responses
 * - Structured JSON responses with schema validation
 * - Error handling with retry logic
 * - Security best practices
 */

// ============================================================================
// Type Definitions
// ============================================================================

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

/**
 * OpenRouter service configuration
 */
interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
}

/**
 * Retry options configuration
 */
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: OpenRouterServiceError) => boolean;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error codes for OpenRouter service operations
 */
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

/**
 * Options for creating OpenRouter service errors
 */
interface OpenRouterErrorOptions {
  code: OpenRouterErrorCode;
  message: string;
  cause?: unknown;
  statusCode?: number;
  retryable?: boolean;
}

/**
 * Custom error class for OpenRouter service operations
 */
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

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Loads and validates OpenRouter configuration from environment variables
 * @throws {OpenRouterServiceError} If required configuration is missing or invalid
 */
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

// ============================================================================
// Retry Logic
// ============================================================================

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

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,      // 1 second
  maxDelayMs: 30000,      // 30 seconds
  shouldRetry: (error) => error.retryable,
};

// ============================================================================
// Private Implementation Methods
// ============================================================================

/**
 * Maximum message length to prevent abuse
 */
const MAX_MESSAGE_LENGTH = 10000;

/**
 * Sanitizes user input by removing control characters and trimming whitespace
 */
const sanitizeUserInput = (input: string): string => {
  // Remove control characters
  const cleaned = input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Trim whitespace
  return cleaned.trim();
};

/**
 * Validates message length
 * @throws {OpenRouterServiceError} If message exceeds maximum length
 */
const validateMessageLength = (content: string): void => {
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new OpenRouterServiceError({
      code: 'invalid_request_error',
      message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      retryable: false,
    });
  }
};

/**
 * Validates message array before sending to API
 * @throws {OpenRouterServiceError} If messages are invalid
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

    validateMessageLength(message.content);
  }
};

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

/**
 * Executes HTTP POST request to OpenRouter API with timeout
 * @throws {OpenRouterServiceError} On network errors or timeout
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

/**
 * Processes error responses from OpenRouter API
 * @throws {OpenRouterServiceError} Always throws with appropriate error details
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

/**
 * Parses standard chat completion response
 * @throws {OpenRouterServiceError} If response structure is invalid
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

/**
 * Performs basic validation of data against JSON schema
 * For production, consider using a library like Ajv for comprehensive validation
 * @throws {Error} If validation fails
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

/**
 * Parses structured JSON response and validates against schema
 * @throws {OpenRouterServiceError} If parsing or validation fails
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

// ============================================================================
// Public Helper Functions
// ============================================================================

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

// ============================================================================
// Public API Methods
// ============================================================================

/**
 * Creates a chat completion request and returns text response
 * 
 * @param messages - Array of chat messages
 * @param options - Optional request configuration
 * @returns Promise resolving to text response
 * 
 * @throws {OpenRouterServiceError} On configuration, validation, network, or API errors
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

/**
 * Creates a chat completion with structured JSON response
 * 
 * @param messages - Array of chat messages
 * @param responseFormat - JSON schema definition for response
 * @param options - Optional request configuration
 * @returns Promise resolving to structured data
 * 
 * @throws {OpenRouterServiceError} On configuration, validation, network, or API errors
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

