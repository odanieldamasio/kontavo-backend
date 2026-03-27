import { Controller, Get, NotFoundException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Obter usuario autenticado' })
  @ApiResponse({ status: 200, type: UserProfileDto })
  @Get('me')
  async me(@CurrentUser() currentUser: JwtPayload): Promise<UserProfileDto> {
    const user = await this.usersService.findById(currentUser.sub);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.toSafeUser(user);
  }
}
