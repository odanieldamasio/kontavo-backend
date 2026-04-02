import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlanType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { SafeUser } from './types/safe-user.type';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    if (registerDto.phone) {
      const existingPhoneUser = await this.usersService.findByPhone(registerDto.phone);

      if (existingPhoneUser) {
        throw new ConflictException('Phone already in use');
      }
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, this.saltRounds);
    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: hashedPassword,
      phone: registerDto.phone,
      planType: PlanType.FREE
    });

    return this.issueTokens(user);
  }

  async validateUser(email: string, password: string): Promise<SafeUser> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.usersService.toSafeUser(user);
  }

  async login(user: SafeUser): Promise<AuthResponseDto> {
    return this.issueTokens(user);
  }

  async refreshTokens(refreshDto: RefreshDto): Promise<AuthResponseDto> {
    const storedRefreshToken = await this.redisService.get(
      this.getRefreshKey(refreshDto.userId)
    );

    if (!storedRefreshToken || storedRefreshToken !== refreshDto.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = await this.verifyRefreshToken(refreshDto.refreshToken);

    if (payload.sub !== refreshDto.userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokens(this.usersService.toSafeUser(user));
  }

  private async issueTokens(user: SafeUser): Promise<AuthResponseDto> {
    const accessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m'
    );
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d'
    );
    const payloadBase = {
      sub: user.id,
      email: user.email
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          ...payloadBase,
          type: 'access'
        },
        {
          expiresIn: this.parseDurationToSeconds(accessExpiresIn)
        }
      ),
      this.jwtService.signAsync(
        {
          ...payloadBase,
          type: 'refresh'
        },
        {
          expiresIn: this.parseDurationToSeconds(refreshExpiresIn)
        }
      )
    ]);

    await this.redisService.set(
      this.getRefreshKey(user.id),
      refreshToken,
      this.parseDurationToSeconds(refreshExpiresIn)
    );

    return {
      user,
      accessToken,
      refreshToken
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET')
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getRefreshKey(userId: string): string {
    return `refresh:${userId}`;
  }

  private parseDurationToSeconds(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 7 * 24 * 60 * 60;
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
