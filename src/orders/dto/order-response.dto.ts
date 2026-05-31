import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ example: '22.50' })
  unitPrice!: string;

  @ApiProperty({ example: '45.00' })
  lineTotal!: string;
}

export class PaymentInstructionsDto {
  @ApiProperty({
    description:
      'Mural account id funds will credit once the transfer confirms.',
  })
  muralAccountId!: string;

  @ApiProperty({
    example: 'POLYGON',
    description: 'Blockchain identifier from Mural account wallet details.',
  })
  blockchain!: string;

  @ApiProperty({
    example: 'Polygon Amoy testnet (USDC test tokens)',
    description: 'Human-readable network hint for sandbox checkout.',
  })
  networkDescription!: string;

  @ApiProperty({ example: 'USDC' })
  tokenSymbol!: string;

  @ApiProperty({
    required: false,
    description:
      'ERC-20 contract on the indicated chain when provided by Mural.',
  })
  tokenContractAddress?: string;

  @ApiProperty({
    description: 'Merchant settlement wallet from Mural (deposit address).',
  })
  payToWalletAddress!: string;

  @ApiProperty({
    description:
      'Exact stablecoin amount the customer should send for this order (USD/USDC treated 1:1).',
    example: '67.50',
  })
  amount!: string;

  @ApiProperty({
    example: 6,
    description: 'USDC decimals on Polygon.',
  })
  decimals!: number;
}

export class OrderSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ example: '67.50' })
  totalUsd!: string;

  @ApiProperty({ type: [OrderLineResponseDto] })
  lines!: OrderLineResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class OrderDetailResponseDto extends OrderSummaryResponseDto {
  @ApiProperty({ type: PaymentInstructionsDto })
  paymentInstructions!: PaymentInstructionsDto;
}
