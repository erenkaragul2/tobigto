import os
from supabase import create_client
from datetime import datetime, timezone

def get_service_client():
    """Get a Supabase client using the service role key for admin access"""
    supabase_url = os.getenv('SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not service_key:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return None
        
    # Create client with service key (bypasses RLS)
    service_client = create_client(supabase_url, service_key)
    return service_client

def record_usage_with_service_role(user_id, usage_type):
    """
    Record usage statistics using service role client to bypass RLS
    
    Args:
        user_id: User ID string
        usage_type: Either 'route_creation' or 'algorithm_run'
    
    Returns:
        dict: Result of the operation
    """
    if not user_id:
        return {'success': False, 'error': 'Missing user ID'}
        
    try:
        # Get service client
        service_client = get_service_client()
        if not service_client:
            return {'success': False, 'error': 'Could not create service client'}
            
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
                
            return {
                'success': True, 
                'method': 'service_update',
                'record_id': record_id
            }
        else:
            # Insert new record - note we're only including the columns we know exist
            insert_data = {
                'user_id': user_id,
                'usage_date': today,
                'routes_created': 1 if usage_type == 'route_creation' else 0,
                'algorithm_runs': 1 if usage_type == 'algorithm_run' else 0
            }
            
            insert_response = service_client.table('usage_tracking') \
                .insert(insert_data) \
                .execute()
                
            return {
                'success': True,
                'method': 'service_insert',
                'data': insert_response.data
            }
                
    except Exception as e:
        print(f"Error recording usage with service role: {str(e)}")
        return {'success': False, 'error': str(e)}

def get_usage_stats_with_service_role(user_id):
    """
    Get usage statistics for a user using service role client
    
    Args:
        user_id: User ID string
    
    Returns:
        dict: Usage statistics including routes created and algorithm runs
    """
    if not user_id:
        return {'success': False, 'error': 'Missing user ID'}
        
    try:
        # Get service client
        service_client = get_service_client()
        if not service_client:
            return {'success': False, 'error': 'Could not create service client'}
            
        # Get current month stats
        today = datetime.now(timezone.utc)
        first_day = datetime(today.year, today.month, 1).date().isoformat()
        
        # Query this month's records
        response = service_client.table('usage_tracking').select('routes_created, algorithm_runs') \
            .eq('user_id', user_id) \
            .gte('usage_date', first_day) \
            .execute()
            
        # Sum up all routes and algorithm runs
        routes_created = 0
        algorithm_runs = 0
        
        if response and hasattr(response, 'data'):
            for record in response.data:
                routes_created += record.get('routes_created', 0) or 0
                algorithm_runs += record.get('algorithm_runs', 0) or 0
                
        return {
            'success': True,
            'method': 'service_client',
            'routes_created': routes_created,
            'algorithm_runs': algorithm_runs,
            'month': today.strftime('%B %Y')
        }
                
    except Exception as e:
        print(f"Error getting usage stats with service role: {str(e)}")
        return {'success': False, 'error': str(e)}