// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const headerPayload = request.headers;

    try {
      // Verify the webhook using the secret from Clerk
      const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
      const event = wh.verify(payloadString, {
        "svix-id": headerPayload.get("svix-id")!,
        "svix-timestamp": headerPayload.get("svix-timestamp")!,
        "svix-signature": headerPayload.get("svix-signature")!,
      }) as any;

      const { id, email_addresses, first_name, last_name, image_url } = event.data;
      const email = email_addresses[0]?.email_address;
      const name = [first_name, last_name].filter(Boolean).join(" ") || "Anonymous User";

      // Call our mutation to save the user to the database
      if (event.type === "user.created" || event.type === "user.updated") {
        await ctx.runMutation(internal.users.syncUser, {
          clerkId: id,
          email,
          name,
          imageUrl: image_url,
        });
      }

      return new Response("Webhook processed successfully", { status: 200 });
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return new Response("Webhook Error", { status: 400 });
    }
  }),
});

export default http;