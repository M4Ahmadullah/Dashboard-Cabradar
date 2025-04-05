import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  console.log("Initializing Prisma client...");
  console.log("Database URL present:", !!process.env.DATABASE_URL);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new PrismaClient({
    log: ["query", "error", "warn"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }).$extends({
    query: {
      $allOperations({ operation, args, query }) {
        const start = performance.now();
        return query(args).finally(() => {
          const end = performance.now();
          const time = end - start;
          if (time > 2000) {
            console.warn(`Slow query detected: ${operation} took ${time}ms`);
          }
        });
      },
    },
  });

  // Test the connection
  client
    .$connect()
    .then(() => console.log("Prisma client connected successfully"))
    .catch((error) => {
      console.error("Failed to connect to database:", error);
      throw error;
    });

  return client;
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export default prisma;
