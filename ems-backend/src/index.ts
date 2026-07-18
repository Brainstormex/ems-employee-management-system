import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

const app = createApp();
const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log(`EMS API listening on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { app, createApp };
