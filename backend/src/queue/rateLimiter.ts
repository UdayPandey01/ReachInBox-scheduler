import { redis } from "../config/redis";

export async function checkAndConsumeRateLimit(
  campaignId: string,
  hourlyLimit: number,
): Promise<{
  allowed: boolean;
  count: number;
  retryAt: Date | null;
}> {
  const now = Date.now();

  const hourStart = Math.floor(
    now / (60 * 60 * 1000),
  );

  const key = `email-rate:${campaignId}:${hourStart}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 3700);
  }

  if (count <= hourlyLimit) {
    return {
      allowed: true,
      count,
      retryAt: null,
    };
  }

  await redis.decr(key);

  const nextHour =
    (hourStart + 1) * 60 * 60 * 1000;

  return {
    allowed: false,
    count: count - 1,
    retryAt: new Date(nextHour),
  };
}