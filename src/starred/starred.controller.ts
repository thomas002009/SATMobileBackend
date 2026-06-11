import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StarredService } from './starred.service';

@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@UseGuards(JwtAuthGuard)
@Controller('starred')
export class StarredController {
  constructor(private readonly starredService: StarredService) {}

  @ApiOkResponse({ description: 'Returns array of starred word IDs for the current user' })
  @Get()
  getStarredIds(@Request() req: { user: { id: string } }) {
    return this.starredService.getStarredIds(req.user.id);
  }

  @ApiParam({ name: 'wordId', description: 'Word ID to toggle star on' })
  @ApiOkResponse({ description: 'Returns { starred: boolean } after toggling' })
  @Post(':wordId')
  async toggleStar(
    @Request() req: { user: { id: string } },
    @Param('wordId') wordId: string,
  ) {
    const starred = await this.starredService.toggleStar(req.user.id, wordId);
    return { starred };
  }
}
