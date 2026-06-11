import { Request, Response, Router } from "express";
import { route } from "@fosscord/api";

const router = Router();

router.post("/", route({}), async (_req: Request, res: Response) => {
	res.sendStatus(204);
});

export default router;