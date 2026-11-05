import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

// Pages only signed-out users should see.
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // The Express API owns the database, so it checks the password.
      async authorize(credentials) {
        const res = await fetch(`${process.env.API_URL}/api/v1/auth/credentials`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-secret": process.env.INTERNAL_API_SECRET,
          },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          cache: "no-store",
        });
        if (res.status === 429) throw new RateLimited();
        if (!res.ok) throw new InvalidCredentials();
        const { data } = await res.json();
        return data.user;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present at sign-in. The API compares `sv` with the DB to revoke old sessions.
      if (user) token.sv = user.sessionVersion;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub;
      return session;
    },
    // Used by src/proxy.js to protect routes.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      if (AUTH_PAGES.some((p) => nextUrl.pathname.startsWith(p))) {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
      }
      return isLoggedIn; // false → redirect to /login?callbackUrl=…
    },
  },
});
