import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPlayTime, getPlayMinutesFromReward } from './playApi.js';

test('nhận diện mọi phần thưởng phút chơi game đang cấu hình bằng tên', () => {
  assert.equal(getPlayMinutesFromReward({ name: '20 phút chơi game' }), 20);
  assert.equal(getPlayMinutesFromReward({ name: '10 PHÚT CHƠI GAME' }), 10);
  assert.equal(getPlayMinutesFromReward({ name: '5,000 VND' }), 0);
});

test('ưu tiên dữ liệu phần thưởng có cấu trúc', () => {
  assert.equal(getPlayMinutesFromReward({ type: 'play_time', value: 30, name: 'Quà đặc biệt' }), 30);
});

test('định dạng đồng hồ phút và giờ', () => {
  assert.equal(formatPlayTime(65), '1:05');
  assert.equal(formatPlayTime(3661), '1:01:01');
});
