import { Request, Response, Router } from "express";
import { Member, getPermission, getRights, Role, GuildMemberUpdateEvent, emitEvent, Rights, Guild, PublicGuildRelations } from "@fosscord/util";
import { HTTPError } from "lambert-server";
import { route } from "@fosscord/api";

const router = Router();

async function getGuildMemberJoinPayload(guild_id: string) {
	const guild = await Guild.findOneOrFail({
		where: { id: guild_id },
		relations: PublicGuildRelations,
	});

	const payload = {
		...guild,
		features: guild.features || [],
		emojis: guild.emojis || [],
		roles: guild.roles || [],
		stickers: guild.stickers || [],
		guild_hashes: {},
		guild_scheduled_events: [],
		stage_instances: [],
		threads: [],
	};

	const properties = { ...payload } as any;
	delete properties.channels;
	delete properties.emojis;
	delete properties.roles;
	delete properties.stickers;
	delete properties.members;
	delete properties.presences;
	delete properties.threads;
	delete properties.guild_scheduled_events;

	return {
		...payload,
		properties,
		additional_fields: {
			joined_at: undefined,
			premium_subscriber_count: guild.premium_subscription_count || 0,
		},
	};
}

export interface MemberChangeSchema {
	roles?: string[];
}

router.get("/", route({}), async (req: Request, res: Response) => {
	const { guild_id, member_id } = req.params;
	await Member.IsInGuildOrFail(req.user_id, guild_id);

	const member = await Member.findOneOrFail({ id: member_id, guild_id });

	return res.json(member);
});

router.patch("/", route({ body: "MemberChangeSchema" }), async (req: Request, res: Response) => {
	let { guild_id, member_id } = req.params;
	if (member_id === "@me") member_id = req.user_id;
	const body = req.body as MemberChangeSchema;

	const member = await Member.findOneOrFail({ where: { id: member_id, guild_id }, relations: ["roles", "user"] });
	const permission = await getPermission(req.user_id, guild_id);
	const everyone = await Role.findOneOrFail({ guild_id: guild_id, name: "@everyone", position: 0 });

	if (body.roles) {
		permission.hasThrow("MANAGE_ROLES");

		if (body.roles.indexOf(everyone.id) === -1) body.roles.push(everyone.id);
		member.roles = body.roles.map((x) => new Role({ id: x })); // foreign key constraint will fail if role doesn't exist
	}

	await member.save();

	member.roles = member.roles.filter((x) => x.id !== everyone.id);

	// do not use promise.all as we have to first write to db before emitting the event to catch errors
	await emitEvent({
		event: "GUILD_MEMBER_UPDATE",
		guild_id,
		data: { ...member, roles: member.roles.map((x) => x.id) }
	} as GuildMemberUpdateEvent);

	res.json(member);
});

router.put("/", route({}), async (req: Request, res: Response) => {

	// TODO: Lurker mode

	const rights = await getRights(req.user_id);

	let { guild_id, member_id } = req.params;
	if (member_id === "@me") {
		member_id = req.user_id;
		rights.hasThrow("JOIN_GUILDS");
	} else {
		// TODO: join others by controller	
	}

	const existingMember = await Member.findOne({ where: { id: member_id, guild_id } });
	if (existingMember) {
		const payload = await getGuildMemberJoinPayload(guild_id);
		return res.send({
			...payload,
			joined_at: existingMember.joined_at,
			additional_fields: {
				...payload.additional_fields,
				joined_at: existingMember.joined_at,
			},
		});
	}

	await Member.addToGuild(member_id, guild_id);
	const member = await Member.findOneOrFail({ where: { id: member_id, guild_id } });
	const payload = await getGuildMemberJoinPayload(guild_id);
	res.send({
		...payload,
		joined_at: member.joined_at,
		additional_fields: {
			...payload.additional_fields,
			joined_at: member.joined_at,
		},
	});
});

router.delete("/", route({}), async (req: Request, res: Response) => {
	const permission = await getPermission(req.user_id);
	const rights = await getRights(req.user_id);
	const { guild_id, member_id } = req.params;
	if (member_id !== "@me" || member_id === req.user_id) {
		// TODO: unless force-joined
		rights.hasThrow("SELF_LEAVE_GROUPS");
	} else {
		rights.hasThrow("KICK_BAN_MEMBERS");
		permission.hasThrow("KICK_MEMBERS");
	}

	await Member.removeFromGuild(member_id, guild_id);
	res.sendStatus(204);
});

export default router;
