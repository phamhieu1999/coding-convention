/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                     BUILDER PATTERN                          ║
 * ║                   (Creational Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Xây dựng object phức tạp theo từng bước (step-by-step). │
 * │ Cho phép tạo nhiều biểu diễn khác nhau từ cùng 1 flow. │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Gọi cà phê ở Starbucks: chọn size → chọn loại sữa → thêm topping
 * → thêm syrup → ít đá/nhiều đá. Cùng 1 quy trình nhưng ra đồ khác nhau.
 *
 * ✅ KHI NÀO DÙNG:
 *   - Constructor có quá nhiều params (>4)
 *   - Cần tạo nhiều biến thể của cùng 1 object
 *   - Cần immutable object sau khi build
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Object đơn giản, ít thuộc tính
 *   - Không cần validation phức tạp
 *
 * 📐 CLASS DIAGRAM:
 *
 *  ┌────────────────────┐    builds    ┌──────────────────┐
 *  │  QueryBuilder      │────────────►│  Query (product)  │
 *  ├────────────────────┤              ├──────────────────┤
 *  │ - table            │              │ + sql: string    │
 *  │ - selectCols       │              │ + params: any[]  │
 *  │ - conditions       │              │ + toString()     │
 *  ├────────────────────┤              └──────────────────┘
 *  │ + select()  → this │
 *  │ + where()   → this │   ┌──────────────────────────┐
 *  │ + orderBy() → this │   │  Director (optional)     │
 *  │ + limit()   → this │   ├──────────────────────────┤
 *  │ + join()    → this │   │ + buildUserList(builder) │
 *  │ + build()   → Query│   │ + buildReport(builder)   │
 *  └────────────────────┘   └──────────────────────────┘
 */

// ============================================================
// PRODUCT (Immutable)
// ============================================================

class Query {
  constructor(
    public readonly sql: string,
    public readonly params: readonly unknown[],
    public readonly meta: Readonly<{ table: string; type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" }>
  ) {
    Object.freeze(this);  // Immutable product
  }

  toString(): string {
    return `[${this.meta.type}] ${this.sql}\n  Params: [${this.params.join(", ")}]`;
  }
}

// ============================================================
// BUILDER
// ============================================================

type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";

class QueryBuilder {
  private table: string = "";
  private type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" = "SELECT";
  private selectColumns: string[] = ["*"];
  private conditions: string[] = [];
  private params: unknown[] = [];
  private orderByClause: string = "";
  private limitValue?: number;
  private offsetValue?: number;
  private joins: string[] = [];
  private groupByColumns: string[] = [];
  private havingClause: string = "";
  private insertData?: Record<string, unknown>;
  private updateData?: Record<string, unknown>;

  /** Bắt đầu SELECT query */
  select(table: string, columns: string[] = ["*"]): this {
    this.reset();
    this.type = "SELECT";
    this.table = table;
    this.selectColumns = columns;
    return this;
  }

  /** Thêm WHERE condition (parameterized → chống SQL injection) */
  where(condition: string, ...values: unknown[]): this {
    this.conditions.push(condition);
    this.params.push(...values);
    return this;
  }

  /** AND condition */
  andWhere(condition: string, ...values: unknown[]): this {
    return this.where(condition, ...values);
  }

  /** JOIN clause */
  join(table: string, on: string, type: JoinType = "INNER"): this {
    this.joins.push(`${type} JOIN ${table} ON ${on}`);
    return this;
  }

  /** ORDER BY */
  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClause = `ORDER BY ${column} ${direction}`;
    return this;
  }

  /** LIMIT + OFFSET (pagination) */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /** Pagination helper */
  paginate(page: number, perPage: number): this {
    this.limitValue = perPage;
    this.offsetValue = (page - 1) * perPage;
    return this;
  }

  /** GROUP BY */
  groupBy(...columns: string[]): this {
    this.groupByColumns = columns;
    return this;
  }

  /** HAVING (dùng sau GROUP BY) */
  having(condition: string): this {
    this.havingClause = condition;
    return this;
  }

  /** Build → trả về immutable Query object */
  build(): Query {
    if (!this.table) throw new Error("Table is required! Call .select() first.");

    const parts: string[] = [];

    // SELECT columns FROM table
    parts.push(`SELECT ${this.selectColumns.join(", ")} FROM ${this.table}`);

    // JOINs
    if (this.joins.length) parts.push(this.joins.join("\n"));

    // WHERE
    if (this.conditions.length) parts.push(`WHERE ${this.conditions.join(" AND ")}`);

    // GROUP BY
    if (this.groupByColumns.length) parts.push(`GROUP BY ${this.groupByColumns.join(", ")}`);

    // HAVING
    if (this.havingClause) parts.push(`HAVING ${this.havingClause}`);

    // ORDER BY
    if (this.orderByClause) parts.push(this.orderByClause);

    // LIMIT + OFFSET
    if (this.limitValue !== undefined) parts.push(`LIMIT ${this.limitValue}`);
    if (this.offsetValue !== undefined) parts.push(`OFFSET ${this.offsetValue}`);

    return new Query(parts.join("\n"), Object.freeze([...this.params]), {
      table: this.table,
      type: this.type,
    });
  }

  private reset(): void {
    this.conditions = [];
    this.params = [];
    this.joins = [];
    this.groupByColumns = [];
    this.orderByClause = "";
    this.havingClause = "";
    this.limitValue = undefined;
    this.offsetValue = undefined;
  }
}

// ============================================================
// DIRECTOR (optional — preset queries)
// ============================================================

class QueryDirector {
  constructor(private readonly builder: QueryBuilder) {}

  /** Preset: lấy danh sách user phân trang */
  buildUserList(page: number = 1, perPage: number = 20): Query {
    return this.builder
      .select("users", ["id", "name", "email", "created_at"])
      .where("is_active = $1", true)
      .orderBy("created_at", "DESC")
      .paginate(page, perPage)
      .build();
  }

  /** Preset: report thống kê order theo user */
  buildOrderReport(minOrders: number = 5): Query {
    return this.builder
      .select("users", ["users.name", "COUNT(orders.id) as order_count", "SUM(orders.total) as revenue"])
      .join("orders", "orders.user_id = users.id", "LEFT")
      .where("users.is_active = $1", true)
      .groupBy("users.id", "users.name")
      .having(`COUNT(orders.id) >= ${minOrders}`)
      .orderBy("revenue", "DESC")
      .limit(50)
      .build();
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  const builder = new QueryBuilder();

  // 1. Method chaining → flexible query building
  console.log("=== Custom Query ===");
  const query1 = builder
    .select("products", ["id", "name", "price", "stock"])
    .where("price > $1", 100)
    .andWhere("stock > $2", 0)
    .andWhere("category = $3", "electronics")
    .orderBy("price", "ASC")
    .paginate(2, 10)
    .build();
  console.log(query1.toString());

  // 2. Complex JOIN query
  console.log("\n=== JOIN Query ===");
  const query2 = builder
    .select("orders", ["orders.id", "users.name", "orders.total", "orders.status"])
    .join("users", "users.id = orders.user_id", "INNER")
    .join("payments", "payments.order_id = orders.id", "LEFT")
    .where("orders.status = $1", "completed")
    .andWhere("orders.total > $2", 500)
    .orderBy("orders.total", "DESC")
    .limit(100)
    .build();
  console.log(query2.toString());

  // 3. Director → preset queries
  console.log("\n=== Director Preset: User List ===");
  const director = new QueryDirector(builder);
  console.log(director.buildUserList(3, 25).toString());

  console.log("\n=== Director Preset: Order Report ===");
  console.log(director.buildOrderReport(10).toString());
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Method chaining (return this) → đọc code như đọc câu
 * 2. build() trả về IMMUTABLE object → an toàn, không bị sửa sau khi tạo
 * 3. Parameterized queries ($1, $2) → chống SQL injection
 * 4. Director = preset patterns → tái sử dụng common queries
 * 5. reset() trong select() → cùng 1 builder tạo được nhiều queries
 * 6. NestJS: TypeORM QueryBuilder chính là pattern này
 *    repo.createQueryBuilder("user").where(...).getMany()
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ SQL QUERY BUILDER (ví dụ trên)
 *    Bài toán: Viết raw SQL phức tạp (JOIN 5 tables, dynamic WHERE, pagination)
 *    dễ lỗi cú pháp, SQL injection, khó maintain.
 *    Giải pháp: QueryBuilder method chaining — đọc code = đọc câu.
 *    Thực tế: TypeORM, Knex.js, Prisma, Sequelize đều dùng Builder pattern.
 *    Code: repo.createQueryBuilder("u")
 *              .leftJoin("u.orders", "o")
 *              .where("u.isActive = :active", { active: true })
 *              .orderBy("u.createdAt", "DESC")
 *              .take(20).skip(40)
 *              .getMany();
 *
 * 2️⃣ HTTP REQUEST BUILDER
 *    Bài toán: Gọi API cần set headers, query params, body, timeout, retry
 *    — mỗi endpoint yêu cầu combo khác nhau.
 *    Giải pháp: RequestBuilder → set từng phần, build() tạo Request object.
 *    Thực tế: Axios config, got options, superagent chaining.
 *    Code: new RequestBuilder()
 *              .setUrl("/api/users")
 *              .setMethod("POST")
 *              .setHeader("Authorization", `Bearer ${token}`)
 *              .setBody({ name: "Alice" })
 *              .setTimeout(5000)
 *              .build();
 *
 * 3️⃣ EMAIL BUILDER
 *    Bài toán: Email có from, to, cc, bcc, subject, body (HTML/text),
 *    attachments, headers, reply-to — constructor 10+ params = nightmare.
 *    Giải pháp: EmailBuilder → set từng phần, validate khi build().
 *    Code: new EmailBuilder()
 *              .from("noreply@app.com")
 *              .to("user@test.com")
 *              .subject("Order Confirmation")
 *              .htmlBody(template)
 *              .attach("invoice.pdf", buffer)
 *              .build();
 *
 * 4️⃣ DOCKER COMPOSE CONFIG BUILDER
 *    Bài toán: Tạo docker-compose.yml cho dev/staging/prod — mỗi env
 *    cần services, volumes, networks, env vars khác nhau.
 *    Giải pháp: ComposeBuilder → addService(), addVolume(), addNetwork()
 *    Director có presets: buildDevStack(), buildProdStack()
 *
 * 5️⃣ FORM VALIDATION RULE BUILDER
 *    Bài toán: Validate form có conditional rules phức tạp:
 *    "email required nếu type=newsletter, phone required nếu type=sms"
 *    Giải pháp: ValidationBuilder chaining rules.
 *    Thực tế: Joi, Zod, class-validator đều dùng Builder pattern.
 *    Code: z.object({ email: z.string().email().min(5).max(255) })
 *
 * 6️⃣ CI/CD PIPELINE BUILDER
 *    Bài toán: Tạo pipeline config (GitHub Actions, GitLab CI) với
 *    stages, jobs, conditions, artifacts khác nhau cho mỗi project.
 *    Giải pháp: PipelineBuilder → addStage("test").addJob("lint").build()
 *
 * 📌 KHI NÀO DÙNG BUILDER:
 *    ✅ Constructor > 4 params
 *    ✅ Object có nhiều optional fields
 *    ✅ Cần validate trước khi tạo (build() throws nếu invalid)
 *    ✅ Cần immutable product
 *    ❌ Object đơn giản (2-3 fields) → dùng constructor bình thường
 */

export { Query, QueryBuilder, QueryDirector };
