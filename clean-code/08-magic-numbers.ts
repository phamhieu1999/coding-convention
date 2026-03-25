/**
 * ============================================
 * CLEAN CODE RULE #8: AVOID MAGIC NUMBERS & STRINGS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Dùng named constants thay vì literal values
 * 2. Dùng Enum cho tập giá trị cố định
 * 3. Gom config vào một nơi duy nhất
 * 4. Dùng readonly object cho complex config
 */

// ═══════════════════════════════════════════
// Rule 8.1: Named Constants
// ═══════════════════════════════════════════

// ❌ BAD: Magic numbers rải khắp code
function validatePassword_BAD(password: string): boolean {
  return password.length >= 8 && password.length <= 64;
}

function calculateShipping_BAD(weight: number): number {
  if (weight > 30) return 150000;
  if (weight > 10) return 75000;
  return 30000;
}

function checkTimeout_BAD(elapsedMs: number): boolean {
  return elapsedMs > 30000; // 30 giây? 30000 gì?
}

// ✅ GOOD: Named constants rõ ý nghĩa
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;

function validatePassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

const SHIPPING_WEIGHT_TIERS = {
  HEAVY: { threshold: 30, fee: 150_000 },
  MEDIUM: { threshold: 10, fee: 75_000 },
  LIGHT: { threshold: 0, fee: 30_000 },
} as const;

function calculateShippingFee(weightKg: number): number {
  if (weightKg > SHIPPING_WEIGHT_TIERS.HEAVY.threshold) {
    return SHIPPING_WEIGHT_TIERS.HEAVY.fee;
  }
  if (weightKg > SHIPPING_WEIGHT_TIERS.MEDIUM.threshold) {
    return SHIPPING_WEIGHT_TIERS.MEDIUM.fee;
  }
  return SHIPPING_WEIGHT_TIERS.LIGHT.fee;
}

const REQUEST_TIMEOUT_MS = 30_000;

function hasRequestTimedOut(elapsedMs: number): boolean {
  return elapsedMs > REQUEST_TIMEOUT_MS;
}

// ═══════════════════════════════════════════
// Rule 8.2: Enum cho tập giá trị cố định
// ═══════════════════════════════════════════

// ❌ BAD: Magic strings, dễ typo
function getStatusColor_BAD(status: string): string {
  if (status === 'actve') return '#00ff00'; // typo → bug ẩn
  if (status === 'inactive') return '#ff0000';
  if (status === 'pending') return '#ffff00';
  return '#808080';
}

// ✅ GOOD: Enum + mapped colors
enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
}

const STATUS_COLORS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: '#22C55E',
  [UserStatus.INACTIVE]: '#EF4444',
  [UserStatus.PENDING]: '#F59E0B',
  [UserStatus.SUSPENDED]: '#6B7280',
};

function getStatusColor(status: UserStatus): string {
  return STATUS_COLORS[status];
}

// ═══════════════════════════════════════════
// Rule 8.3: Centralized Config
// ═══════════════════════════════════════════

// ❌ BAD: Config values rải khắp nơi
// File A: const timeout = 5000;
// File B: const timeout = 5000;
// File C: const maxRetries = 3;
// File D: const maxRetries = 3;
// → Đổi 1 chỗ, quên chỗ khác → inconsistent

// ✅ GOOD: Centralized config object
const AppConfig = {
  api: {
    baseUrl: 'https://api.example.com',
    timeout: 5_000,
    maxRetries: 3,
    retryDelayMs: 1_000,
  },

  auth: {
    jwtExpirationHours: 24,
    refreshTokenDays: 30,
    maxLoginAttempts: 5,
    lockoutMinutes: 30,
  },

  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  upload: {
    maxFileSizeMB: 10,
    allowedExtensions: ['.jpg', '.png', '.pdf', '.docx'] as const,
    storagePath: '/uploads',
  },
} as const;

// Sử dụng nhất quán:
function createApiClient() {
  return {
    timeout: AppConfig.api.timeout,
    retries: AppConfig.api.maxRetries,
    baseURL: AppConfig.api.baseUrl,
  };
}

function isFileSizeValid(sizeBytes: number): boolean {
  const maxBytes = AppConfig.upload.maxFileSizeMB * 1024 * 1024;
  return sizeBytes <= maxBytes;
}

export {
  validatePassword,
  calculateShippingFee,
  AppConfig,
  UserStatus,
  getStatusColor,
};
