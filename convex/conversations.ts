// convex/conversations.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreate = mutation({
  args: {
    otherUserId: v.id("users"), // The ID of the person we clicked on
  },
  handler: async (ctx, args) => {
    // 1. Get the current logged-in user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!me) throw new Error("Current user not found in database");

    // 2. Check if a 1-on-1 conversation already exists
    // Get all conversations I am a part of
    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", me._id))
      .collect();

    for (const membership of myMemberships) {
      const conversation = await ctx.db.get(membership.conversationId);
      
      // If it's a 1-on-1 chat (not a group)
      if (conversation && !conversation.isGroup) {
        // Check if the exact person we clicked on is the OTHER member
        const otherMembership = await ctx.db
          .query("conversationMembers")
          .withIndex("by_userId_and_conversationId", (q) =>
            q.eq("userId", args.otherUserId).eq("conversationId", conversation._id)
          )
          .first();

        if (otherMembership) {
          return conversation._id; // We found the existing chat!
        }
      }
    }

    // 3. If no chat exists, create a new one
    const newConversationId = await ctx.db.insert("conversations", {
      isGroup: false,
    });

    // Add myself to the conversation
    await ctx.db.insert("conversationMembers", {
      userId: me._id,
      conversationId: newConversationId,
      unreadCount: 0,
    });

    // Add the other person to the conversation
    await ctx.db.insert("conversationMembers", {
      userId: args.otherUserId,
      conversationId: newConversationId,
      unreadCount: 0,
    });

    return newConversationId;
  },
});

export const getChatDetails = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return null;

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // Find the member that is NOT me
    const otherMember = members.find((m) => m.userId !== me._id);
    if (!otherMember) return null;

    // Fetch and return the other user's profile
    const otherUser = await ctx.db.get(otherMember.userId);
    return otherUser;
  },
});

export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return;

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_userId_and_conversationId", (q) =>
        q.eq("userId", me._id).eq("conversationId", args.conversationId)
      )
      .first();

    // Reset unread count to 0
    if (membership) {
      await ctx.db.patch(membership._id, { unreadCount: 0 });
    }
  },
});