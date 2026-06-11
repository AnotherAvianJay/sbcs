import { WebSocket, Payload } from "@fosscord/gateway";
import { onHeartbeat } from "./Heartbeat";
import { onIdentify } from "./Identify";
import { onGuildSubscriptionsBulk } from "./GuildSubscriptionsBulk";
import { onLazyRequest } from "./LazyRequest";
import { onPresenceUpdate } from "./PresenceUpdate";
import { onRequestChannelInfo } from "./RequestChannelInfo";
import { onRequestGuildMembers } from "./RequestGuildMembers";
import { onResume } from "./Resume";
import { onVoiceStateUpdate } from "./VoiceStateUpdate";

export type OPCodeHandler = (this: WebSocket, data: Payload) => any;

export default {
	1: onHeartbeat,
	2: onIdentify,
	3: onPresenceUpdate,
	4: onVoiceStateUpdate,
	// 5: Voice Server Ping
	6: onResume,
	// 7: Reconnect: You should attempt to reconnect and resume immediately.
	8: onRequestGuildMembers,
	// 9: Invalid Session
	// 10: Hello
	// 13: Dm_update
	14: onLazyRequest,
	37: onGuildSubscriptionsBulk,
	// 40: QoS Heartbeat used by newer Discord web clients
	40: onHeartbeat,
	41: () => undefined,
	43: onRequestChannelInfo,
};
