/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                      STATE PATTERN                           ║
 * ║                   (Behavioral Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INTENT: Object thay đổi BEHAVIOR khi internal state thay đổi.
 * Mỗi state là 1 class riêng → tránh if/else chains khổng lồ.
 *
 * 🏠 ANALOGY: Máy bán nước tự động. Tùy state (chờ tiền, chờ chọn,
 * đang rót, hết hàng) → cùng nút bấm nhưng behavior khác nhau.
 *
 * ⚠️ KHÔNG DÙNG STATE PATTERN (if/else hell):
 *   if (status === "draft") { ... }
 *   else if (status === "review") { ... }    ← thêm state = thêm else
 *   else if (status === "approved") { ... }  ← spaghetti code
 *   else if (status === "published") { ... }
 *
 * 📐 STATE DIAGRAM:
 *   Draft ──submit()──► Review ──approve()──► Approved ──publish()──► Published
 *     ▲                   │                      │
 *     └───reject()────────┘                      │
 *     └───────────────reject()───────────────────┘
 */

// ============================================================
// STATE INTERFACE
// ============================================================

interface ArticleState {
  readonly name: string;
  submit(article: Article): void;
  approve(article: Article): void;
  reject(article: Article, reason: string): void;
  publish(article: Article): void;
  edit(article: Article, content: string): void;
}

// ============================================================
// CONTEXT
// ============================================================

class Article {
  private state: ArticleState;
  private history: string[] = [];

  constructor(
    public readonly id: string,
    public title: string,
    public content: string,
    public author: string
  ) {
    this.state = new DraftState();
    this.log("Article created");
  }

  setState(newState: ArticleState): void {
    const prev = this.state.name;
    this.state = newState;
    this.log(`${prev} → ${newState.name}`);
    console.log(`  📋 [${this.id}] ${prev} → ${newState.name}`);
  }

  getStateName(): string { return this.state.name; }

  // Delegate tất cả actions cho current state
  submit(): void { this.state.submit(this); }
  approve(): void { this.state.approve(this); }
  reject(reason: string): void { this.state.reject(this, reason); }
  publish(): void { this.state.publish(this); }
  edit(content: string): void { this.state.edit(this, content); }

  log(msg: string): void { this.history.push(`[${new Date().toLocaleTimeString()}] ${msg}`); }

  printInfo(): void {
    console.log(`\n── ${this.title} (${this.id}) ──`);
    console.log(`  Author: ${this.author} | State: ${this.state.name}`);
    console.log(`  History: ${this.history.length} events`);
    this.history.slice(-3).forEach((h) => console.log(`    ${h}`));
  }
}

// ============================================================
// CONCRETE STATES
// ============================================================

class DraftState implements ArticleState {
  readonly name = "📝 Draft";
  submit(article: Article): void { article.setState(new ReviewState()); }
  approve(_a: Article): void { console.log("  ⚠️ Cannot approve a draft. Submit first."); }
  reject(_a: Article): void { console.log("  ⚠️ Cannot reject a draft."); }
  publish(_a: Article): void { console.log("  ⚠️ Cannot publish a draft. Submit → Approve first."); }
  edit(article: Article, content: string): void {
    article.content = content;
    article.log("Content edited");
    console.log("  ✏️ Draft updated.");
  }
}

class ReviewState implements ArticleState {
  readonly name = "👀 In Review";
  submit(_a: Article): void { console.log("  ⚠️ Already in review."); }
  approve(article: Article): void { article.setState(new ApprovedState()); }
  reject(article: Article, reason: string): void {
    article.log(`Rejected: ${reason}`);
    article.setState(new DraftState());
    console.log(`  ❌ Rejected: ${reason}. Back to draft.`);
  }
  publish(_a: Article): void { console.log("  ⚠️ Must be approved before publishing."); }
  edit(_a: Article): void { console.log("  ⚠️ Cannot edit while in review. Reject it first."); }
}

class ApprovedState implements ArticleState {
  readonly name = "✅ Approved";
  submit(_a: Article): void { console.log("  ⚠️ Already approved."); }
  approve(_a: Article): void { console.log("  ⚠️ Already approved."); }
  reject(article: Article, reason: string): void {
    article.log(`Rejected after approval: ${reason}`);
    article.setState(new DraftState());
    console.log(`  ❌ Sent back to draft: ${reason}`);
  }
  publish(article: Article): void {
    article.log("Published!");
    article.setState(new PublishedState());
    console.log("  🎉 Article published!");
  }
  edit(_a: Article): void { console.log("  ⚠️ Cannot edit approved article. Reject it first."); }
}

class PublishedState implements ArticleState {
  readonly name = "🌐 Published";
  submit(_a: Article): void { console.log("  ⚠️ Already published."); }
  approve(_a: Article): void { console.log("  ⚠️ Already published."); }
  reject(_a: Article): void { console.log("  ⚠️ Cannot reject published article. Unpublish first."); }
  publish(_a: Article): void { console.log("  ⚠️ Already published."); }
  edit(_a: Article): void { console.log("  ⚠️ Cannot edit published article."); }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  console.log("=== Happy Path: Draft → Review → Approved → Published ===\n");
  const article1 = new Article("ART-001", "Clean Architecture", "Content...", "Alice");
  article1.edit("Updated clean architecture content");
  article1.submit();
  article1.approve();
  article1.publish();
  article1.printInfo();

  console.log("\n=== Reject Flow: Draft → Review → REJECTED → Draft → Review → Approved ===\n");
  const article2 = new Article("ART-002", "Design Patterns", "Draft content", "Bob");
  article2.submit();
  article2.reject("Missing code examples");
  article2.edit("Added code examples...");
  article2.submit();
  article2.approve();
  article2.publish();
  article2.printInfo();

  console.log("\n=== Invalid Transitions ===\n");
  const article3 = new Article("ART-003", "Test Article", "...", "Charlie");
  article3.publish();   // ⚠️ Can't publish draft
  article3.approve();   // ⚠️ Can't approve draft
  article3.submit();
  article3.edit("...");  // ⚠️ Can't edit in review
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 * 1. Mỗi state = 1 class → thay thế if/else chain
 * 2. State transition logic NẰM TRONG state class (không ở context)
 * 3. Invalid transitions trả warning → không throw (graceful)
 * 4. Context delegate mọi action cho current state
 * 5. NestJS: Workflow engines, order status machines
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ ORDER LIFECYCLE (E-Commerce)
 *    Bài toán: Đơn hàng có 8 trạng thái: Pending → Confirmed → Processing
 *    → Shipped → Delivered | Pending → Cancelled | Shipped → Returned.
 *    Nếu dùng if/else: if (status === "pending") { if (action === "confirm") ... }
 *    → 8 states × 5 actions = 40+ branches → unmanageable.
 *    Giải pháp: Mỗi state = 1 class. PendingState.confirm() → ConfirmedState.
 *    PendingState.ship() → throw "Cannot ship pending order" (invalid transition).
 *    Thực tế: Shopify, Amazon order systems đều dùng state machine.
 *
 * 2️⃣ USER AUTHENTICATION STATE
 *    Bài toán: User có states: Anonymous → LoggingIn → Authenticated → Locked.
 *    Cùng action "accessDashboard" → behavior khác tùy state:
 *    - Anonymous: redirect to login
 *    - LoggingIn: show "please wait"
 *    - Authenticated: show dashboard
 *    - Locked: show "account locked, contact support"
 *    Giải pháp: Mỗi auth state = 1 class, delegate actions cho current state.
 *
 * 3️⃣ TCP CONNECTION STATE
 *    Bài toán: TCP connection có 3 states: Closed → Listening → Established.
 *    Cùng action open/close/send → behavior khác nhau.
 *    Closed.send() → error "not connected"
 *    Established.send() → gửi data thành công.
 *    Giải pháp: Classic State pattern example từ GoF book.
 *    Thực tế: Node.js net.Socket, WebSocket readyState, database connection pools.
 *
 * 4️⃣ VIDEO PLAYER STATE
 *    Bài toán: Player: Stopped → Playing → Paused → Buffering.
 *    Click Play khi Stopped → start video. Click Play khi Playing → do nothing.
 *    Click Play khi Paused → resume. Click Play khi Buffering → do nothing.
 *    Giải pháp: Mỗi state xử lý play/pause/stop theo cách riêng.
 *    Thực tế: YouTube player, Spotify, Netflix — tất cả dùng state machine.
 *
 * 5️⃣ DOCUMENT REVIEW WORKFLOW (ví dụ trên)
 *    Bài toán: CMS/Wiki — bài viết từ Draft → Review → Approved → Published.
 *    Reviewer reject → quay về Draft. Editor không thể edit bài đang Review.
 *    Giải pháp: State pattern đảm bảo chỉ valid transitions được phép.
 *    Thực tế: WordPress post status, Jira ticket workflow, GitHub PR states.
 *
 * 📌 STATE vs STRATEGY:
 *    State: object thay đổi behavior KHI STATE thay đổi (internal trigger)
 *    Strategy: client CHỌN algorithm tại runtime (external trigger)
 *    → State: transitions happen INSIDE state classes (self-managed)
 *    → Strategy: client explicitly calls setStrategy() (externally managed)
 *    → State khi behavior phụ thuộc vào lifecycle/status
 *    → Strategy khi behavior phụ thuộc vào user choice/config
 */

export { Article, ArticleState };
