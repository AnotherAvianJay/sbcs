import { Request, Response, Router } from "express";
import { DiscordApiErrors, emitEvent, getPermission, Guild, GuildUpdateEvent, handleFile, Member } from "@fosscord/util";
import { route } from "@fosscord/api";

const router = Router();

interface GuildProfileUpdateSchema {
	name?: string;
	description?: string;
	icon?: string | null;
	custom_banner?: string | null;
	visibility?: number;
	brand_color_primary?: number | null;
	traits?: unknown[];
	game_application_ids?: string[];
	tag?: string | null;
	badge?: string | null;
	badge_color_primary?: number | null;
	badge_color_secondary?: number | null;
}

function serializeGuildProfile(guild: Guild) {
	const guildData = guild.toJSON() as any;

	return {
		id: guildData.id,
		name: guildData.name,
		description: guildData.description ?? "",
		icon_hash: guildData.icon ?? null,
		custom_banner_hash: guildData.banner ?? null,
		online_count: guildData.presence_count ?? 0,
		member_count: guildData.member_count ?? 0,
		brand_color_primary: null,
		visibility: 0,
		traits: [],
		game_application_ids: [],
		game_activity: {},
		games: [],
		features: guildData.features ?? [],
		tag: null,
		badge: null,
		badge_hash: null,
		badge_color_primary: null,
		badge_color_secondary: null,
		premium_subscription_count: guildData.premium_subscription_count ?? 0,
		premium_tier: guildData.premium_tier ?? 0
	};
}

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	const guild = await Guild.findOneOrFail({ id: guild_id });
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	return res.json(serializeGuildProfile(guild));
});

router.patch("/", route({}), async (req: Request, res: Response) => {
	const body = req.body as GuildProfileUpdateSchema;
	const { guild_id } = req.params;

	const permission = await getPermission(req.user_id, guild_id);

	if (!permission.has("MANAGE_GUILD")) {
		throw DiscordApiErrors.MISSING_PERMISSIONS.withParams("MANAGE_GUILD");
	}

	const guild = await Guild.findOneOrFail({
		where: { id: guild_id },
		relations: ["emojis", "roles", "stickers"]
	});

	if (body.name !== undefined) guild.name = body.name;
	if (body.description !== undefined) guild.description = body.description;
	if (body.icon !== undefined) {
		(guild as any).icon = body.icon ? await handleFile(`/icons/${guild_id}`, body.icon) : null;
	}
	if (body.custom_banner !== undefined) {
		(guild as any).banner = body.custom_banner ? await handleFile(`/banners/${guild_id}`, body.custom_banner) : null;
	}

	const data = guild.toJSON() as any;
	delete data.vanity_url_code;
	delete data.template_id;

	await Promise.all([
		guild.save(),
		emitEvent({ event: "GUILD_UPDATE", data, guild_id } as GuildUpdateEvent)
	]);

	return res.json(serializeGuildProfile(guild));
});

export default router;