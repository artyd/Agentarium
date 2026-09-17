import { prisma } from "./prisma.js";
import { emitToUser } from "./realtime.js";
import { publicUser } from "./serialize.js";

type NotifType =
  | "comment"
  | "reply"
  | "upvote"
  | "fire"
  | "mention"
  | "friend_request"
  | "friend_accept"
  | "community_invite"
  | "join_request";

type NotifInput = {
  userId: string; // recipient
  actorId?: string; // who caused it
  type: NotifType;
  postId?: string;
  commentId?: string;
  chatId?: string;
  communityId?: string;
  text?: string;
};

const notifInclude = { actor: { select: { id: true, nickname: true, avatarUrl: true, bio: true } } } as const;

export function serializeNotification(n: {
  id: string; type: string; postId: string | null; commentId: string | null;
  communityId: string | null; text: string | null; read: boolean; createdAt: Date;
  actor: { id: string; nickname: string; avatarUrl: string | null; bio: string | null } | null;
}) {
  return {
    id: n.id,
    type: n.type,
    postId: n.postId,
    commentId: n.commentId,
    communityId: n.communityId,
    text: n.text,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor ? publicUser(n.actor) : null,
  };
}

/** Create a notification (skips self-notifications) and push it in realtime. */
export async function notify(input: NotifInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;
  try {
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        chatId: input.chatId ?? null,
        communityId: input.communityId ?? null,
        text: input.text ?? null,
      },
      include: notifInclude,
    });
    emitToUser(input.userId, "notification", serializeNotification(n));
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
