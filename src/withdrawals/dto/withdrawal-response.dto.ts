import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';

export class WithdrawalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ required: false, nullable: true })
  muralPayoutRequestId!: string | null;

  @ApiProperty({ enum: WithdrawalStatus })
  status!: WithdrawalStatus;

  @ApiProperty({ required: false, nullable: true })
  lastError!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
