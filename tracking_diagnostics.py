# Add this to app.py or create a new file named tracking_diagnostics.py

from flask import Blueprint, jsonify, request, session, current_app
from functools import wraps
import json
import psycopg2
import os
import traceback
from datetime import datetime, timezone
from auth_middleware import login_required, admin_required
from db_connection import get_db_connection

# Create Blueprint
diagnostics_bp = Blueprint('diagnostics', __name__)

@diagnostics_bp.route('/diagnostics/tracking')
@login_required
@admin_required  # Only allow admins to access this
def tracking_diagnostics():
    """Diagnostic endpoint to help debug usage tracking issues"""
    user_id = session['user']['id']
    
    # Initialize results dictionary
    results = {
        'user': user_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'tests': {},
        'env_vars': {},
        'session': {},
        'database_info': {}
    }
    
    # Check environment variables
    env_vars = [
        'SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_KEY', 
        'DATABASE_URL', 'SESSION_SECRET'
    ]
    
    for var in env_vars:
        value = os.environ.get(var)
        results['env_vars'][var] = {
            'exists': value is not None,
            'length': len(value) if value else 0,
            'preview': value[:5] + '...' if value and len(value) > 5 else None
        }
    
    # Check session
    for key in session.keys():
        if key == 'user':
            # Only show user ID, not full user data
            results['session'][key] = {
                'type': str(type(session[key])),
                'keys': list(session[key].keys()) if isinstance(session[key], dict) else None,
                'id_exists': 'id' in session[key] if isinstance(session[key], dict) else False
            }
        else:
            # For other keys, just show type and length
            results['session'][key] = {
                'type': str(type(session[key])),
                'length': len(session[key]) if hasattr(session[key], '__len__') else 'N/A'
            }
    
    # Test database connection
    try:
        # Test with regular connection
        conn = get_db_connection(use_service_role=False)
        
        with conn.cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'usage_tracking'
                );
            """)
            table_exists = cursor.fetchone()['exists']
            
            results['database_info']['regular_connection'] = {
                'success': True,
                'table_exists': table_exists
            }
            
            if table_exists:
                # Check row count
                cursor.execute("SELECT COUNT(*) as count FROM usage_tracking")
                count = cursor.fetchone()['count']
                results['database_info']['regular_connection']['row_count'] = count
                
                # Check user's records
                cursor.execute(
                    "SELECT COUNT(*) as count FROM usage_tracking WHERE user_id = %s",
                    (user_id,)
                )
                user_count = cursor.fetchone()['count']
                results['database_info']['regular_connection']['user_records'] = user_count
        
        conn.close()
    except Exception as e:
        results['database_info']['regular_connection'] = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
    
    # Test with service role
    try:
        conn = get_db_connection(use_service_role=True)
        
        with conn.cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'usage_tracking'
                );
            """)
            table_exists = cursor.fetchone()['exists']
            
            results['database_info']['service_role_connection'] = {
                'success': True,
                'table_exists': table_exists
            }
            
            if table_exists:
                # Check row count
                cursor.execute("SELECT COUNT(*) as count FROM usage_tracking")
                count = cursor.fetchone()['count']
                results['database_info']['service_role_connection']['row_count'] = count
                
                # Check user's records
                cursor.execute(
                    "SELECT COUNT(*) as count FROM usage_tracking WHERE user_id = %s",
                    (user_id,)
                )
                user_count = cursor.fetchone()['count']
                results['database_info']['service_role_connection']['user_records'] = user_count
                
                # Check for any records in the last 24 hours
                cursor.execute("""
                    SELECT COUNT(*) as count 
                    FROM usage_tracking 
                    WHERE created_at > NOW() - INTERVAL '24 hours'
                """)
                recent_count = cursor.fetchone()['count']
                results['database_info']['service_role_connection']['recent_records'] = recent_count
        
        conn.close()
    except Exception as e:
        results['database_info']['service_role_connection'] = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
    
    # Test RPC functions via Supabase
    try:
        # Import here to avoid circular imports
        from app import supabase
        
        # Test record_route_usage RPC
        response = supabase.rpc('record_route_usage', {'p_user_id': user_id}).execute()
        
        results['tests']['rpc_route_usage'] = {
            'success': True,
            'response': str(response),
            'data': response.data if hasattr(response, 'data') else None
        }
    except Exception as e:
        results['tests']['rpc_route_usage'] = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
    
    try:
        # Test record_algorithm_run RPC
        response = supabase.rpc('record_algorithm_run', {'p_user_id': user_id}).execute()
        
        results['tests']['rpc_algorithm_run'] = {
            'success': True,
            'response': str(response),
            'data': response.data if hasattr(response, 'data') else None
        }
    except Exception as e:
        results['tests']['rpc_algorithm_run'] = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
    
    # Test direct table insert
    try:
        from app import supabase
        
        # Get today's date
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Test insert
        response = supabase.table('usage_tracking').insert({
            'user_id': user_id,
            'usage_date': today,
            'routes_created': 0,
            'algorithm_runs': 0,
            'test_field': 'diagnostics_test'
        }).execute()
        
        results['tests']['direct_insert'] = {
            'success': True,
            'response': str(response),
            'data': response.data if hasattr(response, 'data') else None
        }
    except Exception as e:
        results['tests']['direct_insert'] = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
    
    # Test new enhanced usage tracker
    try:
        from db_tracking import get_usage_tracker
        
        tracker = get_usage_tracker()
        
        # Test get_usage_stats
        stats_result = tracker.get_usage_stats(user_id)
        
        results['tests']['enhanced_get_stats'] = {
            'success': stats_result.get('success', False),
            'method': stats_result.get('method'),
            'routes_created': stats_result.get('routes_created'),
            'algorithm_runs': stats_result.get('algorithm_runs')
        }
        
        # Test record_route_creation with tracking disabled
        test_result = tracker.record_route_creation(user_id)
        
        results['tests']['enhanced_record_route'] = {
            'success': test_result.get('success', False),
            'method': test_result.get('method'),
            'error': test_result.get('error')
        }
    except Exception as e:
        results['tests']['enhanced_tracker'] = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
    
    return jsonify(results)

# Register the blueprint in app.py with:
# app.register_blueprint(diagnostics_bp)