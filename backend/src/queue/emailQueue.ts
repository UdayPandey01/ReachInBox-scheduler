import {Queue} from "bullmq";
import {queueConnection} from "./connection";

export const emailQueue = new Queue("email-queue", {
    connection: queueConnection,
});