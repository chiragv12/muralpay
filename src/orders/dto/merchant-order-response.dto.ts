import { ApiProperty } from '@nestjs/swagger';
import { OrderSummaryResponseDto } from './order-response.dto';
import { WithdrawalResponseDto } from '../../withdrawals/dto/withdrawal-response.dto';

export class PaymentConfirmationDto {
  @ApiProperty({
    description:
      'True once payment has been detected (PAID or later lifecycle states).',
  })
  confirmed!: boolean;

  @ApiProperty({ required: false, nullable: true })
  fundingTxHash?: string | null;

  @ApiProperty({ required: false, nullable: true })
  muralTransactionId?: string | null;

  @ApiProperty({
    required: false,
    description: 'Approximate confirmation time (order updatedAt).',
  })
  paidAt?: Date;
}

export class MerchantOrderSummaryDto extends OrderSummaryResponseDto {
  @ApiProperty({ type: PaymentConfirmationDto })
  payment!: PaymentConfirmationDto;

  @ApiProperty({ type: WithdrawalResponseDto, required: false })
  withdrawal?: WithdrawalResponseDto;
}

export class MerchantOrderDetailDto extends MerchantOrderSummaryDto {}
