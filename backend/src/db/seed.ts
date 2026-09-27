import { db } from "../config/db";
import { users, senders } from "./schema";

async function seed() {
  console.log("Seeding database...");

  const [user] = await db
    .insert(users)
    .values({
      googleId: "dev-google-user-001",
      name: "Development User",
      email: "dev@reachinbox.local",
      avatarUrl: null,
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log("Development user already exists.");
    process.exit(0);
  }

  const [sender] = await db
    .insert(senders)
    .values({
      userId: user.id,
      email: "test@example.com",
      displayName: "ReachInbox Test",
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      smtpUsername: "placeholder",
      smtpPassword: "placeholder",
      isActive: true,
    })
    .returning();

  console.log("User created:", user);
  console.log("Sender created:", sender);

  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});