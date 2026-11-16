import test from 'node:test';
import assert from 'node:assert/strict';
import { planPages, chooseLayout } from './pagination.mjs';

function plan(heights, extra = {}) {
  return planPages({
    count: heights.length,
    capacity: 100,
    measure: (start, end) => heights.slice(start, end).reduce((a, b) => a + b, 0),
    ...extra,
  });
}

test('moves content back from a full first page to avoid a ten-percent last page', () => {
  const result = plan([32, 32, 32, 10]);
  assert.equal(result.pages.length, 2);
  assert.ok(result.pages.at(-1).height >= 40);
});

test('a prohibited boundary keeps the final row with its summary', () => {
  const result = plan([35, 35, 20, 15], { canBreak: end => end !== 3 });
  assert.equal(result.pages.length, 2);
  assert.ok(!result.pages.some(p => p.end === 3));
});

test('uses available single-page space before adding a page', () => {
  assert.equal(plan([25, 30, 40]).pages.length, 1);
});

test('accounts for a repeated table heading and the first-page title', () => {
  const heights = [30, 30, 30, 30, 30, 30];
  const result = plan(heights, { measure: (start, end) =>
    heights.slice(start, end).reduce((a,b) => a+b, 0) + (start === 0 ? 35 : 10) });
  assert.equal(result.pages.length, 3);
  assert.ok(result.pages.every(p => p.height <= 100));
  assert.equal(result.pages[0].start, 0);
  assert.equal(result.pages.at(-1).end, 6);
});

test('preserves all units once, in order, over several pages', () => {
  const result = plan(Array(18).fill(17));
  const indices = result.pages.flatMap(p => Array.from({length:p.end-p.start},(_,i)=>p.start+i));
  assert.deepEqual(indices, Array.from({length:18},(_,i)=>i));
});

test('fails explicitly for an indivisible block taller than a page', () => {
  assert.throws(() => plan([101]), /fit|page|layout/i);
});

test('layout selection considers the last-page fill before cosmetic preference', () => {
  const result = chooseLayout([
    { id:'normal', pages:[{height:100},{height:12}], capacity:100, score:500, designPenalty:0 },
    { id:'compact', pages:[{height:75},{height:40}], capacity:100, score:10, designPenalty:15 },
  ]);
  assert.equal(result.id, 'compact');
});

test('prefers the approved typography when page quality is the same', () => {
  const result = chooseLayout([
    { id:'normal', pages:[{height:80}], capacity:100, score:1, designPenalty:0 },
    { id:'small-title', pages:[{height:70}], capacity:100, score:1, designPenalty:12 },
  ]);
  assert.equal(result.id, 'normal');
});
