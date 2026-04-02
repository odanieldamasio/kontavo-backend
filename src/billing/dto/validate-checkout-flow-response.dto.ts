import { ApiProperty } from '@nestjs/swagger';

export class ValidateCheckoutFlowResponseDto {
  @ApiProperty()
  valid!: boolean;
}
