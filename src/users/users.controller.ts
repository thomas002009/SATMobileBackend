import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns the authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: { user: { id: string; email: string; createdAt: Date } }) {
    return req.user;
  }
}
