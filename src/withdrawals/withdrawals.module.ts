import { Module } from '@nestjs/common';
import { MuralModule } from '../mural/mural.module';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [MuralModule],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
