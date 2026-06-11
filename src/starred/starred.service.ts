import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StarredService {
  constructor(private readonly prisma: PrismaService) {}

  async getStarredIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userWordProgress.findMany({
      where: { userId, starred: true },
      select: { wordId: true },
    });
    return rows.map((r) => r.wordId);
  }

  async toggleStar(userId: string, wordId: string): Promise<boolean> {
    const existing = await this.prisma.userWordProgress.findUnique({
      where: { userId_wordId: { userId, wordId } },
    });

    if (existing) {
      const updated = await this.prisma.userWordProgress.update({
        where: { userId_wordId: { userId, wordId } },
        data: { starred: !existing.starred },
      });
      return updated.starred;
    }

    const created = await this.prisma.userWordProgress.create({
      data: { userId, wordId, starred: true },
    });
    return created.starred;
  }
}
