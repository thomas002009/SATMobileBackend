import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

class SaveCalendarDto {
  sourceListId: string | null;
  chunkOverrides: Record<string, number | null>;
  extraListIds: string[];
}

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  getSettings(@Request() req: { user: { id: string } }) {
    return this.calendarService.getSettings(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put()
  saveSettings(
    @Request() req: { user: { id: string } },
    @Body() body: SaveCalendarDto,
  ) {
    return this.calendarService.saveSettings(req.user.id, {
      sourceListId: body.sourceListId ?? null,
      chunkOverrides: body.chunkOverrides ?? {},
      extraListIds: body.extraListIds ?? [],
    });
  }
}
