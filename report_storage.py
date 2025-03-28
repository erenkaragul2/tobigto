# Enhanced report_storage.py for better error handling and debugging
import base64
import io
import json
import uuid
import traceback
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, send_file, render_template, g, abort, current_app, redirect, url_for, flash
from auth_middleware import login_required
from db_connection import with_db_connection, get_db_connection
from sqlalchemy import desc  # Add this import for the 'desc' function

# Create a blueprint for report storage routes
report_bp = Blueprint('report', __name__)

@report_bp.route('/save_report', methods=['POST'])
@login_required
def save_report():
    """
    Save a PDF report to Supabase with enhanced error handling and debugging
    
    Expects JSON with:
    - pdf_data: PDF content as base64 string
    - metadata: Report metadata
    """
    response_data = {
        'success': False,
        'error': None,
        'debug_info': {},
        'auth_status': 'unknown'
    }
    
    try:
        # Get user ID from session
        if 'user' not in session:
            response_data['error'] = 'User not authenticated'
            response_data['auth_status'] = 'no_session'
            return jsonify(response_data), 401
            
        user_id = session['user']['id']
        response_data['debug_info']['user_id'] = user_id
        response_data['auth_status'] = 'session_found'
        
        # Get request data
        data = request.get_json()
        
        if not data:
            response_data['error'] = 'Missing request data'
            return jsonify(response_data), 400
        
        # Validate required fields
        if 'pdf_data' not in data:
            response_data['error'] = 'Missing PDF data'
            return jsonify(response_data), 400
        
        # Extract PDF data
        pdf_data = data['pdf_data']
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data[28:]
        elif pdf_data.startswith('data:'):
            # Remove any other data URL prefix
            pdf_data = pdf_data.split(',', 1)[1]
        
        # Extract metadata
        metadata = data.get('metadata', {})
        response_data['debug_info']['metadata_keys'] = list(metadata.keys())
        
        # Generate a unique ID for the report
        report_id = str(uuid.uuid4())
        
        # Create timestamp
        current_time = datetime.now(timezone.utc)
        
        # Create the report object
        report_data = {
            'id': report_id,
            'user_id': user_id,
            'report_name': f"Route Optimization Report - {current_time.strftime('%Y-%m-%d %H:%M')}",
            'created_at': current_time.isoformat(),
            'pdf_data': pdf_data,
            'route_count': metadata.get('route_count', 0),
            'total_distance': metadata.get('total_distance', 0),
            'metadata': json.dumps(metadata),
            'job_id': metadata.get('job_id', None)
        }
        
        # Get Supabase client and token info
        from app import supabase
        
        # Try to get user token
        user_token = None
        if 'user' in session and 'access_token' in session['user']:
            user_token = session['user']['access_token']
            response_data['debug_info']['token_available'] = True
        else:
            response_data['debug_info']['token_available'] = False
        
        # Try direct insert first using the client with the user's token
        success = False
        
        try:
            if user_token:
                # Create a client with the user's token for proper RLS enforcement
                from supabase import create_client
                supabase_url = current_app.config.get('SUPABASE_URL') or current_app.config.get('SUPABASE_API_URL')
                supabase_key = current_app.config.get('SUPABASE_KEY') or current_app.config.get('SUPABASE_ANON_KEY')
                
                if supabase_url and supabase_key:
                    user_client = create_client(supabase_url, supabase_key)
                    
                    # Set auth token
                    user_client.auth.set_session(user_token, None)
                    
                    # Insert with user's token
                    response = user_client.table('route_reports').insert(report_data).execute()
                    
                    if hasattr(response, 'data') and len(response.data) > 0:
                        success = True
                        response_data['method'] = 'user_token'
            
            # If that didn't work, try with the app's client
            if not success:
                response = supabase.table('route_reports').insert(report_data).execute()
                
                if hasattr(response, 'data') and len(response.data) > 0:
                    success = True
                    response_data['method'] = 'app_client'
            
            # If still no success, try service role approach
            if not success and 'db_connection' in globals():
                # Use db connection with service role
                conn = get_db_connection(use_service_role=True)
                
                with conn.cursor() as cursor:
                    # Insert using SQL directly
                    cursor.execute("""
                        INSERT INTO route_reports 
                        (id, user_id, report_name, created_at, pdf_data, route_count, total_distance, metadata, job_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        report_id,
                        user_id,
                        f"Route Optimization Report - {current_time.strftime('%Y-%m-%d %H:%M')}",
                        current_time,
                        pdf_data,
                        metadata.get('route_count', 0),
                        metadata.get('total_distance', 0),
                        json.dumps(metadata),
                        metadata.get('job_id', None)
                    ))
                    
                    result = cursor.fetchone()
                    conn.commit()
                    
                    if result and 'id' in result:
                        success = True
                        response_data['method'] = 'service_role_db'
                
                conn.close()
        
        except Exception as insert_error:
            response_data['debug_info']['insert_error'] = str(insert_error)
            response_data['debug_info']['insert_traceback'] = traceback.format_exc()
            
            # Try RPC function as a last resort
            try:
                rpc_response = supabase.rpc(
                    'insert_route_report',
                    {
                        'p_id': report_id,
                        'p_user_id': user_id,
                        'p_report_name': f"Route Optimization Report - {current_time.strftime('%Y-%m-%d %H:%M')}",
                        'p_created_at': current_time.isoformat(),
                        'p_pdf_data': pdf_data,
                        'p_route_count': metadata.get('route_count', 0),
                        'p_total_distance': metadata.get('total_distance', 0),
                        'p_metadata': metadata,
                        'p_job_id': metadata.get('job_id', None)
                    }
                ).execute()
                
                if rpc_response and hasattr(rpc_response, 'data'):
                    success = True
                    response_data['method'] = 'rpc_function'
            except Exception as rpc_error:
                response_data['debug_info']['rpc_error'] = str(rpc_error)
        
        if success:
            response_data['success'] = True
            response_data['message'] = 'Report saved successfully'
            response_data['report_id'] = report_id
            return jsonify(response_data)
        else:
            response_data['error'] = 'Failed to save report to database after multiple attempts'
            return jsonify(response_data), 500
            
    except Exception as e:
        response_data['error'] = f'Error saving report: {str(e)}'
        response_data['debug_info']['traceback'] = traceback.format_exc()
        
        # Log the full error
        current_app.logger.error(f"Error saving report: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        
        return jsonify(response_data), 500

@report_bp.route('/delete_report/<report_id>', methods=['POST'])
@login_required
def delete_report(report_id):
    """
    Delete a saved report
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # First try with Supabase client
        try:
            from app import supabase
            
            # Check if report exists and belongs to user
            response = supabase.table('route_reports').select('id').eq('id', report_id).eq('user_id', user_id).execute()
            
            if not hasattr(response, 'data') or not response.data:
                return jsonify({
                    'success': False,
                    'error': 'Report not found or you do not have permission to delete it'
                }), 404
            
            # Delete the report
            delete_response = supabase.table('route_reports').delete().eq('id', report_id).eq('user_id', user_id).execute()
            
            return jsonify({
                'success': True,
                'message': 'Report deleted successfully'
            })
            
        except Exception as e:
            current_app.logger.error(f"Error deleting report with Supabase: {str(e)}")
            
            # Try with direct database connection
            try:
                conn = get_db_connection(use_service_role=True)
                with conn.cursor() as cursor:
                    # Check if report exists and belongs to user
                    cursor.execute("""
                        SELECT id FROM route_reports
                        WHERE id = %s AND user_id = %s
                    """, (report_id, user_id))
                    
                    result = cursor.fetchone()
                    if not result:
                        conn.close()
                        return jsonify({
                            'success': False,
                            'error': 'Report not found or you do not have permission to delete it'
                        }), 404
                    
                    # Delete the report
                    cursor.execute("""
                        DELETE FROM route_reports
                        WHERE id = %s AND user_id = %s
                    """, (report_id, user_id))
                    
                    conn.commit()
                conn.close()
                
                return jsonify({
                    'success': True,
                    'message': 'Report deleted successfully'
                })
                
            except Exception as db_e:
                current_app.logger.error(f"Error deleting report from database: {str(db_e)}")
                return jsonify({
                    'success': False,
                    'error': f'Database error: {str(db_e)}'
                }), 500
                
    except Exception as e:
        current_app.logger.error(f"Error in delete_report: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
@report_bp.route('/view_report/<report_id>', methods=['GET'])
@login_required
def view_report(report_id):
    """
    View a saved report
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Get Supabase client from app
        from app import supabase
        
        # Try to get access token
        access_token = None
        if 'user' in session and 'access_token' in session['user']:
            access_token = session['user']['access_token']
        
        # Create a function to fetch the report with different methods
        def fetch_report():
            # Method 1: Standard query with app client
            try:
                response = supabase.table('route_reports').select('*').eq('id', report_id).eq('user_id', user_id).execute()
                if hasattr(response, 'data') and response.data:
                    return response.data[0]
            except Exception as e:
                current_app.logger.error(f"Method 1 error: {str(e)}")
            
            # Method 2: Try with user's access token
            if access_token:
                try:
                    from supabase import create_client
                    supabase_url = current_app.config.get('SUPABASE_URL') or current_app.config.get('SUPABASE_API_URL')
                    supabase_key = current_app.config.get('SUPABASE_KEY') or current_app.config.get('SUPABASE_ANON_KEY')
                    
                    if supabase_url and supabase_key:
                        user_client = create_client(supabase_url, supabase_key)
                        user_client.auth.set_session(access_token, None)
                        
                        response = user_client.table('route_reports').select('*').eq('id', report_id).eq('user_id', user_id).execute()
                        if hasattr(response, 'data') and response.data:
                            return response.data[0]
                except Exception as e:
                    current_app.logger.error(f"Method 2 error: {str(e)}")
            
            # Method 3: Use RPC function
            try:
                response = supabase.rpc(
                    'get_user_report',
                    {'p_report_id': report_id, 'p_user_id': user_id}
                ).execute()
                
                if hasattr(response, 'data') and response.data:
                    return response.data[0] if isinstance(response.data, list) else response.data
            except Exception as e:
                current_app.logger.error(f"Method 3 error: {str(e)}")
            
            # Method 4: Use direct database connection with service role
            try:
                conn = get_db_connection(use_service_role=True)
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT * FROM route_reports
                        WHERE id = %s AND user_id = %s
                    """, (report_id, user_id))
                    
                    report = cursor.fetchone()
                    conn.close()
                    
                    if report:
                        return report
            except Exception as e:
                current_app.logger.error(f"Method 4 error: {str(e)}")
            
            return None
        
        # Try to fetch the report
        report = fetch_report()
        
        if not report:
            flash('Report not found or you do not have permission to view it', 'danger')
            return redirect(url_for('report.my_reports'))
        
        # Get download flag
        download = request.args.get('download', 'false').lower() == 'true'
        
        # Send PDF file
        pdf_data = report.get('pdf_data')
        pdf_bytes = base64.b64decode(pdf_data)
        
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=download,
            download_name=f"route_report_{report_id}.pdf"
        )
            
    except Exception as e:
        current_app.logger.error(f"Error viewing report: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        
        flash(f"Error viewing report: {str(e)}", 'danger')
        return redirect(url_for('report.my_reports'))


# Helper function to handle RLS bypass
@report_bp.route('/check_reports_access', methods=['GET'])
@login_required
def check_reports_access():
    """
    Debug endpoint to check reports access
    """
    if 'user' not in session:
        return jsonify({
            'success': False,
            'error': 'Not authenticated'
        }), 401
    
    user_id = session['user']['id']
    results = {
        'user_id': user_id,
        'session_token': bool(session.get('user', {}).get('access_token')),
        'methods': {}
    }
    
    # Method 1: Standard query
    try:
        from app import supabase
        response = supabase.table('route_reports').select('count').eq('user_id', user_id).execute()
        
        results['methods']['standard'] = {
            'success': True,
            'count': len(response.data) if hasattr(response, 'data') else 0
        }
    except Exception as e:
        results['methods']['standard'] = {
            'success': False,
            'error': str(e)
        }
    
    # Method 2: With user token
    if 'user' in session and 'access_token' in session['user']:
        try:
            from supabase import create_client
            supabase_url = current_app.config.get('SUPABASE_URL')
            supabase_key = current_app.config.get('SUPABASE_KEY')
            
            user_client = create_client(supabase_url, supabase_key)
            user_client.auth.set_session(session['user']['access_token'], None)
            
            response = user_client.table('route_reports').select('count').eq('user_id', user_id).execute()
            
            results['methods']['user_token'] = {
                'success': True,
                'count': len(response.data) if hasattr(response, 'data') else 0
            }
        except Exception as e:
            results['methods']['user_token'] = {
                'success': False,
                'error': str(e)
            }
    
    # Method 3: RPC
    try:
        from app import supabase
        response = supabase.rpc('get_user_reports_count', {'p_user_id': user_id}).execute()
        
        results['methods']['rpc'] = {
            'success': True,
            'response': str(response)
        }
    except Exception as e:
        results['methods']['rpc'] = {
            'success': False,
            'error': str(e)
        }
    
    # Method 4: Direct DB
    try:
        conn = get_db_connection(use_service_role=True)
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM route_reports
                WHERE user_id = %s
            """, (user_id,))
            
            count = cursor.fetchone()
            conn.close()
            
            results['methods']['direct_db'] = {
                'success': True,
                'count': count['count'] if count else 0
            }
    except Exception as e:
        results['methods']['direct_db'] = {
            'success': False,
            'error': str(e)
        }
    
    return jsonify(results)


# Function to initialize database with RPC functions for reports
def init_rpc_functions():
    """
    Initialize RPC functions for report storage
    """
    try:
        conn = get_db_connection(use_service_role=True)
        with conn.cursor() as cursor:
            # Function to insert a report
            cursor.execute("""
            CREATE OR REPLACE FUNCTION insert_route_report(
                p_id UUID,
                p_user_id UUID,
                p_report_name TEXT,
                p_created_at TIMESTAMPTZ,
                p_pdf_data TEXT,
                p_route_count INTEGER,
                p_total_distance FLOAT,
                p_metadata JSONB,
                p_job_id TEXT
            ) RETURNS UUID
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_report_id UUID;
            BEGIN
                INSERT INTO route_reports (
                    id, user_id, report_name, created_at, pdf_data, 
                    route_count, total_distance, metadata, job_id
                ) VALUES (
                    p_id, p_user_id, p_report_name, p_created_at, p_pdf_data,
                    p_route_count, p_total_distance, p_metadata, p_job_id
                )
                RETURNING id INTO v_report_id;
                
                RETURN v_report_id;
            END;
            $$;
            """)
            
            # Function to get a user's report
            cursor.execute("""
            CREATE OR REPLACE FUNCTION get_user_report(
                p_report_id UUID,
                p_user_id UUID
            ) RETURNS SETOF route_reports
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY
                SELECT *
                FROM route_reports
                WHERE id = p_report_id AND user_id = p_user_id;
            END;
            $$;
            """)
            
            # Function to get a user's reports count
            cursor.execute("""
            CREATE OR REPLACE FUNCTION get_user_reports_count(
                p_user_id UUID
            ) RETURNS INTEGER
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_count INTEGER;
            BEGIN
                SELECT COUNT(*)
                INTO v_count
                FROM route_reports
                WHERE user_id = p_user_id;
                
                RETURN v_count;
            END;
            $$;
            """)
            
            conn.commit()
            print("RPC functions for report storage created successfully")
    except Exception as e:
        print(f"Error creating RPC functions: {str(e)}")
    finally:
        if conn:
            conn.close()
@report_bp.route('/my_reports')
@login_required
def my_reports():
    """
    View all saved reports for the current user
    """
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Get reports from database
        reports = []
        
        # First try with Supabase client
        try:
            from app import supabase
            response = supabase.table('route_reports').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
            
            if hasattr(response, 'data') and response.data:
                reports = response.data
        except Exception as e:
            current_app.logger.error(f"Error getting reports from Supabase: {str(e)}")
            
            # Try with direct database connection
            try:
                conn = get_db_connection(use_service_role=True)
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT * FROM route_reports
                        WHERE user_id = %s
                        ORDER BY created_at DESC
                    """, (user_id,))
                    
                    reports = cursor.fetchall()
                conn.close()
            except Exception as db_e:
                current_app.logger.error(f"Error getting reports from database: {str(db_e)}")
        
        # Render template with reports
        return render_template('my_reports.html', reports=reports)
            
    except Exception as e:
        current_app.logger.error(f"Error in my_reports: {str(e)}")
        flash(f"Error loading reports: {str(e)}", 'danger')
        return redirect(url_for('dashboard'))

# Enhanced initiation function that ensures everything is set up
def init_reports_table():
    """
    Enhanced function to initialize the route_reports table and related functions
    """
    try:
        # First, check if table exists
        conn = get_db_connection(use_service_role=True)
        table_exists = False
        
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'route_reports'
                    );
                """)
                table_exists = cursor.fetchone()['exists']
                
                # Create table if it doesn't exist
                if not table_exists:
                    cursor.execute("""
                    CREATE TABLE route_reports (
                        id UUID PRIMARY KEY,
                        user_id UUID NOT NULL,
                        report_name TEXT NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        pdf_data TEXT NOT NULL,
                        route_count INTEGER,
                        total_distance FLOAT,
                        metadata JSONB,
                        job_id TEXT
                    );
                    
                    -- Add index for faster queries by user
                    CREATE INDEX idx_route_reports_user_id ON route_reports(user_id);
                    
                    -- Enable Row Level Security
                    ALTER TABLE route_reports ENABLE ROW LEVEL SECURITY;
                    
                    -- Allow users to see only their own reports
                    CREATE POLICY route_reports_user_select ON route_reports
                        FOR SELECT USING (auth.uid() = user_id);
                    
                    -- Allow users to insert their own reports
                    CREATE POLICY route_reports_user_insert ON route_reports
                        FOR INSERT WITH CHECK (auth.uid() = user_id);
                    
                    -- Allow users to delete their own reports
                    CREATE POLICY route_reports_user_delete ON route_reports
                        FOR DELETE USING (auth.uid() = user_id);
                    """)
                    
                    conn.commit()
                    print("Created route_reports table with RLS policies")
                else:
                    print("route_reports table already exists")
        finally:
            conn.close()
        
        # Initialize RPC functions
        init_rpc_functions()
        
        return True
    except Exception as e:
        print(f"Error in init_reports_table: {str(e)}")
        return False