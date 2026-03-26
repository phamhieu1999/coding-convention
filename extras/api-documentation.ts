/**
 * ============================================
 * API DOCUMENTATION (Swagger / OpenAPI)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Swagger decorators trên mỗi endpoint
 * 2. DTO decorators cho request/response schema
 * 3. API grouping bằng tags
 * 4. Authentication documentation
 * 5. Error response documentation
 * 6. Auto-generate client SDK từ OpenAPI spec
 */

// ═══════════════════════════════════════════
// Rule 1: Swagger Setup
// ═══════════════════════════════════════════

// ❌ BAD: Không có Swagger → team phải đọc code để hiểu API
/*
@Controller('users')
export class UsersController {
  @Get()
  findAll() { ... }

  @Post()
  create(@Body() dto: CreateUserDto) { ... }
}
*/

// ✅ GOOD: Swagger setup trong main.ts
const swaggerSetup = `
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My App API')
    .setDescription('RESTful API documentation for My App')
    .setVersion('1.0')
    .setContact('API Team', 'https://myapp.com', 'api@myapp.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'JWT-auth',    // Security scheme name
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Orders', 'Order processing')
    .addTag('Products', 'Product catalog')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://staging-api.myapp.com', 'Staging')
    .addServer('https://api.myapp.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,  // Remember token
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Export OpenAPI JSON
  // GET /docs-json → OpenAPI spec

  await app.listen(3000);
}
`;

// ═══════════════════════════════════════════
// Rule 2: Controller Decorators
// ═══════════════════════════════════════════

// ❌ BAD: Endpoint không có documentation
/*
@Post()
create(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
*/

// ✅ GOOD: Full Swagger decorators
const controllerExample = `
@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Register a new user account. Requires admin role.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Roles('admin')
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated user list',
    type: PaginatedUserResponseDto,
  })
  async findAll(@Query() query: ListUsersDto): Promise<PaginatedResponse> {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Roles('admin')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
`;

// ═══════════════════════════════════════════
// Rule 3: DTO Decorators
// ═══════════════════════════════════════════

// ❌ BAD: DTO không có Swagger decorators
/*
export class CreateUserDto {
  name: string;
  email: string;
  password: string;
}
*/

// ✅ GOOD: DTO với ApiProperty decorators
const dtoExample = `
export class CreateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'User email address (unique)',
    example: 'john@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password (min 8 chars, must include uppercase, number, special char)',
    example: 'SecureP@ss123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Password must include uppercase, number, and special character',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  })
  @IsOptional()
  @IsEnum(['user', 'admin', 'moderator'])
  role?: string;
}

// Response DTO — KHÔNG expose password
export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'user', enum: ['user', 'admin', 'moderator'] })
  role: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;
}

// Paginated response
export class PaginatedUserResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({
    example: { page: 1, limit: 10, totalItems: 42, totalPages: 5 },
  })
  meta: PaginationMeta;
}
`;

// ═══════════════════════════════════════════
// Rule 4: Error Response Documentation
// ═══════════════════════════════════════════

// ✅ GOOD: Standardized error responses
const errorResponseDocs = `
// Reusable error response class
export class ApiErrorResponse {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({
    example: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        { field: 'email', message: 'Invalid email format' },
      ],
    },
  })
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Custom decorator cho common error responses
export function ApiCommonErrors() {
  return applyDecorators(
    ApiResponse({ status: 400, description: 'Bad Request', type: ApiErrorResponse }),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
    ApiResponse({ status: 500, description: 'Internal Server Error' }),
  );
}

// Usage:
// @ApiCommonErrors()
// @Post()
// async create() { ... }
`;

// ═══════════════════════════════════════════
// Rule 5: Authentication in Swagger
// ═══════════════════════════════════════════

// ✅ GOOD: Auth endpoints documentation
const authDocs = `
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'admin@example.com' },
        password: { type: 'string', example: 'SecureP@ss123' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1...',
          refreshToken: 'eyJhbGciOiJIUzI1...',
          expiresIn: 900,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
`;

// ═══════════════════════════════════════════
// Rule 6: Swagger Best Practices Summary
// ═══════════════════════════════════════════

const swaggerBestPractices = {
  mustDo: [
    'ApiTags trên mỗi controller',
    'ApiOperation (summary + description) trên mỗi endpoint',
    'ApiResponse cho mỗi status code có thể trả về',
    'ApiProperty trên mỗi DTO field',
    'ApiBearerAuth cho protected routes',
    'Example values trong ApiProperty',
  ],
  avoid: [
    'Bỏ trống description → khó hiểu',
    'Không document error responses → FE không biết handle',
    'Expose internal entity trực tiếp → dùng Response DTO',
    'Quên update docs khi thay đổi API → docs out of sync',
  ],
  tips: [
    'Dùng @ApiExtraModels() để register nested DTOs',
    'Dùng @ApiHideProperty() để ẩn fields trong Swagger',
    'Export OpenAPI JSON cho auto-generate client SDK',
    'Swagger UI tại /docs, JSON tại /docs-json',
  ],
};

export {
  swaggerSetup,
  controllerExample,
  dtoExample,
  errorResponseDocs,
  authDocs,
  swaggerBestPractices,
};
