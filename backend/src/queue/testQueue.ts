import { emailQueue } from "./emailQueue";

async function testQueue() {
  const jobs = await emailQueue.getJobs([
    "waiting",
    "delayed",
    "active",
    "completed",
    "failed",
  ]);

  for (const job of jobs) {
    console.log({
      id: job.id,
      name: job.name,
      state: await job.getState(),
      data: job.data,
      timestamp: new Date(job.timestamp).toISOString(),
      delay: job.opts.delay,
    });
  }

  await emailQueue.close();
}

testQueue().catch(console.error);