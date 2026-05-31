import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import type {
  AccountCreditedPayload,
  MuralWebhookEnvelope,
} from './mural-webhook.types';
import type {
  PayoutRequestStatusChangedPayload,
  PayoutStatusChangedPayload,
} from './mural-payout-webhook.types';
import { verifyMuralWebhookSignature } from './mural-webhook-signature';

function isAccountCreditedPayload(
  payload: unknown,
): payload is AccountCreditedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as AccountCreditedPayload).type === 'account_credited'
  );
}

function isPayoutRequestStatusChanged(
  payload: unknown,
): payload is PayoutRequestStatusChangedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as PayoutRequestStatusChangedPayload).type ===
      'payout_request_status_changed'
  );
}

function isPayoutStatusChanged(
  payload: unknown,
): payload is PayoutStatusChangedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as PayoutStatusChangedPayload).type === 'payout_status_changed'
  );
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  async handleMuralWebhook(
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ): Promise<{ ok: true; matchedOrderId?: string }> {
    if (!signature || !timestamp) {
      throw new BadRequestException(
        'Missing x-mural-webhook-signature or x-mural-webhook-timestamp',
      );
    }

    this.assertSignatureValid(rawBody, signature, timestamp);

    let envelope: MuralWebhookEnvelope;
    try {
      envelope = JSON.parse(rawBody) as MuralWebhookEnvelope;
    } catch {
      throw new BadRequestException('Invalid JSON webhook body');
    }

    if (
      envelope.eventCategory === 'MURAL_ACCOUNT_BALANCE_ACTIVITY' &&
      isAccountCreditedPayload(envelope.payload)
    ) {
      return this.handleAccountCredited(envelope.payload);
    }

    if (envelope.eventCategory === 'PAYOUT_REQUEST') {
      if (isPayoutRequestStatusChanged(envelope.payload)) {
        await this.withdrawals.handlePayoutRequestStatusChanged(
          envelope.payload.payoutRequestId,
          envelope.payload.statusChangeDetails.currentStatus.type,
        );
        return { ok: true };
      }

      if (isPayoutStatusChanged(envelope.payload)) {
        if (envelope.payload.statusChangeDetails.type === 'fiat') {
          await this.withdrawals.handlePayoutRequestStatusChanged(
            envelope.payload.payoutRequestId,
            envelope.payload.statusChangeDetails.currentStatus.type,
          );
        }
        return { ok: true };
      }
    }

    this.logger.debug(
      `Ignoring webhook eventCategory=${envelope.eventCategory}`,
    );
    return { ok: true };
  }

  private async handleAccountCredited(
    payload: AccountCreditedPayload,
  ): Promise<{ ok: true; matchedOrderId?: string }> {
    const result = await this.orders.applyAccountCredit({
      transactionId: payload.transactionId,
      transactionHash: payload.transactionDetails.transactionHash,
      tokenAmount: payload.tokenAmount.tokenAmount,
      tokenSymbol: payload.tokenAmount.tokenSymbol,
    });

    if (result.orderId) {
      if (result.matched) {
        this.logger.log(
          `Order ${result.orderId} marked PAID for tx ${payload.transactionDetails.transactionHash}`,
        );
      }
      await this.withdrawals.initiateForPaidOrder(result.orderId);
      return { ok: true, matchedOrderId: result.orderId };
    }

    this.logger.warn(
      `No pending order matched credit amount=${payload.tokenAmount.tokenAmount} ${payload.tokenAmount.tokenSymbol} tx=${payload.transactionDetails.transactionHash} reason=${result.reason ?? 'unknown'}`,
    );
    return { ok: true };
  }

  private assertSignatureValid(
    rawBody: string,
    signature: string,
    timestamp: string,
  ): void {
    const skipVerify =
      this.config.get<string>('MURAL_WEBHOOK_SKIP_VERIFY') === 'true';
    if (skipVerify) {
      this.logger.warn(
        'MURAL_WEBHOOK_SKIP_VERIFY=true — webhook signatures are not verified',
      );
      return;
    }

    const publicKey = this.config.get<string>('MURAL_WEBHOOK_PUBLIC_KEY');
    if (!publicKey?.trim()) {
      throw new UnauthorizedException(
        'MURAL_WEBHOOK_PUBLIC_KEY is not configured',
      );
    }

    const normalizedKey = publicKey.includes('\\n')
      ? publicKey.replace(/\\n/g, '\n')
      : publicKey;

    const valid = verifyMuralWebhookSignature(
      rawBody,
      signature,
      timestamp,
      normalizedKey,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid Mural webhook signature');
    }
  }
}
