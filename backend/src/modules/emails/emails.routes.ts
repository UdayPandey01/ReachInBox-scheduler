import {Router} from "express";
import {downloadAttachment, getEmail, listScheduledEmails, listSentEmails, scheduleEmail} from "./emails.controller";
import {requireAuth} from "../../middleware/requireAuth";

const router = Router();

router.use(requireAuth);

router.post("/schedule", scheduleEmail);
router.get("/scheduled", listScheduledEmails);
router.get("/sent", listSentEmails);
router.get("/:id", getEmail);
router.get("/:id/attachments/:attachmentId", downloadAttachment);

export default router;
