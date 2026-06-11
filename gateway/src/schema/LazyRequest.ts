export interface LazyRequest {
	guild_id: string;
	channels?: Record<string, [number, number][]>;
	activities?: boolean;
	threads?: boolean;
	typing?: true;
	members?: any[];
	member_updates?: boolean;
	thread_member_lists?: any[];
}

export const LazyRequest = {
	guild_id: String,
	$activities: Boolean,
	$channels: Object,
	$typing: Boolean,
	$threads: Boolean,
	$members: [] as any[],
	$member_updates: Boolean,
	$thread_member_lists: [] as any[],
};
