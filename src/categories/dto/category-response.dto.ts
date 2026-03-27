import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  color!: string;

  @ApiProperty()
  icon!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty({ nullable: true })
  deletedAt!: Date | null;
}
