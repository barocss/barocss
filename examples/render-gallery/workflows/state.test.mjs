import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA, orderTotal } from './data.mjs';
import { initialState, reduce, orderRows, taskRows } from './state.mjs';
const filter = (state, workspace, key, value) => reduce(state, { type: 'filter', workspace, key, value });
const entityFields = state => ({ revision: state.revision, orders: state.orders, projects: state.projects, orderStatus: state.orderStatus, taskStatus: state.taskStatus, subtaskDone: state.subtaskDone, view: state.view });

test('order searches join customer/products and filters/counts/sorts derive from actual data', () => {
  let state = initialState();
  assert.equal(orderRows(state).length, 48);
  assert.deepEqual(orderRows(state).slice(0, 4).map(item => item.id), ['order-028', 'order-027', 'order-026', 'order-025']);
  state = filter(state, 'orders', 'customer', 'customer-01');
  assert.deepEqual(orderRows(state).map(item => item.id), ['order-025', 'order-013', 'order-037', 'order-001']);
  state = filter(state, 'orders', 'status', 'queued');
  assert.deepEqual(orderRows(state).map(item => item.id), ['order-037', 'order-001']);
  state = filter(state, 'orders', 'query', 'Mina Studio');
  assert.equal(orderRows(state).length, 2);
  state = filter(state, 'orders', 'query', 'Paper notebook');
  assert.deepEqual(orderRows(state).map(item => item.id), ['order-001']);
  state = filter(state, 'orders', 'query', 'no matching authored item');
  assert.deepEqual(orderRows(state), []);
  assert.equal(state.orders.selected, 'order-001');
  state = filter(filter(filter(state, 'orders', 'query', ''), 'orders', 'status', 'all'), 'orders', 'customer', 'all');
  assert.equal(orderRows(state).length, 48);
  for (const sort of ['date-asc', 'date-desc', 'total-asc', 'total-desc']) {
    state = filter(state, 'orders', 'sort', sort);
    const rows = orderRows(state);
    for (let index = 1; index < rows.length; index++) {
      const a = rows[index - 1], b = rows[index];
      const left = sort.startsWith('date') ? a.date : orderTotal(a), right = sort.startsWith('date') ? b.date : orderTotal(b);
      assert.ok(sort.endsWith('desc') ? left >= right : left <= right);
      if (left === right) assert.ok(a.id < b.id);
    }
  }
});

test('task search joins project/assignee/subtask names and null due dates remain last for both directions', () => {
  let state = reduce(initialState(), { type: 'view', view: 'projects' });
  assert.equal(taskRows(state).length, 24);
  state = filter(state, 'projects', 'query', '文句');
  assert.equal(taskRows(state).length, 0);
  state = filter(state, 'projects', 'query', '문구 검토');
  assert.equal(taskRows(state).length, 14);
  state = filter(state, 'projects', 'query', '한강 전시 준비');
  assert.equal(taskRows(state).length, 8);
  state = filter(state, 'projects', 'project', 'project-2');
  state = filter(state, 'projects', 'status', 'doing');
  assert.deepEqual(taskRows(state).map(item => item.id), ['task-023', 'task-014', 'task-005']);
  state = filter(state, 'projects', 'assignee', 'unassigned');
  assert.equal(taskRows(state).length, 0);
  state = reduce(initialState(), { type: 'view', view: 'projects' });
  state = filter(state, 'projects', 'assignee', 'unassigned');
  assert.deepEqual(new Set(taskRows(state).map(item => item.id)), new Set(['task-001', 'task-006', 'task-011', 'task-016', 'task-021']));
  state = filter(state, 'projects', 'assignee', 'all');
  for (const sort of ['due-asc', 'due-desc']) {
    state = filter(state, 'projects', 'sort', sort);
    const rows = taskRows(state);
    assert.equal(rows.slice(-6).every(item => item.due === null), true);
    assert.equal(rows.slice(0, 18).every(item => item.due !== null), true);
    for (let index = 1; index < 18; index++) assert.ok(sort === 'due-asc' ? rows[index - 1].due <= rows[index].due : rows[index - 1].due >= rows[index].due);
    assert.deepEqual(rows.slice(-6).map(item => item.id), ['task-001', 'task-005', 'task-009', 'task-013', 'task-017', 'task-021']);
  }
});

test('accepted local mutations preserve fixture baseline and survive workspace/specimen changes', () => {
  const baseline = JSON.stringify(DATA);
  let state = initialState();
  state = filter(state, 'orders', 'sort', 'total-desc');
  state = reduce(state, { type: 'page', workspace: 'orders', value: 2 });
  state = reduce(state, { type: 'order-status', id: 'order-001', next: 'packed', revision: state.revision, view: 'orders' });
  assert.equal(state.revision, 1);
  assert.equal(state.orderStatus['order-001'], 'packed');
  assert.equal(Object.values(state.orderStatus).filter(status => status === 'queued').length, 23);
  assert.equal(Object.values(state.orderStatus).filter(status => status === 'packed').length, 13);
  const savedOrders = structuredClone(state.orders);
  state = reduce(state, { type: 'view', view: 'projects' });
  state = filter(state, 'projects', 'query', 'workshop');
  state = filter(state, 'projects', 'sort', 'due-desc');
  const savedProjects = structuredClone(state.projects);
  state = reduce(state, { type: 'view', view: 'specimens' });
  state = reduce(state, { type: 'view', view: 'orders' });
  assert.deepEqual(state.orders, savedOrders);
  assert.deepEqual(state.projects, savedProjects);
  assert.equal(state.orderStatus['order-001'], 'packed');
  state = filter(state, 'orders', 'status', 'queued');
  assert.equal(orderRows(state).some(item => item.id === 'order-001'), false);
  assert.equal(state.orders.selected, 'order-001');
  assert.equal(state.orders.page, 0);
  assert.equal(JSON.stringify(DATA), baseline);
});

test('completion guard rejects incomplete subtasks then succeeds after bounded selected-target mutations', () => {
  let state = reduce(initialState(), { type: 'view', view: 'projects' });
  state = reduce(state, { type: 'select', workspace: 'projects', id: 'task-004' });
  const before = entityFields(state);
  state = reduce(state, { type: 'task-status', id: 'task-004', next: 'done', revision: 0, view: 'projects' });
  assert.match(state.error, /every subtask/);
  assert.deepEqual(entityFields(state), before);
  state = reduce(state, { type: 'subtask', id: 'subtask-4-2', taskId: 'task-004', done: true, revision: 0, view: 'projects' });
  assert.equal(state.revision, 1);
  state = reduce(state, { type: 'task-status', id: 'task-004', next: 'done', revision: 1, view: 'projects' });
  assert.equal(state.taskStatus['task-004'], 'done');
  assert.equal(state.revision, 2);
  const complete = entityFields(state);
  state = reduce(state, { type: 'subtask', id: 'subtask-4-2', taskId: 'task-004', done: false, revision: 2, view: 'projects' });
  assert.match(state.error, /Reopen/);
  assert.deepEqual(entityFields(state), complete);
  state = reduce(state, { type: 'task-status', id: 'task-004', next: 'doing', revision: 2, view: 'projects' });
  assert.equal(state.taskStatus['task-004'], 'doing');
  state = reduce(state, { type: 'view', view: 'orders' });
  state = reduce(state, { type: 'view', view: 'specimens' });
  state = reduce(state, { type: 'view', view: 'projects' });
  assert.equal(state.projects.selected, 'task-004');
  assert.equal(state.subtaskDone['subtask-4-2'], true);
  assert.equal(DATA.tasks[3].subtasks[1].done, false);
});

test('unknown, stale, out-of-view, extra fields and invalid transitions have zero valid-state effects', () => {
  let state = initialState();
  const operations = [
    { type: 'order-status', id: 'order-001', next: 'dispatched', revision: 0, view: 'orders' },
    { type: 'order-status', id: 'order-001', next: 'packed', revision: -1, view: 'orders' },
    { type: 'order-status', id: 'unknown', next: 'packed', revision: 0, view: 'orders' },
    { type: 'order-status', id: 'order-002', next: 'packed', revision: 0, view: 'orders' },
    { type: 'order-status', id: 'order-001', next: 'packed', revision: 0, view: 'projects' },
    { type: 'order-status', id: 'order-001', next: 'packed', revision: 0, view: 'orders', callback: 'script' },
    { type: 'filter', workspace: 'orders', key: '__proto__', value: {} },
    { type: 'filter', workspace: 'orders', key: 'query', value: 'x'.repeat(121) },
    { type: 'filter', workspace: 'orders', key: 'customer', value: 'missing' },
    { type: 'page', workspace: 'orders', value: 99 },
    { type: 'select', workspace: 'orders', id: 'missing' },
    { type: 'filter', workspace: 'projects', key: 'query', value: 'other workspace' },
    { type: 'view', view: 'arbitrary' },
    { type: 'script' },
    null,
  ];
  for (const op of operations) {
    const before = entityFields(state);
    const next = reduce(state, op);
    assert.deepEqual(entityFields(next), before);
    assert.ok(next.error);
    state = next;
  }
  for (let index = 0; index < 200; index++) state = reduce(state, { type: 'unknown' });
  assert.equal(state.history.length, 128);
  state = reduce(state, { type: 'order-status', id: 'order-001', next: 'packed', revision: 0, view: 'orders' });
  const before = entityFields(state);
  state = reduce(state, { type: 'order-status', id: 'order-001', next: 'dispatched', revision: 0, view: 'orders' });
  assert.match(state.error, /Stale/);
  assert.deepEqual(entityFields(state), before);
});

test('detail tabs preserve pagination and checked orders; atomic bulk packing uses current visible checked targets', () => {
  let state = filter(initialState(), 'orders', 'status', 'queued');
  state = filter(state, 'orders', 'sort', 'date-asc');
  const firstIds = orderRows(state).slice(0, 4).map(item => item.id);
  assert.deepEqual(firstIds, ['order-001', 'order-002', 'order-003', 'order-004']);
  for (const id of firstIds) state = reduce(state, { type: 'check', workspace: 'orders', id, checked: true });
  state = filter(state, 'orders', 'tab', 'lines');
  assert.deepEqual(state.orders.checked, firstIds);
  assert.equal(state.orders.tab, 'lines');
  assert.equal(state.revision, 0);
  const before = entityFields(state);
  for (const ids of [[], [firstIds[0], firstIds[0]], [firstIds[0], 'order-039'], ['missing'], [...firstIds, 'order-039']]) {
    const rejected = reduce(state, { type: 'order-bulk', ids, next: 'packed', revision: 0, view: 'orders' });
    assert.deepEqual(entityFields(rejected), before);
    assert.match(rejected.error, /Bulk/);
  }
  state = reduce(state, { type: 'order-bulk', ids: firstIds, next: 'packed', revision: 0, view: 'orders' });
  assert.equal(state.revision, 1);
  assert.equal(firstIds.every(id => state.orderStatus[id] === 'packed'), true);
  assert.equal(orderRows(state).length, 20);
  assert.equal(state.orders.selected, 'order-001');
  assert.equal(DATA.orders[0].status, 'queued');
  const accepted = entityFields(state);
  const stale = reduce(state, { type: 'order-bulk', ids: firstIds, next: 'packed', revision: 0, view: 'orders' });
  assert.deepEqual(entityFields(stale), accepted);
  assert.match(stale.error, /Stale/);
  const hidden = reduce(state, { type: 'check', workspace: 'orders', id: 'order-001', checked: true });
  assert.deepEqual(entityFields(hidden), accepted);
  state = reduce(state, { type: 'page', workspace: 'orders', value: 1 });
  state = filter(state, 'orders', 'tab', 'history');
  assert.equal(state.orders.page, 1);
  assert.equal(state.orders.tab, 'history');
  assert.deepEqual(state.orders.checked, firstIds);
});

test('bulk operations reject mixed statuses, unchecked IDs and foreign view without any entity changes', () => {
  let state = filter(initialState(), 'orders', 'sort', 'date-asc');
  const ids = orderRows(state).slice(0, 4).map(item => item.id);
  for (const id of ids) state = reduce(state, { type: 'check', workspace: 'orders', id, checked: true });
  const before = entityFields(state);
  const mixed = reduce(state, { type: 'order-bulk', ids, next: 'packed', revision: 0, view: 'orders' });
  assert.deepEqual(entityFields(mixed), before);
  state = reduce(state, {type:'clear-checks',workspace:'orders'});
  state = filter(state, 'orders', 'status', 'queued');
  const queuedId = orderRows(state)[0].id;
  const unchecked = reduce(state, { type: 'order-bulk', ids: [queuedId], next: 'packed', revision: 0, view: 'orders' });
  assert.deepEqual(entityFields(unchecked), entityFields(state));
  state = reduce(state, { type: 'check', workspace: 'orders', id: queuedId, checked: true });
  const wrong = reduce(state, { type: 'order-bulk', ids: [queuedId], next: 'packed', revision: 0, view: 'projects' });
  assert.deepEqual(entityFields(wrong), entityFields(state));
});

test('clearing hidden checked rows preserves records and status history identifies accepted targets', () => {
 let state=initialState(); state=filter(state,'orders','status','queued');state=filter(state,'orders','sort','date-asc');state=reduce(state,{type:'check',workspace:'orders',id:'order-001',checked:true});state=reduce(state,{type:'order-bulk',ids:['order-001'],next:'packed',revision:0,view:'orders'});assert.equal(state.history.at(-1).ids[0],'order-001');assert.equal(state.history.at(-1).next,'packed');assert.equal(orderRows(state).some(o=>o.id==='order-001'),false);state=reduce(state,{type:'clear-checks',workspace:'orders'});assert.deepEqual(state.orders.checked,[]);assert.equal(state.orderStatus['order-001'],'packed');assert.equal(state.orders.selected,'order-001');
});
