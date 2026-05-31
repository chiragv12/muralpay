import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { MuralService } from '../mural/mural.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatUsd } from '../util/money';
import { CreateOrderDto } from './dto/create-order.dto';
import type {
  OrderDetailResponseDto,
  OrderLineResponseDto,
  OrderSummaryResponseDto,
  PaymentInstructionsDto,
} from './dto/order-response.dto';
import type {
  MerchantOrderDetailDto,
  MerchantOrderSummaryDto,
} from './dto/merchant-order-response.dto';
import type { WithdrawalResponseDto } from '../withdrawals/dto/withdrawal-response.dto';

export interface ApplyAccountCreditInput {
  transactionId: string;
  transactionHash: string;
  tokenAmount: number;
  tokenSymbol: string;
  eventId?: string;
}

export interface ApplyAccountCreditResult {
  matched: boolean;
  orderId?: string;
  reason?: string;
}

type OrderWithLines = Prisma.OrderGetPayload<{
  include: { lines: { include: { product: true } } };
}>;

type MerchantOrderRow = Prisma.OrderGetPayload<{
  include: { lines: { include: { product: true } }; withdrawal: true };
}>;

function networkHint(blockchain: string): string {
  const key = blockchain.toUpperCase();
  if (key === 'POLYGON') {
    return 'Polygon Amoy testnet (USDC test tokens)';
  }
  return `${blockchain} (sandbox — confirm test network in Mural dashboard)`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mural: MuralService,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderSummaryResponseDto> {
    const ids = dto.lines.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate productId in order lines');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });

    if (products.length !== ids.length) {
      throw new BadRequestException(
        'One or more products are unknown or inactive',
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let total = new Decimal(0);
    for (const line of dto.lines) {
      const product = productMap.get(line.productId)!;
      const unit = new Decimal(product.priceUsd.toString());
      total = total.plus(unit.mul(line.quantity));
    }

    const totalUsd = new Prisma.Decimal(total.toDecimalPlaces(2).toFixed(2));

    const order = await this.prisma.$transaction((tx) =>
      tx.order.create({
        data: {
          status: OrderStatus.PENDING_PAYMENT,
          totalUsd,
          lines: {
            create: dto.lines.map((line) => {
              const product = productMap.get(line.productId)!;
              return {
                productId: line.productId,
                quantity: line.quantity,
                unitPrice: product.priceUsd,
              };
            }),
          },
        },
        include: {
          lines: { include: { product: true } },
        },
      }),
    );

    return this.toSummary(order);
  }

  async listForMerchant(): Promise<MerchantOrderSummaryDto[]> {
    const orders = await this.prisma.order.findMany({
      include: {
        lines: { include: { product: true } },
        withdrawal: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.toMerchantSummary(order));
  }

  async findOneForMerchant(id: string): Promise<MerchantOrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        withdrawal: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return this.toMerchantSummary(order);
  }

  /**
   * Called from Mural `account_credited` webhooks. Matches by exact USDC amount
   * against the oldest pending order; idempotent on transaction id / tx hash.
   */
  async applyAccountCredit(
    input: ApplyAccountCreditInput,
  ): Promise<ApplyAccountCreditResult> {
    const existing = await this.prisma.order.findFirst({
      where: {
        OR: [
          { muralTransactionId: input.transactionId },
          { fundingTxHash: input.transactionHash },
        ],
      },
    });
    if (existing) {
      return { matched: true, orderId: existing.id };
    }

    if (input.tokenSymbol.toUpperCase() !== 'USDC') {
      return {
        matched: false,
        reason: `unsupported token ${input.tokenSymbol}`,
      };
    }

    const credited = new Decimal(input.tokenAmount).toDecimalPlaces(2);
    const pending = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT },
      orderBy: { createdAt: 'asc' },
    });

    const matches = pending.filter((order) =>
      new Decimal(order.totalUsd.toString())
        .toDecimalPlaces(2)
        .equals(credited),
    );

    if (matches.length === 0) {
      return {
        matched: false,
        reason: 'no pending order with matching amount',
      };
    }

    const target = matches[0];
    if (matches.length > 1) {
      // Documented pitfall: multiple open orders with the same total cannot be
      // disambiguated from on-chain amount alone — oldest wins.
    }

    const updated = await this.prisma.order.updateMany({
      where: {
        id: target.id,
        status: OrderStatus.PENDING_PAYMENT,
      },
      data: {
        status: OrderStatus.PAID,
        muralTransactionId: input.transactionId,
        fundingTxHash: input.transactionHash,
      },
    });

    if (updated.count === 0) {
      const raced = await this.prisma.order.findUnique({
        where: { id: target.id },
      });
      if (
        raced &&
        (raced.muralTransactionId === input.transactionId ||
          raced.fundingTxHash === input.transactionHash)
      ) {
        return { matched: true, orderId: raced.id };
      }
      return { matched: false, reason: 'order no longer pending' };
    }

    return { matched: true, orderId: target.id };
  }

  async findOneWithInstructions(id: string): Promise<OrderDetailResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const wallet = await this.mural.resolveCheckoutWallet();

    const paymentInstructions: PaymentInstructionsDto = {
      muralAccountId: wallet.muralAccountId,
      blockchain: wallet.blockchain,
      networkDescription: networkHint(wallet.blockchain),
      tokenSymbol: wallet.tokenSymbol,
      tokenContractAddress: wallet.tokenContractAddress,
      payToWalletAddress: wallet.walletAddress,
      amount: formatUsd(order.totalUsd),
      decimals: 6,
    };

    return {
      ...this.toSummary(order),
      paymentInstructions,
    };
  }

  private toMerchantSummary(order: MerchantOrderRow): MerchantOrderSummaryDto {
    const summary = this.toSummary(order);
    const paid =
      order.status !== OrderStatus.PENDING_PAYMENT &&
      order.status !== OrderStatus.FAILED;
    return {
      ...summary,
      payment: {
        confirmed: paid,
        fundingTxHash: order.fundingTxHash,
        muralTransactionId: order.muralTransactionId,
        paidAt:
          order.status !== OrderStatus.PENDING_PAYMENT
            ? order.updatedAt
            : undefined,
      },
      withdrawal: order.withdrawal
        ? this.toWithdrawalSummary(order.withdrawal)
        : undefined,
    };
  }

  private toWithdrawalSummary(
    withdrawal: NonNullable<MerchantOrderRow['withdrawal']>,
  ): WithdrawalResponseDto {
    return {
      id: withdrawal.id,
      orderId: withdrawal.orderId,
      muralPayoutRequestId: withdrawal.muralPayoutRequestId,
      status: withdrawal.status,
      lastError: withdrawal.lastError,
      createdAt: withdrawal.createdAt,
      updatedAt: withdrawal.updatedAt,
    };
  }

  private toSummary(order: OrderWithLines): OrderSummaryResponseDto {
    const lines: OrderLineResponseDto[] = order.lines.map((line) => {
      const unit = new Decimal(line.unitPrice.toString());
      const lineTotal = unit.mul(line.quantity);
      return {
        id: line.id,
        productId: line.productId,
        sku: line.product.sku,
        productName: line.product.name,
        quantity: line.quantity,
        unitPrice: formatUsd(line.unitPrice),
        lineTotal: formatUsd(lineTotal),
      };
    });

    return {
      id: order.id,
      status: order.status,
      totalUsd: formatUsd(order.totalUsd),
      lines,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
