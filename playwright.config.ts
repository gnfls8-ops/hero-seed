import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/sub/path/`,
    trace: 'retain-on-failure',
  },
  // dist를 하위 경로(/sub/path/)에서 서비스해 GitHub Pages와 같은 조건을 검증한다.
  webServer: {
    command: `node tests/e2e/serve-dist.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/sub/path/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      // 모바일 터치 에뮬레이션 (실기기 검증이 아님)
      name: 'chromium-mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
  ],
});
