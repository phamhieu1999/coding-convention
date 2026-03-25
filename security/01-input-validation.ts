/**
 * ============================================
 * SECURITY #1: INPUT VALIDATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. LUÔN validate input ở boundary (controller layer)
 * 2. Whitelist approach — chỉ cho phép fields đã khai báo
 * 3. Transform input về đúng type
 * 4. Custom validators cho business logic
 * 5. Validate nested objects và arrays
 * 6. Không tin bất kỳ input nào từ client
 */

// ═══════════════════════════════════════════
// Rule 1.1: Whitelist — Strip Unknown Properties
// ═══════════════════════════════════════════

// ❌ BAD: Nhận mọi field từ client
/*
@Post()
async create(@Body() body: any) {
  // body = { name: "John", email: "...", role: "admin", isVerified: true }
  // Client tự gán role=admin, isVerified=true → privilege escalation!
  await this.userRepo.save(body);
}
*/

// ✅ GOOD: Whitelist với class-validator
/*
// main.ts — Global validation pipe
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Tự động strip fields không có decorator
  forbidNonWhitelisted: true,   // Throw error nếu có fields lạ
  transform: true,              // Auto transform string → number, etc.
  transformOptions: {
    enableImplicitConversion: true,
  },
}));
*/

// ═══════════════════════════════════════════
// Rule 1.2: DTO Validation đầy đủ
// ═══════════════════════════════════════════

// ❌ BAD: DTO không có validation
class CreateUserDto_BAD {
  name: any;
  email: any;
  password: any;
  age: any;
}

// ✅ GOOD: DTO với decorators đầy đủ
/*
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-ZÀ-ỹ\s'-]+$/, {
    message: 'Name contains invalid characters',
  })
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255)
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[\d\s-]{10,15}$/, {
    message: 'Invalid phone number format',
  })
  phone?: string;
}
*/

// ═══════════════════════════════════════════
// Rule 1.3: Validate Nested Objects & Arrays
// ═══════════════════════════════════════════

// ❌ BAD: Không validate nested
/*
class CreateOrderDto {
  items: any[];  // Nhận mọi thứ!
}
*/

// ✅ GOOD: Validate nested với @ValidateNested
/*
class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must have at least 1 item' })
  @ArrayMaxSize(50, { message: 'Order cannot have more than 50 items' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9-]+$/, { message: 'Invalid coupon code format' })
  couponCode?: string;
}
*/

// ═══════════════════════════════════════════
// Rule 1.4: Custom Validator
// ═══════════════════════════════════════════

// ✅ GOOD: Custom decorator cho business validation
/*
// validators/is-strong-password.validator.ts
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string): boolean {
    if (!password || password.length < 8) return false;

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const noCommonPatterns = !/^(password|123456|qwerty)/i.test(password);

    return hasUpper && hasLower && hasDigit && hasSpecial && noCommonPatterns;
  }

  defaultMessage(): string {
    return 'Password is too weak. Must contain uppercase, lowercase, digit, and special character';
  }
}

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

// Sử dụng:
class RegisterDto {
  @IsStrongPassword()
  password: string;
}
*/

// ═══════════════════════════════════════════
// Rule 1.5: Query Param Validation
// ═══════════════════════════════════════════

// ❌ BAD: Query params không validate
/*
@Get()
async findAll(@Query('page') page: string, @Query('limit') limit: string) {
  // page = "abc", limit = "-1" → crash hoặc query sai
  return this.repo.find({ skip: (+page - 1) * +limit, take: +limit });
}
*/

// ✅ GOOD: DTO cho query params
/*
class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'email'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  @Transform(({ value }) => value?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC';
}
*/

// ═══════════════════════════════════════════
// Rule 1.6: File Upload Validation
// ═══════════════════════════════════════════

// ❌ BAD: Không validate file upload
/*
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async upload(@UploadedFile() file: Express.Multer.File) {
  // Nhận mọi loại file, mọi kích thước → nguy hiểm!
  await this.storageService.save(file);
}
*/

// ✅ GOOD: Validate file type, size, name
/*
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestException(`File type ${file.mimetype} is not allowed`),
        false,
      );
    }
    // Validate file extension matches mime type
    const ext = path.extname(file.originalname).toLowerCase();
    const validExtensions: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    };
    if (!validExtensions[file.mimetype]?.includes(ext)) {
      return callback(
        new BadRequestException('File extension does not match MIME type'),
        false,
      );
    }
    callback(null, true);
  },
}))
async upload(@UploadedFile() file: Express.Multer.File) {
  // Sanitize filename
  const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  await this.storageService.save(file.buffer, sanitizedName);
}
*/

export { CreateUserDto_BAD };
