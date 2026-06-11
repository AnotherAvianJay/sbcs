import { CLOSECODES, OPCODES } from "../util/Constants";
import { WebSocket, Payload } from "@fosscord/gateway";
var erlpack: any;
try {
	erlpack = require("@yukikaze-bot/erlpack");
} catch (error) {}
import OPCodeHandlers from "../opcodes";
import { Tuple } from "lambert-server";
import { check } from "../opcodes/instanceOf";
import WS from "ws";

const PayloadSchema = {
	op: Number,
	$d: new Tuple(Object, Number), // or number for heartbeat sequence
	$s: Number,
	$t: String,
};

export async function Message(this: WebSocket, buffer: WS.Data) {
	// TODO: compression
	var data: Payload;

	if (this.encoding === "etf" && buffer instanceof Buffer)
		data = erlpack.unpack(buffer);
	else if (this.encoding === "json" && typeof buffer === "string")
		data = JSON.parse(buffer);
	else return;

	check.call(this, PayloadSchema, data);

	if (data.op === OPCODES.Lazy_Request) {
		console.log("[Gateway][LazyRequest] received", {
			guild_id: data.d?.guild_id,
			keys: Object.keys(data.d || {}),
			channel_keys: Object.keys(data.d?.channels || {}),
			threads: data.d?.threads,
			typing: data.d?.typing,
			activities: data.d?.activities,
			members: Array.isArray(data.d?.members) ? data.d.members.length : undefined,
			thread_member_lists: Array.isArray(data.d?.thread_member_lists)
				? data.d.thread_member_lists.length
				: undefined,
		});
	}

	if (data.op === OPCODES.Guild_Subscriptions_Bulk) {
		const subscriptions = data.d?.subscriptions || {};
		const firstGuildId = Object.keys(subscriptions)[0];
		const firstSubscription = firstGuildId ? subscriptions[firstGuildId] : undefined;
		console.log("[Gateway][GuildSubscriptionsBulk] received", {
			guild_count: Object.keys(subscriptions).length,
			first_guild_id: firstGuildId,
			first_subscription_keys: firstSubscription ? Object.keys(firstSubscription) : [],
			first_channel_keys: Object.keys(firstSubscription?.channels || {}),
		});
	}

	// @ts-ignore
	const OPCodeHandler = OPCodeHandlers[data.op];
	if (!OPCodeHandler) {
		console.error("[Gateway] Unkown opcode " + data.op);
		// TODO: if all opcodes are implemented comment this out:
		// this.close(CLOSECODES.Unknown_opcode);
		return;
	}

	try {
		return await OPCodeHandler.call(this, data);
	} catch (error) {
		console.error(error);
		if (!this.CLOSED && this.CLOSING)
			return this.close(CLOSECODES.Unknown_error);
	}
}
