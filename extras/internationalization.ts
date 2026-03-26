/**
 * ============================================
 * INTERNATIONALIZATION (i18n)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Tách text ra khỏi code → translation files
 * 2. NestJS-i18n module cho backend
 * 3. Typed translation keys — tránh typo
 * 4. Dynamic locale detection — Accept-Language header
 * 5. Pluralization và interpolation
 * 6. Date/Number formatting theo locale
 */

// ═══════════════════════════════════════════
// Rule 1: Translation File Structure
// ═══════════════════════════════════════════

// ❌ BAD: Hardcode text trong code
/*
throw new NotFoundException('User not found');
return { message: 'Order created successfully' };
return { error: 'Email already exists' };
*/

// ✅ GOOD: Translation files organized by module

// File structure:
// src/i18n/
// ├── en/
// │   ├── common.json
// │   ├── auth.json
// │   ├── user.json
// │   ├── order.json
// │   └── validation.json
// ├── vi/
// │   ├── common.json
// │   ├── auth.json
// │   ├── user.json
// │   ├── order.json
// │   └── validation.json
// └── ja/
//     └── ...

const translations_en = {
  common: {
    success: 'Operation successful',
    error: 'An error occurred',
    notFound: '{resource} not found',
    created: '{resource} created successfully',
    updated: '{resource} updated successfully',
    deleted: '{resource} deleted successfully',
    unauthorized: 'You are not authorized to perform this action',
    forbidden: 'Access denied',
  },
  auth: {
    loginSuccess: 'Login successful',
    loginFailed: 'Invalid email or password',
    tokenExpired: 'Your session has expired. Please login again.',
    accountLocked: 'Account locked. Try again in {minutes} minutes.',
    passwordChanged: 'Password changed successfully',
    registerSuccess: 'Registration successful. Please verify your email.',
  },
  user: {
    notFound: 'User with ID \'{id}\' not found',
    emailDuplicate: 'Email \'{email}\' is already in use',
    profileUpdated: 'Profile updated successfully',
    avatarUploaded: 'Avatar uploaded successfully',
  },
  order: {
    notFound: 'Order #{orderId} not found',
    created: 'Order #{orderId} created. Total: {total}',
    cancelled: 'Order #{orderId} has been cancelled',
    cannotCancel: 'Cannot cancel order in \'{status}\' status',
    insufficientStock: 'Insufficient stock for {productName}. Available: {available}',
  },
  validation: {
    required: '{field} is required',
    minLength: '{field} must be at least {min} characters',
    maxLength: '{field} must not exceed {max} characters',
    email: 'Please enter a valid email address',
    password: 'Password must include uppercase, number, and special character',
  },
};

const translations_vi = {
  common: {
    success: 'Thao tác thành công',
    error: 'Đã xảy ra lỗi',
    notFound: 'Không tìm thấy {resource}',
    created: 'Tạo {resource} thành công',
    updated: 'Cập nhật {resource} thành công',
    deleted: 'Xóa {resource} thành công',
    unauthorized: 'Bạn không có quyền thực hiện thao tác này',
    forbidden: 'Truy cập bị từ chối',
  },
  auth: {
    loginSuccess: 'Đăng nhập thành công',
    loginFailed: 'Email hoặc mật khẩu không đúng',
    tokenExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    accountLocked: 'Tài khoản bị khoá. Thử lại sau {minutes} phút.',
    passwordChanged: 'Đổi mật khẩu thành công',
    registerSuccess: 'Đăng ký thành công. Vui lòng xác minh email.',
  },
  user: {
    notFound: 'Không tìm thấy người dùng với ID \'{id}\'',
    emailDuplicate: 'Email \'{email}\' đã được sử dụng',
    profileUpdated: 'Cập nhật hồ sơ thành công',
    avatarUploaded: 'Cập nhật ảnh đại diện thành công',
  },
  order: {
    notFound: 'Không tìm thấy đơn hàng #{orderId}',
    created: 'Đơn hàng #{orderId} đã tạo. Tổng: {total}',
    cancelled: 'Đơn hàng #{orderId} đã huỷ',
    cannotCancel: 'Không thể huỷ đơn hàng ở trạng thái \'{status}\'',
    insufficientStock: 'Không đủ hàng cho {productName}. Còn lại: {available}',
  },
  validation: {
    required: '{field} là bắt buộc',
    minLength: '{field} phải có ít nhất {min} ký tự',
    maxLength: '{field} không được vượt quá {max} ký tự',
    email: 'Vui lòng nhập email hợp lệ',
    password: 'Mật khẩu phải bao gồm chữ hoa, số và ký tự đặc biệt',
  },
};

// ═══════════════════════════════════════════
// Rule 2: Translation Service
// ═══════════════════════════════════════════

// ✅ GOOD: Type-safe translation service

type TranslationKey = string; // In real app: use deep key paths

class TranslationService {
  private translations = new Map<string, Record<string, unknown>>();
  private defaultLocale = 'en';

  constructor() {
    this.translations.set('en', this.flattenObject(translations_en));
    this.translations.set('vi', this.flattenObject(translations_vi));
  }

  translate(key: TranslationKey, locale?: string, params?: Record<string, string | number>): string {
    const lang = locale || this.defaultLocale;
    const dict = this.translations.get(lang) || this.translations.get(this.defaultLocale);
    if (!dict) return key;

    let text = (dict[key] as string) || key;

    // Interpolation: replace {param} with values
    if (params) {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
      }
    }

    return text;
  }

  private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = String(value);
      }
    }

    return result;
  }
}

// Usage:
// const t = new TranslationService();
// t.translate('user.notFound', 'en', { id: '123' })
//   → "User with ID '123' not found"
// t.translate('user.notFound', 'vi', { id: '123' })
//   → "Không tìm thấy người dùng với ID '123'"

// ═══════════════════════════════════════════
// Rule 3: Locale Detection
// ═══════════════════════════════════════════

// ✅ GOOD: Detect locale from request
/*
// locale.middleware.ts
@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Priority:
    // 1. Query param: ?lang=vi
    // 2. Custom header: X-Lang
    // 3. Accept-Language header
    // 4. JWT user preference
    // 5. Default: 'en'

    const locale =
      req.query.lang as string ||
      req.headers['x-lang'] as string ||
      this.parseAcceptLanguage(req.headers['accept-language']) ||
      req.user?.preferredLanguage ||
      'en';

    req.locale = this.validateLocale(locale);
    next();
  }

  private parseAcceptLanguage(header?: string): string | undefined {
    if (!header) return undefined;
    // "vi-VN,vi;q=0.9,en;q=0.8" → "vi"
    const match = header.match(/^([a-z]{2})/i);
    return match?.[1]?.toLowerCase();
  }

  private validateLocale(locale: string): string {
    const supported = ['en', 'vi', 'ja', 'ko'];
    return supported.includes(locale) ? locale : 'en';
  }
}
*/

// ═══════════════════════════════════════════
// Rule 4: Date & Number Formatting
// ═══════════════════════════════════════════

// ✅ GOOD: Locale-aware formatting
function formatDate(date: Date, locale: string): string {
  const formats: Record<string, Intl.DateTimeFormatOptions> = {
    en: { year: 'numeric', month: 'short', day: 'numeric' },
    vi: { year: 'numeric', month: '2-digit', day: '2-digit' },
  };

  return new Intl.DateTimeFormat(locale, formats[locale] || formats.en).format(date);
}

function formatCurrency(amount: number, locale: string, currency?: string): string {
  const currencyMap: Record<string, string> = {
    en: 'USD', vi: 'VND', ja: 'JPY', ko: 'KRW',
  };

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || currencyMap[locale] || 'USD',
  }).format(amount);
}

// formatDate(new Date(), 'en')  → "Jan 15, 2024"
// formatDate(new Date(), 'vi')  → "15/01/2024"
// formatCurrency(1000, 'en')    → "$1,000.00"
// formatCurrency(1000000, 'vi') → "1.000.000 ₫"

// ═══════════════════════════════════════════
// Rule 5: i18n Best Practices
// ═══════════════════════════════════════════

const I18N_BEST_PRACTICES = {
  do: [
    'Tách tất cả user-facing text ra translation files',
    'Dùng interpolation cho dynamic values: {name}, {count}',
    'Hỗ trợ pluralization: 1 item vs 2 items',
    'Format dates/numbers theo locale (Intl API)',
    'Fallback to default locale nếu key chưa dịch',
    'Store user language preference trong profile',
  ],
  dont: [
    'Hardcode text trong code: throw new Error("User not found")',
    'Concatenate strings: "Hello " + name → dùng interpolation',
    'Assume date format: MM/DD vs DD/MM',
    'Mix languages trong cùng response',
    'Dịch error codes — giữ codes bằng English',
  ],
};

export {
  TranslationService,
  formatDate,
  formatCurrency,
  translations_en,
  translations_vi,
  I18N_BEST_PRACTICES,
  type TranslationKey,
};
