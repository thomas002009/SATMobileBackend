import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

const RETRY_DELAYS_MS = [3000, 8000, 20000];

const DEFAULT_MODEL = 'google/gemma-4-31b-it:free';

@Injectable()
export class AiService {
  private readonly client: OpenAI;

  constructor(private readonly prisma: PrismaService) {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:8080',
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

  async generateSingleDefinition(
    word: string,
  ): Promise<{ word: string; definition: string; example: string }> {
    const results = await this.generateDefinitions([word]);
    return results[0];
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
        const is429 =
          err instanceof OpenAI.RateLimitError || (err as any)?.status === 429;
        if (!is429 || attempt === RETRY_DELAYS_MS.length) {
          lastError = err;
          break;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ServiceUnavailableException(
      `AI request failed: ${errMsg}`,
      { cause: lastError },
    );
  }

  async parsePdfAndCreate(
    ownerId: string,
    pdfText: string,
    title: string,
  ): Promise<{ listId: string; count: number }> {
    const prompt = `The text below is a word list extracted from a PDF. It contains words paired with their definitions. The text may have artifacts such as broken formatting, extra whitespace, or garbled characters — use context to infer the correct pairings.

Parse every word-definition pair and return ONLY a valid JSON object with no markdown, no code fences, no extra text:
{"words":[{"word":"<term>","definition":"<definition>","example":"<example sentence>"}]}

For each entry, preserve the original definition and generate one short example sentence.

Text:
${pdfText}`;

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await this.client.responses.create({
          model: DEFAULT_MODEL,
          input: prompt,
        });

        const raw = response.output_text.trim();
        const jsonStart = raw.indexOf('{');
        const jsonEnd = raw.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('AI did not return a valid JSON object');
        }

        const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
          words: { word: string; definition: string; example: string }[];
        };

        if (!Array.isArray(parsed.words) || parsed.words.length === 0) {
          throw new Error('AI returned no words');
        }

        const list = await this.prisma.wordList.create({
          data: { title, ownerId },
        });

        const result = await this.prisma.word.createMany({
          data: parsed.words.map((w) => ({
            term: w.word,
            definition: w.definition,
            example: w.example || null,
            listId: list.id,
          })),
        });

        return { listId: list.id, count: result.count };
      } catch (err) {
        const is429 =
          err instanceof OpenAI.RateLimitError || (err as any)?.status === 429;
        if (!is429 || attempt === RETRY_DELAYS_MS.length) {
          lastError = err;
          break;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }

    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ServiceUnavailableException(`AI request failed: ${errMsg}`, {
      cause: lastError,
    });
  }

  async createWithAiDefinitions(
    ownerId: string,
    title: string,
    description: string | undefined,
    words: string[],
  ): Promise<{ listId: string; count: number }> {
    const generated = await this.generateDefinitions(words);

    const list = await this.prisma.wordList.create({
      data: { title, description, ownerId },
    });

    const result = await this.prisma.word.createMany({
      data: generated.map((w) => ({
        term: w.word,
        definition: w.definition,
        example: w.example || null,
        listId: list.id,
      })),
    });

    return { listId: list.id, count: result.count };
  }
}
