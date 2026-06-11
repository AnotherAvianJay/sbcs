import { Request, Response, Router } from "express";
import { Guild, Member } from "@fosscord/util";
import { route } from "@fosscord/api";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	const guild = await Guild.findOneOrFail({ id: guild_id });
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	const guildData = guild.toJSON() as any;
	const welcomeScreen = guildData.welcome_screen ?? {};

	return res.json({
		guild_id,
		welcome_message: {
			author_ids: [],
			message: welcomeScreen.description ?? ""
		},
		new_member_actions: [],
		resource_channels: [],
		enabled: welcomeScreen.enabled ?? false
	});
});

export default router;