import { Router, Request, Response } from "express";
import { route } from "@fosscord/api";

const router = Router();

router.get("/", route({}), async (_req: Request, res: Response) => {
	res.json({
		entries: [],
		unranked_game_entries: [],
		request_id: "content-inventory-empty-feed",
		refresh_stale_inbox_after_ms: 300000,
		wait_ms_until_next_fetch: 300000,
	});
});

export default router;