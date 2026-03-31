import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import { BillingUrlResponseDto } from './dto/billing-url-response.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @ApiOperation({ summary: 'Criar sessao de checkout do Stripe' })
  @ApiBody({ type: CreateCheckoutSessionDto })
  @ApiResponse({ status: 201, type: BillingUrlResponseDto })
  @Post('checkout')
  createCheckout(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: CreateCheckoutSessionDto
  ): Promise<BillingUrlResponseDto> {
    return this.billingService.createCheckoutSession(currentUser.sub, dto);
  }

  @ApiOperation({ summary: 'Criar sessao do Stripe Customer Portal' })
  @ApiResponse({ status: 201, type: BillingUrlResponseDto })
  @Post('portal')
  createPortal(
    @CurrentUser() currentUser: JwtPayload
  ): Promise<BillingUrlResponseDto> {
    return this.billingService.createPortalSession(currentUser.sub);
  }

  @Public()
  @ApiExcludeEndpoint()
  @HttpCode(200)
  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string | string[] | undefined,
    @Req() request: { rawBody?: Buffer; body?: Buffer | unknown }
  ): Promise<{ received: true }> {
    const rawBody =
      request.rawBody ??
      (Buffer.isBuffer(request.body) ? request.body : undefined);

    if (!rawBody) {
      throw new BadRequestException('Missing raw body for Stripe webhook');
    }

    const event = this.billingService.constructWebhookEvent(signature, rawBody);
    await this.billingService.handleWebhookEvent(event);

    return { received: true };
  }
}
