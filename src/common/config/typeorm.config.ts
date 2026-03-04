import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

export default new DataSource({
  type: "postgres",

  // Use DATABASE_URL if available (Render)
  ...(process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        username: process.env.DB_USERNAME || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: process.env.DB_DATABASE || "my_local_db",
      }),

  entities: isProduction ? ["dist/**/*.entity.js"] : ["src/**/*.entity.ts"],
  migrations: isProduction ? ["dist/migrations/*.js"] : ["src/migrations/*.ts"],
  synchronize: false,
});
