import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MerchantOrderDetailDto,
  MerchantOrderSummaryDto,
} from '../orders/dto/merchant-order-response.dto';
import { OrdersService } from '../orders/orders.service';

@ApiTags('merchant')
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders with payment confirmation status' })
  @ApiOkResponse({ type: MerchantOrderSummaryDto, isArray: true })
  list(): Promise<MerchantOrderSummaryDto[]> {
    return this.ordersService.listForMerchant();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Order detail with payment confirmation for merchant',
  })
  @ApiOkResponse({ type: MerchantOrderDetailDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MerchantOrderDetailDto> {
    return this.ordersService.findOneForMerchant(id);
  }
}
