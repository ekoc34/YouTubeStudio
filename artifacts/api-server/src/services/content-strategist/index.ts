import { z } from "zod/v4";
import {
  AIConfigurationError,
  createStructuredAIProvider,
} from "./provider";

const ideaDraftSchema = z.object({
  title: z.string().min(1).max(180),
  topic: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  description: z.string().max(3000),
  targetAudience: z.string().min(1).max(240),
  format: z.string().min(1).max(100),
  estimatedDuration: z.number().int().min(10).max(180),
  viralScore: z.number().int().min(0).max(100),
  originalityScore: z.number().int().min(0).max(100),
  rationale: z.string().min(1),
  weaknesses: z.array(z.string()).max(8),
  improvements: z.array(z.string()).max(8),
});

const generatedIdeasSchema = z.object({
  ideas: z.array(ideaDraftSchema).min(1).max(8),
});

const analysisSchema = z.object({
  viralScore: z.number().int().min(0).max(100),
  originalityScore: z.number().int().min(0).max(100),
  explanation: z.string().min(1),
  hookOptions: z.array(z.string().min(1)).min(1).max(5),
  weaknesses: z.array(z.string()).max(8),
  improvements: z.array(z.string()).max(8),
});

const generatedSceneSchema = z.object({
  sequence: z.number().int().min(1),
  narration: z.string(),
  visualInstructions: z.string(),
  onScreenText: z.string(),
  soundSuggestion: z.string(),
});

const generatedScriptSchema = z.object({
  hook: z.string().min(1).max(800),
  narration: z.string().min(1).max(12000),
  scenes: z.array(generatedSceneSchema).min(3).max(24),
  soundMusic: z.string().max(1000),
  cta: z.string().max(800),
});

export type IdeaDraft = z.infer<typeof ideaDraftSchema>;
export type StrategistAnalysis = z.infer<typeof analysisSchema>;
export type GeneratedScript = z.infer<typeof generatedScriptSchema>;

export class ContentStrategist {
  constructor(
    private readonly provider = createStructuredAIProvider(),
  ) {}

  async generateIdeas(input: {
    topic?: string;
    targetAudience?: string;
    format?: string;
    count: number;
  }): Promise<IdeaDraft[]> {
    const result = await this.provider.generateStructured<
      z.infer<typeof generatedIdeasSchema>
    >({
      task: [
        "You are a YouTube Shorts content strategist.",
        "Create original, specific concepts designed for short-form video.",
        "Score viral potential and originality from 0 to 100; these are editorial estimates, not predictions.",
        "Do not claim you researched live YouTube trends or competing videos.",
        "Return one JSON object with an ideas array. Each idea must include title, topic, hook, description, targetAudience, format, estimatedDuration, viralScore, originalityScore, rationale, weaknesses, and improvements.",
      ].join(" "),
      input: [
        `Generate exactly ${input.count} distinct YouTube Shorts ideas.`,
        `Topic: ${input.topic?.trim() || "Choose a focused, evergreen topic."}`,
        `Target audience: ${input.targetAudience?.trim() || "A broad but clearly defined audience."}`,
        `Preferred format: ${input.format?.trim() || "Choose the best format for each idea."}`,
      ].join("\n"),
      schema: generatedIdeasSchema,
    });

    return result.ideas;
  }

  async analyzeIdea(input: {
    title: string;
    topic: string;
    hook: string;
    description: string;
    targetAudience: string;
    format: string;
    estimatedDuration: number;
  }): Promise<StrategistAnalysis> {
    return this.provider.generateStructured<StrategistAnalysis>({
      task: [
        "You are a YouTube Shorts content strategist.",
        "Evaluate the supplied concept without claiming to have checked live trends, competitors, or performance data.",
        "Give honest 0-100 editorial estimates for viral potential and originality, explain the reasoning, identify specific weaknesses, and suggest actionable improvements.",
        "Return a JSON object with viralScore, originalityScore, explanation, hookOptions (3 distinct hooks), weaknesses, and improvements.",
      ].join(" "),
      input: JSON.stringify(input),
      schema: analysisSchema,
    });
  }

  async generateShortsScript(input: {
    title: string;
    topic: string;
    hook: string;
    description: string;
    targetAudience: string;
    format: string;
    estimatedDuration: number;
    targetDurationSeconds: number;
    tone?: string;
  }): Promise<GeneratedScript> {
    return this.provider.generateStructured<GeneratedScript>({
      task: [
        "You write original, audience-aware YouTube Shorts scripts.",
        "Create a complete, shootable script for the requested duration.",
        "The output must contain a strong opening hook, one coherent narration, 3 to 12 ordered scenes with scene narration, specific visual instructions, concise on-screen text, and a per-scene sound suggestion, plus an overall sound/music suggestion and a natural call to action.",
        "Keep scenes aligned with the narration, use vertical-video framing cues, and do not claim any media has been generated.",
        "Return a JSON object with hook, narration, scenes, soundMusic, and cta.",
      ].join(" "),
      input: JSON.stringify(input),
      schema: generatedScriptSchema,
    });
  }
}

export { AIConfigurationError };
