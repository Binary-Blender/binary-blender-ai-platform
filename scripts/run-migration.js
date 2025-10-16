const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function runMigration() {
  console.log('🚀 Starting Asset Repository migration...')

  // Extract database connection details from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  // Parse Supabase URL to get database connection info
  const url = new URL(supabaseUrl)
  const projectId = url.hostname.split('.')[0]

  const client = new Client({
    host: `${projectId}.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || serviceRoleKey,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('✅ Connected to Supabase PostgreSQL database')

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../sql/asset-repository-migration.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration SQL loaded, executing...')

    // Execute the entire migration as one transaction
    await client.query('BEGIN')

    try {
      await client.query(migrationSQL)
      await client.query('COMMIT')

      console.log('✅ Migration completed successfully!')
      console.log('📊 Created tables: projects, folders, assets, asset_relationships, asset_versions, prompts, experiments, model_comparisons, workflow_patterns')
      console.log('👁️ Created views: project_summaries, asset_lineage')
      console.log('⚡ Created functions: update_updated_at_column, create_default_user_data')
      console.log('')
      console.log('🎉 Asset Repository is ready to use!')
      console.log('✨ Visit /assets, /prompts, or /experiments to start using the new features')

    } catch (queryError) {
      await client.query('ROLLBACK')
      console.error('❌ Migration failed:', queryError.message)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Connection error:', error.message)
    console.log('')
    console.log('💡 Alternative approach: You can run the migration manually:')
    console.log('   1. Open your Supabase dashboard')
    console.log('   2. Go to the SQL Editor')
    console.log('   3. Copy and paste the contents of sql/asset-repository-migration.sql')
    console.log('   4. Run the query')
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()