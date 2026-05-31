import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductResponseDto } from './product-response.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List active catalog items' })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  list(): Promise<ProductResponseDto[]> {
    return this.productsService.listCatalog();
  }
}
