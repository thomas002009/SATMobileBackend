import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CalendarSettingsData = {
  sourceListId: string | null;
  chunkOverrides: Record<string, number | null>;
  extraListIds: string[];
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<CalendarSettingsData> {
    const settings = await this.prisma.userCalendarSettings.findUnique({
      where: { userId },
    });
    if (!settings) {
      return { sourceListId: null, chunkOverrides: {}, extraListIds: [] };
    }
    return {
      sourceListId: settings.sourceListId ?? null,
      chunkOverrides: settings.chunkOverrides as Record<string, number | null>,
      extraListIds: settings.extraListIds as string[],
    };
  }

  async saveSettings(
    userId: string,
    data: CalendarSettingsData,
  ): Promise<CalendarSettingsData> {
    const saved = await this.prisma.userCalendarSettings.upsert({
      where: { userId },
      create: {
        userId,
        sourceListId: data.sourceListId,
        chunkOverrides: data.chunkOverrides,
        extraListIds: data.extraListIds,
      },
      update: {
        sourceListId: data.sourceListId,
        chunkOverrides: data.chunkOverrides,
        extraListIds: data.extraListIds,
      },
    });
    return {
      sourceListId: saved.sourceListId ?? null,
      chunkOverrides: saved.chunkOverrides as Record<string, number | null>,
      extraListIds: saved.extraListIds as string[],
    };
  }
}
