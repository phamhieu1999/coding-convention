/**
 * ============================================
 * CLEAN CODE RULE #12: ENCAPSULATION & INFORMATION HIDING
 * ============================================
 *
 * Nguyên tắc:
 * 1. Expose API tối thiểu (Law of Least Privilege)
 * 2. Dùng private/protected/#privateField đúng cách
 * 3. Getter/Setter có validation logic
 * 4. Không expose internal state trực tiếp
 * 5. Prefer composition over inheritance
 */

// ═══════════════════════════════════════════
// Rule 12.1: Không expose internal state
// ═══════════════════════════════════════════

// ❌ BAD: Public fields → ai cũng sửa được → state không nhất quán
class BankAccount_BAD {
  public balance: number = 0; // ai cũng đổi được!
  public transactions: { amount: number; date: Date }[] = [];

  deposit(amount: number) {
    this.balance += amount;
    this.transactions.push({ amount, date: new Date() });
  }
}
// Vấn đề: account.balance = -999999; hoàn toàn hợp lệ 😱

// ✅ GOOD: Private fields + getter + method kiểm soát access
class BankAccount {
  #balance: number = 0;
  readonly #transactions: { amount: number; type: string; date: Date }[] = [];

  get balance(): number {
    return this.#balance;
  }

  get transactionHistory(): ReadonlyArray<{ amount: number; type: string; date: Date }> {
    return [...this.#transactions]; // trả copy, không cho mutate gốc
  }

  deposit(amount: number): void {
    this.#validateAmount(amount);
    this.#balance += amount;
    this.#recordTransaction(amount, 'deposit');
  }

  withdraw(amount: number): void {
    this.#validateAmount(amount);
    if (amount > this.#balance) {
      throw new Error(`Insufficient balance: ${this.#balance}`);
    }
    this.#balance -= amount;
    this.#recordTransaction(amount, 'withdrawal');
  }

  #validateAmount(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (!Number.isFinite(amount)) throw new Error('Amount must be finite');
  }

  #recordTransaction(amount: number, type: string): void {
    this.#transactions.push({ amount, type, date: new Date() });
  }
}

// ═══════════════════════════════════════════
// Rule 12.2: Getter/Setter có validation
// ═══════════════════════════════════════════

// ❌ BAD: Set trực tiếp, không validate
class Temperature_BAD {
  public celsius: number = 0; // có thể set = -999 (vô lý)
}

// ✅ GOOD: Setter kiểm soát giá trị, getter cung cấp computed values
class Temperature {
  #celsius: number = 0;

  get celsius(): number {
    return this.#celsius;
  }

  set celsius(value: number) {
    if (value < -273.15) {
      throw new Error('Temperature cannot be below absolute zero (-273.15°C)');
    }
    this.#celsius = value;
  }

  get fahrenheit(): number {
    return this.#celsius * 9 / 5 + 32;
  }

  get kelvin(): number {
    return this.#celsius + 273.15;
  }
}

// ═══════════════════════════════════════════
// Rule 12.3: Interface segregation — expose tối thiểu
// ═══════════════════════════════════════════

// ❌ BAD: Service class expose quá nhiều method nội bộ
class UserService_BAD {
  public hashPassword(password: string): string { return password; }
  public validateEmail(email: string): boolean { return email.includes('@'); }
  public generateToken(userId: string): string { return userId; }
  public saveToDatabase(user: any): void { /* ... */ }
  public sendWelcomeEmail(email: string): void { /* ... */ }

  // Caller có thể gọi hashPassword, generateToken trực tiếp → nguy hiểm!
  public register(name: string, email: string, password: string): void {
    const hashed = this.hashPassword(password);
    this.saveToDatabase({ name, email, password: hashed });
    this.sendWelcomeEmail(email);
  }
}

// ✅ GOOD: Chỉ expose API cần thiết, ẩn implementation details
interface IUserRegistration {
  register(name: string, email: string, password: string): Promise<void>;
}

class UserService implements IUserRegistration {
  async register(name: string, email: string, password: string): Promise<void> {
    this.#validateInput(email, password);
    const hashed = this.#hashPassword(password);
    await this.#saveToDatabase({ name, email, password: hashed });
    await this.#sendWelcomeEmail(email);
  }

  #validateInput(email: string, password: string): void {
    if (!email.includes('@')) throw new Error('Invalid email');
    if (password.length < 8) throw new Error('Password too short');
  }

  #hashPassword(password: string): string {
    return `hashed_${password}`;
  }

  async #saveToDatabase(user: { name: string; email: string; password: string }): Promise<void> {
    // save logic
  }

  async #sendWelcomeEmail(email: string): Promise<void> {
    // email logic
  }
}

// ═══════════════════════════════════════════
// Rule 12.4: Defensive copy — không leak reference
// ═══════════════════════════════════════════

// ❌ BAD: Trả reference trực tiếp → caller mutate internal state
class ShoppingCart_BAD {
  private items: string[] = [];

  getItems(): string[] {
    return this.items; // Leak reference! Caller có thể push/pop
  }
}

// ✅ GOOD: Trả defensive copy
class ShoppingCart {
  readonly #items: string[] = [];

  getItems(): readonly string[] {
    return [...this.#items]; // Copy → caller không ảnh hưởng internal state
  }

  addItem(item: string): void {
    if (!item.trim()) throw new Error('Item name cannot be empty');
    this.#items.push(item);
  }

  get itemCount(): number {
    return this.#items.length;
  }
}

// ═══════════════════════════════════════════
// Rule 12.5: Tách module — chỉ export public API
// ═══════════════════════════════════════════

// ❌ BAD: Export tất cả → caller phụ thuộc vào internal
// export { hashPassword, validateEmail, generateToken, UserService_BAD };

// ✅ GOOD: Chỉ export interface + class cần thiết
export {
  type IUserRegistration,
  BankAccount,
  Temperature,
  ShoppingCart,
  UserService,
};
