import { Request, Response, Router } from "express";
import { Guild, Member } from "@fosscord/util";
import { route } from "@fosscord/api";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;

	await Guild.findOneOrFail({ id: guild_id });
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	return res.json({
		primary_category_id: null,
		category_ids: [],
		keywords: [],
		emoji_discoverability_enabled: false,
		partner_actioned_timestamp: null,
		partner_application_timestamp: null,
		is_published: false,
		reasons_to_join: [],
		social_links: [],
		about: ""
	});
});

export default router;