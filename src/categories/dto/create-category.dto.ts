import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Alimentacao' })
  name!: string;

  @ApiProperty({ example: '#22C55E' })
  color!: string;

  @ApiProperty({ example: 'shopping-bag' })
  icon!: string;

  @ApiPropertyOptional({ example: false, default: false })
  isDefault?: boolean;
}
