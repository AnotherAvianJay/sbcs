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
			if (!Array.isArray(arr)) return [];
			const missing = arr
				.map((item, idx) => {
					// Handle merged_members (array of arrays)
					if (Array.isArray(item)) item = item[0];
					if (!item) return { idx, reason: "null item" };
					if (item.user) {
						if (item.user.flags === undefined || item.user.flags === null) {
							return { idx, id: item.user.id, reason: "user.flags is null/undefined" };
						}
					} else if (item.flags === undefined || item.flags === null) {
						return { idx, id: item.id, reason: "flags is null/undefined" };
					}
					return null;
				})
				.filter(Boolean);
			if (missing.length > 0) {
				console.log(`[DEBUG] ${name} items missing flags:`, missing);
			}
			return missing;
		};

		console.log("[DEBUG] Checking READY payload for missing flags...");
		const usersMissing = findMissingFlags(ready.users, "users");
		const membersMissing = findMissingFlags(ready.merged_members, "merged_members");
		const relationsMissing = findMissingFlags(ready.relationships, "relationships");
		const channelsMissing = findMissingFlags(ready.private_channels?.flatMap((c: any) => c.recipients || []), "private_channels.recipients");
		
		const totalMissing = usersMissing.length + membersMissing.length + relationsMissing.length + channelsMissing.length;
		if (totalMissing === 0) {
			console.log("[DEBUG] All user objects have flags!");
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
