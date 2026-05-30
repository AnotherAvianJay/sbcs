import { Request, Response, Router } from "express";
import { route, check } from "@fosscord/api";
import { Application, Snowflake, Config, User, emitEvent, defaultSettings } from "@fosscord/util";
import bcrypt from "bcrypt";

const router: Router = Router();

export interface ApplicationCreateSchema {
	name: string;
	icon?: string | null;
	description?: string;
	bot_public?: boolean;
	bot_require_code_grant?: boolean;
}

export interface ApplicationModifySchema {
	name?: string;
	icon?: string | null;
	description?: string;
	bot_public?: boolean;
	bot_require_code_grant?: boolean;
}

export interface BotCreateSchema {
	name: string;
}

// Get all applications for the current user
router.get("/", route({}), async (req: Request, res: Response) => {
	const apps = await Application.find({
		where: { owner: { id: req.user_id } },
		relations: ["owner", "team"]
	});
	res.json(apps);
});

// Get a specific application by ID
router.get("/:id", route({ right: "CREATE_APPLICATIONS" }), async (req: Request, res: Response) => {
	const app = await Application.findOne({
		where: { id: req.params.id },
		relations: ["owner", "team", "guild"]
	});
	if (!app) return res.status(404).json({ message: "Application not found" });
	if (app.owner?.id !== req.user_id) return res.status(403).json({ message: "Not authorized" });
	res.json(app);
});

// Create a new application (bot)
router.post("/", route({ body: "ApplicationCreateSchema" }), async (req: Request, res: Response) => {
	const body = req.body as ApplicationCreateSchema;

	const owner = await User.findOne({ where: { id: req.user_id } });
	if (!owner) return res.status(404).json({ message: "User not found" });

	const app = new Application();
	app.id = Snowflake.generate();
	app.name = body.name;
	app.description = body.description || "";
	app.bot_public = body.bot_public ?? true;
	app.bot_require_code_grant = body.bot_require_code_grant ?? false;
	app.owner = owner;
	app.verify_key = await bcrypt.hash(app.id + Date.now().toString(), 10);
	app.flags = "0";

	await app.save();

	// Emit application create event
	await emitEvent({
		event: "APPLICATION_CREATE",
		data: app,
		user_id: req.user_id
	} as any);

	res.status(201).json(app);
});

// Modify an existing application
router.patch("/:id", route({ body: "ApplicationModifySchema", right: "CREATE_APPLICATIONS" }), async (req: Request, res: Response) => {
	const body = req.body as ApplicationModifySchema;

	const app = await Application.findOne({
		where: { id: req.params.id },
		relations: ["owner"]
	});
	if (!app) return res.status(404).json({ message: "Application not found" });
	if (app.owner?.id !== req.user_id) return res.status(403).json({ message: "Not authorized" });

	if (body.name !== undefined) app.name = body.name;
	if (body.description !== undefined) app.description = body.description;
	if (body.bot_public !== undefined) app.bot_public = body.bot_public;
	if (body.bot_require_code_grant !== undefined) app.bot_require_code_grant = body.bot_require_code_grant;

	await app.save();

	res.json(app);
});

// Delete an application
router.delete("/:id", route({ right: "CREATE_APPLICATIONS" }), async (req: Request, res: Response) => {
	const app = await Application.findOne({
		where: { id: req.params.id },
		relations: ["owner"]
	});
	if (!app) return res.status(404).json({ message: "Application not found" });
	if (app.owner?.id !== req.user_id) return res.status(403).json({ message: "Not authorized" });

	await app.remove();

	res.status(204).send();
});

// Get bot for an application
router.get("/:id/bot", route({ right: "CREATE_APPLICATIONS" }), async (req: Request, res: Response) => {
	const app = await Application.findOne({
		where: { id: req.params.id },
		relations: ["owner"]
	});
	if (!app) return res.status(404).json({ message: "Application not found" });
	if (app.owner?.id !== req.user_id) return res.status(403).json({ message: "Not authorized" });

	// Check if bot user already exists
	const botUser = await User.findOne({ where: { id: req.params.id, bot: true } });
	if (botUser) {
		return res.json({
			id: botUser.id,
			username: botUser.username,
			discriminator: botUser.discriminator,
			avatar: botUser.avatar,
			bot: true,
			public_flags: botUser.public_flags
		});
	}

	return res.status(404).json({ message: "Bot not found" });
});

// Create bot for an application
router.post("/:id/bot", route({ right: "CREATE_APPLICATIONS" }), async (req: Request, res: Response) => {
	const app = await Application.findOne({
		where: { id: req.params.id },
		relations: ["owner"]
	});
	if (!app) return res.status(404).json({ message: "Application not found" });
	if (app.owner?.id !== req.user_id) return res.status(403).json({ message: "Not authorized" });

	// Check if bot user already exists
	let botUser = await User.findOne({ where: { id: req.params.id, bot: true } });
	if (botUser) {
		return res.status(400).json({ message: "Bot already exists for this application" });
	}

	// Create bot user with same ID as application
	botUser = new User();
	botUser.id = app.id; // Bot has same ID as application
	botUser.username = app.name;
	botUser.discriminator = "0000";
	botUser.bot = true;
	botUser.avatar = app.icon || null;
	botUser.bio = app.description || "";
	botUser.system = false;
	botUser.created_at = new Date();
	botUser.public_flags = 0;
	botUser.premium = false;
	botUser.premium_type = 0;
	botUser.desktop = false;
	botUser.mobile = false;
	botUser.nsfw_allowed = false;
	botUser.mfa_enabled = false;
	botUser.verified = false;
	botUser.disabled = false;
	botUser.deleted = false;
	botUser.flags = "0";
	botUser.rights = "0";
	botUser.data = { valid_tokens_since: new Date() };
	botUser.fingerprints = [];
	botUser.settings = defaultSettings;
	botUser.extended_settings = "";
	await botUser.save();

	return res.json({
		token: "", // Token generation would be handled separately
		id: botUser.id,
		username: botUser.username,
		discriminator: botUser.discriminator,
		avatar: botUser.avatar,
		bot: true,
		public_flags: botUser.public_flags
	});
});

export default router;
