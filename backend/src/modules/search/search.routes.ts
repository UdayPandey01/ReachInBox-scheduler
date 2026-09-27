import { Router } from "express";
import { searchEmails } from "./search.controller";
import { requireAuth } from "../../middleware/requireAuth";

const router = Router();

router.get("/emails", requireAuth, searchEmails);

export default router;
