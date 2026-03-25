/**
 * ============================================
 * CLEAN CODE RULE #9: TESTING (Viết test sạch)
 * ============================================
 *
 * Nguyên tắc:
 * 1. Mỗi test chỉ test MỘT behavior
 * 2. Tên test mô tả kịch bản: given_when_then
 * 3. Arrange → Act → Assert (AAA pattern)
 * 4. Không logic trong test (no if/loop)
 * 5. Test phải độc lập, không phụ thuộc nhau
 * 6. Dùng test doubles đúng cách (mock/stub/spy)
 */

// ═══════════════════════════════════════════
// Phần code production cần test
// ═══════════════════════════════════════════

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

class ShoppingCart {
  private items: CartItem[] = [];

  addItem(item: CartItem): void {
    const existing = this.items.find((i) => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      return;
    }
    this.items.push({ ...item });
  }

  removeItem(productId: string): void {
    this.items = this.items.filter((i) => i.productId !== productId);
  }

  getTotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  }

  getItemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  applyDiscount(percent: number): number {
    if (percent < 0 || percent > 100) {
      throw new Error('Discount must be between 0 and 100');
    }
    return this.getTotal() * (1 - percent / 100);
  }

  clear(): void {
    this.items = [];
  }
}

// ═══════════════════════════════════════════
// Rule 9.1: Test naming - Given/When/Then
// ═══════════════════════════════════════════

// ❌ BAD: Tên test không rõ ràng
// describe('ShoppingCart', () => {
//   it('test1', () => { ... });
//   it('should work', () => { ... });
//   it('add item test', () => { ... });
// });

// ✅ GOOD: Tên test mô tả rõ kịch bản
// describe('ShoppingCart', () => {
//   describe('addItem', () => {
//     it('should add new item to empty cart', () => { ... });
//     it('should increase quantity when adding existing product', () => { ... });
//   });
//
//   describe('getTotal', () => {
//     it('should return 0 for empty cart', () => { ... });
//     it('should sum price * quantity for all items', () => { ... });
//   });
//
//   describe('applyDiscount', () => {
//     it('should throw error when discount is negative', () => { ... });
//     it('should return full price when discount is 0 percent', () => { ... });
//   });
// });

// ═══════════════════════════════════════════
// Rule 9.2: AAA Pattern (Arrange → Act → Assert)
// ═══════════════════════════════════════════

// ❌ BAD: Mọi thứ trộn lẫn, khó đọc
function testBad() {
  const cart = new ShoppingCart();
  cart.addItem({ productId: '1', name: 'Phone', price: 500, quantity: 2 });
  console.assert(cart.getTotal() === 1000);
  cart.addItem({ productId: '2', name: 'Case', price: 20, quantity: 1 });
  console.assert(cart.getTotal() === 1020);
  console.assert(cart.getItemCount() === 3);
  cart.removeItem('1');
  console.assert(cart.getTotal() === 20);
}

// ✅ GOOD: AAA pattern rõ ràng
function test_addItem_shouldAddNewItemToEmptyCart() {
  // Arrange
  const cart = new ShoppingCart();
  const phone: CartItem = {
    productId: 'phone-1',
    name: 'iPhone 15',
    price: 25_000_000,
    quantity: 1,
  };

  // Act
  cart.addItem(phone);

  // Assert
  console.assert(cart.getItemCount() === 1, 'Should have 1 item');
  console.assert(cart.getTotal() === 25_000_000, 'Total should be 25M');
}

function test_addItem_shouldMergeQuantityForExistingProduct() {
  // Arrange
  const cart = new ShoppingCart();
  const phone: CartItem = {
    productId: 'phone-1',
    name: 'iPhone 15',
    price: 25_000_000,
    quantity: 1,
  };

  // Act
  cart.addItem(phone);
  cart.addItem({ ...phone, quantity: 2 });

  // Assert
  console.assert(cart.getItemCount() === 3, 'Should merge to 3');
  console.assert(cart.getTotal() === 75_000_000, 'Total = 25M * 3');
}

function test_applyDiscount_shouldThrowWhenDiscountIsNegative() {
  // Arrange
  const cart = new ShoppingCart();
  cart.addItem({
    productId: '1',
    name: 'Item',
    price: 100_000,
    quantity: 1,
  });

  // Act & Assert
  try {
    cart.applyDiscount(-10);
    console.assert(false, 'Should have thrown');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    console.assert(
      message.includes('between 0 and 100'),
      'Should mention valid range',
    );
  }
}

function test_getTotal_shouldReturnZeroForEmptyCart() {
  // Arrange
  const cart = new ShoppingCart();

  // Act
  const total = cart.getTotal();

  // Assert
  console.assert(total === 0, 'Empty cart total should be 0');
}

// ═══════════════════════════════════════════
// Rule 9.3: Mỗi test chỉ test MỘT thing
// ═══════════════════════════════════════════

// ❌ BAD: Test quá nhiều thứ cùng lúc
function test_everything_BAD() {
  const cart = new ShoppingCart();
  cart.addItem({ productId: '1', name: 'A', price: 100, quantity: 2 });
  console.assert(cart.getTotal() === 200);
  console.assert(cart.getItemCount() === 2);
  cart.removeItem('1');
  console.assert(cart.getTotal() === 0);
  console.assert(cart.getItemCount() === 0);
  // Test add, total, count, remove trong 1 test → khó biết cái nào fail
}

// ✅ GOOD: Mỗi test 1 assertion rõ ràng (đã demo ở trên)

// ═══════════════════════════════════════════
// Chạy tất cả tests
// ═══════════════════════════════════════════

function runAllTests(): void {
  console.log('🧪 Running Clean Code Test Examples...\n');

  test_addItem_shouldAddNewItemToEmptyCart();
  console.log('✅ addItem: should add new item to empty cart');

  test_addItem_shouldMergeQuantityForExistingProduct();
  console.log('✅ addItem: should merge quantity for existing product');

  test_applyDiscount_shouldThrowWhenDiscountIsNegative();
  console.log('✅ applyDiscount: should throw when discount is negative');

  test_getTotal_shouldReturnZeroForEmptyCart();
  console.log('✅ getTotal: should return 0 for empty cart');

  console.log('\n🎉 All tests passed!');
}

runAllTests();

export { ShoppingCart };
