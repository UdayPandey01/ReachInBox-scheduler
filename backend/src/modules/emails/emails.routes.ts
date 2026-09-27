import {Router} from "express";
import {scheduleEmail} from "./emails.controller";

const router = Router();

router.post("/schedule", scheduleEmail);

export default router;