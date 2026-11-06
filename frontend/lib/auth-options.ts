import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      // On first sign-in, `account` is present and contains the Google sub.
      // On subsequent calls token.sub is already set by NextAuth.
      if (account?.providerAccountId) {
        token.sub = `google|${account.providerAccountId}`
      }
      return token
    },
    session({ session, token }) {
      // Expose the namespaced Google sub as session.user.id
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
