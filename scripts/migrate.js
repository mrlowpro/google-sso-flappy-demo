const { initDatabase, closeDatabase } = require("../src/db");

async function run() {
  try {
    await initDatabase();
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

run();
