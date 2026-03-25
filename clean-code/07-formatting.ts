/**
 * ============================================
 * CLEAN CODE RULE #7: CODE FORMATTING & STRUCTURE
 * ============================================
 *
 * Nguyên tắc:
 * 1. Consistent formatting (dùng Prettier/ESLint)
 * 2. Vertical spacing: nhóm code liên quan
 * 3. File < 300 dòng (tách module nếu lớn hơn)
 * 4. Import ordering: external → internal → types
 * 5. Newspaper rule: high-level trước, detail sau
 */

// ═══════════════════════════════════════════
// Rule 7.1: Import Ordering
// ═══════════════════════════════════════════

// ❌ BAD: Import lộn xộn
// import { UserService } from './user.service';
// import * as fs from 'fs';
// import { OrderDto } from './dto/order.dto';
// import { Injectable } from '@nestjs/common';
// import { User } from './entities/user.entity';
// import * as path from 'path';

// ✅ GOOD: Import có tổ chức
// 1. Node built-in modules
// import * as fs from 'fs';
// import * as path from 'path';
//
// 2. External packages
// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
//
// 3. Internal modules
// import { UserService } from './user.service';
//
// 4. DTOs / Types
// import { OrderDto } from './dto/order.dto';
// import { User } from './entities/user.entity';

// ═══════════════════════════════════════════
// Rule 7.2: Vertical Spacing - Nhóm code liên quan
// ═══════════════════════════════════════════

// ❌ BAD: Mọi thứ dồn lại, không có khoảng trống
class OrderProcessor_BAD {
  private orders: Map<string, unknown> = new Map();
  private readonly TAX_RATE = 0.1;
  private readonly SHIPPING_FEE = 25000;
  addOrder(id: string, data: unknown) { this.orders.set(id, data); }
  removeOrder(id: string) { this.orders.delete(id); }
  getOrder(id: string) { return this.orders.get(id); }
  calculateTax(amount: number) { return amount * this.TAX_RATE; }
  calculateShipping() { return this.SHIPPING_FEE; }
  calculateTotal(amount: number) {
    return amount + this.calculateTax(amount) + this.calculateShipping();
  }
}

// ✅ GOOD: Nhóm rõ ràng theo chức năng
class OrderProcessor {
  // ── Properties ──────────────────────────
  private readonly orders: Map<string, Order> = new Map();

  // ── Constants ───────────────────────────
  private static readonly TAX_RATE = 0.1;
  private static readonly FREE_SHIPPING_THRESHOLD = 500_000;
  private static readonly STANDARD_SHIPPING_FEE = 25_000;

  // ── CRUD Operations ─────────────────────
  addOrder(order: Order): void {
    this.orders.set(order.id, order);
  }

  removeOrder(id: string): boolean {
    return this.orders.delete(id);
  }

  findOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  // ── Calculations ────────────────────────
  calculateTax(subtotal: number): number {
    return subtotal * OrderProcessor.TAX_RATE;
  }

  calculateShippingFee(subtotal: number): number {
    if (subtotal >= OrderProcessor.FREE_SHIPPING_THRESHOLD) return 0;
    return OrderProcessor.STANDARD_SHIPPING_FEE;
  }

  calculateGrandTotal(subtotal: number): number {
    const tax = this.calculateTax(subtotal);
    const shipping = this.calculateShippingFee(subtotal);
    return subtotal + tax + shipping;
  }
}

// ═══════════════════════════════════════════
// Rule 7.3: Newspaper Rule
// Đọc từ trên xuống: public → private, tổng quan → chi tiết
// ═══════════════════════════════════════════

interface Order {
  id: string;
  items: OrderItem[];
  customerId: string;
  status: string;
}

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderReceipt {
  orderId: string;
  items: { name: string; total: number }[];
  subtotal: number;
  tax: number;
  grandTotal: number;
}

class ReceiptGenerator {
  // ── Public API (đọc đầu tiên) ──────────
  generate(order: Order): OrderReceipt {
    const itemDetails = this.formatItems(order.items);
    const subtotal = this.calculateSubtotal(order.items);
    const tax = this.calculateTax(subtotal);

    return {
      orderId: order.id,
      items: itemDetails,
      subtotal,
      tax,
      grandTotal: subtotal + tax,
    };
  }

  // ── Private helpers (chi tiết bên dưới) ─
  private formatItems(items: OrderItem[]): { name: string; total: number }[] {
    return items.map((item) => ({
      name: item.name,
      total: item.price * item.quantity,
    }));
  }

  private calculateSubtotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  private calculateTax(subtotal: number): number {
    return subtotal * 0.1;
  }
}

// ═══════════════════════════════════════════
// Rule 7.4: Consistent brace style & line length
// ═══════════════════════════════════════════

// ❌ BAD: Inconsistent style
function bad1(x: number) { return x * 2 }
function bad2(x: number)
{
  return x * 2;
}
const bad3 = (x: number) => { if(x>0){ return x }else{ return -x } }

// ✅ GOOD: Consistent, dễ đọc
function doubleValue(value: number): number {
  return value * 2;
}

function absoluteValue(value: number): number {
  return value >= 0 ? value : -value;
}

// Khi expression dài → xuống dòng rõ ràng
function isEligibleForPremiumUpgrade(
  accountAge: number,
  totalSpent: number,
  referralCount: number,
): boolean {
  const hasMinAccountAge = accountAge >= 365;
  const hasMinSpending = totalSpent >= 10_000_000;
  const hasReferrals = referralCount >= 3;

  return hasMinAccountAge && hasMinSpending && hasReferrals;
}

export { OrderProcessor, ReceiptGenerator, isEligibleForPremiumUpgrade };
