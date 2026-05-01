import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';

const RETRY_DELAYS_MS = [3000, 8000, 20000];

const DEFAULT_MODEL = 'google/gemma-4-31b-it:free';

@Injectable()
export class AiService {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
        'X-Title': 'VocabProject',
      },
    });
  }

  async createResponse(
    input: string | OpenAI.Responses.EasyInputMessage[],
    options?: Partial<OpenAI.Responses.ResponseCreateParamsNonStreaming>,
  ) {
    return this.client.responses.create({
      model: DEFAULT_MODEL,
      input,
      ...options,
    });
  }

  async streamResponse(
    input: string | OpenAI.Responses.EasyInputMessage[],
    options?: Partial<OpenAI.Responses.ResponseCreateParamsStreaming>,
  ) {
    return this.client.responses.create({
      model: DEFAULT_MODEL,
      input,
      stream: true,
      ...options,
    });
  }

  async generateDefinitions(
    words: string[],
  ): Promise<{ word: string; definition: string; example: string }[]> {
    const prompt = `You are a dictionary assistant. For each word in the list below, provide a clear, concise definition and one example sentence.

Return ONLY a valid JSON array with no markdown, no code fences, no extra text. Each element must have exactly these fields: "word", "definition", "example".

Words: ${words.join(', ')}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await this.client.responses.create({
          model: DEFAULT_MODEL,
          input: prompt,
        });

        const raw = response.output_text.trim();
        const jsonStart = raw.indexOf('[');
        const jsonEnd = raw.lastIndexOf(']');
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('AI did not return a valid JSON array');
        }

        return JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
          word: string;
          definition: string;
          example: string;
        }[];
      } catch (err) {
        const is429 = err instanceof OpenAI.RateLimitError || (err as any)?.status === 429;
        if (!is429 || attempt === RETRY_DELAYS_MS.length) {
          lastError = err;
          break;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }

    throw new ServiceUnavailableException(
      'AI model is currently rate-limited. Please try again in a moment.',
      { cause: lastError },
    );
  }
}
