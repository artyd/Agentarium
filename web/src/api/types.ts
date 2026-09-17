export type PublicUser = { id: string; nickname: string; avatarUrl: string | null; bio: string | null };

export type PostDTO = {
  id: string;
  type: string;
  title: string;
  bodyHtml: string;
  codeSnippet: string | null;
  link: { url: string; title: string; desc: string | null; image: string | null } | null;
  imageUrl: string | null;
  imageUrls: string[];
  createdAt: string;
  author: PublicUser;
  community: { id: string; slug: string; title: string } | null;
  pinned: boolean;
  tags: string[];
  edited: boolean;
  score: number;
  myVote: number;
  fire: number;
  myFire: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
  bookmarked: boolean;
  commentCount: number;
};

export type NotificationDTO = {
  id: string;
  type: string;
  postId: string | null;
  commentId: string | null;
  communityId: string | null;
  text: string | null;
  read: boolean;
  createdAt: string;
  actor: PublicUser | null;
};

export type CommentDTO = {
  id: string;
  bodyHtml: string;
  score: number;
  edited: boolean;
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
  online: boolean;
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
  online: boolean;
};
