import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
  },
});
