import { cleanHtml, cleanInline } from "./sanitize.js";

export type PublicUser = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
};

export function publicUser(u: {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
}): PublicUser {
  return { id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl ?? null, bio: u.bio ?? null };
}

// Prisma include fragment for posts with everything needed to serialize.
export const postInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
  community: { select: { id: true, slug: true, title: true } },
  votes: { select: { userId: true, value: true } },
  reactions: { select: { userId: true, emoji: true } },
  _count: { select: { comments: true } },
} as const;

type PostRow = {
  id: string;
  type: string;
  title: string;
  bodyHtml: string;
  codeSnippet: string | null;
  linkUrl: string | null;
  linkTitle: string | null;
  imageUrl: string | null;
  createdAt: Date;
  communityId: string | null;
  author: { id: string; nickname: string; avatarUrl: string | null; bio: string | null };
  community: { id: string; slug: string; title: string } | null;
  votes: { userId: string; value: number }[];
  reactions: { userId: string; emoji: string }[];
  _count: { comments: number };
};

export function serializePost(p: PostRow, userId: string | null) {
  const score = p.votes.reduce((s, v) => s + v.value, 0);
  const myVote = userId ? p.votes.find((v) => v.userId === userId)?.value ?? 0 : 0;
  const fire = p.reactions.length;
  const myFire = userId ? p.reactions.some((r) => r.userId === userId) : false;
  return {
    id: p.id,
    type: p.type,
    title: cleanInline(p.title),
    bodyHtml: cleanHtml(p.bodyHtml),
    codeSnippet: p.codeSnippet,
    link: p.linkUrl ? { url: p.linkUrl, title: p.linkTitle ?? p.linkUrl } : null,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    author: publicUser(p.author),
    community: p.community
      ? { id: p.community.id, slug: p.community.slug, title: p.community.title }
      : null,
    score,
    myVote,
    fire,
    myFire,
    commentCount: p._count.comments,
  };
}

export const commentInclude = {
  author: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
} as const;

type CommentRow = {
  id: string;
  bodyHtml: string;
  score: number;
  createdAt: Date;
  parentCommentId: string | null;
  author: { id: string; nickname: string; avatarUrl: string | null; bio: string | null };
};

export type CommentDTO = {
  id: string;
  bodyHtml: string;
  score: number;
  createdAt: string;
  parentCommentId: string | null;
  author: PublicUser;
  replies: CommentDTO[];
};

export function serializeComment(c: CommentRow): CommentDTO {
  return {
    id: c.id,
    bodyHtml: cleanHtml(c.bodyHtml),
    score: c.score,
    createdAt: c.createdAt.toISOString(),
    parentCommentId: c.parentCommentId,
    author: publicUser(c.author),
    replies: [],
  };
}

/** Build a nested comment tree (top-level + replies) from a flat list. */
export function nestComments(rows: CommentRow[]): CommentDTO[] {
  const nodes = new Map<string, CommentDTO>();
  const roots: CommentDTO[] = [];
  for (const r of rows) nodes.set(r.id, serializeComment(r));
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    if (r.parentCommentId && nodes.has(r.parentCommentId)) {
      nodes.get(r.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
