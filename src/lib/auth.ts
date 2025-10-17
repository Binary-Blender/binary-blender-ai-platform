import { NextAuthOptions } from 'next-auth'
import { SupabaseAdapter } from '@auth/supabase-adapter'
import GoogleProvider from 'next-auth/providers/google'
import { supabase, supabaseAdmin } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          membership_tier: 'basic', // Default tier for all users
        }
      },
    }),
    // Development provider for testing
    ...(process.env.NODE_ENV === 'development' ? [{
      id: 'development',
      name: 'Development Login',
      type: 'credentials' as const,
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        return {
          id: 'dev-user-1',
          email: credentials.email,
          name: credentials.name || 'Development User',
          membership_tier: 'premium',
        }
      },
    }] : []),
  ],
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all authenticated users from our configured providers
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.membership_tier = user.membership_tier
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.membership_tier = token.membership_tier as string

        // Try to get the actual UUID from the database with short timeout
        try {
          const dbUser = await Promise.race([
            syncUserWithDatabase({
              id: token.sub!,
              email: session.user.email,
              name: session.user.name,
              image: session.user.image,
              membership_tier: token.membership_tier as string
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Database sync timeout')), 1000)
            )
          ])

          // Use the database UUID as the session user ID
          session.user.id = dbUser?.id || token.sub!
        } catch (error) {
          console.error('Error syncing user with database during session:', error)
          // Fallback to token sub if database sync fails
          session.user.id = token.sub!
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}

async function syncUserWithDatabase(user: any) {
  try {
    // Check if user exists in our database by email
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single()

    if (!existingUser) {
      // Create new user
      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({
          email: user.email,
          display_name: user.name,
          avatar_url: user.image,
          membership_tier: user.membership_tier || 'basic',
          credits_remaining: 100, // Welcome credits
          total_credits_purchased: 100,
        })
        .select('*')
        .single()

      if (!error && newUser) {
        // Add welcome credits transaction
        await supabaseAdmin
          .from('credit_transactions')
          .insert({
            user_id: newUser.id,
            amount: 100,
            transaction_type: 'bonus',
            description: 'Welcome bonus credits',
          })

        return newUser
      }
    } else {
      // Update existing user
      const { data: updatedUser } = await supabaseAdmin
        .from('users')
        .update({
          display_name: user.name,
          avatar_url: user.image,
          membership_tier: user.membership_tier,
          last_login_at: new Date().toISOString(),
        })
        .eq('email', user.email)
        .select('*')
        .single()

      return updatedUser || existingUser
    }
  } catch (error) {
    console.error('Error syncing user with database:', error)
    return null
  }
}

// Extend NextAuth types
declare module 'next-auth' {
  interface User {
    membership_tier: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      membership_tier: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    membership_tier: string
  }
}