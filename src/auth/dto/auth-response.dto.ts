import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from '../../users/dto/user-profile.dto';
import { SafeUser } from '../types/safe-user.type';

export class AuthResponseDto {
  @ApiProperty({ type: UserProfileDto })
  user!: SafeUser;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
