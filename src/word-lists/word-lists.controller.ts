import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WordListsService } from './word-lists.service';

class WordItemDto {
  word: string;
  definition?: string;
  example?: string;
}

class CreateWordListDto {
  title: string;
  description?: string;
  words: WordItemDto[];
}

@Controller('word-lists')
export class WordListsController {
  constructor(private readonly wordListsService: WordListsService) {}

  @ApiOkResponse({ description: 'Returns all public and admin word lists' })
  @Get()
  getLists() {
    return this.wordListsService.getLists();
  }

  @ApiOkResponse({ description: 'Returns the default admin list with all words' })
  @ApiNotFoundResponse({ description: 'Default list not found' })
  @Get('default')
  getDefaultList() {
    return this.wordListsService.getDefaultList();
  }

  @ApiParam({ name: 'id', description: 'Word list ID' })
  @ApiOkResponse({ description: 'Returns the word list with all its words' })
  @ApiNotFoundResponse({ description: 'Word list not found' })
  @Get(':id')
  getListById(@Param('id') id: string) {
    return this.wordListsService.getListById(id);
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
          items: {
            type: 'object',
            required: ['word'],
            properties: {
              word: { type: 'string' },
              definition: { type: 'string' },
              example: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Returns the new list id and word count' })
  @ApiBadRequestResponse({ description: 'Missing title or empty words array' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @Post()
  createFromJson(
    @Request() req: { user: { id: string } },
    @Body() body: CreateWordListDto,
  ) {
    if (!body.title) throw new BadRequestException('title is required');
    if (!body.words?.length) throw new BadRequestException('words array is required');
    return this.wordListsService.createFromJson(req.user.id, body.title, body.description, body.words);
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
  @ApiOkResponse({ description: 'Creates a word list with AI-generated definitions and examples' })
  @ApiBadRequestResponse({ description: 'Missing title or empty words array' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  createWithAiDefinitions(
    @Request() req: { user: { id: string } },
    @Body() body: { title: string; description?: string; words: string[] },
  ) {
    if (!body.title) throw new BadRequestException('title is required');
    if (!body.words?.length) throw new BadRequestException('words array is required');
    return this.wordListsService.createWithAiDefinitions(
      req.user.id,
      body.title,
      body.description,
      body.words,
    );
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ description: 'Returns the new list id and word count' })
  @ApiBadRequestResponse({ description: 'Invalid or missing file/title' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @Post('upload-csv')
  uploadCsv(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!title) {
      throw new BadRequestException('title is required');
    }
    return this.wordListsService.uploadCsv(
      req.user.id,
      title,
      description,
      file.buffer,
    );
  }
}
