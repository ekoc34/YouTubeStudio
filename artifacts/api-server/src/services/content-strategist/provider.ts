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

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error("The AI provider returned an empty response.");
    }

    return request.schema.parse(JSON.parse(content) as unknown);
  }
}

export function createStructuredAIProvider(): StructuredAIProvider {
  const providerName = process.env.CONTENT_STRATEGIST_PROVIDER ?? "openai";

  if (providerName !== "openai") {
    throw new AIConfigurationError(
      `The configured content strategist provider "${providerName}" is not installed.`,
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
