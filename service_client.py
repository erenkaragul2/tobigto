# Enhance service_client.py file to improve error handling and debug information

import os
import time
from supabase import create_client
from datetime import datetime, timezone
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('service_client')

def get_service_client(retry_count=3):
    """
    Get a Supabase client using the service role key for admin access
    
    Args:
        retry_count: Number of retries on failure
    
    Returns:
        Supabase client with service role or None on failure
    """
    supabase_url = os.getenv('SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not service_key:
        logger.error("CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
        return None
    
    # For debugging
    masked_key = service_key[:5] + "*****" if service_key and len(service_key) > 10 else "Invalid key"
    logger.info(f"Creating service client with URL: {supabase_url}, Key: {masked_key}")
    
    attempt = 0
    last_error = None
    
    while attempt < retry_count:
        try:
            # Create client with service key (bypasses RLS)
            service_client = create_client(supabase_url, service_key)
            
            # Verify connection with a simple query
            response = service_client.table('usage_tracking').select('count').limit(1).execute()
            
            logger.info("Service client created successfully")
            return service_client
            
        except Exception as e:
            last_error = e
            attempt += 1
            logger.error(f"Error creating service client (attempt {attempt}/{retry_count}): {str(e)}")
            
            if attempt < retry_count:
                # Exponential backoff
                sleep_time = 0.5 * (2 ** attempt)
                time.sleep(sleep_time)
    
    logger.error(f"Failed to create service client after {retry_count} attempts: {str(last_error)}")
    return None

def record_usage_with_service_role(user_id, usage_type, debug=False):
    """
    Record usage statistics using service role client to bypass RLS
    
    Args:
        user_id: User ID string
        usage_type: Either 'route_creation' or 'algorithm_run'
        debug: Enable additional debug output
    
    Returns:
        dict: Result of the operation
    """
    if not user_id:
        return {'success': False, 'error': 'Missing user ID'}
    
    start_time = time.time()
    logger.info(f"Recording {usage_type} for user {user_id}")
    
    try:
        # Get service client
        service_client = get_service_client()
        if not service_client:
            raise Exception("Failed to create service client")
        
        # Get today's date in ISO format
        today = datetime.now(timezone.utc).date().isoformat()
        
        # First check if a record exists for today
        response = service_client.table('usage_tracking').select('id, routes_created, algorithm_runs') \
            .eq('user_id', user_id) \
            .eq('usage_date', today) \
            .execute()
        
        existing_record = None
        if response and hasattr(response, 'data') and len(response.data) > 0:
            existing_record = response.data[0]
        
        if existing_record:
            # Update existing record
            record_id = existing_record['id']
            
            if usage_type == 'route_creation':
                current_count = existing_record.get('routes_created', 0) or 0
                update_data = {'routes_created': current_count + 1}
            else:  # algorithm_run
                current_count = existing_record.get('algorithm_runs', 0) or 0
                update_data = {'algorithm_runs': current_count + 1}
            
            # Add updated timestamp
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            # Update the record
            update_response = service_client.table('usage_tracking') \
                .update(update_data) \
                .eq('id', record_id) \
                .execute()
            
            elapsed = time.time() - start_time
            logger.info(f"Updated usage record in {elapsed:.2f}s")
            
            return {
                'success': True, 
                'method': 'service_update',
                'record_id': record_id,
                'elapsed_time': elapsed
            }
        else:
            # Insert new record - note we're only including the columns we know exist
            insert_data = {
                'user_id': user_id,
                'usage_date': today,
                'routes_created': 1 if usage_type == 'route_creation' else 0,
                'algorithm_runs': 1 if usage_type == 'algorithm_run' else 0,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            insert_response = service_client.table('usage_tracking') \
                .insert(insert_data) \
                .execute()
            
            elapsed = time.time() - start_time
            logger.info(f"Created new usage record in {elapsed:.2f}s")
            
            return {
                'success': True,
                'method': 'service_insert',
                'data': insert_response.data,
                'elapsed_time': elapsed
            }
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Error recording usage with service role (after {elapsed:.2f}s): {str(e)}")
        
        # Return detailed error information
        return {
            'success': False, 
            'error': str(e),
            'user_id': user_id,
            'usage_type': usage_type,
            'elapsed_time': elapsed
        }