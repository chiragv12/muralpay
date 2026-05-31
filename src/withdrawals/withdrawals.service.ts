import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, WithdrawalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { MuralService } from '../mural/mural.service';
import { PrismaService } from '../prisma/prisma.service';
import type { WithdrawalResponseDto } from './dto/withdrawal-response.dto';

type WithdrawalRow = Prisma.WithdrawalGetPayload<Record<string, never>>;

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mural: MuralService,
  ) {}

  async listForMerchant(): Promise<WithdrawalResponseDto[]> {
    const rows = await this.prisma.withdrawal.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async findOneForMerchant(id: string): Promise<WithdrawalResponseDto> {
    const row = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Withdrawal ${id} not found`);
    }
    return this.toDto(row);
  }

  /**
   * Idempotent: creates and executes a COP payout for a PAID order (Workflow C).
   */
  async initiateForPaidOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { withdrawal: true },
    });

    if (!order) {
      this.logger.warn(`initiateForPaidOrder: order ${orderId} not found`);
      return;
    }

    if (order.status === OrderStatus.PENDING_PAYMENT) {
      return;
    }

    if (order.withdrawal?.muralPayoutRequestId) {
      return;
    }

    let withdrawal = order.withdrawal;
    if (!withdrawal) {
      withdrawal = await this.prisma.withdrawal.create({
        data: {
          orderId: order.id,
          status: WithdrawalStatus.PENDING,
        },
      });
    }

    try {
      const wallet = await this.mural.resolveCheckoutWallet();
      const tokenAmount = new Decimal(order.totalUsd.toString()).toNumber();

      const created = await this.mural.createCopPayout({
        sourceAccountId: wallet.muralAccountId,
        tokenAmount,
        memo: `Order ${order.id}`,
      });

      await this.mural.executePayoutRequest(created.id);

      await this.prisma.$transaction([
        this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            muralPayoutRequestId: created.id,
            status: WithdrawalStatus.SUBMITTED,
            lastError: null,
          },
        }),
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.WITHDRAWAL_INITIATED },
        }),
      ]);

      this.logger.log(
        `COP withdrawal submitted for order ${order.id} payoutRequestId=${created.id}`,
      );

      // Sandbox auto-completes payouts; reflect terminal state if already executed.
      await this.syncFromMuralPayoutStatus(created.id, created.status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `COP withdrawal failed for order ${order.id}: ${message}`,
      );
      await this.prisma.$transaction([
        this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: WithdrawalStatus.FAILED,
            lastError: message.slice(0, 500),
          },
        }),
        this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
        }),
      ]);
    }
  }

  async handlePayoutRequestStatusChanged(
    payoutRequestId: string,
    currentStatusType: string,
  ): Promise<void> {
    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { muralPayoutRequestId: payoutRequestId },
    });
    if (!withdrawal) {
      this.logger.debug(`No withdrawal for payoutRequestId=${payoutRequestId}`);
      return;
    }

    await this.applyPayoutTerminalStatus(withdrawal, currentStatusType);
  }

  private async syncFromMuralPayoutStatus(
    payoutRequestId: string,
    status: string,
  ): Promise<void> {
    const normalized = status.toLowerCase();
    if (
      normalized !== 'executed' &&
      normalized !== 'completed' &&
      normalized !== 'pending'
    ) {
      return;
    }

    const withdrawal = await this.prisma.withdrawal.findFirst({
      where: { muralPayoutRequestId: payoutRequestId },
    });
    if (!withdrawal) {
      return;
    }

    if (normalized === 'executed' || normalized === 'completed') {
      await this.applyPayoutTerminalStatus(withdrawal, normalized);
    }
  }

  private async applyPayoutTerminalStatus(
    withdrawal: WithdrawalRow,
    currentStatusType: string,
  ): Promise<void> {
    const status = currentStatusType.toLowerCase();

    if (status === 'executed' || status === 'completed') {
      await this.prisma.$transaction([
        this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: WithdrawalStatus.COMPLETED, lastError: null },
        }),
        this.prisma.order.update({
          where: { id: withdrawal.orderId },
          data: { status: OrderStatus.WITHDRAWAL_COMPLETED },
        }),
      ]);
      return;
    }

    if (status === 'failed' || status === 'canceled') {
      await this.prisma.$transaction([
        this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: WithdrawalStatus.FAILED,
            lastError: `Mural payout ${status}`,
          },
        }),
        this.prisma.order.update({
          where: { id: withdrawal.orderId },
          data: { status: OrderStatus.FAILED },
        }),
      ]);
    }
  }

  private toDto(row: WithdrawalRow): WithdrawalResponseDto {
    return {
      id: row.id,
      orderId: row.orderId,
      muralPayoutRequestId: row.muralPayoutRequestId,
      status: row.status,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
