import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WithdrawalResponseDto } from '../withdrawals/dto/withdrawal-response.dto';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';

@ApiTags('merchant')
@Controller('merchant/withdrawals')
export class MerchantWithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  @ApiOperation({ summary: 'List COP withdrawals linked to paid orders' })
  @ApiOkResponse({ type: WithdrawalResponseDto, isArray: true })
  list(): Promise<WithdrawalResponseDto[]> {
    return this.withdrawalsService.listForMerchant();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Withdrawal status detail' })
  @ApiOkResponse({ type: WithdrawalResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WithdrawalResponseDto> {
    return this.withdrawalsService.findOneForMerchant(id);
  }
}
