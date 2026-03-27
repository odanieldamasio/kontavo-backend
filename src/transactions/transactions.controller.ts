import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { PaginatedTransactionsResponseDto } from './dto/paginated-transactions-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiOperation({ summary: 'Criar transacao' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, type: TransactionResponseDto })
  @Post()
  create(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateTransactionDto
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(currentUser.sub, dto);
  }

  @ApiOperation({ summary: 'Listar transacoes com filtros' })
  @ApiResponse({ status: 200, type: PaginatedTransactionsResponseDto })
  @Get()
  findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListTransactionsQueryDto
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.transactionsService.findAll(currentUser.sub, query);
  }

  @ApiOperation({ summary: 'Atualizar transacao' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @Patch(':id')
  update(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(currentUser.sub, id, dto);
  }

  @ApiOperation({ summary: 'Remover transacao com soft delete' })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  @Delete(':id')
  remove(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.remove(currentUser.sub, id);
  }
}
