import nodemailer from "nodemailer";

async function testEthereal() {
  const account = await nodemailer.createTestAccount();

  console.log("Ethereal account:");
  console.log("User:", account.user);

  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });

  await transporter.verify();

  console.log("SMTP verified");

  const info = await transporter.sendMail({
    from: `"ReachInbox Test" <${account.user}>`,
    to: "test@example.com",
    subject: "Ethereal SMTP Test",
    text: "Hello from ReachInbox Scheduler!",
  });

  console.log("Message ID:", info.messageId);
  console.log(
    "Preview URL:",
    nodemailer.getTestMessageUrl(info),
  );
}

testEthereal().catch(console.error);