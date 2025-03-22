# database_fix.py - Run this script to diagnose and fix database issues

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime, timezone
import traceback

# Configuration
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
DATABASE_URL = os.environ.get('DATABASE_URL')

# Diagnostic function
def diagnose_database():
    """Check database connection and tables"""
    print("Starting database diagnostics...")
    
    # Check environment variables
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY environment variable is not set")
        print("This key is required to bypass Row Level Security")
        return False
        
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable is not set")
        print("This URL is required to connect to the database")
        return False
    
    # Test database connection
    try:
        conn = get_db_connection()
        print("✅ Successfully connected to database")
        
        with conn.cursor() as cursor:
            # Check if usage_tracking table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'usage_tracking'
                );
            """)
            
            exists = cursor.fetchone()['exists']
            
            if exists:
                print("✅ usage_tracking table exists")
                
                # Check structure
                cursor.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns
                    WHERE table_name = 'usage_tracking';
                """)
                
                columns = cursor.fetchall()
                column_names = [col['column_name'] for col in columns]
                
                required_columns = ['id', 'user_id', 'usage_date', 'routes_created', 'algorithm_runs']
                missing_columns = [col for col in required_columns if col not in column_names]
                
                if missing_columns:
                    print(f"❌ Missing columns in usage_tracking table: {', '.join(missing_columns)}")
                    print("Will need to create or alter table")
                else:
                    print("✅ usage_tracking table has all required columns")
                    
                # Check for RLS policies
                cursor.execute("""
                    SELECT tablename, policyname
                    FROM pg_policies
                    WHERE tablename = 'usage_tracking';
                """)
                
                policies = cursor.fetchall()
                policy_names = [pol['policyname'] for pol in policies]
                
                if policies:
                    print(f"ℹ️ Found RLS policies on usage_tracking: {', '.join(policy_names)}")
                else:
                    print("ℹ️ No RLS policies found on usage_tracking table")
                
            else:
                print("❌ usage_tracking table does not exist")
                print("Will need to create table")
            
            # Check if tracking_events table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'tracking_events'
                );
            """)
            
            exists = cursor.fetchone()['exists']
            
            if exists:
                print("✅ tracking_events table exists")
            else:
                print("ℹ️ tracking_events table does not exist")
                print("Will create table for improved tracking")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error connecting to database: {str(e)}")
        print(traceback.format_exc())
        return False

# Helper function to get a database connection
def get_db_connection():
    """Create database connection using service role credentials"""
    conn = psycopg2.connect(
        DATABASE_URL,
        password=SUPABASE_SERVICE_KEY,  # Override password with service key
        cursor_factory=RealDictCursor
    )
    return conn

# Function to fix database tables
def fix_database():
    """Create or fix the necessary database tables"""
    try:
        conn = get_db_connection()
        
        with conn.cursor() as cursor:
            # Check if usage_tracking table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'usage_tracking'
                );
            """)
            
            exists = cursor.fetchone()['exists']
            
            if not exists:
                print("Creating usage_tracking table...")
                
                # Create the usage_tracking table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS usage_tracking (
                        id SERIAL PRIMARY KEY,
                        user_id UUID NOT NULL,
                        usage_date DATE NOT NULL,
                        routes_created INTEGER DEFAULT 0,
                        algorithm_runs INTEGER DEFAULT 0,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(user_id, usage_date)
                    );
                    
                    -- Add comment to table
                    COMMENT ON TABLE usage_tracking IS 'Tracks user resource usage for limits and billing';
                """)
                
                print("✅ usage_tracking table created")
            else:
                # Check table structure and fix if needed
                cursor.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'usage_tracking';
                """)
                
                columns = cursor.fetchall()
                column_names = [col['column_name'] for col in columns]
                
                # Check for missing columns
                if 'routes_created' not in column_names:
                    print("Adding routes_created column...")
                    cursor.execute("ALTER TABLE usage_tracking ADD COLUMN routes_created INTEGER DEFAULT 0;")
                
                if 'algorithm_runs' not in column_names:
                    print("Adding algorithm_runs column...")
                    cursor.execute("ALTER TABLE usage_tracking ADD COLUMN algorithm_runs INTEGER DEFAULT 0;")
                
                if 'updated_at' not in column_names:
                    print("Adding updated_at column...")
                    cursor.execute("ALTER TABLE usage_tracking ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();")
                
                print("✅ usage_tracking table structure validated/fixed")
            
            # Check if tracking_events table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'tracking_events'
                );
            """)
            
            exists = cursor.fetchone()['exists']
            
            if not exists:
                print("Creating tracking_events table...")
                
                # Create the tracking_events table for more detailed event tracking
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tracking_events (
                        id SERIAL PRIMARY KEY,
                        user_id UUID NOT NULL,
                        event_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        event_data JSONB,
                        processed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        processed_at TIMESTAMPTZ,
                        UNIQUE(event_id)
                    );
                    
                    -- Add indexes for faster queries
                    CREATE INDEX IF NOT EXISTS idx_tracking_events_user_id ON tracking_events(user_id);
                    CREATE INDEX IF NOT EXISTS idx_tracking_events_event_type ON tracking_events(event_type);
                    CREATE INDEX IF NOT EXISTS idx_tracking_events_processed ON tracking_events(processed);
                    
                    -- Add comment to table
                    COMMENT ON TABLE tracking_events IS 'Detailed tracking of individual events for debugging and recovery';
                """)
                
                print("✅ tracking_events table created")
            
            # Create RPC functions for recording usage
            print("Creating/updating record_route_usage function...")
            cursor.execute("""
                CREATE OR REPLACE FUNCTION record_route_usage(p_user_id UUID)
                RETURNS BOOLEAN
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                DECLARE
                    today DATE := CURRENT_DATE;
                    existing_record RECORD;
                BEGIN
                    -- Check if record exists for today
                    SELECT * INTO existing_record
                    FROM usage_tracking
                    WHERE user_id = p_user_id AND usage_date = today;
                    
                    IF existing_record.id IS NOT NULL THEN
                        -- Update existing record
                        UPDATE usage_tracking
                        SET routes_created = COALESCE(routes_created, 0) + 1,
                            updated_at = NOW()
                        WHERE id = existing_record.id;
                    ELSE
                        -- Insert new record
                        INSERT INTO usage_tracking (user_id, usage_date, routes_created)
                        VALUES (p_user_id, today, 1);
                    END IF;
                    
                    RETURN TRUE;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Error in record_route_usage: %', SQLERRM;
                        RETURN FALSE;
                END;
                $$;
                
                -- Grant execute permission
                GRANT EXECUTE ON FUNCTION record_route_usage(UUID) TO authenticated;
                GRANT EXECUTE ON FUNCTION record_route_usage(UUID) TO anon;
            """)
            
            print("Creating/updating record_algorithm_run function...")
            cursor.execute("""
                CREATE OR REPLACE FUNCTION record_algorithm_run(p_user_id UUID)
                RETURNS BOOLEAN
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                DECLARE
                    today DATE := CURRENT_DATE;
                    existing_record RECORD;
                BEGIN
                    -- Check if record exists for today
                    SELECT * INTO existing_record
                    FROM usage_tracking
                    WHERE user_id = p_user_id AND usage_date = today;
                    
                    IF existing_record.id IS NOT NULL THEN
                        -- Update existing record
                        UPDATE usage_tracking
                        SET algorithm_runs = COALESCE(algorithm_runs, 0) + 1,
                            updated_at = NOW()
                        WHERE id = existing_record.id;
                    ELSE
                        -- Insert new record
                        INSERT INTO usage_tracking (user_id, usage_date, algorithm_runs)
                        VALUES (p_user_id, today, 1);
                    END IF;
                    
                    RETURN TRUE;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Error in record_algorithm_run: %', SQLERRM;
                        RETURN FALSE;
                END;
                $$;
                
                -- Grant execute permission
                GRANT EXECUTE ON FUNCTION record_algorithm_run(UUID) TO authenticated;
                GRANT EXECUTE ON FUNCTION record_algorithm_run(UUID) TO anon;
            """)
            
            # Create RLS policies if needed
            print("Setting up proper RLS policies...")
            
            # First ensure RLS is enabled
            cursor.execute("ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;")
            cursor.execute("ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;")
            
            # Set up policies for usage_tracking
            cursor.execute("""
                -- Drop existing policies if they exist
                DROP POLICY IF EXISTS usage_tracking_insert_policy ON usage_tracking;
                DROP POLICY IF EXISTS usage_tracking_select_policy ON usage_tracking;
                DROP POLICY IF EXISTS usage_tracking_update_policy ON usage_tracking;
                
                -- Create policies
                CREATE POLICY usage_tracking_insert_policy ON usage_tracking
                FOR INSERT
                WITH CHECK (auth.uid() = user_id);
                
                CREATE POLICY usage_tracking_select_policy ON usage_tracking
                FOR SELECT
                USING (auth.uid() = user_id);
                
                CREATE POLICY usage_tracking_update_policy ON usage_tracking
                FOR UPDATE
                USING (auth.uid() = user_id);
            """)
            
            # Set up policies for tracking_events
            cursor.execute("""
                -- Drop existing policies if they exist
                DROP POLICY IF EXISTS tracking_events_insert_policy ON tracking_events;
                DROP POLICY IF EXISTS tracking_events_select_policy ON tracking_events;
                
                -- Create policies
                CREATE POLICY tracking_events_insert_policy ON tracking_events
                FOR INSERT
                WITH CHECK (auth.uid() = user_id);
                
                CREATE POLICY tracking_events_select_policy ON tracking_events
                FOR SELECT
                USING (auth.uid() = user_id);
            """)
            
            print("✅ RLS policies set up successfully")
            
            # Commit all changes
            conn.commit()
            print("✅ All database fixes applied successfully")
            
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error fixing database: {str(e)}")
        print(traceback.format_exc())
        return False

# Main function
def main():
    print("===== Database Diagnostic and Fix Tool =====")
    
    # Run diagnostics first
    print("\n[STEP 1] Running diagnostics...")
    diagnostics_success = diagnose_database()
    
    if not diagnostics_success:
        print("\n❌ Diagnostics failed. Please fix the issues before continuing.")
        return
    
    # Ask user if they want to apply fixes
    print("\n[STEP 2] Ready to apply fixes")
    response = input("Do you want to apply database fixes? (y/n): ").strip().lower()
    
    if response != 'y':
        print("Operation cancelled. No changes were made.")
        return
    
    # Apply fixes
    print("\n[STEP 3] Applying fixes...")
    fix_success = fix_database()
    
    if fix_success:
        print("\n✅ Database fixes completed successfully!")
        print("The system should now be able to track usage properly.")
    else:
        print("\n❌ Some fixes could not be applied. Please review the errors above.")

# Run the script
if __name__ == "__main__":
    main()