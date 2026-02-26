// convex/conversations.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 1. Create a brand new group chat
export const createGroup = mutation({
  args: {
    name: v.string(),
    members: v.array(v.id("users")), // Array of user IDs selected in the modal
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Insert the conversation with a name
    const newConversationId = await ctx.db.insert("conversations", {
      isGroup: true,
      name: args.name,
    });

    // Add myself
    await ctx.db.insert("conversationMembers", {
      userId: me._id,
      conversationId: newConversationId,
      unreadCount: 0,
    });

    // Add all selected members
    for (const memberId of args.members) {
      await ctx.db.insert("conversationMembers", {
        userId: memberId,
        conversationId: newConversationId,
        unreadCount: 0,
      });
    }

    return newConversationId;
  },
});

// 2. Your existing getOrCreate (Untouched)
export const getOrCreate = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const me = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).first();
    if (!me) throw new Error("Current user not found in database");

    const myMemberships = await ctx.db.query("conversationMembers").withIndex("by_userId", (q) => q.eq("userId", me._id)).collect();

    for (const membership of myMemberships) {
      const conversation = await ctx.db.get(membership.conversationId);
      if (conversation && !conversation.isGroup) {
        const otherMembership = await ctx.db
          .query("conversationMembers")
          .withIndex("by_userId_and_conversationId", (q) => q.eq("userId", args.otherUserId).eq("conversationId", conversation._id))
          .first();
        if (otherMembership) return conversation._id;
      }
    }

    const newConversationId = await ctx.db.insert("conversations", { isGroup: false });
    await ctx.db.insert("conversationMembers", { userId: me._id, conversationId: newConversationId, unreadCount: 0 });
    await ctx.db.insert("conversationMembers", { userId: args.otherUserId, conversationId: newConversationId, unreadCount: 0 });
    return newConversationId;
  },
});

// 3. Mark as read (Untouched)
export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const me = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).first();
    if (!me) return;

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId_and_conversationId", (q) => q.eq("userId", me._id).eq("conversationId", args.conversationId))
      .first();

    if (membership) await ctx.db.patch(membership._id, { unreadCount: 0 });
  },
});

// 4. NEW: Unified Sidebar Query (Fetches 1on1s AND Groups)
export const getSidebarChats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return [];

    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", me._id))
      .collect();

    const chats = await Promise.all(
      myMemberships.map(async (mem) => {
        const conv = await ctx.db.get(mem.conversationId);
        if (!conv) return null;

        let name, imageUrl, isOnline = false, lastSeen = 0;

        if (conv.isGroup) {
          name = conv.name;
          imageUrl = `https://ui-avatars.com/api/?name=${conv.name}&background=0D8ABC&color=fff`;
        } else {
          const otherMem = await ctx.db
            .query("conversationMembers")
            .withIndex("by_conversationId", (q) => q.eq("conversationId", conv._id))
            .collect();
          const other = otherMem.find((m) => m.userId !== me._id);
          if (other) {
            const otherUser = await ctx.db.get(other.userId);
            name = otherUser?.name;
            imageUrl = otherUser?.imageUrl;
            isOnline = otherUser?.isOnline || false;
            lastSeen = otherUser?.lastSeen || 0;
          }
        }

        let lastMessageContent = "";
        let lastMessageTime = conv._creationTime;
        if (conv.lastMessageId) {
          const lastMsg = await ctx.db.get(conv.lastMessageId);
          if (lastMsg) {
            lastMessageContent = lastMsg.content;
            lastMessageTime = lastMsg._creationTime;
          }
        }

        return {
          _id: conv._id,
          name,
          imageUrl,
          isOnline,
          lastSeen,
          isGroup: conv.isGroup,
          unreadCount: mem.unreadCount || 0,
          lastMessageContent,
          lastMessageTime,
        };
      })
    );

    const validChats = chats.filter((c) => c !== null);
    validChats.sort((a, b) => b!.lastMessageTime - a!.lastMessageTime);
    return validChats;
  },
});

// 5. UPDATED: Get Chat Details (Now understands groups!)
export const getChatDetails = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const me = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).first();
    if (!me) return null;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return null;

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    if (conv.isGroup) {
      const memberProfiles = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
      return {
        isGroup: true,
        name: conv.name,
        imageUrl: `https://ui-avatars.com/api/?name=${conv.name}&background=0D8ABC&color=fff`,
        members: memberProfiles.filter((p) => p !== null),
      };
    } else {
      const otherMember = members.find((m) => m.userId !== me._id);
      const otherUser = otherMember ? await ctx.db.get(otherMember.userId) : null;
      return {
        isGroup: false,
        name: otherUser?.name,
        imageUrl: otherUser?.imageUrl,
        isOnline: otherUser?.isOnline,
        lastSeen: otherUser?.lastSeen,
        members: [],
      };
    }
  },
});

export const updateTyping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const me = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).first();
    if (!me) return;

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId_and_conversationId", (q) => q.eq("userId", me._id).eq("conversationId", args.conversationId))
      .first();

    if (membership) {
      // Update the database with the exact millisecond they pressed a key
      await ctx.db.patch(membership._id, { typingAt: Date.now() });
    }
  },
});

export const getTypingStatus = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const typingUsers = [];
    for (const member of members) {
      if (member.typingAt) {
        const user = await ctx.db.get(member.userId);
        // Exclude ourselves from the typing list!
        if (user && user.clerkId !== identity.subject) {
          typingUsers.push({ name: user.name, typingAt: member.typingAt });
        }
      }
    }
    return typingUsers; // Returns a list of who is typing and when
  },
});