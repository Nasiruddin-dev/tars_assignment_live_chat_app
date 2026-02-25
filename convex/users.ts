// convex/users.ts
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const syncUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update existing user (e.g., they changed their profile picture)
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        imageUrl: args.imageUrl,
        email: args.email,
      });
    } else {
      // Create new user
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
        isOnline: true, // We'll set them online by default on signup
      });
    }
  },
});

export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return null;

    const users = await ctx.db.query("users").collect();
    const otherUsers = users.filter((u) => u.clerkId !== identity.subject);

    // Enhance users with conversation data for sorting and badges
    const enhancedUsers = await Promise.all(
      otherUsers.map(async (user) => {
        const myMemberships = await ctx.db
          .query("conversationMembers")
          .withIndex("by_userId", (q) => q.eq("userId", me._id))
          .collect();

        let unreadCount = 0;
        let lastMessageTime = 0;
        let lastMessageContent = "";

        for (const mem of myMemberships) {
          const conv = await ctx.db.get(mem.conversationId);
          if (conv && !conv.isGroup) {
            const otherMem = await ctx.db
              .query("conversationMembers")
              .withIndex("by_userId_and_conversationId", (q) =>
                q.eq("userId", user._id).eq("conversationId", conv._id)
              )
              .first();

            if (otherMem) {
              unreadCount = mem.unreadCount || 0; // Get MY unread count
              if (conv.lastMessageId) {
                const lastMsg = await ctx.db.get(conv.lastMessageId);
                if (lastMsg) {
                  lastMessageTime = lastMsg._creationTime;
                  lastMessageContent = lastMsg.content;
                }
              }
              break;
            }
          }
        }

        return {
          ...user,
          unreadCount,
          lastMessageTime,
          lastMessageContent,
        };
      })
    );

    // Sort: Newest conversations at the top
    enhancedUsers.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    return enhancedUsers;
  },
});