const { test, expect } = require('@playwright/test');

test.describe('chunk failure safety rail', () => {
  test('refuses destructive production chunk tests unless explicitly enabled', async ({ baseURL }) => {
    expect(String(baseURL || '')).not.toMatch(/^https:\/\/app\.86chaos\.com\/?$/i);
  });
});
