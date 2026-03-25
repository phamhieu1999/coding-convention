/**
 * Template Method Pattern
 * 
 * Định nghĩa skeleton (bộ khung) của một algorithm trong base class,
 * nhưng để các subclass override các bước cụ thể mà không thay đổi
 * cấu trúc tổng thể.
 * 
 * Use case: Data pipeline, report generation, game loop, build process
 */

// --- Abstract Class with Template Method ---
abstract class DataPipeline {
  // TEMPLATE METHOD - định nghĩa flow cố định
  run(source: string): void {
    console.log(`\n${"═".repeat(50)}`);
    console.log(`🔄 Running ${this.getPipelineName()} Pipeline`);
    console.log(`${"═".repeat(50)}`);

    const rawData = this.extract(source);
    const validData = this.validate(rawData);
    const transformedData = this.transform(validData);
    
    // Hook method (optional override)
    if (this.shouldEnrich()) {
      this.enrich(transformedData);
    }

    this.load(transformedData);
    this.notify();

    console.log(`✅ Pipeline completed!\n`);
  }

  // Abstract methods - bắt buộc subclass phải implement
  protected abstract getPipelineName(): string;
  protected abstract extract(source: string): any[];
  protected abstract transform(data: any[]): any[];
  protected abstract load(data: any[]): void;

  // Hook methods - optional override, có default behavior
  protected validate(data: any[]): any[] {
    console.log(`  [Validate] Checking ${data.length} records...`);
    const valid = data.filter(item => item !== null && item !== undefined);
    console.log(`  [Validate] ${valid.length}/${data.length} records valid`);
    return valid;
  }

  protected shouldEnrich(): boolean {
    return false; // Default: không enrich
  }

  protected enrich(data: any[]): void {
    console.log(`  [Enrich] Enriching ${data.length} records...`);
  }

  protected notify(): void {
    console.log(`  [Notify] Pipeline execution logged`);
  }
}

// --- Concrete Implementation: CSV Pipeline ---
class CSVPipeline extends DataPipeline {
  protected getPipelineName(): string {
    return "CSV";
  }

  protected extract(source: string): any[] {
    console.log(`  [Extract] Reading CSV from: ${source}`);
    // Simulate CSV data
    return [
      { name: "Alice", age: "30", email: "alice@test.com" },
      { name: "Bob", age: "invalid", email: "bob@test.com" },
      null,
      { name: "Charlie", age: "25", email: "" },
    ];
  }

  protected validate(data: any[]): any[] {
    const validData = super.validate(data);
    // Thêm validation riêng cho CSV
    return validData.filter(item => item.name && item.email);
  }

  protected transform(data: any[]): any[] {
    console.log(`  [Transform] Normalizing CSV data...`);
    return data.map(item => ({
      ...item,
      name: item.name.toUpperCase(),
      age: parseInt(item.age) || 0,
      processedAt: new Date().toISOString(),
    }));
  }

  protected load(data: any[]): void {
    console.log(`  [Load] Inserting ${data.length} records into database`);
    data.forEach(d => console.log(`    → ${JSON.stringify(d)}`));
  }
}

// --- Concrete Implementation: API Pipeline ---
class APIPipeline extends DataPipeline {
  protected getPipelineName(): string {
    return "API";
  }

  protected extract(source: string): any[] {
    console.log(`  [Extract] Fetching from API: ${source}`);
    // Simulate API response
    return [
      { id: 1, title: "Post 1", body: "Content 1", userId: 1 },
      { id: 2, title: "Post 2", body: "Content 2", userId: 2 },
      { id: 3, title: "Post 3", body: "Content 3", userId: 1 },
    ];
  }

  protected transform(data: any[]): any[] {
    console.log(`  [Transform] Transforming API response...`);
    return data.map(item => ({
      postId: item.id,
      title: item.title.toUpperCase(),
      author: `User_${item.userId}`,
      summary: item.body.substring(0, 50),
      importedAt: new Date().toISOString(),
    }));
  }

  // Override hook: enable enrichment
  protected shouldEnrich(): boolean {
    return true;
  }

  protected enrich(data: any[]): void {
    console.log(`  [Enrich] Adding user details from API...`);
    data.forEach(item => {
      item.authorEmail = `${item.author.toLowerCase()}@company.com`;
    });
  }

  protected load(data: any[]): void {
    console.log(`  [Load] Sending ${data.length} records to data warehouse`);
    data.forEach(d => console.log(`    → ${JSON.stringify(d)}`));
  }

  // Override notification
  protected notify(): void {
    super.notify();
    console.log(`  [Notify] Slack notification sent to #data-team`);
  }
}

// --- Concrete Implementation: Log Pipeline ---
class LogPipeline extends DataPipeline {
  protected getPipelineName(): string {
    return "Log Analysis";
  }

  protected extract(source: string): any[] {
    console.log(`  [Extract] Reading log file: ${source}`);
    return [
      { level: "ERROR", message: "Connection timeout", ts: "2024-01-15T10:30:00" },
      { level: "WARN", message: "High memory usage", ts: "2024-01-15T10:31:00" },
      { level: "INFO", message: "Request completed", ts: "2024-01-15T10:32:00" },
      { level: "ERROR", message: "Database error", ts: "2024-01-15T10:33:00" },
    ];
  }

  protected transform(data: any[]): any[] {
    console.log(`  [Transform] Filtering ERROR logs only...`);
    return data
      .filter(item => item.level === "ERROR")
      .map(item => ({
        ...item,
        severity: "HIGH",
        alertRequired: true,
      }));
  }

  protected load(data: any[]): void {
    console.log(`  [Load] Writing ${data.length} error records to monitoring dashboard`);
    data.forEach(d => console.log(`    🔴 ${d.ts}: ${d.message}`));
  }

  protected notify(): void {
    console.log(`  [Notify] PagerDuty alert triggered! 🚨`);
  }
}

// --- Usage ---
// Cùng 1 template (extract → validate → transform → enrich? → load → notify)
// nhưng behavior khác nhau tùy implementation

const csvPipeline = new CSVPipeline();
csvPipeline.run("data/users.csv");

const apiPipeline = new APIPipeline();
apiPipeline.run("https://api.example.com/posts");

const logPipeline = new LogPipeline();
logPipeline.run("/var/log/app.log");

export { DataPipeline, CSVPipeline, APIPipeline, LogPipeline };

/**
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ ETL / DATA PIPELINE (ví dụ trên)
 *    Bài toán: Import data từ CSV, API, Database, S3 — flow luôn giống nhau:
 *    extract → validate → transform → enrich? → load → notify.
 *    Nhưng MỖI source có cách extract, transform, load KHÁC NHAU.
 *    Giải pháp: Base class định nghĩa flow. Subclass override từng bước.
 *    Thực tế: Apache Airflow DAGs, AWS Glue jobs, NestJS scheduled tasks.
 *    → Thêm S3Pipeline = extend DataPipeline, override extract() + load().
 *
 * 2️⃣ TEST FRAMEWORK (Jest, Mocha)
 *    Bài toán: Test flow luôn là: beforeAll → beforeEach → test → afterEach → afterAll.
 *    Framework cố định FLOW, developer chỉ override nội dung test.
 *    Giải pháp: TestRunner (template method) giữ flow cố định.
 *    describe("...", () => {
 *      beforeAll(() => { ... });  // hook: setup
 *      it("...", () => { ... }); // abstract: test content
 *      afterAll(() => { ... });  // hook: cleanup
 *    });
 *    Thực tế: Jest, Mocha, JUnit, NestJS testing module.
 *
 * 3️⃣ DOCUMENT PARSER
 *    Bài toán: Parse PDF, Word, HTML — flow giống nhau:
 *    openFile → readContent → parseStructure → extractText → close.
 *    Nhưng cách parse PDF khác Word khác HTML.
 *    Giải pháp: DocumentParser base → PDFParser, WordParser, HTMLParser.
 *    Mỗi subclass override readContent() + parseStructure() theo format.
 *
 * 4️⃣ BUILD PROCESS (CI/CD)
 *    Bài toán: Build Node.js app vs Java app vs Go app — flow giống:
 *    install deps → lint → compile → test → package.
 *    Nhưng commands khác nhau (npm vs gradle vs go build).
 *    Giải pháp: BuildPipeline base → NodeBuild, JavaBuild, GoBuild.
 *    Code: class NodeBuild extends BuildPipeline {
 *            install() { exec("npm ci"); }
 *            compile() { exec("tsc"); }
 *            test() { exec("jest"); }
 *            package() { exec("docker build ."); }
 *          }
 *
 * 5️⃣ REPORT GENERATION
 *    Bài toán: Generate SalesReport, InventoryReport, FinancialReport — flow:
 *    fetchData → validate → calculate → format → export.
 *    Nhưng mỗi report fetch data khác (SQL query khác), calculate khác.
 *    Giải pháp: ReportGenerator base định nghĩa flow, subclass override bước cụ thể.
 *    Hook: shouldSendEmail() — SalesReport gửi email, InventoryReport không.
 *
 * 📌 TEMPLATE METHOD vs STRATEGY:
 *    Template Method: flow CỐ ĐỊNH, override MỘT SỐ bước (inheritance)
 *    Strategy: TOÀN BỘ algorithm swap (composition)
 *    → Template Method khi: flow không đổi, chỉ chi tiết bước thay đổi
 *    → Strategy khi: toàn bộ logic có thể swap hoàn toàn
 *    → Template Method = "đừng gọi tôi, tôi sẽ gọi bạn" (Hollywood Principle)
 */
