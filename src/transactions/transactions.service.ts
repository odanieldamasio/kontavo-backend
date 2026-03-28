import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  PlanType,
  Prisma,
  Transaction,
  TransactionSource,
  User
} from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { PaginatedTransactionsResponseDto } from './dto/paginated-transactions-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsWhatsappNotifierService } from './transactions-whatsapp-notifier.service';

@Injectable()
export class TransactionsService {
  private static readonly FREE_MONTHLY_LIMIT = 15;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
    private readonly transactionsWhatsappNotifierService: TransactionsWhatsappNotifierService
  ) {}

  async create(
    userId: string,
    dto: CreateTransactionDto
  ): Promise<TransactionResponseDto> {
    const user = await this.getUserOrThrow(userId);
    const parsedDate = this.parseDate(dto.date);

    await this.categoriesService.findActiveByIdOrThrow(userId, dto.categoryId);
    await this.ensureMonthlyLimit(user, parsedDate);

    const transaction = await this.prismaService.transaction.create({
      data: {
        type: dto.type,
        amount: this.toDecimal(dto.amount),
        description: dto.description,
        date: parsedDate,
        userId,
        categoryId: dto.categoryId,
        source: dto.source ?? TransactionSource.MANUAL,
        receiptUrl: dto.receiptUrl
      }
    });

    const response = this.toResponse(transaction);

    if (response.source === TransactionSource.MANUAL) {
      await this.transactionsWhatsappNotifierService.notifyCreatedTransaction(
        user,
        response
      );
    }

    return response;
  }

  async findAll(
    userId: string,
    query: ListTransactionsQueryDto
  ): Promise<PaginatedTransactionsResponseDto> {
    const page = this.parsePositiveInt(query.page, 1);
    const limit = this.parsePositiveInt(query.limit, 10);
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: null
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.startDate || query.endDate) {
      where.date = {};

      if (query.startDate) {
        where.date.gte = this.parseDate(query.startDate);
      }

      if (query.endDate) {
        where.date.lte = this.parseDate(query.endDate);
      }
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prismaService.transaction.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto
  ): Promise<TransactionResponseDto> {
    const transaction = await this.findActiveByIdOrThrow(userId, id);
    const user = await this.getUserOrThrow(userId);
    const nextDate = dto.date ? this.parseDate(dto.date) : transaction.date;
    const nextCategoryId = dto.categoryId ?? transaction.categoryId;

    if (dto.categoryId) {
      await this.categoriesService.findActiveByIdOrThrow(userId, dto.categoryId);
    }

    await this.ensureMonthlyLimit(user, nextDate, transaction.id);

    const updated = await this.prismaService.transaction.update({
      where: { id },
      data: {
        type: dto.type,
        amount:
          dto.amount !== undefined ? this.toDecimal(dto.amount) : undefined,
        description: dto.description,
        date: dto.date ? nextDate : undefined,
        categoryId: nextCategoryId,
        source: dto.source,
        receiptUrl: dto.receiptUrl
      }
    });

    return this.toResponse(updated);
  }

  async remove(userId: string, id: string): Promise<TransactionResponseDto> {
    await this.findActiveByIdOrThrow(userId, id);

    const deleted = await this.prismaService.transaction.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });

    return this.toResponse(deleted);
  }

  private async findActiveByIdOrThrow(
    userId: string,
    id: string
  ): Promise<Transaction> {
    const transaction = await this.prismaService.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      }
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureMonthlyLimit(
    user: User,
    date: Date,
    excludeTransactionId?: string
  ): Promise<void> {
    if (user.planType !== PlanType.FREE) {
      return;
    }

    const { start, end } = this.getMonthRange(date);
    const where: Prisma.TransactionWhereInput = {
      userId: user.id,
      deletedAt: null,
      date: {
        gte: start,
        lte: end
      }
    };

    if (excludeTransactionId) {
      where.id = {
        not: excludeTransactionId
      };
    }

    const currentCount = await this.prismaService.transaction.count({ where });
    const projectedCount = currentCount + 1;

    if (projectedCount > TransactionsService.FREE_MONTHLY_LIMIT) {
      throw new ForbiddenException({
        code: 'LIMIT_REACHED',
        message: 'Limite atingido'
      });
    }
  }

  private getMonthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);

    return { start, end };
  }

  private parseDate(value: string): Date {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return parsed;
  }

  private parsePositiveInt(value: string | number | undefined, fallback: number): number {
    if (value === undefined) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private toDecimal(value: string | number): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private toResponse(transaction: Transaction): TransactionResponseDto {
    return {
      ...transaction,
      amount: transaction.amount.toString()
    };
  }
}
