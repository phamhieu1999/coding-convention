/**
 * ============================================
 * GRAPHQL CONVENTIONS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Schema-first vs Code-first approach
 * 2. Resolver structure — tách rõ Query / Mutation / Subscription
 * 3. Input validation với class-validator
 * 4. Pagination (Relay-style cursor)
 * 5. Error handling chuẩn GraphQL
 * 6. DataLoader — chống N+1 queries
 * 7. Authentication & Authorization
 */

// ═══════════════════════════════════════════
// Rule 1: Code-First Approach (NestJS)
// ═══════════════════════════════════════════

// ❌ BAD: Schema lẫn lộn, không typed
/*
const typeDefs = `
  type User {
    id: ID!
    name: String
    email: String
  }
  type Query {
    user(id: ID!): User
  }
`;
// Không type-safe, dễ typo, khó maintain
*/

// ✅ GOOD: Code-first với decorators
const objectTypeExample = `
// user.model.ts
@ObjectType({ description: 'User account' })
export class UserModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => String, { nullable: true })
  avatar?: string;

  @Field(() => [OrderModel], { description: 'User orders' })
  orders: OrderModel[];

  @Field()
  createdAt: Date;

  // KHÔNG expose password, tokens
  // Không có @Field() → không xuất hiện trong schema
  password: string;
  refreshToken: string;
}
`;

// ═══════════════════════════════════════════
// Rule 2: Resolver Structure
// ═══════════════════════════════════════════

// ❌ BAD: Tất cả logic trong resolver
/*
@Resolver()
export class UserResolver {
  @Query()
  async user(@Args('id') id: string) {
    const user = await this.userRepo.findOne(id);
    if (!user) throw new Error('not found');
    const orders = await this.orderRepo.find({ userId: id });
    user.orders = orders;
    return user;
  }
}
*/

// ✅ GOOD: Resolver thin → delegate to service
const resolverExample = `
@Resolver(() => UserModel)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly orderLoader: OrderLoader,
  ) {}

  // ── Queries ──
  @Query(() => UserModel, { name: 'user', description: 'Get user by ID' })
  async getUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<UserModel> {
    return this.userService.findById(id);
  }

  @Query(() => UserConnection, { name: 'users' })
  async getUsers(
    @Args() args: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: UserFilterInput,
  ): Promise<UserConnection> {
    return this.userService.findWithCursor(args, filter);
  }

  // ── Mutations ──
  @Mutation(() => UserModel)
  async createUser(
    @Args('input') input: CreateUserInput,
  ): Promise<UserModel> {
    return this.userService.create(input);
  }

  @Mutation(() => UserModel)
  @UseGuards(GqlAuthGuard)
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Args('input') input: UpdateProfileInput,
  ): Promise<UserModel> {
    return this.userService.update(user.id, input);
  }

  // ── Field Resolvers (lazy loaded) ──
  @ResolveField(() => [OrderModel])
  async orders(@Parent() user: UserModel): Promise<OrderModel[]> {
    // DataLoader prevents N+1
    return this.orderLoader.loadByUserId(user.id);
  }

  @ResolveField(() => Int)
  async orderCount(@Parent() user: UserModel): Promise<number> {
    return this.orderLoader.countByUserId(user.id);
  }
}
`;

// ═══════════════════════════════════════════
// Rule 3: Input Types & Validation
// ═══════════════════════════════════════════

// ✅ GOOD: Validated input types
const inputTypeExample = `
@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
  password: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;
}

@InputType()
export class UserFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  search?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'banned'])
  status?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  role?: string;
}
`;

// ═══════════════════════════════════════════
// Rule 4: DataLoader — Chống N+1
// ═══════════════════════════════════════════

// ❌ BAD: N+1 query trong field resolver
/*
@ResolveField()
async orders(@Parent() user: UserModel) {
  // 1 query PER user → 100 users = 100 queries!
  return this.orderRepo.find({ userId: user.id });
}
*/

// ✅ GOOD: DataLoader batches queries
const dataLoaderExample = `
// order.loader.ts
@Injectable({ scope: Scope.REQUEST })  // MUST be request-scoped
export class OrderLoader {
  private readonly batchLoader = new DataLoader<string, OrderModel[]>(
    async (userIds: readonly string[]) => {
      // 1 query for ALL user IDs
      const orders = await this.orderRepo.find({
        where: { userId: In([...userIds]) },
      });

      // Group by userId
      const orderMap = new Map<string, OrderModel[]>();
      for (const order of orders) {
        const existing = orderMap.get(order.userId) || [];
        existing.push(order);
        orderMap.set(order.userId, existing);
      }

      // Return in same order as input
      return userIds.map(id => orderMap.get(id) || []);
    },
  );

  async loadByUserId(userId: string): Promise<OrderModel[]> {
    return this.batchLoader.load(userId);
  }
}
// 100 users → 1 batch query instead of 100!
`;

// ═══════════════════════════════════════════
// Rule 5: Error Handling
// ═══════════════════════════════════════════

// ✅ GOOD: Structured GraphQL errors
const errorHandlingExample = `
// GraphQL error format
// {
//   "errors": [{
//     "message": "User not found",
//     "extensions": {
//       "code": "USER_NOT_FOUND",
//       "statusCode": 404
//     }
//   }]
// }

// Custom exception filter for GraphQL
@Catch()
export class GqlExceptionFilter implements GqlExceptionFilter {
  catch(exception: Error): ApolloError {
    if (exception instanceof NotFoundException) {
      return new ApolloError(exception.message, 'NOT_FOUND');
    }
    if (exception instanceof ForbiddenException) {
      return new ForbiddenError(exception.message);
    }
    if (exception instanceof UnauthorizedException) {
      return new AuthenticationError(exception.message);
    }
    if (exception instanceof BadRequestException) {
      return new UserInputError(exception.message, {
        validationErrors: exception.getResponse(),
      });
    }
    // Unknown error → don't expose details
    return new ApolloError('Internal server error', 'INTERNAL_ERROR');
  }
}
`;

// ═══════════════════════════════════════════
// Rule 6: Subscription (Real-time)
// ═══════════════════════════════════════════

const subscriptionExample = `
@Resolver(() => OrderModel)
export class OrderResolver {
  @Subscription(() => OrderModel, {
    filter: (payload, variables) =>
      payload.orderUpdated.userId === variables.userId,
  })
  orderUpdated(@Args('userId') userId: string) {
    return this.pubSub.asyncIterator('orderUpdated');
  }
}

// Publish from service:
async updateOrderStatus(orderId: string, status: string): Promise<Order> {
  const order = await this.orderRepo.save({ id: orderId, status });
  await this.pubSub.publish('orderUpdated', { orderUpdated: order });
  return order;
}
`;

// ═══════════════════════════════════════════
// Rule 7: Best Practices Summary
// ═══════════════════════════════════════════

const GRAPHQL_BEST_PRACTICES = {
  schema: [
    'Dùng code-first approach với NestJS decorators',
    'Nullable fields rõ ràng: { nullable: true }',
    'Description cho mọi type, field, argument',
    'Không expose sensitive fields (password, tokens)',
  ],
  performance: [
    'DataLoader cho tất cả field resolvers có query DB',
    'Complexity limit — chặn queries quá deep/expensive',
    'Persisted queries cho production',
    'Query depth limiting — max 7 levels',
  ],
  security: [
    'Input validation bằng class-validator',
    'Auth guard trên mutations',
    'Rate limiting per operation',
    'Disable introspection in production',
  ],
};

export {
  objectTypeExample,
  resolverExample,
  inputTypeExample,
  dataLoaderExample,
  errorHandlingExample,
  subscriptionExample,
  GRAPHQL_BEST_PRACTICES,
};
