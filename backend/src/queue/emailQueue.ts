import {Queue} from "bullmq";
import {queueConnection} from "./connection";

export const emailQueue = new Queue("email-queue", {
    connection: queueConnection,
});

export const sendEmailJobOptions = {
    attempts: 3,
    backoff: {
        type: "exponential",
        delay: 5000,
    },
};
