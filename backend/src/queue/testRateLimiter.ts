import { checkAndConsumeRateLimit } from "./rateLimiter";

async function testRateLimiter() {
  const campaignId = "test-campaign-rate-limit";

  console.log("Request 1:");
  console.log(
    await checkAndConsumeRateLimit(campaignId, 2),
  );

  console.log("Request 2:");
  console.log(
    await checkAndConsumeRateLimit(campaignId, 2),
  );

  console.log("Request 3:");
  console.log(
    await checkAndConsumeRateLimit(campaignId, 2),
  );
}

testRateLimiter().catch(console.error);