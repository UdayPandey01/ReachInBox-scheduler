import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export async function getEtherealTransporter() {
  if (transporter) {
    return transporter;
  }

  const account = await nodemailer.createTestAccount();

  console.log("Ethereal account:", account.user);

  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });

  await transporter.verify();

  console.log("Ethereal SMTP connection verified");

  return transporter;
}