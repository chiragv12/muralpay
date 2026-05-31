import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  OrderDetailResponseDto,
  OrderSummaryResponseDto,
} from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create checkout order from catalog line items' })
  @ApiCreatedResponse({ type: OrderSummaryResponseDto })
  create(@Body() dto: CreateOrderDto): Promise<OrderSummaryResponseDto> {
    return this.ordersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Order detail with USDC-on-Polygon payment instructions',
  })
  @ApiOkResponse({ type: OrderDetailResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderDetailResponseDto> {
    return this.ordersService.findOneWithInstructions(id);
  }
}
