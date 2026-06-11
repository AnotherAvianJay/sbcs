import { WebSocket, Payload } from "@fosscord/gateway";
import { Send } from "../util/Send";
import { OPCODES } from "../util/Constants";

interface RequestChannelInfoPayload {
	guild_id?: string | string[];
	fields?: string[];
}

export async function onRequestChannelInfo(this: WebSocket, { d }: Payload) {
	const body = (d || {}) as RequestChannelInfoPayload;
	if (!body.guild_id || !body.fields) return;

	await Send(this, {
		op: OPCODES.Dispatch,
		s: this.sequence++,
		t: "CHANNEL_INFO",
		d: {
			guild_id: body.guild_id,
			channels: [],
		},
	});
}