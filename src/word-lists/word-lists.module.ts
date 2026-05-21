import { Module } from '@nestjs/common';
import { WordListsController } from './word-lists.controller';
import { WordListsService } from './word-lists.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WordListsController],
  providers: [WordListsService],
})
export class WordListsModule {}
