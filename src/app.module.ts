import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WordListsModule } from './word-lists/word-lists.module';
import { AiModule } from './ai/ai.module';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    WordListsModule,
    AiModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
