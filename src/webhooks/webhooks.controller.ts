import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { WebhooksService } from './webhooks.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('mural')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mural webhook ingress (account_credited → mark order PAID)',
  })
  async handleMural(
    @Req() req: RawBodyRequest,
    @Headers('x-mural-webhook-signature') signature?: string,
    @Headers('x-mural-webhook-timestamp') timestamp?: string,
  ): Promise<{ ok: true; matchedOrderId?: string }> {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException(
        'Raw request body unavailable — ensure NestFactory rawBody is enabled',
      );
    }

    return this.webhooksService.handleMuralWebhook(
      rawBody,
      signature,
      timestamp,
    );
  }
}
