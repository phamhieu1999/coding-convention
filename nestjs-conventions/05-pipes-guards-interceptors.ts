/**
 * ============================================
 * NESTJS CONVENTION #5: PIPES, GUARDS & INTERCEPTORS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Pipes: transform + validate input data
 * 2. Guards: authentication + authorization (trả true/false)
 * 3. Interceptors: logging, caching, response mapping, timeout
 * 4. Execution order: Middleware → Guard → Interceptor (before) → Pipe → Handler → Interceptor (after)
 * 5. Mỗi loại chỉ làm đúng nhiệm vụ — không lẫn lộn
 */

// ═══════════════════════════════════════════
// Rule 5.1: Custom Validation Pipe
// ═══════════════════════════════════════════

// ❌ BAD: Validate thủ công trong controller
/*
@Post()
async create(@Body() body: any) {
  if (!body.email) throw new BadRequestException('Email required');
  if (!body.email.includes('@')) throw new BadRequestException('Invalid email');
  if (!body.name || body.name.length < 2) throw new BadRequestException('Name too short');
  if (body.age && (body.age < 0 || body.age > 150)) throw new BadRequestException('Invalid age');
  // ... 20 dòng validation nữa
}
*/

// ✅ GOOD: Custom validation pipe + DTO
/*
@Injectable()
export class CustomValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (!metadata.metatype || !this.shouldValidate(metadata.metatype)) {
      return value;
    }

    const object = plainToInstance(metadata.metatype, value);
    const errors = await validate(object, {
      whitelist: true,          // Strip unknown properties
      forbidNonWhitelisted: true, // Throw nếu có fields lạ
      transform: true,          // Auto transform types
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return object;
  }

  private shouldValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]): Record<string, string[]> {
    return errors.reduce((acc, err) => {
      acc[err.property] = Object.values(err.constraints || {});
      return acc;
    }, {});
  }
}

// main.ts — Global pipe
app.useGlobalPipes(new CustomValidationPipe());
*/

// ═══════════════════════════════════════════
// Rule 5.2: Custom Parse Pipe
// ═══════════════════════════════════════════

// ❌ BAD: Parse trong controller method
/*
@Get(':slug')
async findBySlug(@Param('slug') slug: string) {
  const sanitized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (sanitized.length < 3) throw new BadRequestException('Invalid slug');
  return this.service.findBySlug(sanitized);
}
*/

// ✅ GOOD: Custom pipe — reusable
class ParseSlugPipe {
  transform(value: string): string {
    const slug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug.length < 3) {
      throw new Error('Slug must be at least 3 characters');
    }
    return slug;
  }
}

// Sử dụng: @Param('slug', ParseSlugPipe) slug: string

// ═══════════════════════════════════════════
// Rule 5.3: Auth Guard
// ═══════════════════════════════════════════

// ❌ BAD: Check auth trong mỗi controller method
/*
@Get('profile')
async getProfile(@Req() req: Request) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new UnauthorizedException('No token');
  try {
    const payload = jwt.verify(token, SECRET);
    return this.userService.findById(payload.sub);
  } catch {
    throw new UnauthorizedException('Invalid token');
  }
}
*/

// ✅ GOOD: Guard tách riêng, reusable
/*
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip nếu route được đánh dấu @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}

// Decorator helper
const Public = () => SetMetadata('isPublic', true);

// Sử dụng:
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  @Public()                     // Skip auth cho route này
  @Get('health')
  health() { return { status: 'ok' }; }

  @Get('profile')               // Yêu cầu auth
  getProfile(@CurrentUser() user: AuthUser) {}
}
*/

// ═══════════════════════════════════════════
// Rule 5.4: Role-Based Guard
// ═══════════════════════════════════════════

// ✅ GOOD: Roles guard composable
/*
// roles.decorator.ts
const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // No roles required

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// Sử dụng:
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Delete(':id')
async remove(@Param('id') id: string) {}
*/

// ═══════════════════════════════════════════
// Rule 5.5: Logging Interceptor
// ═══════════════════════════════════════════

// ✅ GOOD: Interceptor cho request/response logging
/*
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] || '';
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Gắn requestId vào request để trace xuyên suốt
    request.requestId = requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${response.statusCode} ${duration}ms - ${ip} ${userAgent}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${requestId}] ${method} ${url} ${error.status || 500} ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
*/

// ═══════════════════════════════════════════
// Rule 5.6: Timeout Interceptor
// ═══════════════════════════════════════════

// ✅ GOOD: Timeout tự động cho slow requests
/*
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 10_000) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('Request timed out');
        }
        throw err;
      }),
    );
  }
}

// Sử dụng:
@UseInterceptors(new TimeoutInterceptor(5000)) // 5s timeout
@Get('heavy-report')
async generateReport() {}
*/

// ═══════════════════════════════════════════
// Rule 5.7: Response Transform Interceptor
// ═══════════════════════════════════════════

// ✅ GOOD: Wrap response trong standard format
interface StandardResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
}

/*
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
*/

export { ParseSlugPipe, type StandardResponse };
