# db_tracking.py - Create this new file in your project directory

import json
import logging
from datetime import datetime, timezone
from flask import session, current_app, g, request, jsonify
from db_connection import get_db_connection

# Set up logger
logger = logging.getLogger(__name__)

class UsageTracker:
    """Enhanced usage tracking with multiple fallback mechanisms"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    def record_route_creation(self, user_id):
        """
        Record a route creation with multiple fallback methods
        
        Args:
            user_id: The user ID
            
        Returns:
            dict: Result with success status and details
        """
        if not user_id:
            logger.error("Cannot record route usage: Missing user_id")
            return {'success': False, 'error': 'Missing user_id'}
        
        methods_tried = []
        
        # Store tracking info in session to recover failed attempts
        tracking_info = {
            'user_id': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': 'route_creation',
            'client_ip': request.remote_addr if request else None,
            'user_agent': request.user_agent.string if request and request.user_agent else None
        }
        
        # Method 1: Try RPC function first (fastest)
        try:
            logger.info(f"Attempting to record route usage via RPC for user {user_id}")
            response = self.supabase.rpc(
                'record_route_usage',
                {'p_user_id': user_id}
            ).execute()
            
            methods_tried.append('rpc')
            
            # Check for successful response
            if response and hasattr(response, 'data') and response.data is True:
                logger.info(f"Successfully recorded route usage via RPC for user {user_id}")
                return {'success': True, 'method': 'rpc'}
            else:
                logger.warning(f"RPC method returned unexpected response: {response}")
        except Exception as e:
            logger.error(f"RPC method failed: {str(e)}")
        
        # Method 2: Try direct table insert
        try:
            logger.info(f"Attempting direct table insert for user {user_id}")
            
            # Get today's date in UTC
            today = datetime.now(timezone.utc).date().isoformat()
            
            # First check if a record exists for today
            response = self.supabase.table('usage_tracking').select('id, routes_created') \
                .eq('user_id', user_id) \
                .eq('usage_date', today) \
                .execute()
                
            methods_tried.append('direct_query')
                
            existing_record = None
            if response and hasattr(response, 'data') and len(response.data) > 0:
                existing_record = response.data[0]
                
            if existing_record:
                # Update existing record
                record_id = existing_record['id']
                current_count = existing_record.get('routes_created', 0) or 0
                
                update_response = self.supabase.table('usage_tracking') \
                    .update({'routes_created': current_count + 1}) \
                    .eq('id', record_id) \
                    .execute()
                    
                methods_tried.append('direct_update')
                
                if update_response and hasattr(update_response, 'data'):
                    logger.info(f"Successfully updated route usage via direct update for user {user_id}")
                    return {'success': True, 'method': 'direct_update'}
            else:
                # Insert new record
                insert_response = self.supabase.table('usage_tracking').insert({
                    'user_id': user_id,
                    'usage_date': today,
                    'routes_created': 1,
                    'algorithm_runs': 0
                }).execute()
                
                methods_tried.append('direct_insert')
                
                if insert_response and hasattr(insert_response, 'data'):
                    logger.info(f"Successfully recorded route usage via direct insert for user {user_id}")
                    return {'success': True, 'method': 'direct_insert'}
        except Exception as e:
            logger.error(f"Direct table access failed: {str(e)}")
        
        # Method 3: Use service role connection (this should work even with RLS)
        try:
            logger.info(f"Attempting service role connection for user {user_id}")
            
            # Get direct DB connection with service role
            conn = get_db_connection(use_service_role=True)
            
            try:
                with conn.cursor() as cursor:
                    # Check if record exists for today
                    today = datetime.now(timezone.utc).date()
                    
                    cursor.execute(
                        """
                        SELECT id, routes_created FROM usage_tracking 
                        WHERE user_id = %s AND usage_date = %s
                        """, 
                        (user_id, today)
                    )
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Update existing record
                        current_count = existing['routes_created'] or 0
                        cursor.execute(
                            """
                            UPDATE usage_tracking 
                            SET routes_created = %s, updated_at = NOW()
                            WHERE id = %s
                            RETURNING id
                            """,
                            (current_count + 1, existing['id'])
                        )
                    else:
                        # Insert new record
                        cursor.execute(
                            """
                            INSERT INTO usage_tracking 
                            (user_id, usage_date, routes_created, algorithm_runs) 
                            VALUES (%s, %s, %s, %s)
                            RETURNING id
                            """,
                            (user_id, today, 1, 0)
                        )
                        
                    result = cursor.fetchone()
                    conn.commit()
                    
                    methods_tried.append('service_role')
                    
                    if result and 'id' in result:
                        logger.info(f"Successfully recorded route usage via service role for user {user_id}")
                        return {'success': True, 'method': 'service_role', 'id': result['id']}
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"Service role connection failed: {str(e)}")
        
        # All methods failed, store in session for later recovery
        if 'pending_usage_records' not in session:
            session['pending_usage_records'] = []
            
        tracking_info['methods_tried'] = methods_tried
        session['pending_usage_records'].append(tracking_info)
        session.modified = True
        
        logger.warning(f"All tracking methods failed for user {user_id}. Stored in session for recovery.")
        return {
            'success': False, 
            'error': 'All tracking methods failed',
            'methods_tried': methods_tried,
            'recovery': 'Stored in session for later recovery'
        }
    
    def record_algorithm_run(self, user_id):
        """
        Record an algorithm run with multiple fallback methods
        
        Args:
            user_id: The user ID
            
        Returns:
            dict: Result with success status and details
        """
        if not user_id:
            logger.error("Cannot record algorithm run: Missing user_id")
            return {'success': False, 'error': 'Missing user_id'}
        
        methods_tried = []
        
        # Try RPC function first
        try:
            logger.info(f"Attempting to record algorithm run via RPC for user {user_id}")
            response = self.supabase.rpc(
                'record_algorithm_run',
                {'p_user_id': user_id}
            ).execute()
            
            methods_tried.append('rpc')
            
            # Check for successful response
            if response and hasattr(response, 'data') and response.data is True:
                logger.info(f"Successfully recorded algorithm run via RPC for user {user_id}")
                return {'success': True, 'method': 'rpc'}
        except Exception as e:
            logger.error(f"Algorithm run RPC failed: {str(e)}")
        
        # Method 2: Try direct table insert/update for algorithm runs
        try:
            logger.info(f"Attempting direct table access for algorithm run for user {user_id}")
            
            # Get today's date in UTC
            today = datetime.now(timezone.utc).date().isoformat()
            
            # First check if a record exists for today
            response = self.supabase.table('usage_tracking').select('id, algorithm_runs') \
                .eq('user_id', user_id) \
                .eq('usage_date', today) \
                .execute()
                
            methods_tried.append('direct_query')
                
            existing_record = None
            if response and hasattr(response, 'data') and len(response.data) > 0:
                existing_record = response.data[0]
                
            if existing_record:
                # Update existing record
                record_id = existing_record['id']
                current_count = existing_record.get('algorithm_runs', 0) or 0
                
                update_response = self.supabase.table('usage_tracking') \
                    .update({'algorithm_runs': current_count + 1}) \
                    .eq('id', record_id) \
                    .execute()
                    
                methods_tried.append('direct_update')
                
                if update_response and hasattr(update_response, 'data'):
                    logger.info(f"Successfully updated algorithm run via direct update for user {user_id}")
                    return {'success': True, 'method': 'direct_update'}
            else:
                # Insert new record
                insert_response = self.supabase.table('usage_tracking').insert({
                    'user_id': user_id,
                    'usage_date': today,
                    'routes_created': 0,
                    'algorithm_runs': 1
                }).execute()
                
                methods_tried.append('direct_insert')
                
                if insert_response and hasattr(insert_response, 'data'):
                    logger.info(f"Successfully recorded algorithm run via direct insert for user {user_id}")
                    return {'success': True, 'method': 'direct_insert'}
        except Exception as e:
            logger.error(f"Direct table access failed for algorithm run: {str(e)}")
        
        # Method 3: Service role for algorithm runs
        try:
            logger.info(f"Attempting service role connection for algorithm run for user {user_id}")
            
            # Get direct DB connection with service role
            conn = get_db_connection(use_service_role=True)
            
            try:
                with conn.cursor() as cursor:
                    # Check if record exists for today
                    today = datetime.now(timezone.utc).date()
                    
                    cursor.execute(
                        """
                        SELECT id, algorithm_runs FROM usage_tracking 
                        WHERE user_id = %s AND usage_date = %s
                        """, 
                        (user_id, today)
                    )
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Update existing record
                        current_count = existing['algorithm_runs'] or 0
                        cursor.execute(
                            """
                            UPDATE usage_tracking 
                            SET algorithm_runs = %s, updated_at = NOW()
                            WHERE id = %s
                            RETURNING id
                            """,
                            (current_count + 1, existing['id'])
                        )
                    else:
                        # Insert new record
                        cursor.execute(
                            """
                            INSERT INTO usage_tracking 
                            (user_id, usage_date, routes_created, algorithm_runs) 
                            VALUES (%s, %s, %s, %s)
                            RETURNING id
                            """,
                            (user_id, today, 0, 1)
                        )
                        
                    result = cursor.fetchone()
                    conn.commit()
                    
                    methods_tried.append('service_role')
                    
                    if result and 'id' in result:
                        logger.info(f"Successfully recorded algorithm run via service role for user {user_id}")
                        return {'success': True, 'method': 'service_role', 'id': result['id']}
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"Service role connection failed for algorithm run: {str(e)}")
        
        # All methods failed, store in session for later recovery
        if 'pending_usage_records' not in session:
            session['pending_usage_records'] = []
            
        tracking_info = {
            'user_id': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': 'algorithm_run',
            'methods_tried': methods_tried
        }
        
        session['pending_usage_records'].append(tracking_info)
        session.modified = True
        
        logger.warning(f"All tracking methods failed for algorithm run for user {user_id}. Stored in session for recovery.")
        return {
            'success': False, 
            'error': 'All tracking methods failed',
            'methods_tried': methods_tried,
            'recovery': 'Stored in session for later recovery'
        }
    
    def process_pending_records(self, user_id):
        """
        Process any pending usage records stored in the session
        
        Args:
            user_id: The user ID
            
        Returns:
            dict: Summary of recovery attempts
        """
        if 'pending_usage_records' not in session or not session['pending_usage_records']:
            return {'success': True, 'processed': 0, 'message': 'No pending records'}
        
        pending_records = session['pending_usage_records']
        results = {
            'total': len(pending_records),
            'successful': 0,
            'failed': 0,
            'details': []
        }
        
        # Create a new list for records that still fail
        still_pending = []
        
        for record in pending_records:
            # Skip records for other users
            if record.get('user_id') != user_id:
                still_pending.append(record)
                continue
                
            # Check if record is too old (older than 7 days)
            try:
                timestamp = datetime.fromisoformat(record.get('timestamp', ''))
                now = datetime.now(timezone.utc)
                if (now - timestamp).days > 7:
                    # Skip old records
                    logger.warning(f"Skipping old usage record from {timestamp.isoformat()}")
                    continue
            except Exception:
                # If timestamp is invalid, skip this record
                continue
            
            # Process based on action type
            action = record.get('action')
            if action == 'route_creation':
                result = self.record_route_creation(user_id)
            elif action == 'algorithm_run':
                result = self.record_algorithm_run(user_id)
            else:
                # Unknown action type
                result = {'success': False, 'error': f'Unknown action type: {action}'}
            
            # Add result to details
            result_entry = {
                'action': action,
                'success': result.get('success', False),
                'timestamp': record.get('timestamp'),
                'method': result.get('method', None),
                'error': result.get('error', None)
            }
            
            results['details'].append(result_entry)
            
            if result.get('success', False):
                results['successful'] += 1
            else:
                results['failed'] += 1
                still_pending.append(record)  # Keep failed records for next attempt
        
        # Update the session with records that still need processing
        session['pending_usage_records'] = still_pending
        session.modified = True
        
        results['success'] = results['failed'] == 0
        results['still_pending'] = len(still_pending)
        
        return results
    
    def get_usage_stats(self, user_id):
        """
        Get current usage statistics for a user
        
        Args:
            user_id: The user ID
            
        Returns:
            dict: Usage statistics
        """
        if not user_id:
            return {'routes_created': 0, 'algorithm_runs': 0, 'error': 'No user ID provided'}
        
        methods_tried = []
        
        # Method 1: Try direct query first
        try:
            logger.info(f"Getting usage stats via direct query for user {user_id}")
            
            # Get current month's data
            today = datetime.now(timezone.utc).date()
            first_day = today.replace(day=1).isoformat()
            
            response = self.supabase.table('usage_tracking') \
                .select('routes_created, algorithm_runs') \
                .eq('user_id', user_id) \
                .gte('usage_date', first_day) \
                .execute()
                
            methods_tried.append('direct_query')
            
            if response and hasattr(response, 'data'):
                routes_created = sum(item.get('routes_created', 0) or 0 for item in response.data)
                algorithm_runs = sum(item.get('algorithm_runs', 0) or 0 for item in response.data)
                
                logger.info(f"Successfully got usage stats via direct query for user {user_id}")
                return {
                    'success': True,
                    'method': 'direct_query',
                    'routes_created': routes_created,
                    'algorithm_runs': algorithm_runs
                }
        except Exception as e:
            logger.error(f"Direct query for usage stats failed: {str(e)}")
        
        # Method 2: Service role as fallback
        try:
            logger.info(f"Getting usage stats via service role for user {user_id}")
            
            # Get direct DB connection with service role
            conn = get_db_connection(use_service_role=True)
            
            try:
                with conn.cursor() as cursor:
                    # Get current month's data
                    today = datetime.now(timezone.utc).date()
                    first_day = today.replace(day=1)
                    
                    cursor.execute(
                        """
                        SELECT SUM(routes_created) as routes_created, 
                               SUM(algorithm_runs) as algorithm_runs
                        FROM usage_tracking 
                        WHERE user_id = %s AND usage_date >= %s
                        """, 
                        (user_id, first_day)
                    )
                    
                    result = cursor.fetchone()
                    methods_tried.append('service_role')
                    
                    if result:
                        logger.info(f"Successfully got usage stats via service role for user {user_id}")
                        return {
                            'success': True,
                            'method': 'service_role',
                            'routes_created': result['routes_created'] or 0,
                            'algorithm_runs': result['algorithm_runs'] or 0
                        }
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"Service role for usage stats failed: {str(e)}")
        
        # All methods failed
        logger.warning(f"All methods for getting usage stats failed for user {user_id}")
        return {
            'success': False,
            'error': 'Failed to get usage stats',
            'methods_tried': methods_tried,
            'routes_created': 0,
            'algorithm_runs': 0
        }

# Helper function to get tracker instance
def get_usage_tracker():
    """Get or create a UsageTracker instance"""
    if hasattr(g, 'usage_tracker'):
        return g.usage_tracker
    
    # Import here to avoid circular dependencies
    from app import supabase
    g.usage_tracker = UsageTracker(supabase)
    return g.usage_tracker