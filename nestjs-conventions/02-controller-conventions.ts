/**
 * ============================================
 * NESTJS CONVENTION #2: CONTROLLER CONVENTIONS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Controller chỉ handle HTTP — KHÔNG chứa business logic
 * 2. Dùng DTO + class-validator cho input validation
 * 3. Response serialization với class-transformer
 * 4. Route naming theo RESTful convention
 * 5. Swagger documentation cho mọi endpoint
 * 6. Tách request parsing và response formatting
 */

// ═══════════════════════════════════════════
// Rule 2.1: Controller — Thin, No Business Logic
// ═══════════════════════════════════════════

// ❌ BAD: Controller chứa business logic
/*
@Controller('orders')
export class OrderController {
  @Post()
  async createOrder(@Body() body: any) {
    // Validation ngay trong controller
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('Items required');
    }

    // Business logic trực tiếp trong controller!
    let total = 0;
    for (const item of body.items) {
      const product = await this.productRepo.findOne(item.productId);
      if (!product) throw new NotFoundException('Product not found');
      if (product.stock < item.quantity) {
        throw new BadRequestException('Not enough stock');
      }
      total += product.price * item.quantity;
    }

    // Áp dụng discount
    if (body.couponCode) {
      const coupon = await this.couponRepo.findOne({ code: body.couponCode });
      if (coupon && coupon.expiresAt > new Date()) {
        total *= (1 - coupon.discount);
      }
    }

    const order = await this.orderRepo.save({ ...body, total });
    await this.emailService.send(body.email, 'Order created');
    return order;
  }
}
*/

// ✅ GOOD: Controller mỏng, delegate cho Service
/*
@Controller('orders')
@ApiTags('Orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderResponseDto> {
    const order = await this.orderService.createOrder(user.id, createOrderDto);
    return OrderResponseDto.fromEntity(order);
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2.2: DTO — Input Validation
// ═══════════════════════════════════════════

// ❌ BAD: Không có DTO, dùng any
/*
@Post()
async create(@Body() body: any) {
  // body có thể chứa anything, SQL injection, XSS...
  return this.service.create(body);
}
*/

// ✅ GOOD: DTO với class-validator + whitelist
class CreateOrderItemDto {
  // @IsString()
  // @IsNotEmpty()
  productId!: string;

  // @IsInt()
  // @Min(1)
  // @Max(100)
  quantity!: number;
}

class CreateOrderDto {
  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => CreateOrderItemDto)
  // @ArrayMinSize(1)
  items!: CreateOrderItemDto[];

  // @IsString()
  // @IsOptional()
  // @MaxLength(50)
  couponCode?: string;

  // @IsEnum(PaymentMethod)
  paymentMethod!: string;

  // @IsString()
  // @Matches(/^[a-zA-Z0-9\s,.-]+$/) // Sanitize address
  shippingAddress!: string;
}

// ─────────────────────────────────────────────
// DTO cho Update: dùng PartialType hoặc PickType
// ─────────────────────────────────────────────

// ❌ BAD: Copy-paste toàn bộ fields, đổi thành optional
/*
class UpdateOrderDto {
  items?: CreateOrderItemDto[];
  couponCode?: string;
  paymentMethod?: string;
  shippingAddress?: string;
}
*/

// ✅ GOOD: Kế thừa từ CreateDto
/*
// PartialType: tất cả field thành optional
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

// PickType: chỉ lấy fields cần thiết
export class UpdateShippingDto extends PickType(CreateOrderDto, ['shippingAddress']) {}

// OmitType: bỏ fields không cho update
export class UpdateOrderDto extends OmitType(PartialType(CreateOrderDto), ['paymentMethod']) {}

// IntersectionType: combine 2 DTO
export class CreateOrderWithMetaDto extends IntersectionType(
  CreateOrderDto,
  OrderMetadataDto,
) {}
*/

// ═══════════════════════════════════════════
// Rule 2.3: Response Serialization
// ═══════════════════════════════════════════

// ❌ BAD: Trả entity trực tiếp → lộ password, internal fields
/*
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.userRepo.findOne(id);
  // Response: { id, email, password, salt, internalNote, ... }
}
*/

// ✅ GOOD: Response DTO — chỉ trả fields cần thiết
class UserResponseDto {
  id!: string;
  email!: string;
  displayName!: string;
  role!: string;
  createdAt!: Date;
  // KHÔNG có password, salt, internalNote

  static fromEntity(entity: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    createdAt: Date;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.displayName = `${entity.firstName} ${entity.lastName}`;
    dto.role = entity.role;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

// Hoặc dùng class-transformer:
/*
@Exclude()
export class UserResponseDto {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  displayName: string;
  @Expose() createdAt: Date;
  // password, salt tự động bị exclude
}
*/

// ═══════════════════════════════════════════
// Rule 2.4: Route Naming Convention
// ═══════════════════════════════════════════

// ❌ BAD: Tên route không chuẩn RESTful
/*
@Controller('api')
export class UserController {
  @Get('getUsers')           // Verb trong URL
  @Get('get-user-by-id/:id') // Quá dài, có verb
  @Post('createNewUser')     // Verb + tên method
  @Post('user/delete/:id')   // POST cho delete
  @Get('users-list')         // Thừa "-list"
}
*/

// ✅ GOOD: RESTful route naming
/*
@Controller('users')
export class UserController {
  @Get()                          // GET /users
  findAll(@Query() query: PaginationDto) {}

  @Get(':id')                     // GET /users/:id
  findOne(@Param('id', ParseUUIDPipe) id: string) {}

  @Post()                         // POST /users
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {}

  @Patch(':id')                   // PATCH /users/:id (partial update)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {}

  @Delete(':id')                  // DELETE /users/:id
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {}

  // Nested resources
  @Get(':userId/orders')          // GET /users/:userId/orders
  findUserOrders(@Param('userId') userId: string) {}

  // Actions (khi không map được RESTful)
  @Post(':id/activate')           // POST /users/:id/activate
  activate(@Param('id') id: string) {}
}
*/

// ═══════════════════════════════════════════
// Rule 2.5: Param Parsing với Pipes
// ═══════════════════════════════════════════

// ❌ BAD: Parse và validate param thủ công trong controller
/*
@Get(':id')
async findOne(@Param('id') id: string) {
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}/)) {
    throw new BadRequestException('Invalid UUID');
  }
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) throw new BadRequestException('Invalid ID');
}
*/

// ✅ GOOD: Dùng built-in Pipes
/*
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {}

@Get('page/:page')
findByPage(@Param('page', new ParseIntPipe({ errorHttpStatusCode: 422 })) page: number) {}

@Get('active/:status')
findByStatus(@Param('status', new DefaultValuePipe(true), ParseBoolPipe) status: boolean) {}
*/

export { CreateOrderDto, CreateOrderItemDto, UserResponseDto };
