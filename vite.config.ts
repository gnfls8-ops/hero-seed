import { defineConfig } from 'vitest/config';

// base: 기본은 상대 경로('./')라서 GitHub Pages 저장소 하위 경로에서도 그대로 동작한다.
// 절대 경로가 필요하면 BASE_PATH=/repo-name/ npm run build 처럼 지정한다.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
