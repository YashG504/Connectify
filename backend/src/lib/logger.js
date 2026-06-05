import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// In production, we log as raw JSON for log aggregators (Datadog, AWS CloudWatch, etc.)
// In development, we use pino-pretty for human-readable terminal output
const logger = isProduction
  ? pino({ level: process.env.LOG_LEVEL || "info" })
  : pino({
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    });

export default logger;
