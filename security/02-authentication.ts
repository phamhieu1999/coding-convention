/**
 * ============================================
 * SECURITY #2: AUTHENTICATION
 * ============================================
 *
 * Nguyên tắc:
 * 1. JWT access token ngắn hạn (15m) + refresh token dài hạn (7d)
 * 2. Refresh token rotation — mỗi lần dùng tạo token mới
 * 3. Hash password đúng cách (bcrypt, argon2)
 * 4. Không lưu sensitive data trong JWT payload
 * 5. Revoke token khi user logout / đổi password
 * 6. Rate limit cho login endpoint
 */

declare const process: { env: Record<string, string | undefined> };

// ═══════════════════════════════════════════
// Rule 2.1: Password Hashing
// ═══════════════════════════════════════════

// ❌ BAD: Lưu plain text hoặc hash yếu
class AuthService_BAD {
  async register(email: string, password: string): Promise<void> {
    // Lưu thẳng plain text!
    console.log('Saving:', { email, password });
  }

  async login(email: string, inputPassword: string): Promise<boolean> {
    const storedPassword = 'plain_text_password';
    return inputPassword === storedPassword; // So sánh plain text!
  }
}

// ✅ GOOD: Hash với bcrypt (cost factor >= 12)
/*
import * as bcrypt from 'bcrypt';

class AuthService {
  private readonly SALT_ROUNDS = 12;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async register(dto: RegisterDto): Promise<User> {
    const hashedPassword = await this.hashPassword(dto.password);
    return this.userRepo.save({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
    });
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2.2: JWT Token Strategy
// ═══════════════════════════════════════════

// ❌ BAD: Token không expire hoặc chứa sensitive data
/*
const token = jwt.sign({
  userId: user.id,
  email: user.email,
  password: user.password,    // TUYỆT ĐỐI KHÔNG!
  creditCard: user.creditCard, // TUYỆT ĐỐI KHÔNG!
  role: user.role,
}, 'weak-secret', { expiresIn: '365d' }); // Quá dài!
*/

// ✅ GOOD: Minimal payload, short-lived access token
interface JwtPayload {
  sub: string;          // User ID
  role: string;         // Role for authorization
  iat?: number;         // Issued at
  exp?: number;         // Expiration
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class TokenService {
  private readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';
  private readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
  private readonly ACCESS_TOKEN_TTL = '15m';
  private readonly REFRESH_TOKEN_TTL = '7d';

  generateTokenPair(userId: string, role: string): TokenPair {
    const payload: JwtPayload = { sub: userId, role };

    // Simulate JWT sign
    const accessToken = `access_${JSON.stringify(payload)}_${this.ACCESS_TOKEN_SECRET}`;
    const refreshToken = `refresh_${userId}_${Date.now()}_${this.REFRESH_TOKEN_SECRET}`;

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  verifyAccessToken(token: string): JwtPayload | null {
    try {
      // Simulate JWT verify
      if (token.startsWith('access_')) {
        return { sub: 'user-id', role: 'user' };
      }
      return null;
    } catch {
      return null;
    }
  }
}

// ═══════════════════════════════════════════
// Rule 2.3: Refresh Token Rotation
// ═══════════════════════════════════════════

// ❌ BAD: Refresh token dùng lại nhiều lần, không revoke
/*
async refresh(refreshToken: string): Promise<TokenPair> {
  const payload = jwt.verify(refreshToken, REFRESH_SECRET);
  // Tạo access token mới nhưng KHÔNG đổi refresh token
  return { accessToken: newAccessToken, refreshToken }; // Reuse!
}
*/

// ✅ GOOD: Rotation — mỗi lần refresh tạo cặp token mới + revoke cũ
/*
class RefreshTokenService {
  // Lưu refresh token trong DB/Redis
  async storeRefreshToken(
    userId: string,
    token: string,
    familyId: string,
  ): Promise<void> {
    await this.redisService.set(
      `refresh:${token}`,
      JSON.stringify({ userId, familyId }),
      'EX', 7 * 24 * 60 * 60, // 7 days
    );
  }

  async rotateRefreshToken(oldRefreshToken: string): Promise<TokenPair> {
    // 1. Verify old token exists
    const stored = await this.redisService.get(`refresh:${oldRefreshToken}`);
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    const { userId, familyId } = JSON.parse(stored);

    // 2. Revoke old token
    await this.redisService.del(`refresh:${oldRefreshToken}`);

    // 3. Generate new token pair
    const newTokenPair = this.tokenService.generateTokenPair(userId);
    const newRefreshToken = newTokenPair.refreshToken;

    // 4. Store new refresh token (same family)
    await this.storeRefreshToken(userId, newRefreshToken, familyId);

    return newTokenPair;
  }

  // Revoke toàn bộ token family (khi phát hiện token bị stolen)
  async revokeTokenFamily(familyId: string): Promise<void> {
    const keys = await this.redisService.keys(`refresh:*`);
    for (const key of keys) {
      const data = await this.redisService.get(key);
      if (data && JSON.parse(data).familyId === familyId) {
        await this.redisService.del(key);
      }
    }
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2.4: Login Flow Complete
// ═══════════════════════════════════════════

// ✅ GOOD: Login với rate limiting và security measures
/*
class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_DURATION = 15 * 60; // 15 minutes

  async login(dto: LoginDto): Promise<TokenPair> {
    // 1. Check rate limit
    await this.checkLoginAttempts(dto.email);

    // 2. Find user (timing-safe: luôn hash check dù user không tồn tại)
    const user = await this.userRepo.findByEmail(dto.email.toLowerCase());

    // 3. Verify password (timing-safe comparison)
    const isValid = user
      ? await bcrypt.compare(dto.password, user.password)
      : await bcrypt.compare(dto.password, '$2b$12$fake.hash.to.prevent.timing.attack');

    if (!user || !isValid) {
      await this.incrementLoginAttempts(dto.email);
      throw new UnauthorizedException('Invalid email or password');
      // KHÔNG nói "email not found" hay "wrong password" riêng!
    }

    // 4. Reset login attempts on success
    await this.resetLoginAttempts(dto.email);

    // 5. Generate tokens
    return this.tokenService.generateTokenPair(user.id, user.role);
  }

  private async checkLoginAttempts(email: string): Promise<void> {
    const attempts = await this.redisService.get(`login_attempts:${email}`);
    if (attempts && parseInt(attempts) >= this.MAX_LOGIN_ATTEMPTS) {
      throw new TooManyRequestsException(
        `Account locked. Try again in ${this.LOCK_DURATION / 60} minutes`,
      );
    }
  }

  private async incrementLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts:${email}`;
    await this.redisService.incr(key);
    await this.redisService.expire(key, this.LOCK_DURATION);
  }

  private async resetLoginAttempts(email: string): Promise<void> {
    await this.redisService.del(`login_attempts:${email}`);
  }
}
*/

// ═══════════════════════════════════════════
// Rule 2.5: Logout — Token Revocation
// ═══════════════════════════════════════════

// ❌ BAD: Không revoke token khi logout
/*
async logout(): Promise<void> {
  // Chỉ xóa token ở client → token vẫn valid cho đến khi hết hạn!
  return;
}
*/

// ✅ GOOD: Blacklist access token + revoke refresh token
/*
class AuthService {
  async logout(accessToken: string, refreshToken: string): Promise<void> {
    // 1. Blacklist access token (TTL = remaining time)
    const payload = this.tokenService.decode(accessToken);
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redisService.set(
        `blacklist:${accessToken}`,
        '1',
        'EX', ttl,
      );
    }

    // 2. Revoke refresh token
    await this.redisService.del(`refresh:${refreshToken}`);
  }

  // Trong Guard: check blacklist
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return !!(await this.redisService.get(`blacklist:${token}`));
  }
}
*/

export { AuthService_BAD, TokenService, type JwtPayload, type TokenPair };
