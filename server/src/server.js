import { createApp } from "./app.js";
import mongoose from "mongoose";
import { connectToDatabase } from "./database.js";

const DEFAULT_PORT = 4000;
const portValue = process.env.PORT ?? String(DEFAULT_PORT);
const port = Number(portValue);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

await connectToDatabase();
const app = createApp();
const server = app.listen(port, () => {
  console.log(`CineTrack API listening at http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("Could not start CineTrack API:", error.message);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
}
