import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA, validateData, orderTotal } from './data.mjs';
const clone = () => structuredClone(DATA);

test('authored fixture has validated relational volume, missing values and frozen baseline', () => {
  assert.equal(validateData(DATA), true);
  assert.deepEqual(['orders', 'customers', 'products', 'projects', 'tasks', 'assignees'].map(key => DATA[key].length), [48, 12, 16, 3, 24, 6]);
  assert.equal(DATA.asOf, '2026-10-01');
  assert.ok(new TextEncoder().encode(JSON.stringify(DATA)).length < 1024 * 1024);
  assert.ok(DATA.customers.some(item => !('note' in item)));
  assert.ok(DATA.orders.some(item => !('note' in item)));
  assert.ok(DATA.tasks.some(item => item.assigneeId === null && item.due === null && item.subtasks.length === 0));
  assert.ok(DATA.tasks.some(item => item.due !== null && item.due < DATA.asOf && item.status !== 'done'));
  assert.ok(DATA.orders.some(item => item.lines.length === 6));
  assert.ok(DATA.tasks.some(item => item.subtasks.length === 4));
  assert.ok(DATA.tasks.some(item => item.title.length > 80));
  assert.ok(JSON.stringify(DATA).includes('한강'));
  for (const project of DATA.projects) assert.deepEqual(new Set(DATA.tasks.filter(item => item.projectId === project.id).map(item => item.status)), new Set(['todo', 'doing', 'done']));
  for (const value of [DATA, DATA.orders, DATA.orders[0], DATA.orders[0].lines, DATA.orders[0].lines[0], DATA.tasks[0], DATA.tasks[3].subtasks[0]]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { DATA.orders[0].status = 'dispatched'; }, TypeError);
});

test('integer cents derive from referenced products and quantities', () => {
  assert.equal(orderTotal(DATA.orders[0]), 450);
  assert.equal(orderTotal(DATA.orders[1]), 2 * 625 + 3 * 1150);
  for (const order of DATA.orders) {
    const expected = order.lines.reduce((sum, line) => sum + DATA.products.find(product => product.id === line.productId).price * line.quantity, 0);
    assert.equal(orderTotal(order), expected);
    assert.ok(Number.isSafeInteger(expected));
  }
  assert.throws(() => orderTotal({ lines: [{ productId: 'missing', quantity: 1 }] }), /relation/);
  assert.throws(() => orderTotal({ lines: [{ productId: DATA.products[0].id, quantity: Infinity }] }), /relation/);
});

test('invalid IDs, references, dates, enums, counts, text and unsafe totals reject', () => {
  const cases = [
    data => { data.customers[1].id = data.customers[0].id; },
    data => { data.orders[0].customerId = 'unknown'; },
    data => { data.orders[0].lines[0].productId = 'unknown'; },
    data => { data.orders[0].lines.push({ ...data.orders[0].lines[0] }); },
    data => { data.orders[0].lines[0].quantity = 1.5; },
    data => { data.products[0].price = Infinity; },
    data => { data.products[0].price = Number.MAX_SAFE_INTEGER; },
    data => { data.orders[0].date = '2026-02-30'; },
    data => { data.orders[0].status = 'paid'; },
    data => { data.customers[0].name = 'x'.repeat(601); },
    data => { data.orders.pop(); data.orders.length = 39; },
    data => { data.tasks[0].assigneeId = 'unknown'; },
    data => { data.tasks[0].due = 'today'; },
    data => { data.tasks[0].projectId = 'unknown'; },
    data => { data.tasks[3].subtasks[1].id = data.tasks[3].subtasks[0].id; },
    data => { data.tasks[3].status = 'done'; },
    data => { data.products[0].callback = 'script'; },
  ];
  for (const change of cases) { const data = clone(); change(data); assert.throws(() => validateData(data)); }
});
