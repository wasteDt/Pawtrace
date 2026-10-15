import type { Request, Response } from "express";
import {
  app,
  prisma,
  currentSession,
  csrfValid,
  sendError,
  UserStatus,
  ProfessionalStatus,
} from "../context.js";

const chatStreams = new Map<number, Set<Response>>();

function sendChatEvent(userId: number, event: unknown) {
  for (const response of chatStreams.get(userId) ?? [])
    response.write(`event: conversation\ndata: ${JSON.stringify(event)}\n\n`);
}

async function activeSession(request: Request, response: Response) {
  const session = await currentSession(request);
  if (!session || session.user.status !== UserStatus.ACTIVE) {
    sendError(response, 401, "UNAUTHENTICATED", "请先登录");
    return null;
  }
  return session;
}

function publicUser(user: {
  id: number;
  profile: { nickname: string | null; avatarUrl: string | null } | null;
  professional: {
    type: string;
    status: string;
    displayName: string;
    organization: string;
    specialties: unknown;
  } | null;
}) {
  const professional =
    user.professional?.status === ProfessionalStatus.APPROVED
      ? user.professional
      : null;
  return {
    id: user.id,
    nickname: user.profile?.nickname ?? `用户${user.id}`,
    avatarUrl: user.profile?.avatarUrl ?? null,
    professional: professional
      ? {
          type: professional.type,
          displayName: professional.displayName,
          organization: professional.organization,
          specialties: professional.specialties,
        }
      : null,
  };
}

const publicUserInclude = {
  profile: { select: { nickname: true, avatarUrl: true } },
  professional: {
    select: {
      type: true,
      status: true,
      displayName: true,
      organization: true,
      specialties: true,
    },
  },
} as const;

app.get("/api/v1/directory/users", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  const query =
    typeof request.query.q === "string"
      ? request.query.q.trim().slice(0, 50)
      : "";
  const users = await prisma.user.findMany({
    where: {
      id: { not: session.userId },
      status: UserStatus.ACTIVE,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { profile: { nickname: { contains: query } } },
              {
                professional: {
                  displayName: { contains: query },
                  status: ProfessionalStatus.APPROVED,
                },
              },
            ],
          }
        : {}),
    },
    include: publicUserInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const following = await prisma.follow.findMany({
    where: {
      followerId: session.userId,
      followingId: { in: users.map((user) => user.id) },
    },
    select: { followingId: true },
  });
  const followedIds = new Set(following.map((item) => item.followingId));
  return response.json({
    data: users.map((user) => ({
      ...publicUser(user),
      isFollowing: followedIds.has(user.id),
    })),
  });
});

app.get("/api/v1/users/:userId", async (request, response) => {
  const userId = Number(request.params.userId);
  const user = Number.isInteger(userId)
    ? await prisma.user.findFirst({
        where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
        include: publicUserInclude,
      })
    : null;
  if (!user)
    return sendError(response, 404, "RESOURCE_NOT_FOUND", "用户不存在");
  const session = await currentSession(request);
  const [followingCount, followerCount, following, followedBy] =
    await Promise.all([
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.follow.count({ where: { followingId: userId } }),
      session
        ? prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.userId,
                followingId: userId,
              },
            },
          })
        : null,
      session
        ? prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: userId,
                followingId: session.userId,
              },
            },
          })
        : null,
    ]);
  return response.json({
    data: {
      ...publicUser(user),
      followingCount,
      followerCount,
      isFollowing: Boolean(following),
      followsMe: Boolean(followedBy),
    },
  });
});

app.put("/api/v1/users/:userId/follow", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  if (!csrfValid(request, session))
    return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
  const userId = Number(request.params.userId);
  if (!Number.isInteger(userId) || userId === session.userId)
    return sendError(
      response,
      400,
      "INVALID_FOLLOW_TARGET",
      "不能关注自己或无效用户",
    );
  const target = await prisma.user.findFirst({
    where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  if (!target)
    return sendError(response, 404, "RESOURCE_NOT_FOUND", "用户不存在");
  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: session.userId,
        followingId: userId,
      },
    },
    create: { followerId: session.userId, followingId: userId },
    update: {},
  });
  return response.json({ data: { isFollowing: true } });
});

app.delete("/api/v1/users/:userId/follow", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  if (!csrfValid(request, session))
    return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
  const userId = Number(request.params.userId);
  if (!Number.isInteger(userId))
    return sendError(response, 400, "INVALID_FOLLOW_TARGET", "用户编号无效");
  await prisma.follow.deleteMany({
    where: { followerId: session.userId, followingId: userId },
  });
  return response.json({ data: { isFollowing: false } });
});

app.get("/api/v1/me/connections", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  const type =
    request.query.type === "followers" || request.query.type === "friends"
      ? request.query.type
      : "following";
  const [outgoing, incoming] = await Promise.all([
    prisma.follow.findMany({
      where: {
        followerId: session.userId,
        following: { status: UserStatus.ACTIVE, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { following: { include: publicUserInclude } },
    }),
    prisma.follow.findMany({
      where: {
        followingId: session.userId,
        follower: { status: UserStatus.ACTIVE, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { follower: { include: publicUserInclude } },
    }),
  ]);
  const incomingIds = new Set(incoming.map((item) => item.followerId));
  const outgoingIds = new Set(outgoing.map((item) => item.followingId));
  const items =
    type === "followers"
      ? incoming.map((item) => ({
          ...publicUser(item.follower),
          isFollowing: outgoingIds.has(item.followerId),
          followsMe: true,
        }))
      : outgoing
          .filter(
            (item) => type !== "friends" || incomingIds.has(item.followingId),
          )
          .map((item) => ({
            ...publicUser(item.following),
            isFollowing: true,
            followsMe: incomingIds.has(item.followingId),
          }));
  return response.json({ data: items });
});

app.get("/api/v1/me/settings/message-privacy", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.userId },
    select: { messagePrivacy: true },
  });
  return response.json({
    data: { messagePrivacy: profile?.messagePrivacy ?? "FOLLOWERS" },
  });
});

app.patch("/api/v1/me/settings/message-privacy", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  if (!csrfValid(request, session))
    return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
  const messagePrivacy = request.body?.messagePrivacy;
  if (messagePrivacy !== "FOLLOWERS" && messagePrivacy !== "MUTUAL")
    return sendError(response, 400, "VALIDATION_ERROR", "请选择消息接收范围");
  const profile = await prisma.userProfile.update({
    where: { userId: session.userId },
    data: { messagePrivacy },
  });
  return response.json({ data: { messagePrivacy: profile.messagePrivacy } });
});

app.post("/api/v1/conversations", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  if (!csrfValid(request, session))
    return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
  const targetUserId = Number(request.body?.targetUserId);
  if (!Number.isInteger(targetUserId) || targetUserId === session.userId)
    return sendError(response, 400, "VALIDATION_ERROR", "请选择其他用户");
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, status: UserStatus.ACTIVE, deletedAt: null },
    include: { profile: true },
  });
  if (!target)
    return sendError(response, 404, "RESOURCE_NOT_FOUND", "用户不存在");
  const [following, followedBy] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUserId,
        },
      },
    }),
    prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: targetUserId,
          followingId: session.userId,
        },
      },
    }),
  ]);
  if (!following)
    return sendError(response, 403, "FOLLOW_REQUIRED", "请先关注对方");
  if (target.profile?.messagePrivacy === "MUTUAL" && !followedBy)
    return sendError(
      response,
      403,
      "MUTUAL_FOLLOW_REQUIRED",
      "对方仅接收互相关注用户的消息",
    );
  const userAId = Math.min(session.userId, targetUserId);
  const userBId = Math.max(session.userId, targetUserId);
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: {
      userAId,
      userBId,
      participants: { create: [{ userId: userAId }, { userId: userBId }] },
    },
    update: {},
  });
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: conversation.id,
        userId: session.userId,
      },
    },
    data: { hiddenAt: null },
  });
  return response.status(201).json({ data: { id: conversation.id } });
});

app.get("/api/v1/conversations", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId: session.userId, hiddenAt: null },
    take: 50,
    orderBy: { conversation: { lastMessageAt: "desc" } },
    include: {
      conversation: {
        include: {
          userA: { include: publicUserInclude },
          userB: { include: publicUserInclude },
          messages: { orderBy: { id: "desc" }, take: 1 },
        },
      },
    },
  });
  const items = await Promise.all(
    memberships.map(async (membership) => {
      const conversation = membership.conversation;
      const peer =
        conversation.userAId === session.userId
          ? conversation.userB
          : conversation.userA;
      const unreadCount = await prisma.chatMessage.count({
        where: {
          conversationId: conversation.id,
          id: { gt: membership.lastReadMessageId },
          senderId: { not: session.userId },
        },
      });
      const lastMessage = conversation.messages[0] ?? null;
      return {
        id: conversation.id,
        peer: publicUser(peer),
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount,
        muted: membership.muted,
      };
    }),
  );
  return response.json({ data: items });
});

app.get("/api/v1/conversations/stream", async (request, response) => {
  const session = await activeSession(request, response);
  if (!session) return;
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
  response.write("event: connected\ndata: {}\n\n");
  const streams = chatStreams.get(session.userId) ?? new Set<Response>();
  streams.add(response);
  chatStreams.set(session.userId, streams);
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 25000);
  request.on("close", () => {
    clearInterval(heartbeat);
    streams.delete(response);
    if (!streams.size) chatStreams.delete(session.userId);
  });
});

app.get(
  "/api/v1/conversations/:conversationId/messages",
  async (request, response) => {
    const session = await activeSession(request, response);
    if (!session) return;
    const conversationId = Number(request.params.conversationId);
    const membership = Number.isInteger(conversationId)
      ? await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: { conversationId, userId: session.userId },
          },
        })
      : null;
    if (!membership)
      return sendError(response, 404, "RESOURCE_NOT_FOUND", "会话不存在");
    const beforeId = Number(request.query.beforeId);
    const afterId = Number(request.query.afterId);
    const newer = Number.isInteger(afterId) && afterId > 0;
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId,
        ...(newer
          ? { id: { gt: afterId } }
          : Number.isInteger(beforeId) && beforeId > 0
          ? { id: { lt: beforeId } }
          : {}),
      },
      orderBy: { id: newer ? "asc" : "desc" },
      take: 30,
    });
    return response.json({
      data: { messages: newer ? messages : messages.reverse(), hasMore: messages.length === 30 },
    });
  },
);

app.post(
  "/api/v1/conversations/:conversationId/messages",
  async (request, response) => {
    const session = await activeSession(request, response);
    if (!session) return;
    if (!csrfValid(request, session))
      return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
    const conversationId = Number(request.params.conversationId);
    const body =
      typeof request.body?.body === "string" ? request.body.body.trim() : "";
    if (!Number.isInteger(conversationId) || !body || body.length > 2000)
      return sendError(
        response,
        400,
        "VALIDATION_ERROR",
        "消息长度应为 1 至 2000 字符",
      );
    const membership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: session.userId },
      },
      include: { conversation: true },
    });
    if (!membership)
      return sendError(response, 404, "RESOURCE_NOT_FOUND", "会话不存在");
    const peerId =
      membership.conversation.userAId === session.userId
        ? membership.conversation.userBId
        : membership.conversation.userAId;
    const peer = await prisma.user.findFirst({
      where: { id: peerId, status: UserStatus.ACTIVE, deletedAt: null },
      include: { profile: true },
    });
    if (!peer)
      return sendError(
        response,
        403,
        "RECIPIENT_UNAVAILABLE",
        "对方账号当前无法接收消息",
      );
    const follows = await prisma.follow.findMany({
      where: {
        OR: [
          { followerId: session.userId, followingId: peerId },
          { followerId: peerId, followingId: session.userId },
        ],
      },
    });
    if (peer.profile?.messagePrivacy === "MUTUAL" && follows.length !== 2)
      return sendError(
        response,
        403,
        "MUTUAL_FOLLOW_REQUIRED",
        "对方仅接收互相关注用户的消息",
      );
    if (!follows.length)
      return sendError(
        response,
        403,
        "FOLLOW_REQUIRED",
        "双方已无关注关系，暂不能继续聊天",
      );
    const message = await prisma.$transaction(async (transaction) => {
      const message = await transaction.chatMessage.create({
        data: { conversationId, senderId: session.userId, body },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      });
      await transaction.conversationParticipant.updateMany({
        where: { conversationId },
        data: { hiddenAt: null },
      });
      await transaction.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: session.userId,
          lastReadMessageId: { lt: message.id },
        },
        data: { lastReadMessageId: message.id },
      });
      return message;
    });
    const event = { conversationId, message };
    sendChatEvent(session.userId, event);
    sendChatEvent(peerId, event);
    return response.status(201).json({ data: message });
  },
);

app.post(
  "/api/v1/conversations/:conversationId/read",
  async (request, response) => {
    const session = await activeSession(request, response);
    if (!session) return;
    if (!csrfValid(request, session))
      return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
    const conversationId = Number(request.params.conversationId);
    const membership = Number.isInteger(conversationId)
      ? await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: { conversationId, userId: session.userId },
          },
        })
      : null;
    if (!membership)
      return sendError(response, 404, "RESOURCE_NOT_FOUND", "会话不存在");
    const latest = await prisma.chatMessage.findFirst({
      where: { conversationId },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (latest && latest.id > membership.lastReadMessageId)
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId: session.userId,
          lastReadMessageId: { lt: latest.id },
        },
        data: { lastReadMessageId: latest.id },
      });
    return response.status(204).send();
  },
);

app.delete(
  "/api/v1/conversations/:conversationId",
  async (request, response) => {
    const session = await activeSession(request, response);
    if (!session) return;
    if (!csrfValid(request, session))
      return sendError(response, 403, "CSRF_INVALID", "安全校验失败");
    const conversationId = Number(request.params.conversationId);
    const result = Number.isInteger(conversationId)
      ? await prisma.conversationParticipant.updateMany({
          where: { conversationId, userId: session.userId },
          data: { hiddenAt: new Date() },
        })
      : { count: 0 };
    if (!result.count)
      return sendError(response, 404, "RESOURCE_NOT_FOUND", "会话不存在");
    return response.status(204).send();
  },
);
