import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

const isSimRun = process.argv.some((arg) => arg.includes('simulation'))

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: isSimRun
        ? [...configDefaults.exclude, 'e2e/**']
        : [...configDefaults.exclude, 'e2e/**', 'src/__tests__/simulation/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
