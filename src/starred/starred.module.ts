import { Module } from '@nestjs/common';
import { StarredController } from './starred.controller';
import { StarredService } from './starred.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StarredController],
  providers: [StarredService],
})
export class StarredModule {}
