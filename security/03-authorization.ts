/**
 * ============================================
 * SECURITY #3: AUTHORIZATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. RBAC (Role-Based Access Control) cho permission đơn giản
 * 2. ABAC (Attribute-Based Access Control) cho permission phức tạp
 * 3. Resource ownership — user chỉ access resource của mình
 * 4. Guard composition — combine nhiều guards
 * 5. Default deny — mọi route yêu cầu auth trừ khi đánh dấu @Public()
 * 6. Tách authentication (ai?) và authorization (được phép?)
 */

// ═══════════════════════════════════════════
// Rule 3.1: RBAC — Role-Based Access Control
// ═══════════════════════════════════════════

// ❌ BAD: Check role trực tiếp trong controller
/*
@Delete(':id')
async remove(@Param('id') id: string, @Req() req: any) {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    throw new ForbiddenException('Not allowed');
  }
  // Lặp lại ở MỌI endpoint cần check role
  return this.userService.remove(id);
}
*/

// ✅ GOOD: Roles decorator + Guard
enum Role {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// Role hierarchy: SUPER_ADMIN > ADMIN > MODERATOR > USER
const ROLE_HIERARCHY: Record<Role, Role[]> = {
  [Role.SUPER_ADMIN]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR, Role.USER],
  [Role.ADMIN]: [Role.ADMIN, Role.MODERATOR, Role.USER],
  [Role.MODERATOR]: [Role.MODERATOR, Role.USER],
  [Role.USER]: [Role.USER],
};

function hasRoleAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole]?.includes(requiredRole) ?? false;
}

/*
// roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => hasRoleAccess(user.role, role));
  }
}

// Sử dụng:
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  @Get()
  @Roles(Role.ADMIN)         // Chỉ admin+ mới xem danh sách users
  findAll() {}

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)   // Chỉ super admin mới xóa user
  remove(@Param('id') id: string) {}

  @Get('profile')             // Mọi authenticated user đều xem được profile
  getProfile() {}
}
*/

// ═══════════════════════════════════════════
// Rule 3.2: Resource Ownership
// ═══════════════════════════════════════════

// ❌ BAD: User có thể access resource của người khác
/*
@Get('orders/:id')
async getOrder(@Param('id') id: string) {
  return this.orderService.findById(id);
  // User A có thể xem order của User B!
}

@Patch('profile/:userId')
async updateProfile(@Param('userId') userId: string, @Body() dto: any) {
  return this.userService.update(userId, dto);
  // User A có thể update profile của User B!
}
*/

// ✅ GOOD: Check ownership
/*
// ownership.guard.ts
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admin bypass ownership check
    if (hasRoleAccess(user.role, Role.ADMIN)) return true;

    const resourceId = request.params.id;
    const resourceType = this.reflector.get('resourceType', context.getHandler());

    if (!resourceType || !resourceId) return true;

    const service = this.moduleRef.get(resourceType.service, { strict: false });
    const resource = await service.findById(resourceId);

    if (!resource) throw new NotFoundException();

    return resource.userId === user.id;
  }
}

// Decorator
const CheckOwnership = (service: any) =>
  SetMetadata('resourceType', { service });

// Sử dụng:
@Get('orders/:id')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@CheckOwnership(OrderService)
async getOrder(@Param('id') id: string) {
  return this.orderService.findById(id);
}
*/

// ═══════════════════════════════════════════
// Rule 3.3: Permission-Based (Fine-grained)
// ═══════════════════════════════════════════

// ✅ GOOD: Granular permissions thay vì chỉ roles
enum Permission {
  // User management
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Order management
  ORDER_READ = 'order:read',
  ORDER_CREATE = 'order:create',
  ORDER_UPDATE = 'order:update',
  ORDER_CANCEL = 'order:cancel',
  ORDER_REFUND = 'order:refund',

  // Report
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',
}

// Role → Permissions mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.ORDER_READ,
    Permission.ORDER_CREATE,
    Permission.USER_READ,
  ],
  [Role.MODERATOR]: [
    Permission.ORDER_READ,
    Permission.ORDER_CREATE,
    Permission.ORDER_UPDATE,
    Permission.ORDER_CANCEL,
    Permission.USER_READ,
    Permission.REPORT_VIEW,
  ],
  [Role.ADMIN]: [
    ...Object.values(Permission).filter(p => p !== Permission.USER_DELETE),
  ],
  [Role.SUPER_ADMIN]: Object.values(Permission),
};

function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/*
// permissions.decorator.ts
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);

// permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    return required.every((perm) => hasPermission(user.role, perm));
  }
}

// Sử dụng:
@Post('orders/:id/refund')
@RequirePermissions(Permission.ORDER_REFUND)
async refundOrder(@Param('id') id: string) {}

@Get('reports/revenue')
@RequirePermissions(Permission.REPORT_VIEW, Permission.REPORT_EXPORT)
async getRevenueReport() {}
*/

// ═══════════════════════════════════════════
// Rule 3.4: ABAC — Attribute-Based Access Control
// ═══════════════════════════════════════════

// ✅ GOOD: Policy-based authorization cho complex rules
interface PolicyContext {
  user: { id: string; role: Role; department?: string };
  resource: { ownerId: string; status: string; department?: string };
  action: string;
}

type PolicyFn = (context: PolicyContext) => boolean;

const policies: Record<string, PolicyFn> = {
  'order:cancel': (ctx) => {
    // Admin có thể cancel mọi order
    if (hasRoleAccess(ctx.user.role, Role.ADMIN)) return true;
    // Owner chỉ cancel được order PENDING
    return ctx.resource.ownerId === ctx.user.id
      && ctx.resource.status === 'PENDING';
  },

  'order:refund': (ctx) => {
    // Chỉ admin + order đã DELIVERED
    return hasRoleAccess(ctx.user.role, Role.ADMIN)
      && ctx.resource.status === 'DELIVERED';
  },

  'report:view': (ctx) => {
    // Admin xem tất cả, manager chỉ xem department mình
    if (hasRoleAccess(ctx.user.role, Role.ADMIN)) return true;
    return ctx.user.department === ctx.resource.department;
  },
};

function evaluatePolicy(action: string, context: PolicyContext): boolean {
  const policy = policies[action];
  if (!policy) return false; // Default deny
  return policy(context);
}

export {
  Role,
  Permission,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  hasRoleAccess,
  hasPermission,
  evaluatePolicy,
  type PolicyContext,
};
