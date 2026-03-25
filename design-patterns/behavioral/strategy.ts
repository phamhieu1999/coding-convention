/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    STRATEGY PATTERN                          ║
 * ║                   (Behavioral Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INTENT: Định nghĩa họ algorithms, đóng gói từng cái,
 * cho phép hoán đổi tại RUNTIME. Client chọn strategy phù hợp.
 *
 * 🏠 ANALOGY: Đi từ A→B, chọn: đi bộ (chậm/free), taxi (nhanh/đắt),
 * xe bus (vừa/rẻ). Cùng mục đích, khác cách thực hiện.
 *
 * 📐 DIAGRAM:
 *  Context ───has───► «interface» Strategy
 *                          │ implements
 *                    ┌─────┼─────┐
 *                    ▼     ▼     ▼
 *                  StratA StratB StratC
 */

// ============================================================
// STRATEGY INTERFACE
// ============================================================

interface CompressionStrategy {
  readonly name: string;
  compress(data: string): CompressedData;
  decompress(compressed: CompressedData): string;
  getEstimatedRatio(): number; // % size reduction
}

interface CompressedData {
  readonly algorithm: string;
  readonly originalSize: number;
  readonly compressedSize: number;
  readonly data: string;
}

// ============================================================
// CONCRETE STRATEGIES
// ============================================================

/** RLE: tốt cho data có nhiều ký tự lặp (aaabbbccc → a3b3c3) */
class RLEStrategy implements CompressionStrategy {
  readonly name = "RLE (Run-Length Encoding)";

  compress(data: string): CompressedData {
    const compressed = data.replace(/(.)\1+/g, (match, char) => `${char}${match.length}`);
    return {
      algorithm: "RLE",
      originalSize: data.length,
      compressedSize: compressed.length,
      data: compressed,
    };
  }

  decompress(compressed: CompressedData): string {
    return compressed.data.replace(/(.)(\d+)/g, (_, char, count) => char.repeat(parseInt(count)));
  }

  getEstimatedRatio(): number { return 40; }
}

/** Dictionary: tốt cho data có nhiều từ lặp lại */
class DictionaryStrategy implements CompressionStrategy {
  readonly name = "Dictionary Encoding";

  compress(data: string): CompressedData {
    const words = data.split(/\s+/);
    const dict = new Map<string, string>();
    let idx = 0;

    const tokens = words.map((word) => {
      if (!dict.has(word)) dict.set(word, `#${idx++}`);
      return dict.get(word)!;
    });

    const header = Array.from(dict.entries()).map(([w, t]) => `${t}=${w}`).join("|");
    const compressed = `[${header}]${tokens.join(" ")}`;
    return {
      algorithm: "DICT",
      originalSize: data.length,
      compressedSize: compressed.length,
      data: compressed,
    };
  }

  decompress(compressed: CompressedData): string {
    const match = compressed.data.match(/^\[(.*?)\](.*)/);
    if (!match) return compressed.data;
    const dict = new Map(match[1].split("|").map((e) => {
      const [token, word] = e.split("=");
      return [token, word] as [string, string];
    }));
    return match[2].split(" ").map((t) => dict.get(t) ?? t).join(" ");
  }

  getEstimatedRatio(): number { return 30; }
}

/** NoOp: không nén (baseline) */
class NoCompressionStrategy implements CompressionStrategy {
  readonly name = "No Compression";

  compress(data: string): CompressedData {
    return { algorithm: "NONE", originalSize: data.length, compressedSize: data.length, data };
  }

  decompress(compressed: CompressedData): string { return compressed.data; }
  getEstimatedRatio(): number { return 0; }
}

// ============================================================
// CONTEXT
// ============================================================

class FileCompressor {
  private strategy: CompressionStrategy;

  constructor(strategy?: CompressionStrategy) {
    this.strategy = strategy ?? new NoCompressionStrategy();
  }

  /** Swap strategy tại runtime */
  setStrategy(strategy: CompressionStrategy): void {
    console.log(`  🔄 Strategy changed to: ${strategy.name}`);
    this.strategy = strategy;
  }

  /** Auto-select strategy tốt nhất cho data */
  autoSelectStrategy(data: string): void {
    const hasRepeats = /(.)\1{3,}/.test(data);
    const hasRepeatingWords = new Set(data.split(/\s+/)).size < data.split(/\s+/).length * 0.7;

    if (hasRepeats) this.setStrategy(new RLEStrategy());
    else if (hasRepeatingWords) this.setStrategy(new DictionaryStrategy());
    else this.setStrategy(new NoCompressionStrategy());
  }

  compressFile(filename: string, data: string): CompressedData {
    console.log(`\n📄 Compressing "${filename}" (${data.length} chars) with ${this.strategy.name}`);
    const result = this.strategy.compress(data);
    const ratio = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
    console.log(`  📊 ${result.originalSize} → ${result.compressedSize} chars (${ratio}% reduction)`);
    return result;
  }

  decompressFile(compressed: CompressedData): string {
    return this.strategy.decompress(compressed);
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  const compressor = new FileCompressor();

  // Data phù hợp cho RLE (nhiều ký tự lặp)
  const binaryLike = "aaaaaabbbbccccccddddddddeeee";
  compressor.setStrategy(new RLEStrategy());
  const rleResult = compressor.compressFile("binary.dat", binaryLike);
  console.log(`  ✅ Decompressed matches: ${compressor.decompressFile(rleResult) === binaryLike}`);

  // Data phù hợp cho Dictionary (nhiều từ lặp)
  const logData = "ERROR server crashed ERROR database timeout ERROR server crashed WARN high memory";
  compressor.setStrategy(new DictionaryStrategy());
  const dictResult = compressor.compressFile("app.log", logData);
  console.log(`  ✅ Decompressed matches: ${compressor.decompressFile(dictResult) === logData}`);

  // Auto-select strategy
  console.log("\n=== Auto Select ===");
  compressor.autoSelectStrategy(binaryLike);
  compressor.compressFile("auto1.dat", binaryLike);

  compressor.autoSelectStrategy(logData);
  compressor.compressFile("auto2.log", logData);

  compressor.autoSelectStrategy("unique short text");
  compressor.compressFile("auto3.txt", "unique short text");
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 * 1. Strategy = swap algorithm tại runtime, client KHÔNG cần biết chi tiết
 * 2. autoSelectStrategy() → chọn strategy dựa trên data characteristics
 * 3. Mỗi strategy là 1 class riêng → dễ test, dễ thêm mới
 * 4. Context (FileCompressor) delegate compression cho strategy
 * 5. NestJS: PassportStrategy, CacheStrategy, ValidationPipe options
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ PAYMENT PROCESSING
 *    Bài toán: Checkout hỗ trợ Credit Card, PayPal, Crypto, Bank Transfer.
 *    Mỗi phương thức có flow validate + charge + confirm khác nhau.
 *    Giải pháp: PaymentStrategy interface → CreditCardStrategy, PayPalStrategy...
 *    Context chọn strategy dựa trên user selection.
 *    Code: checkoutService.setPaymentStrategy(new CryptoStrategy());
 *          checkoutService.processPayment(order);
 *    Thực tế: Shopify checkout, Stripe Elements, NestJS payment modules.
 *
 * 2️⃣ SORTING / SEARCH ALGORITHMS
 *    Bài toán: Sort 100 items → quicksort OK. Sort 10M items → merge sort.
 *    Sort nearly-sorted data → insertion sort. Data có range nhỏ → counting sort.
 *    Giải pháp: SortStrategy interface → auto-select dựa trên data size + type.
 *    Code: const strategy = data.length > 10000 ? new MergeSort() : new QuickSort();
 *          sorter.setStrategy(strategy);
 *    Thực tế: V8 engine (Timsort), database query optimizers.
 *
 * 3️⃣ AUTHENTICATION STRATEGIES
 *    Bài toán: API hỗ trợ JWT, API Key, OAuth2, Basic Auth.
 *    Mỗi strategy validate token/credentials khác nhau.
 *    Giải pháp: AuthStrategy interface → JWTStrategy, APIKeyStrategy...
 *    Thực tế: Passport.js — chính xác là Strategy pattern:
 *    passport.use(new JwtStrategy(opts, verify));
 *    passport.use(new GoogleStrategy(opts, verify));
 *    Mỗi strategy = 1 class, swap tại config time.
 *
 * 4️⃣ PRICING / DISCOUNT STRATEGIES
 *    Bài toán: E-commerce cần tính giá: Regular (full price), Seasonal (20% off),
 *    VIP (30% off + free ship), Flash Sale (50% off, limited qty).
 *    Giải pháp: PricingStrategy interface. Cart.setPricingStrategy() tại runtime.
 *    Code: if (user.isVIP) cart.setPricingStrategy(new VIPPricing());
 *          else if (isFlashSale) cart.setPricingStrategy(new FlashSalePricing());
 *    Thêm strategy mới = thêm class, KHÔNG sửa Cart code.
 *
 * 5️⃣ DATA SERIALIZATION / FORMAT
 *    Bài toán: API trả response dạng JSON (default), XML (legacy clients),
 *    Protocol Buffers (internal services), MessagePack (mobile).
 *    Giải pháp: SerializationStrategy interface → JSONStrategy, XMLStrategy...
 *    Chọn strategy dựa trên Accept header hoặc client type.
 *    Code: const serializer = req.headers.accept === "application/xml"
 *            ? new XMLSerializer() : new JSONSerializer();
 *          res.send(serializer.serialize(data));
 *
 * 📌 STRATEGY vs STATE vs TEMPLATE METHOD:
 *    Strategy: client CHỌN algorithm (external, interchangeable)
 *    State: behavior tự thay đổi theo internal state (self-managed)
 *    Template Method: algorithm cố định, chỉ override MỘT SỐ bước (inheritance)
 */

export { CompressionStrategy, FileCompressor, RLEStrategy, DictionaryStrategy };
