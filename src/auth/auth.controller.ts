import { Controller, Post, Body } from '@nestjs/common';
import { ApiOkResponse, ApiConflictResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOkResponse({ description: 'Returns a JWT access token' })
  @ApiConflictResponse({ description: 'Email already in use' })
  @Post('register')
  register(@Body() body: AuthDto) {
    return this.authService.register(body.email, body.password);
  }

  @ApiOkResponse({ description: 'Returns a JWT access token' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Post('login')
  login(@Body() body: AuthDto) {
    return this.authService.login(body.email, body.password);
  }
}
