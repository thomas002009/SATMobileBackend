import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      required: ['word'],
      properties: {
        word: { type: 'string', example: 'ephemeral' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Returns AI-generated definition and example for the word',
    schema: {
      type: 'object',
      properties: {
        word: { type: 'string' },
        definition: { type: 'string' },
        example: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'word is required' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @Post('define')
  defineWord(@Body() body: { word: string }) {
    if (!body.word?.trim()) throw new BadRequestException('word is required');
    return this.ai.generateSingleDefinition(body.word.trim());
  }

  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      required: ['words'],
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            required: ['word'],
            properties: {
              word: { type: 'string' },
              definition: { type: 'string' },
              example: { type: 'string' },
            },
          },
          example: [{ word: 'ephemeral' }, { word: 'serendipity' }],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Returns the list with AI-generated definitions and examples',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          definition: { type: 'string' },
          example: { type: 'string' },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'words array is required' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  async enrichList(
    @Body() body: { words: { word: string; [key: string]: unknown }[] },
  ) {
    if (!body.words?.length)
      throw new BadRequestException('words array is required');

    const terms = body.words.map((w) => {
      if (!w.word?.trim())
        throw new BadRequestException('each item must have a word field');
      return w.word.trim();
    });

    const generated = await this.ai.generateDefinitions(terms);

    return body.words.map((original, i) => ({
      ...original,
      definition: generated[i]?.definition ?? '',
      example: generated[i]?.example ?? '',
    }));
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF file to parse' },
        title: { type: 'string', example: 'Chapter 3 Vocabulary' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Extracts and returns raw text from an uploaded PDF',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'file is required' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post('upload-pdf')
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');
    const text = await this.ai.extractPdfText(file.buffer);
    if (!text.trim()) throw new BadRequestException('could not extract text from PDF');
    return { text };
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF file to parse' },
        title: { type: 'string', example: 'Chapter 3 Vocabulary' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Extracts PDF text, parses it via AI, and saves it as a word list',
    schema: {
      type: 'object',
      properties: {
        listId: { type: 'string' },
        count: { type: 'number' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'file or title is required' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post('parse-pdf')
  async parsePdf(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!title?.trim()) throw new BadRequestException('title is required');
    const text = await this.ai.extractPdfText(file.buffer);
    if (!text.trim()) throw new BadRequestException('could not extract text from PDF');
    return this.ai.parsePdfAndCreate(req.user.id, text.trim(), title.trim());
  }

  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'words'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        words: {
          type: 'array',
          items: { type: 'string' },
          example: ['ephemeral', 'serendipity', 'ubiquitous'],
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Creates a word list with AI-generated definitions and examples',
  })
  @ApiBadRequestResponse({ description: 'Missing title or empty words array' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  generateWordList(
    @Request() req: { user: { id: string } },
    @Body() body: { title: string; description?: string; words: string[] },
  ) {
    if (!body.title) throw new BadRequestException('title is required');
    if (!body.words?.length)
      throw new BadRequestException('words array is required');
    return this.ai.createWithAiDefinitions(
      req.user.id,
      body.title,
      body.description,
      body.words,
    );
  }
}
