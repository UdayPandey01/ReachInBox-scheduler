import {
  Request,
  Response,
  NextFunction,
} from "express";

import { scheduledEmailSchema } from "./emails.schema";
import { emailsService } from "./emails.service";

const DEV_USER_ID = "95536b28-94bd-49ba-a62a-70ac8e00c2bd";

export async function scheduleEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = scheduledEmailSchema.parse(req.body);

    const result = await emailsService.scheduleEmail(
      input,
      DEV_USER_ID,
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}