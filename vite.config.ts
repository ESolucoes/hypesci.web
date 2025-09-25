import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: mode === 'development' && env.VITE_LT_URL
        ? {
            '/lt': {
              target: env.VITE_LT_URL,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/lt/, ''),
              secure: false,
            },
          }
        : undefined,
    },
  };
});
