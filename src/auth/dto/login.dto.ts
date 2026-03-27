import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'daniel@kontavo.com' })
  email!: string;

  @ApiProperty({ example: '12345678' })
  password!: string;
}
