import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Transporte' })
  name?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  color?: string;

  @ApiPropertyOptional({ example: 'car' })
  icon?: string;

  @ApiPropertyOptional({ example: false })
  isDefault?: boolean;
}
