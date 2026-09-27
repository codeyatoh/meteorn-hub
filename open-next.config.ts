import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Disable ISR/KV caching features for now since we don't have bindings set up
  enableCacheInterception: false
});
