import { loadConfig } from "./config.js";
import { buildApp } from "./server.js";

async function main() {
  const config = loadConfig();
  const app = buildApp(config);
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
  } catch (err) {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  }
}

void main();
