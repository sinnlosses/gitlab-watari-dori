import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: {
      GITLAB_URL: "https://gitlab.test",
      ACCESS_TOKEN: "test-token",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
})
