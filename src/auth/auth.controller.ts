import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthService } from './auth.service';
import { SafeUser } from './types/safe-user.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Registrar novo usuario' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @Post('register')
  register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Realizar login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @Post('login')
  login(
    @Body() _loginDto: LoginDto,
    @CurrentUser() user: SafeUser
  ): Promise<AuthResponseDto> {
    return this.authService.login(user);
  }

  @Public()
  @ApiOperation({ summary: 'Atualizar tokens usando refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @Post('refresh')
  refresh(@Body() refreshDto: RefreshDto): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(refreshDto);
  }
}
