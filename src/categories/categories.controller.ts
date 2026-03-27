import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Criar categoria' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @Post()
  create(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateCategoryDto
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(currentUser.sub, dto);
  }

  @ApiOperation({ summary: 'Listar categorias ativas do usuario' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @Get()
  findAll(@CurrentUser() currentUser: JwtPayload): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(currentUser.sub);
  }

  @ApiOperation({ summary: 'Atualizar categoria' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @Patch(':id')
  update(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(currentUser.sub, id, dto);
  }

  @ApiOperation({ summary: 'Remover categoria com soft delete' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @Delete(':id')
  remove(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.remove(currentUser.sub, id);
  }
}
