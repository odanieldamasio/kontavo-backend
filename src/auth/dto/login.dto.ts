import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'daniel@jadeon.com' })
  email!: string;

  @ApiProperty({ example: '12345678' })
  password!: string;
}
