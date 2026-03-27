import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    return this.prismaService.category.create({
      data: {
        name: dto.name,
        color: dto.color,
        icon: dto.icon,
        userId,
        isDefault: dto.isDefault ?? false
      }
    });
  }

  findAll(userId: string): Promise<Category[]> {
    return this.prismaService.category.findMany({
      where: {
        userId,
        deletedAt: null
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });
  }

  async findActiveByIdOrThrow(userId: string, id: string): Promise<Category> {
    const category = await this.prismaService.category.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      }
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto
  ): Promise<Category> {
    await this.findActiveByIdOrThrow(userId, id);

    return this.prismaService.category.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
        icon: dto.icon,
        isDefault: dto.isDefault
      }
    });
  }

  async remove(userId: string, id: string): Promise<Category> {
    await this.findActiveByIdOrThrow(userId, id);

    return this.prismaService.category.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });
  }
}
