export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL || "https://gentle-chimp-66.clerk.accounts.dev", 
      applicationID: "convex",
    },
  ],
};