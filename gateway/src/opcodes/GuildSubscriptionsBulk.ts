import { WebSocket, Payload } from "@fosscord/gateway";
import { onLazyRequest } from "./LazyRequest";

interface GuildSubscriptionRequest {
	channels?: Record<string, [number, number][]>;
	activities?: boolean;
	threads?: boolean;
	typing?: true;
	members?: string[];
	member_updates?: boolean;
	thread_member_lists?: unknown[];
}

interface GuildSubscriptionsBulkPayload {
	subscriptions?: Record<string, GuildSubscriptionRequest>;
}

export async function onGuildSubscriptionsBulk(this: WebSocket, payload: Payload) {
	const subscriptions = (payload.d as GuildSubscriptionsBulkPayload | undefined)?.subscriptions;
	if (!subscriptions || typeof subscriptions !== "object") return;

	for (const guild_id of Object.keys(subscriptions)) {
		await onLazyRequest.call(this, {
			...payload,
			d: {
				guild_id,
				...subscriptions[guild_id],
			},
		});
	}
}