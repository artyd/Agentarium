export type PublicUser = { id: string; nickname: string; avatarUrl: string | null; bio: string | null };

export type PostDTO = {
  id: string;
  type: string;
  title: string;
  bodyHtml: string;
  codeSnippet: string | null;
  link: { url: string; title: string } | null;
  imageUrl: string | null;
  createdAt: string;
  author: PublicUser;
  community: { id: string; slug: string; title: string } | null;
  score: number;
  myVote: number;
  fire: number;
  myFire: boolean;
  commentCount: number;
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

export type CommunityListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isPrivate: boolean;
  memberCount: number;
  threadCount: number;
  isMember: boolean;
};

export type ThreadListItem = {
  id: string;
  title: string;
  author: PublicUser;
  commentCount: number;
  createdAt: string;
};

export type ChatListItem = {
  id: string;
  type: "direct" | "group";
  title: string;
  members: PublicUser[];
  others: PublicUser[];
  lastMessage: { body: string; createdAt: string; authorId: string } | null;
  unread: number;
  updatedAt: string;
};

export type MessageDTO = {
  id: string;
  body: string;
  author: PublicUser;
  mine: boolean;
  createdAt: string;
};

export type PersonDTO = PublicUser & {
  status: "none" | "pending" | "accepted";
  friendshipId: string | null;
  incoming: boolean;
};
