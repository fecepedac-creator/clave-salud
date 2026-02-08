import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [vue()],
    define: {
      'process.env': {
        FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
        FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
        FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET,
        FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID,
      }
    }
  };
});