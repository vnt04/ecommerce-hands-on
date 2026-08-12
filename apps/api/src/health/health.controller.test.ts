import { describe, expect, test } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  test('trả về trạng thái ok', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
