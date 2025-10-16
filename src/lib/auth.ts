import { NextAuthOptions } from 'next-auth'
import { SupabaseAdapter } from '@auth/supabase-adapter'
import { supabase, supabaseAdmin } from './supabase'

// Custom Skool OAuth provider (will need to be configured based on Skool's actual OAuth implementation)
const SkoolProvider = {
  id: 'skool',
  name: 'Skool',
  type: 'oauth' as const,
  clientId: process.env.SKOOL_CLIENT_ID,
  clientSecret: process.env.SKOOL_CLIENT_SECRET,
  authorization: {
    url: 'https://www.skool.com/oauth/authorize', // This is hypothetical - needs real Skool OAuth endpoints
    params: {
      scope: 'read:user read:membership',
      response_type: 'code',
    },
  },
  token: 'https://www.skool.com/oauth/token', // Hypothetical
  userinfo: 'https://www.skool.com/api/me', // Hypothetical
  profile(profile: any) {
    return {
      id: profile.id,
      name: profile.display_name || profile.name,
      email: profile.email,
      image: profile.avatar_url,
      skool_user_id: profile.id,
      membership_tier: profile.membership_tier || 'basic',
    }
  },
}

export const authOptions: NextAuthOptions = {
  providers: [
    SkoolProvider,
    // Fallback for development - remove in production
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
          skool_user_id: 'dev-user-1',
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
      if (account?.provider === 'skool') {
        // Verify Skool membership is active
        // This would need to call Skool's API to verify membership status
        return true // For now, allow all Skool users
      }

      if (account?.provider === 'development') {
        return true // Allow development login
      }

      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.skool_user_id = user.skool_user_id
        token.membership_tier = user.membership_tier
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.skool_user_id = token.skool_user_id as string
        session.user.membership_tier = token.membership_tier as string

        // Try to get the actual UUID from the database with short timeout
        try {
          const dbUser = await Promise.race([
            syncUserWithDatabase({
              id: token.sub!,
              email: session.user.email,
              name: session.user.name,
              image: session.user.image,
              skool_user_id: token.skool_user_id as string,
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
    // Check if user exists in our database
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('skool_user_id', user.skool_user_id)
      .single()

    if (!existingUser) {
      // Create new user
      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({
          skool_user_id: user.skool_user_id,
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
          email: user.email,
          display_name: user.name,
          avatar_url: user.image,
          membership_tier: user.membership_tier,
          last_login_at: new Date().toISOString(),
        })
        .eq('skool_user_id', user.skool_user_id)
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
    skool_user_id: string
    membership_tier: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      skool_user_id: string
      membership_tier: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    skool_user_id: string
    membership_tier: string
  }
}