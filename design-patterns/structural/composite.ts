/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                   COMPOSITE PATTERN                          ║
 * ║                   (Structural Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ INTENT                                                  │
 * │ Tổ chức objects theo CẤU TRÚC CÂY. Client xử lý       │
 * │ single object và group of objects CÙNG MỘT CÁCH.       │
 * └─────────────────────────────────────────────────────────┘
 *
 * 🏠 REAL-WORLD ANALOGY:
 * Cơ cấu tổ chức công ty: CEO → VP → Manager → Developer
 * Tính lương phòng ban = tổng lương tất cả nhân viên (đệ quy).
 *
 * 📐 TREE STRUCTURE:
 *
 *            Department (Composite)
 *           /          |           \
 *     Department    Employee     Employee
 *       /    \       (Leaf)      (Leaf)
 *  Employee Employee
 *   (Leaf)   (Leaf)
 *
 * ✅ KHI NÀO DÙNG:
 *   - Cấu trúc cây: file system, menu, org chart, UI components
 *   - Cần xử lý leaf và composite cùng cách
 *
 * ❌ KHI NÀO KHÔNG DÙNG:
 *   - Cấu trúc phẳng (flat list)
 *   - Leaf và composite cần API khác nhau
 */

// ============================================================
// COMPONENT INTERFACE
// ============================================================

interface OrganizationComponent {
  readonly name: string;
  getSalary(): number;
  getHeadcount(): number;
  display(indent?: string): void;
  find(predicate: (item: OrganizationComponent) => boolean): OrganizationComponent[];
}

// ============================================================
// LEAF
// ============================================================

class Employee implements OrganizationComponent {
  constructor(
    public readonly name: string,
    public readonly role: string,
    public readonly salary: number
  ) {}

  getSalary(): number {
    return this.salary;
  }

  getHeadcount(): number {
    return 1;
  }

  display(indent: string = ""): void {
    console.log(`${indent}👤 ${this.name} (${this.role}) - $${this.salary.toLocaleString()}/yr`);
  }

  find(predicate: (item: OrganizationComponent) => boolean): OrganizationComponent[] {
    return predicate(this) ? [this] : [];
  }
}

// ============================================================
// COMPOSITE
// ============================================================

class Department implements OrganizationComponent {
  private readonly children: OrganizationComponent[] = [];

  constructor(public readonly name: string) {}

  add(...items: OrganizationComponent[]): this {
    this.children.push(...items);
    return this; // Fluent API
  }

  remove(item: OrganizationComponent): boolean {
    const idx = this.children.indexOf(item);
    if (idx === -1) return false;
    this.children.splice(idx, 1);
    return true;
  }

  /** Đệ quy: tổng lương cả department (bao gồm sub-departments) */
  getSalary(): number {
    return this.children.reduce((sum, child) => sum + child.getSalary(), 0);
  }

  /** Đệ quy: tổng nhân sự */
  getHeadcount(): number {
    return this.children.reduce((count, child) => count + child.getHeadcount(), 0);
  }

  /** In ra dạng tree */
  display(indent: string = ""): void {
    const salary = this.getSalary().toLocaleString();
    const count = this.getHeadcount();
    console.log(`${indent}📁 ${this.name} (${count} people, $${salary}/yr)`);
    this.children.forEach((child) => child.display(indent + "  "));
  }

  /** Tìm kiếm đệ quy */
  find(predicate: (item: OrganizationComponent) => boolean): OrganizationComponent[] {
    let results: OrganizationComponent[] = predicate(this) ? [this] : [];
    for (const child of this.children) {
      results = results.concat(child.find(predicate));
    }
    return results;
  }

  getChildren(): readonly OrganizationComponent[] {
    return this.children;
  }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  // Build org chart
  const company = new Department("TechCorp");

  const engineering = new Department("Engineering");
  const backend = new Department("Backend Team");
  backend.add(
    new Employee("Alice", "Senior Engineer", 120000),
    new Employee("Bob", "Engineer", 95000),
    new Employee("Charlie", "Junior Engineer", 70000),
  );

  const frontend = new Department("Frontend Team");
  frontend.add(
    new Employee("Diana", "Lead Engineer", 130000),
    new Employee("Eve", "Engineer", 90000),
  );

  engineering.add(
    new Employee("Frank", "VP Engineering", 180000),
    backend,
    frontend,
  );

  const marketing = new Department("Marketing");
  marketing.add(
    new Employee("Grace", "Marketing Director", 140000),
    new Employee("Hank", "Marketing Specialist", 75000),
  );

  company.add(
    new Employee("Ivan", "CEO", 250000),
    engineering,
    marketing,
  );

  // Display org chart
  console.log("=== Organization Chart ===\n");
  company.display();

  // ✅ getSalary() và getHeadcount() hoạt động ĐỒNG NHẤT
  // cho cả Employee (leaf) và Department (composite)
  console.log("\n=== Statistics ===");
  console.log(`Company total salary: $${company.getSalary().toLocaleString()}`);
  console.log(`Company headcount: ${company.getHeadcount()}`);
  console.log(`Engineering salary: $${engineering.getSalary().toLocaleString()}`);
  console.log(`Engineering headcount: ${engineering.getHeadcount()}`);
  console.log(`Backend salary: $${backend.getSalary().toLocaleString()}`);

  // Search
  console.log("\n=== Find: salary > $100,000 ===");
  const highEarners = company.find(
    (item) => item instanceof Employee && item.salary > 100000
  );
  highEarners.forEach((e) => e.display("  "));

  console.log("\n=== Find: departments with > 2 people ===");
  const bigDepts = company.find(
    (item) => item instanceof Department && item.getHeadcount() > 2
  );
  bigDepts.forEach((d) => console.log(`  📁 ${d.name} (${d.getHeadcount()} people)`));
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 *
 * 1. Client gọi getSalary() trên Employee hay Department → cùng cách!
 * 2. Đệ quy tự nhiên: Department.getSalary() = sum of children.getSalary()
 * 3. Composite HAS children (có thể là Leaf HOẶC Composite)
 * 4. Fluent API: department.add(emp1, emp2) → method chaining
 * 5. NestJS: Module system chính là Composite pattern
 *    Module imports other Modules → tree structure
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ FILE SYSTEM (classic example)
 *    Bài toán: Tính size thư mục. Folder chứa files VÀ sub-folders.
 *    folder.getSize() = sum of all files + sub-folders (đệ quy).
 *    Giải pháp: File (leaf) và Folder (composite) cùng implement FileSystemNode.
 *    Thực tế: Node.js fs module, IDE file explorer, cloud storage UI.
 *    Code: const root = new Folder("src");
 *          root.add(new File("index.ts", 1024), new Folder("utils"));
 *          root.getSize(); // Đệ quy tổng size tất cả children
 *
 * 2️⃣ UI COMPONENT TREE (React / Angular)
 *    Bài toán: Page chứa Layout → chứa Sidebar + Content → chứa Buttons.
 *    render() cần đệ quy render tất cả children.
 *    Giải pháp: Component interface → LeafComponent (Button) và ContainerComponent (Div).
 *    Thực tế: React Virtual DOM, Angular View Tree, Flutter Widget Tree.
 *    → React.render(<App/>) đệ quy render toàn bộ component tree.
 *
 * 3️⃣ MENU / NAVIGATION SYSTEM
 *    Bài toán: Admin panel có menu đa cấp:
 *    Dashboard | Users → [List, Create, Roles → [View, Edit]] | Settings
 *    Giải pháp: MenuItem (leaf link) và MenuGroup (composite chứa sub-items).
 *    Khi render: menuGroup.render() đệ quy render tất cả children thành <ul><li>.
 *    Khi check permission: menuGroup.isVisible(user) = any child visible.
 *
 * 4️⃣ PERMISSION / ROLE HIERARCHY
 *    Bài toán: Admin role có permissions: {users: [read, write]}, {orders: [read]}.
 *    RoleGroup "SuperAdmin" chứa role "Admin" + role "Finance" → kế thừa tất cả permissions.
 *    Giải pháp: Permission (leaf) và RoleGroup (composite).
 *    roleGroup.getPermissions() = flatten tất cả permissions của children roles.
 *
 * 5️⃣ E-COMMERCE PRODUCT BUNDLES
 *    Bài toán: Shop bán sản phẩm lẻ (iPhone) VÀ bundle (iPhone + Case + AirPods).
 *    Bundle có thể chứa bundle khác (Starter Pack chứa iPhone Bundle + Accessories).
 *    Giải pháp: Product (leaf) và Bundle (composite) cùng implement OrderItem.
 *    bundle.getPrice() = sum of all products' prices + bundle discount.
 *    bundle.getWeight() = sum of all products' weights (for shipping calc).
 *
 * 📌 DẤU HIỆU CẦN COMPOSITE:
 *    ✅ Data có cấu trúc CÂY (parent-children)
 *    ✅ Cần xử lý leaf và group CÙNG CÁCH (polymorphism)
 *    ✅ Operations cần đệ quy (getSize, render, getPermissions)
 *    ❌ Data phẳng (flat list) → dùng array bình thường
 */

export { OrganizationComponent, Employee, Department };
