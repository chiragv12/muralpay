import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { MerchantOrdersController } from './merchant-orders.controller';
import { MerchantWithdrawalsController } from './merchant-withdrawals.controller';

@Module({
  imports: [OrdersModule, WithdrawalsModule],
  controllers: [MerchantOrdersController, MerchantWithdrawalsController],
})
export class MerchantModule {}
