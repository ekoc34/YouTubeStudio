import OpenAI from "openai";
import { z, type ZodType } from "zod/v4";

export type StructuredGenerationRequest<T> = {
  task: string;
  input: string;
  schema: ZodType<T>;
};

export interface StructuredAIProvider {
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>;
}

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export class AIProviderRequestError extends Error {
  readonly providerName: "openai" | "openrouter";
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(
    providerName: "openai" | "openrouter",
    message: string,
    status?: number,
    code?: string,
  ) {
    super(message);
    this.name = "AIProviderRequestError";
    this.providerName = providerName;
    this.status = status;
    this.code = code;
  }
}

export class OpenAIProvider implements StructuredAIProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${request.task}\nReturn only a valid JSON object matching the requested fields. Do not wrap it in markdown.`,
        },
        { role: "user", content: request.input },
      ],
    });

    const firstChoice =
      response && typeof response === "object" && Array.isArray(response.choices)
        ? response.choices[0]
        : undefined;
    const message =
      firstChoice && typeof firstChoice === "object"
        ? firstChoice.message
        : undefined;
    const content =
      message && typeof message === "object" ? message.content : undefined;
    if (typeof content !== "string" || content.length === 0) {
      throw new AIProviderRequestError(
        "openrouter",
        "OpenRouter returned an empty or unsupported structured response. Retry or choose a different OPENROUTER_MODEL.",
      );
    }

    return request.schema.parse(JSON.parse(content) as unknown);
  }
}

function configuredAIProviderName(): string {
  return (
    process.env.AI_PROVIDER?.trim() ||
    process.env.CONTENT_STRATEGIST_PROVIDER?.trim() ||
    "openai"
  ).toLowerCase();
}

export function isAIProviderConfigured(): boolean {
  const providerName = configuredAIProviderName();
  if (providerName === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (providerName === "openrouter") {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }
  return false;
}

function openRouterErrorMetadata(error: unknown): {
  status?: number;
  code?: string;
} {
  if (!error || typeof error !== "object") return {};
  const providerError = error as { code?: unknown; status?: unknown };
  const code =
    typeof providerError.code === "string" &&
    /^[A-Za-z0-9_.-]{1,80}$/.test(providerError.code)
      ? providerError.code
      : undefined;
  return {
    ...(typeof providerError.status === "number"
      ? { status: providerError.status }
      : {}),
    ...(code ? { code } : {}),
  };
}

function toOpenRouterRequestError(error: unknown): AIProviderRequestError {
  const { status, code } = openRouterErrorMetadata(error);
  const normalizedCode = code?.toLowerCase() ?? "";
  const timedOut =
    error instanceof Error && /timeout/i.test(error.name);
  let message: string;

  if (timedOut) {
    message =
      "OpenRouter did not respond before the request timed out. Retry later or choose a responsive OPENROUTER_MODEL.";
  } else if (status === 401 || status === 403) {
    message =
      "OpenRouter could not authenticate this request. Check that OPENROUTER_API_KEY is configured correctly.";
  } else if (
    status === 402 ||
    normalizedCode.includes("insufficient_quota") ||
    normalizedCode.includes("credit_balance")
  ) {
    message =
      "OpenRouter has no available credits for this request. Check the account or free-model limits, then retry.";
  } else if (status === 429 || normalizedCode.includes("rate_limit")) {
    message =
      "OpenRouter rate limits were reached. Wait briefly and retry; free-model availability can vary.";
  } else if (status === 400 || status === 404) {
    message =
      "The configured OpenRouter model or structured-output format is unavailable. Choose a supported OPENROUTER_MODEL and retry.";
  } else if (status != null && status >= 500) {
    message = "OpenRouter is temporarily unavailable. Try again later.";
  } else {
    message =
      "The OpenRouter request could not be completed. Check provider settings and model availability, then retry.";
  }

  return new AIProviderRequestError("openrouter", message, status, code);
}

// OpenRouter's free router selects an available model supporting the requested structured-output parameters.
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

export class OpenRouterProvider implements StructuredAIProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      maxRetries: 0,
      timeout: 120_000,
    });
    this.model = model;
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      const { $schema: _schemaVersion, ...jsonSchema } = z.toJSONSchema(
        request.schema,
      );
      const openRouterProviderOptions = {
        provider: { require_parameters: true },
        ...(this.model === "qwen/qwen3.8-27b:free"
          ? { reasoning: { effort: "low" } }
          : {}),
      };
      response = await this.client.chat.completions.create({
        ...openRouterProviderOptions,
        model: this.model,
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "structured_response",
            strict: true,
            schema: jsonSchema,
          },
        },
        messages: [
          {
            role: "system",
            content: `${request.task}\nReturn only a valid JSON object matching the requested fields. Do not wrap it in markdown.`,
          },
          { role: "user", content: request.input },
        ],
      });
    } catch (error) {
      throw toOpenRouterRequestError(error);
    }

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("The AI provider returned an empty response.");
    }

    return request.schema.parse(JSON.parse(content) as unknown);
  }
}

export function createStructuredAIProvider(): StructuredAIProvider {
  const providerName = configuredAIProviderName();

  if (providerName === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new AIConfigurationError(
        "OPENROUTER_API_KEY is missing. Add it through Replit Secrets to enable OpenRouter AI generation.",
      );
    }
    const model =
      process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
    return new OpenRouterProvider(apiKey, model);
  }

  if (providerName !== "openai") {
    throw new AIConfigurationError(
      `Unsupported AI provider "${providerName}". Set AI_PROVIDER to "openai" or "openrouter".`,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIConfigurationError(
      "OPENAI_API_KEY is missing. Add it through Replit Secrets to enable AI generation.",
    );
  }

  return new OpenAIProvider(apiKey, process.env.OPENAI_MODEL ?? "gpt-5-mini");
}

export const scoreSchema = z.number().int().min(0).max(100);
