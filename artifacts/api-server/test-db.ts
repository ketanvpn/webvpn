import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

async function run() {
  try {
    const rows = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.createdAt)).limit(5);
    console.log("DB ROWS:", JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
