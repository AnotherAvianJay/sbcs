var erlpack: any;
try {
	erlpack = require("@yukikaze-bot/erlpack");
} catch (error) {
	console.log("Missing @yukikaze-bot/erlpack, electron-based desktop clients designed for discord.com will not be able to connect!");
}
import { Payload, WebSocket } from "@fosscord/gateway";

export async function Send(socket: WebSocket, data: Payload) {
	// Debug: log READY payload to find which user object is missing flags
	if (data.t === "READY" && data.d) {
		const ready = data.d as any;
		const findMissingFlags = (arr: any[], name: string) => {
			if (!Array.isArray(arr)) {
				console.log(`[DEBUG] ${name} is not an array:`, typeof arr);
				return [];
			}
			const missing = arr
				.map((item, idx) => {
					// Handle merged_members (array of arrays)
					if (Array.isArray(item)) item = item[0];
					if (!item) return { idx, reason: "null item" };
					// Check if user object exists
					if (item.user === undefined) {
						return { idx, id: item.id, reason: "user field is undefined" };
					}
					if (item.user === null) {
						return { idx, id: item.id, reason: "user field is null" };
					}
					// Check user.flags
					if (item.user) {
						if (item.user.flags === undefined) {
							return { idx, id: item.user.id || item.id, reason: "user.flags is undefined" };
						}
						if (item.user.flags === null) {
							return { idx, id: item.user.id || item.id, reason: "user.flags is null" };
						}
					} else if (item.flags === undefined) {
						return { idx, id: item.id, reason: "flags is undefined" };
					} else if (item.flags === null) {
						return { idx, id: item.id, reason: "flags is null" };
					}
					return null;
				})
				.filter(Boolean);
			if (missing.length > 0) {
				console.log(`[DEBUG] ${name} items missing flags:`, missing.slice(0, 5));
				if (missing.length > 5) console.log(`[DEBUG] ... and ${missing.length - 5} more`);
			}
			return missing;
		};

		console.log("[DEBUG] Checking READY payload for missing flags...");
		const usersMissing = findMissingFlags(ready.users, "users");
		const membersMissing = findMissingFlags(ready.merged_members, "merged_members");
		const relationsMissing = findMissingFlags(ready.relationships, "relationships");
		const channelsMissing = findMissingFlags(ready.private_channels?.flatMap((c: any) => c.recipients || []), "private_channels.recipients");
		// Check guilds.members - Discord client may access this
		const guildMembers = ready.guilds?.flatMap((g: any) => g.members || []) || [];
		const guildMembersMissing = findMissingFlags(guildMembers, "guilds.members");
		// Check guild emojis/stickers user objects
		const guildEmojis = ready.guilds?.flatMap((g: any) => g.emojis || []) || [];
		const guildEmojisUserMissing = findMissingFlags(guildEmojis.map((e: any) => e.user ? { user: e.user } : null).filter(Boolean), "guilds.emojis.user");
		const guildStickers = ready.guilds?.flatMap((g: any) => g.stickers || []) || [];
		const guildStickersUserMissing = findMissingFlags(guildStickers.map((s: any) => s.user ? { user: s.user } : null).filter(Boolean), "guilds.stickers.user");
		// Check user_settings - might have user object?
		const userSettings = ready.user_settings ? [ready.user_settings] : [];
		console.log("[DEBUG] user_settings fields:", ready.user_settings ? Object.keys(ready.user_settings) : "none");
		
		const totalMissing = usersMissing.length + membersMissing.length + relationsMissing.length + channelsMissing.length + guildMembersMissing.length + guildEmojisUserMissing.length + guildStickersUserMissing.length;
		if (totalMissing === 0) {
			console.log("[DEBUG] All user objects have flags!");
			console.log("[DEBUG] guilds count:", ready.guilds?.length, "guild members count:", guildMembers.length);
			console.log("[DEBUG] emojis count:", guildEmojis.length, "stickers count:", guildStickers.length);
			console.log("[DEBUG] Full guild structure:", JSON.stringify(ready.guilds?.[0] ? Object.keys(ready.guilds[0]) : "no guilds"));
		} else {
			console.log(`[DEBUG] Total items missing flags: ${totalMissing}`);
		}
	}

	let buffer: Buffer | string;
	if (socket.encoding === "etf") buffer = erlpack.pack(data);
	// TODO: encode circular object
	else if (socket.encoding === "json") buffer = JSON.stringify(data);
	else return;
	// TODO: compression
	if (socket.deflate) {
		socket.deflate.write(buffer);
		socket.deflate.flush();
		return;
	}

	return new Promise((res, rej) => {
		if (socket.readyState !== 1) {
			return rej("socket not open");
		}
		socket.send(buffer, (err: any) => {
			if (err) return rej(err);
			return res(null);
		});
	});
}
