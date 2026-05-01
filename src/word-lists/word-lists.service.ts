import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class WordListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async getDefaultList() {
    const list = await this.prisma.wordList.findFirst({
      where: { isAdmin: true },
      include: { words: true },
    });
    if (!list) throw new NotFoundException('Default list not found');
    return list;
  }

  async getListById(id: string) {
    const list = await this.prisma.wordList.findUnique({
      where: { id },
      include: { words: true },
    });
    if (!list) throw new NotFoundException('Word list not found');
    return list;
  }

  async getLists() {
    return this.prisma.wordList.findMany({
      include: {
        owner: { select: { id: true, email: true } },
        _count: { select: { words: true } },
      },
    });
  }

  async createFromJson(
    ownerId: string,
    title: string,
    description: string | undefined,
    words: { word: string; definition?: string; example?: string }[],
  ): Promise<{ listId: string; count: number }> {
    if (!words.length) throw new BadRequestException('words array is empty');

    const list = await this.prisma.wordList.create({
      data: { title, description, ownerId },
    });

    const result = await this.prisma.word.createMany({
      data: words.map((w) => ({
        term: w.word,
        definition: w.definition ?? '',
        example: w.example ?? null,
        listId: list.id,
      })),
    });

    return { listId: list.id, count: result.count };
  }

  async createWithAiDefinitions(
    ownerId: string,
    title: string,
    description: string | undefined,
    words: string[],
  ): Promise<{ listId: string; count: number }> {
    if (!words.length) throw new BadRequestException('words array is empty');

    const generated = await this.ai.generateDefinitions(words);

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

  async uploadCsv(
    ownerId: string,
    title: string,
    description: string | undefined,
    fileBuffer: Buffer,
  ): Promise<{ listId: string; count: number }> {
    let rows: string[][];
    try {
      rows = parse(fileBuffer, {
        skip_empty_lines: true,
        trim: true,
      }) as string[][];
    } catch {
      throw new BadRequestException('Failed to parse CSV file');
    }

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    const list = await this.prisma.wordList.create({
      data: { title, description, ownerId },
    });

    const data = rows.map((row) => ({
      term: row[0] ?? '',
      definition: row[1] ?? '',
      example: row[2] || null,
      listId: list.id,
    }));

    const result = await this.prisma.word.createMany({ data, skipDuplicates: false });
    return { listId: list.id, count: result.count };
  }
}
