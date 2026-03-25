/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    COMMAND PATTERN                            ║
 * ║                   (Behavioral Pattern)                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INTENT: Đóng gói request thành object → parameterize, queue,
 * log, và hỗ trợ UNDO/REDO operations.
 *
 * 🏠 ANALOGY: Đặt đồ ăn qua app. Đơn hàng (command) được tạo,
 * gửi vào queue, bếp (receiver) thực hiện. Có thể hủy đơn (undo).
 *
 * FLOW: Invoker → Command.execute() → Receiver does work
 *                 Command.undo()   → Receiver reverts
 */

// ============================================================
// COMMAND INTERFACE
// ============================================================

interface Command {
  execute(): void;
  undo(): void;
  readonly description: string;
}

// ============================================================
// RECEIVER
// ============================================================

interface SpreadsheetCell { value: string | number; formula?: string; style?: string; }

class Spreadsheet {
  private cells: Map<string, SpreadsheetCell> = new Map();

  getCell(ref: string): SpreadsheetCell | undefined { return this.cells.get(ref); }
  setCell(ref: string, cell: SpreadsheetCell): void { this.cells.set(ref, cell); }
  deleteCell(ref: string): void { this.cells.delete(ref); }

  display(): void {
    console.log("  ┌────────────────────────────────────┐");
    if (this.cells.size === 0) { console.log("  │ (empty)                            │"); }
    for (const [ref, cell] of this.cells) {
      const val = cell.formula ? `${cell.value} [=${cell.formula}]` : String(cell.value);
      const style = cell.style ? ` {${cell.style}}` : "";
      console.log(`  │ ${ref.padEnd(4)} │ ${(val + style).padEnd(28)} │`);
    }
    console.log("  └────────────────────────────────────┘");
  }
}

// ============================================================
// CONCRETE COMMANDS
// ============================================================

class SetCellCommand implements Command {
  private previousCell?: SpreadsheetCell;
  readonly description: string;

  constructor(
    private readonly sheet: Spreadsheet,
    private readonly ref: string,
    private readonly newCell: SpreadsheetCell
  ) {
    this.description = `Set ${ref} = ${newCell.value}`;
  }

  execute(): void {
    this.previousCell = this.sheet.getCell(this.ref); // Save for undo
    this.sheet.setCell(this.ref, { ...this.newCell });
  }

  undo(): void {
    if (this.previousCell) this.sheet.setCell(this.ref, this.previousCell);
    else this.sheet.deleteCell(this.ref);
  }
}

class DeleteCellCommand implements Command {
  private previousCell?: SpreadsheetCell;
  readonly description: string;

  constructor(private readonly sheet: Spreadsheet, private readonly ref: string) {
    this.description = `Delete ${ref}`;
  }

  execute(): void {
    this.previousCell = this.sheet.getCell(this.ref);
    this.sheet.deleteCell(this.ref);
  }

  undo(): void {
    if (this.previousCell) this.sheet.setCell(this.ref, this.previousCell);
  }
}

class StyleCellCommand implements Command {
  private previousStyle?: string;
  readonly description: string;

  constructor(
    private readonly sheet: Spreadsheet,
    private readonly ref: string,
    private readonly style: string
  ) {
    this.description = `Style ${ref}: ${style}`;
  }

  execute(): void {
    const cell = this.sheet.getCell(this.ref);
    if (!cell) throw new Error(`Cell ${this.ref} not found`);
    this.previousStyle = cell.style;
    this.sheet.setCell(this.ref, { ...cell, style: this.style });
  }

  undo(): void {
    const cell = this.sheet.getCell(this.ref);
    if (cell) this.sheet.setCell(this.ref, { ...cell, style: this.previousStyle });
  }
}

/** Macro = composite command (batch operations) */
class MacroCommand implements Command {
  readonly description: string;
  constructor(private readonly commands: Command[], description?: string) {
    this.description = description ?? `Macro [${commands.length} commands]`;
  }
  execute(): void { this.commands.forEach((c) => c.execute()); }
  undo(): void { [...this.commands].reverse().forEach((c) => c.undo()); }
}

// ============================================================
// INVOKER (Undo/Redo Manager)
// ============================================================

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // New command clears redo
    console.log(`  ▶ ${command.description}`);
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) { console.log("  ↩ Nothing to undo"); return false; }
    cmd.undo();
    this.redoStack.push(cmd);
    console.log(`  ↩ Undo: ${cmd.description}`);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) { console.log("  ↪ Nothing to redo"); return false; }
    cmd.execute();
    this.undoStack.push(cmd);
    console.log(`  ↪ Redo: ${cmd.description}`);
    return true;
  }

  getHistory(): string[] { return this.undoStack.map((c, i) => `${i + 1}. ${c.description}`); }
}

// ============================================================
// USAGE
// ============================================================

function demo() {
  const sheet = new Spreadsheet();
  const history = new CommandHistory();

  console.log("=== Building Spreadsheet ===\n");

  history.execute(new SetCellCommand(sheet, "A1", { value: "Name" }));
  history.execute(new SetCellCommand(sheet, "B1", { value: "Salary" }));
  history.execute(new SetCellCommand(sheet, "A2", { value: "Alice" }));
  history.execute(new SetCellCommand(sheet, "B2", { value: 95000 }));
  history.execute(new SetCellCommand(sheet, "A3", { value: "Bob" }));
  history.execute(new SetCellCommand(sheet, "B3", { value: 88000 }));
  history.execute(new StyleCellCommand(sheet, "A1", "bold; bg:yellow"));
  history.execute(new StyleCellCommand(sheet, "B1", "bold; bg:yellow"));
  sheet.display();

  console.log("\n=== Undo 2 times ===");
  history.undo();
  history.undo();
  sheet.display();

  console.log("\n=== Redo 1 time ===");
  history.redo();
  sheet.display();

  // Macro command
  console.log("\n=== Macro: Add row ===");
  history.execute(new MacroCommand([
    new SetCellCommand(sheet, "A4", { value: "Charlie" }),
    new SetCellCommand(sheet, "B4", { value: 72000 }),
  ], "Add Charlie row"));
  sheet.display();

  console.log("\n=== Undo macro (undoes both cells) ===");
  history.undo();
  sheet.display();

  console.log("\n=== History ===");
  history.getHistory().forEach((h) => console.log(`  ${h}`));
}

demo();

/**
 * 🔑 KEY TAKEAWAYS:
 * 1. Command đóng gói: action + data + undo info vào 1 object
 * 2. Undo/Redo: lưu history stack, undo = pop + reverse
 * 3. MacroCommand: batch nhiều commands, undo tất cả cùng lúc
 * 4. execute() save previous state → undo() restore
 * 5. NestJS: CQRS module (@nestjs/cqrs) dùng Command pattern
 *
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ BÀI TOÁN THỰC TẾ TRONG PRODUCTION
 * ═══════════════════════════════════════════════════════════════
 *
 * 1️⃣ TEXT EDITOR / SPREADSHEET UNDO/REDO (ví dụ trên)
 *    Bài toán: User edit document → undo → redo → undo 5 lần.
 *    Nếu dùng state snapshot → mỗi undo lưu toàn bộ document → tốn RAM.
 *    Giải pháp: Command lưu delta (chỉ lưu thay đổi), undo = reverse delta.
 *    Thực tế: Google Docs, VS Code, Excel đều dùng Command + Memento pattern.
 *
 * 2️⃣ DATABASE TRANSACTION ROLLBACK
 *    Bài toán: Tạo order cần: insert order → insert items → charge payment.
 *    Nếu payment fail → cần rollback items + order (undo 2 bước).
 *    Giải pháp: Mỗi DB operation = 1 Command. Fail → undo toàn bộ chain.
 *    Code: const saga = [insertOrderCmd, insertItemsCmd, chargePaymentCmd];
 *          // Execute tuần tự, nếu fail → undo ngược lại
 *    Thực tế: Saga pattern (microservices) = distributed Command pattern.
 *
 * 3️⃣ TASK QUEUE / JOB SCHEDULER
 *    Bài toán: Background jobs (send email, resize image, generate report)
 *    cần: enqueue → execute later → retry on failure → log result.
 *    Giải pháp: Mỗi job = 1 Command. Queue lưu commands, worker execute.
 *    Code: queue.add(new SendEmailCommand(userId, template));
 *          queue.add(new ResizeImageCommand(imageId, 800, 600));
 *    Thực tế: BullMQ, Agenda, AWS SQS — job payload = serialized command.
 *
 * 4️⃣ CQRS (Command Query Responsibility Segregation)
 *    Bài toán: Hệ thống lớn cần tách Read (query) và Write (command).
 *    Write phức tạp (validate, events, side-effects), Read đơn giản (cached views).
 *    Giải pháp: CreateOrderCommand, UpdateOrderCommand — mỗi cái = 1 class.
 *    CommandBus dispatch command → đúng handler xử lý.
 *    Thực tế: NestJS @nestjs/cqrs module:
 *    @CommandHandler(CreateOrderCommand)
 *    class CreateOrderHandler { execute(cmd) { ... } }
 *
 * 5️⃣ MACRO RECORDING (Automation)
 *    Bài toán: User lặp lại sequence thao tác mỗi ngày:
 *    "Import CSV → filter invalid → transform → export PDF"
 *    Giải pháp: Record các commands vào MacroCommand → replay 1 click.
 *    Thực tế: Excel macros, Photoshop actions, CI/CD pipelines.
 *    Code: const dailyReport = new MacroCommand([
 *            new ImportCSVCommand(source),
 *            new FilterCommand(rules),
 *            new TransformCommand(mapping),
 *            new ExportPDFCommand(outputPath),
 *          ], "Daily Report Automation");
 *
 * 📌 COMMAND vs STRATEGY:
 *    Command: đóng gói ACTION + DATA → có thể queue, undo, log
 *    Strategy: đóng gói ALGORITHM → swap tại runtime, không có undo
 *    → Command khi cần: undo, queue, transaction, history
 *    → Strategy khi chỉ cần swap logic (sort, compress, validate)
 */

export { Command, CommandHistory, Spreadsheet, SetCellCommand, DeleteCellCommand, MacroCommand };
