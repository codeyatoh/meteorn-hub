import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";
import defaultCloudflareConfig from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: defaultCloudflareConfig,
  // Disable ISR/KV caching features for now since we don't have bindings set up
  dangerous: {
    enableCacheInterception: false
  }
};

export default config;
