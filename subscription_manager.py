import os
import requests
import json
from datetime import datetime, timezone
from functools import wraps
from flask import request, redirect, url_for, session, flash, current_app

class LemonSqueezyClient:
    """Client for interacting with the Lemon Squeezy API"""
    
    BASE_URL = "https://api.lemonsqueezy.com/v1"
    
    def __init__(self, api_key):
        self.api_key = api_key
        self.headers = {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key}"
        }
    
    def get_user_subscription(self, user_id, supabase_client, plans):
        """Get the current subscription for a user with improved error handling"""
        if not user_id:
            current_app.logger.error("get_user_subscription called with empty user_id")
            return None
            
        try:
            response = supabase_client.table('subscriptions').select('*').eq('user_id', user_id).eq('status', 'active').execute()
            
            if response.data and len(response.data) > 0:
                subscription = response.data[0]
                
                # Check if subscription is still valid
                if subscription['current_period_end']:
                    end_date = datetime.fromisoformat(subscription['current_period_end'].replace('Z', '+00:00'))
                    if end_date < datetime.now(timezone.utc):
                        # Subscription has expired, update status
                        current_app.logger.info(f"Subscription {subscription['id']} has expired, updating status")
                        supabase_client.table('subscriptions').update({'status': 'expired'}).eq('id', subscription['id']).execute()
                        return None
                
                # Enrich the subscription with plan details
                plan_id = subscription.get('plan_id')
                for plan_key, plan_info in plans.items():
                    if plan_info['variant_id'] == plan_id:
                        subscription['plan_name'] = plan_info['name']
                        subscription['plan_key'] = plan_key
                        subscription['features'] = plan_info['features']
                        break
                
                return subscription
            return None
        except Exception as e:
            current_app.logger.error(f"Error fetching subscription for user {user_id}: {str(e)}")
            return None
    
    def get_customer(self, customer_id):
        """Get customer details"""
        url = f"{self.BASE_URL}/customers/{customer_id}"
        response = requests.get(url, headers=self.headers)
        return response.json() if response.ok else None
        
    def create_checkout(self, store_id, variant_id, checkout_data):
        """
        Create a checkout session via Lemon Squeezy API with improved debugging
        
        Args:
            store_id: The store ID
            variant_id: The variant ID for the product
            checkout_data: Dictionary with checkout data (email, custom fields, etc.)
            
        Returns:
            Checkout session data including URL
        """
        url = f"{self.BASE_URL}/checkouts"
        
        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "store_id": store_id,
                    "variant_id": variant_id,
                    "custom_price": None,  # Use default price
                    "product_options": {},
                    "checkout_options": {},
                    "checkout_data": checkout_data
                }
            }
        }
        
        try:
            print(f"Sending request to Lemon Squeezy API: {url}")
            print(f"Request payload: {json.dumps(payload)}")
            
            response = requests.post(url, headers=self.headers, json=payload)
            
            print(f"Response status code: {response.status_code}")
            print(f"Response headers: {response.headers}")
            
            # Try to get JSON response if available
            try:
                response_data = response.json()
                print(f"Response JSON: {json.dumps(response_data)}")
            except:
                print(f"Response text: {response.text}")
            
            if response.ok:
                data = response.json()
                checkout_url = data.get('data', {}).get('attributes', {}).get('url')
                print(f"Generated checkout URL: {checkout_url}")
                return data
            else:
                error_message = f"Error creating checkout: {response.status_code} - {response.text}"
                print(error_message)
                return None
        except Exception as e:
            error_message = f"Exception creating checkout: {str(e)}"
            print(error_message)
            return None
    
    def create_customer_portal_url(self, customer_id, return_url=None):
        """
        Create a customer portal URL for managing subscriptions
        
        Args:
            customer_id: The Lemon Squeezy customer ID
            return_url: Optional URL to redirect to after customer actions
            
        Returns:
            Customer portal URL or None on error
        """
        url = f"{self.BASE_URL}/customers/{customer_id}/portal"
        
        payload = {
            "data": {
                "type": "customer-portals",
                "attributes": {}
            }
        }
        
        # Add return URL if provided
        if return_url:
            payload["data"]["attributes"]["return_url"] = return_url
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            
            if response.ok:
                data = response.json()
                return data.get("data", {}).get("attributes", {}).get("url")
            else:
                print(f"Error creating customer portal: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Exception creating customer portal: {str(e)}")
            return None


class SubscriptionManager:
    """Manager for handling subscription-related operations"""
    
    # Subscription plans
    PLANS = {
        'starter': {
            'name': 'Starter',
            'variant_id': '727207',  # Your variant ID
            'features': ['8 drivers', 'Up to 25 routes per month', 'Basic route optimization', 'Email support'],
            'limits': {
                'max_routes': 25,
                'max_drivers': 8
            }
        },
        'professional': {
            'name': 'Professional',
            'variant_id': '727230',  # Your variant ID
            'features': ['15 drivers', 'Up to 55 routes per month', 'Advanced route optimization', 'Priority support'],
            'limits': {
                'max_routes': 55,
                'max_drivers': 15
            }
        },
        'enterprise': {
            'name': 'Enterprise',
            'variant_id': '727232',  # Your variant ID
            'features': ['24 drivers', 'Up to 120 routes per month', 'Premium features', '24/7 support'],
            'limits': {
                'max_routes': 120,
                'max_drivers': 24
            }
        }
    }   
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.ls_client = LemonSqueezyClient(os.getenv('LEMON_SQUEEZY_API_KEY'))
        self.store_id = os.getenv('LEMON_SQUEEZY_STORE_ID')
    
    def get_user_subscription(self, user_id):
        """Get the current subscription for a user"""
        try:
            response = self.supabase.table('subscriptions').select('*').eq('user_id', user_id).eq('status', 'active').execute()
            
            if response.data and len(response.data) > 0:
                subscription = response.data[0]
                
                # Check if subscription is still valid
                if subscription['current_period_end']:
                    end_date = datetime.fromisoformat(subscription['current_period_end'].replace('Z', '+00:00'))
                    if end_date < datetime.now(timezone.utc):
                        # Subscription has expired, update status
                        self.supabase.table('subscriptions').update({'status': 'expired'}).eq('id', subscription['id']).execute()
                        return None
                
                # Enrich the subscription with plan details
                plan_id = subscription.get('plan_id')
                for plan_key, plan_info in self.PLANS.items():
                    if plan_info['variant_id'] == plan_id:
                        subscription['plan_name'] = plan_info['name']
                        subscription['plan_key'] = plan_key
                        subscription['features'] = plan_info['features']
                        break
                
                return subscription
            return None
        except Exception as e:
            print(f"Error fetching subscription: {str(e)}")
            return None
    
    def create_checkout_session(self, user_id, email, plan_id, success_url, cancel_url):
        """Create a checkout session for a subscription"""
        if not user_id or not email:
            current_app.logger.error("Missing required parameters for checkout session")
            raise ValueError("User ID and email are required")
            
        if plan_id not in self.PLANS:
            current_app.logger.error(f"Invalid plan ID: {plan_id}")
            raise ValueError(f"Invalid plan ID: {plan_id}")
        
        plan = self.PLANS[plan_id]
        
        if not plan.get('variant_id'):
            current_app.logger.error(f"Missing variant ID for plan: {plan_id}")
            raise ValueError(f"Plan configuration error: missing variant ID")
        
        if not self.store_id:
            current_app.logger.error("Missing store ID in subscription manager")
            raise ValueError("Subscription manager configuration error: missing store ID")
        
        checkout_data = {
            "email": email,
            "custom": {
                "user_id": user_id
            },
            "success_url": success_url,
            "cancel_url": cancel_url
        }
        
        current_app.logger.info(f"Creating checkout session for user {user_id}, plan {plan_id}")
        
        try:
            response = self.ls_client.create_checkout(
                store_id=self.store_id,
                variant_id=plan['variant_id'],
                checkout_data=checkout_data
            )
            
            if response and 'data' in response:
                checkout_url = response['data']['attributes']['url']
                current_app.logger.info(f"Checkout session created successfully: {checkout_url}")
                return checkout_url
            else:
                current_app.logger.error("Invalid response from Lemon Squeezy API")
                if response:
                    current_app.logger.error(f"Response: {response}")
                return None
        except Exception as e:
            current_app.logger.error(f"Error creating checkout session: {str(e)}")
            raise
    
    # Replace the process_webhook method in subscription_manager.py
    # Update this method in subscription_manager.py to ensure it always returns complete data
    def get_user_usage(self, user_id):
        """
        Get usage statistics for a user with proper error handling
        
        Args:
            user_id: The user ID
                
        Returns:
            dict: Usage statistics including routes created this month
        """
        if not user_id:
            current_app.logger.warning("get_user_usage called with empty user_id")
            return {'routes_created': 0}
        
        try:
            # Get the current month and year
            current_date = datetime.now(timezone.utc)
            current_month = current_date.month
            current_year = current_date.year
            
            # Calculate first and last day of the month
            first_day = f"{current_year}-{current_month:02d}-01"
            # Calculate last day of the current month
            if current_month == 12:
                last_day = f"{current_year + 1}-01-01"
            else:
                last_day = f"{current_year}-{current_month + 1:02d}-01"
                
            current_app.logger.info(f"Querying usage for user {user_id} between {first_day} and {last_day}")
            
            # Query the database for usage in the current month
            # IMPORTANT: Use usage_date for filtering, not created_at
            try:
                response = self.supabase.table('usage_tracking').select('*')\
                    .eq('user_id', user_id)\
                    .gte('usage_date', first_day)\
                    .lt('usage_date', last_day)\
                    .execute()
                
                if response.data:
                    # Log what we found for debugging
                    current_app.logger.info(f"Found {len(response.data)} usage records")
                    
                    # Sum up the routes created this month
                    routes_created = sum(item.get('routes_created', 0) for item in response.data)
                    current_app.logger.info(f"Total routes created this month: {routes_created}")
                    return {'routes_created': routes_created}
                else:
                    current_app.logger.info(f"No usage records found for user {user_id} this month")
                    return {'routes_created': 0}
                    
            except Exception as e:
                current_app.logger.error(f"Error querying usage tracking: {str(e)}")
                # Try a simpler query as a fallback
                try:
                    response = self.supabase.table('usage_tracking').select('*')\
                        .eq('user_id', user_id)\
                        .execute()
                        
                    if response.data:
                        # Filter manually to the current month
                        current_month_records = [
                            item for item in response.data 
                            if 'usage_date' in item and first_day <= item['usage_date'] < last_day
                        ]
                        routes_created = sum(item.get('routes_created', 0) for item in current_month_records)
                        current_app.logger.info(f"Fallback query found {routes_created} routes created")
                        return {'routes_created': routes_created}
                        
                    return {'routes_created': 0}
                except Exception as fallback_error:
                    current_app.logger.error(f"Fallback query also failed: {str(fallback_error)}")
                    return {'routes_created': 0}
            
        except Exception as e:
            current_app.logger.error(f"Error getting user usage: {str(e)}")
            return {'routes_created': 0}

    def get_user_limits(self, user_id):
        """
        Get the usage limits for a user based on their subscription
        
        Args:
            user_id: The user ID
            
        Returns:
            dict: Usage limits including max routes and max drivers
        """
        # Default limits for trial users
        default_limits = {
            'max_routes': 5,
            'max_drivers': 3,
            'is_trial': True
        }
        
        if not user_id:
            return default_limits
        
        # Get the user's subscription
        subscription = self.get_user_subscription(user_id)
        
        if not subscription:
            return default_limits
        
        # Get the plan details
        plan_id = subscription.get('plan_id')
        
        # Find matching plan
        for plan_key, plan_info in self.PLANS.items():
            if plan_info['variant_id'] == plan_id:
                return {
                    'max_routes': plan_info['limits']['max_routes'],
                    'max_drivers': plan_info['limits']['max_drivers'],
                    'is_trial': False
                }
        
        # If no matching plan found, return default limits
        return default_limits

    def get_max_drivers(self, user_id):
        """
        Get the maximum number of drivers allowed for a user
        
        Args:
            user_id: The user ID
            
        Returns:
            int: Maximum number of drivers allowed
        """
        limits = self.get_user_limits(user_id)
        return limits.get('max_drivers', 3)  # Default to 3 if not found

    def check_route_limit(self, user_id):
        """
        Check if a user has hit their route creation limit
        
        Args:
            user_id: The user ID
            
        Returns:
            tuple: (has_routes_left, routes_created, max_routes)
        """
        # Get user limits
        limits = self.get_user_limits(user_id)
        max_routes = limits.get('max_routes', 5)  # Default to 5 if not found
        
        # Get user usage
        usage = self.get_user_usage(user_id)
        routes_created = usage.get('routes_created', 0)
        
        # Check if user has routes left
        has_routes_left = routes_created < max_routes
        
        return has_routes_left, routes_created, max_routes

    # Updated record_route_creation method for SubscriptionManager
# Add this to your subscription_manager.py file, replacing the existing method

def record_route_creation(self, user_id):
    """
    Record a route creation in the usage tracking table with enhanced reliability
    
    Args:
        user_id: The user ID
        
    Returns:
        bool: True if successful, False otherwise
    """
    import traceback
    from datetime import datetime, timezone
    
    if not user_id:
        print("Cannot record route usage: Missing user_id")
        return False
    
    # Store attempt details for debugging
    attempt_details = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'user_id': user_id,
        'methods_tried': []
    }
    
    # Get today's date in UTC
    today = datetime.now(timezone.utc).date().isoformat()
    
    try:
        # 1. Try the Supabase RPC function approach first (preferred)
        attempt_details['methods_tried'].append('rpc')
        try:
            print(f"Attempting to record route usage for user {user_id} via RPC function")
            
            # Create SQL function if it doesn't exist (run this in your Supabase SQL editor first)
            # This is commented out as it should be created in advance
            """
            CREATE OR REPLACE FUNCTION public.record_route_usage(p_user_id UUID)
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
                
                IF FOUND THEN
                    -- Update existing record
                    UPDATE usage_tracking
                    SET routes_created = routes_created + 1,
                        updated_at = NOW()
                    WHERE id = existing_record.id;
                ELSE
                    -- Insert new record
                    INSERT INTO usage_tracking (user_id, usage_date, routes_created, created_at, updated_at)
                    VALUES (p_user_id, today, 1, NOW(), NOW());
                END IF;
                
                RETURN TRUE;
            END;
            $$;
            """
            
            response = self.supabase.rpc(
                'record_route_usage',
                {'p_user_id': user_id}
            ).execute()
            
            # Check if response indicates success - this means data exists
            if response and (hasattr(response, 'data') or hasattr(response, 'count')):
                print(f"Route usage recorded for user {user_id} via RPC function")
                return True
                
        except Exception as rpc_error:
            print(f"RPC method failed, error: {str(rpc_error)}")
            attempt_details['rpc_error'] = str(rpc_error)
            # Continue to fallback methods
        
        # 2. Try direct Supabase table manipulation as first fallback
        attempt_details['methods_tried'].append('supabase_direct')
        try:
            print(f"Attempting to record route usage for user {user_id} via direct Supabase table access")
            
            # Check if record exists for today
            response = self.supabase.table('usage_tracking')\
                .select('*')\
                .eq('user_id', user_id)\
                .eq('usage_date', today)\
                .execute()
                
            if response and response.data and len(response.data) > 0:
                # Update existing record
                record = response.data[0]
                new_count = record.get('routes_created', 0) + 1
                
                update_response = self.supabase.table('usage_tracking')\
                    .update({'routes_created': new_count, 'updated_at': datetime.now(timezone.utc).isoformat()})\
                    .eq('id', record['id'])\
                    .execute()
                    
                print(f"Updated existing record: routes_created={new_count}")
                return True
            else:
                # Insert new record
                insert_data = {
                    'user_id': user_id,
                    'usage_date': today,
                    'routes_created': 1,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                
                insert_response = self.supabase.table('usage_tracking')\
                    .insert(insert_data)\
                    .execute()
                    
                print(f"Created new usage record for user {user_id}")
                return True
                
        except Exception as supabase_error:
            print(f"Direct Supabase table access failed: {str(supabase_error)}")
            attempt_details['supabase_direct_error'] = str(supabase_error)
            # Continue to next fallback method
        
        # 3. Try direct database connection as last resort
        attempt_details['methods_tried'].append('direct_db')
        try:
            print(f"Attempting to record route usage for user {user_id} via direct DB connection")
            
            try:
                # Import inside the function to avoid circular imports
                from db_connection import get_db_connection
                
                # Get database connection with service role to bypass RLS
                conn = get_db_connection(use_service_role=True)
                
                try:
                    with conn.cursor() as cursor:
                        # Check if a record exists for today
                        cursor.execute("""
                            SELECT id, routes_created FROM usage_tracking
                            WHERE user_id = %s AND usage_date = %s
                        """, (user_id, today))
                        
                        record = cursor.fetchone()
                        
                        if record:
                            # Update existing record
                            new_count = record['routes_created'] + 1
                            cursor.execute("""
                                UPDATE usage_tracking
                                SET routes_created = %s, updated_at = NOW()
                                WHERE id = %s
                            """, (new_count, record['id']))
                            
                            print(f"Updated existing record via direct DB: routes_created={new_count}")
                        else:
                            # Insert new record
                            cursor.execute("""
                                INSERT INTO usage_tracking (user_id, usage_date, routes_created, created_at, updated_at)
                                VALUES (%s, %s, 1, NOW(), NOW())
                            """, (user_id, today))
                            
                            print("Created new usage record via direct DB")
                        
                        # Commit the transaction
                        conn.commit()
                        print(f"Route usage recorded for user {user_id} via direct DB connection")
                        return True
                        
                except Exception as db_error:
                    if conn:
                        conn.rollback()
                    print(f"Database error recording route usage: {str(db_error)}")
                    print(traceback.format_exc())
                    attempt_details['db_query_error'] = str(db_error)
                    return False
                finally:
                    if conn:
                        conn.close()
                    
            except Exception as db_connection_error:
                print(f"Failed to establish database connection: {str(db_connection_error)}")
                attempt_details['db_connection_error'] = str(db_connection_error)
                return False
                
        except Exception as db_access_error:
            print(f"Error accessing database module: {str(db_access_error)}")
            attempt_details['db_access_error'] = str(db_access_error)
            
        # 4. Last resort: Try to create a local record to sync later
        attempt_details['methods_tried'].append('local_storage')
        try:
            # Store usage in a temporary file for later synchronization
            import os
            import json
            
            # Create directory if it doesn't exist
            os.makedirs('data/pending_usage', exist_ok=True)
            
            # Create a unique file name
            file_name = f"data/pending_usage/usage_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
            
            # Store the usage data
            with open(file_name, 'w') as f:
                json.dump({
                    'user_id': user_id,
                    'usage_date': today,
                    'routes_created': 1,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'attempt_details': attempt_details
                }, f)
                
            print(f"Stored usage in local file for later sync: {file_name}")
            return True
            
        except Exception as local_storage_error:
            print(f"Failed to store usage locally: {str(local_storage_error)}")
            attempt_details['local_storage_error'] = str(local_storage_error)
            
        # 5. Store error information for debugging
        try:
            import os
            import json
            
            # Create directory if it doesn't exist
            os.makedirs('data/usage_errors', exist_ok=True)
            
            # Create a unique file name
            error_file = f"data/usage_errors/error_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json"
            
            # Store all attempt details
            with open(error_file, 'w') as f:
                json.dump(attempt_details, f)
                
            print(f"Stored error details in: {error_file}")
            
        except Exception as error_log_error:
            print(f"Failed to log error details: {str(error_log_error)}")
            
        # All methods failed
        return False
            
    except Exception as e:
        print(f"Unhandled error in record_route_creation: {str(e)}")
        print(traceback.format_exc())
        return False

    def _ensure_usage_tracking_table_exists(self):
        """
        Ensure the usage_tracking table exists in the database
        """
        try:
            # Check if table exists by querying it
            self.supabase.table('usage_tracking').select('count').limit(1).execute()
        except Exception as e:
            # If table doesn't exist, create it
            if 'The table usage_tracking does not exist' in str(e):
                print("Creating usage_tracking table...")
                try:
                    # Note: Table creation might require more privileges than your API key has
                    # This is just an example of how it might work
                    self.supabase.rpc('create_usage_tracking_table').execute()
                except Exception as create_error:
                    print(f"Error creating usage_tracking table: {str(create_error)}")
                    print("The table needs to be created manually in the Supabase dashboard")
            else:
                print(f"Error checking usage_tracking table: {str(e)}")

    def process_webhook(self, payload, signature=None):
        """
        Process webhook from Lemon Squeezy
        
        Args:
            payload (dict): The webhook payload
            signature (str, optional): The webhook signature (not used in processing but kept for compatibility)
        
        Returns:
            bool: True if processed successfully, False otherwise
        """
        # Log the entire payload for debugging
        print(f"Processing webhook: {json.dumps(payload, indent=2)}")
        
        event_name = payload.get('meta', {}).get('event_name')
        
        if event_name == 'subscription_created':
            return self._handle_subscription_created(payload)
        elif event_name == 'subscription_updated':
            return self._handle_subscription_updated(payload)
        elif event_name == 'subscription_cancelled':
            return self._handle_subscription_cancelled(payload)
        elif event_name == 'subscription_resumed':
            return self._handle_subscription_resumed(payload)
        elif event_name == 'subscription_expired':
            return self._handle_subscription_expired(payload)
        elif event_name == 'order_created':
            return self._handle_order_created(payload)
        
        # Log unknown events
        print(f"Unknown webhook event: {event_name}")
        return False

    def _handle_subscription_created(self, payload):
        """Handle subscription_created webhook event with improved user ID extraction"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            attributes = subscription_data.get('attributes', {})
            
            # Log the full webhook payload for debugging
            print(f"Subscription created webhook payload: {json.dumps(payload, indent=2)}")
            
            # Try to get user_id from different possible locations
            user_id = None
            
            # First check for user_id in meta.custom_data (NEW LOCATION)
            meta = payload.get('meta', {})
            custom_data = meta.get('custom_data', {})
            if isinstance(custom_data, dict) and 'user_id' in custom_data:
                user_id = custom_data.get('user_id')
                print(f"Found user_id in meta.custom_data: {user_id}")
            
            # Then check for custom_data in attributes
            if not user_id and 'custom_data' in attributes:
                attr_custom_data = attributes.get('custom_data', {})
                if isinstance(attr_custom_data, dict) and 'user_id' in attr_custom_data:
                    user_id = attr_custom_data.get('user_id')
                    print(f"Found user_id in attributes.custom_data: {user_id}")
            
            # Check in order_id if available
            if not user_id and 'order_id' in attributes:
                try:
                    order_id = attributes.get('order_id')
                    print(f"Looking up order {order_id} for user_id")
                    
                    # Get the order data to find user_id
                    response = requests.get(
                        f"{self.ls_client.BASE_URL}/orders/{order_id}",
                        headers=self.ls_client.headers
                    )
                    
                    if response.ok:
                        order_data = response.json()
                        order_attributes = order_data.get('data', {}).get('attributes', {})
                        
                        # Check for user_id in order's custom_data
                        order_custom_data = order_attributes.get('custom_data', {})
                        if order_custom_data and 'user_id' in order_custom_data:
                            user_id = order_custom_data.get('user_id')
                            print(f"Found user_id in related order's custom_data: {user_id}")
                except Exception as e:
                    print(f"Error fetching order: {str(e)}")
            
            # Check in meta data legacy format
            if not user_id and 'meta' in payload:
                if 'custom' in meta and isinstance(meta.get('custom'), dict):
                    user_id = meta.get('custom', {}).get('user_id')
                    print(f"Found user_id in meta.custom: {user_id}")
            
            # Check for user email match if user_id still not found
            if not user_id and 'user_email' in attributes:
                email = attributes.get('user_email')
                print(f"Trying to find user by email: {email}")
                
                try:
                    # Look up the user by email in Supabase
                    response = self.supabase.auth.admin.list_users()
                    
                    if hasattr(response, 'users'):
                        for user in response.users:
                            if user.email == email:
                                user_id = user.id
                                print(f"Found user_id by email lookup: {user_id}")
                                break
                except Exception as e:
                    print(f"Error looking up user by email: {str(e)}")
            
            if not user_id:
                print("ERROR: Could not find user_id in webhook payload")
                return False
            
            print(f"Using user_id: {user_id}")
            
            # Check if a subscription record already exists for this subscription_id
            try:
                existing = self.supabase.table('subscriptions').select('*')\
                    .eq('subscription_id', subscription_id).execute()
                
                if existing.data and len(existing.data) > 0:
                    print(f"Subscription record already exists for subscription {subscription_id}")
                    
                    # Update the existing record
                    response = self.supabase.table('subscriptions').update({
                        'user_id': user_id,
                        'customer_id': attributes.get('customer_id'),
                        'plan_id': attributes.get('variant_id'),
                        'status': 'active',
                        'current_period_end': attributes.get('renews_at'),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }).eq('subscription_id', subscription_id).execute()
                    
                    print(f"Updated existing subscription record: {response.data if hasattr(response, 'data') else 'Unknown'}")
                    return True
            except Exception as e:
                print(f"Error checking for existing subscription: {str(e)}")
            
            # Create subscription record
            try:
                response = self.supabase.table('subscriptions').insert({
                    'user_id': user_id,
                    'subscription_id': subscription_id,
                    'customer_id': attributes.get('customer_id'),
                    'plan_id': attributes.get('variant_id'),
                    'status': 'active',
                    'current_period_end': attributes.get('renews_at')
                }).execute()
                
                print(f"Subscription record created: {response.data if hasattr(response, 'data') else 'Unknown'}")
                return True
            except Exception as e:
                print(f"Error creating subscription record: {str(e)}")
                return False
        except Exception as e:
            import traceback
            print(f"Error handling subscription created: {str(e)}")
            print(traceback.format_exc())
            return False

# Add a new method to handle orders (which may contain user_id in custom_data)
    def _handle_order_created(self, payload):
        """Handle order_created webhook event which may contain subscription info"""
        try:
            # Log the order payload
            print(f"Processing order_created webhook: {json.dumps(payload, indent=2)}")
            
            order_data = payload.get('data', {})
            attributes = order_data.get('attributes', {})
            
            # Check if this order created a subscription
            first_subscription_id = attributes.get('first_subscription_id')
            if not first_subscription_id:
                print("Order did not create a subscription")
                return True  # Successfully processed (no action needed)
            
            # Extract user_id from custom_data
            custom_data = attributes.get('custom_data', {})
            user_id = None
            
            # Try to get user_id from different possible locations
            if custom_data and 'user_id' in custom_data:
                user_id = custom_data.get('user_id')
            
            # Also check in meta or other locations
            if not user_id and 'meta' in payload:
                meta = payload.get('meta', {})
                if 'custom' in meta:
                    user_id = meta.get('custom', {}).get('user_id')
            
            # If user_id found, check if a subscription record already exists
            if user_id:
                print(f"Found user_id in order: {user_id}")
                
                # Check if subscription record exists
                response = self.supabase.table('subscriptions').select('*')\
                    .eq('subscription_id', first_subscription_id).execute()
                
                if response.data and len(response.data) > 0:
                    print(f"Subscription record already exists for subscription {first_subscription_id}")
                    return True
                
                # If not, create a new subscription record
                print(f"Creating subscription record for user {user_id} and subscription {first_subscription_id}")
                
                # Get customer_id from order
                customer_id = attributes.get('customer_id')
                
                # Get variant_id if available
                variant_id = None
                order_items = attributes.get('order_items', [])
                if order_items and len(order_items) > 0:
                    variant_id = order_items[0].get('variant_id')
                
                # Create subscription record
                subscription_data = {
                    'user_id': user_id,
                    'subscription_id': first_subscription_id,
                    'customer_id': customer_id,
                    'plan_id': variant_id,
                    'status': 'active'
                }
                
                # Only add renewal date if available
                if 'renewed_at' in attributes:
                    subscription_data['current_period_end'] = attributes.get('renewed_at')
                
                response = self.supabase.table('subscriptions').insert(subscription_data).execute()
                print(f"Subscription record created: {response.data if hasattr(response, 'data') else 'Unknown'}")
                
                return True
            
            print("No user_id found in order")
            return False
        
        except Exception as e:
            import traceback
            print(f"Error handling order created: {str(e)}")
            print(traceback.format_exc())
            return False
    
    def _handle_subscription_updated(self, payload):
        """Handle subscription_updated webhook event with improved record creation/update"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            attributes = subscription_data.get('attributes', {})
            
            print(f"Handling subscription_updated for subscription_id: {subscription_id}")
            
            # Extract user_id from meta.custom_data (this is the new location in your webhook)
            user_id = None
            meta = payload.get('meta', {})
            custom_data = meta.get('custom_data', {})
            if isinstance(custom_data, dict) and 'user_id' in custom_data:
                user_id = custom_data.get('user_id')
                print(f"Found user_id in meta.custom_data: {user_id}")
            
            # If we couldn't find user_id, try other locations
            if not user_id:
                # Try in attributes.custom_data
                attr_custom_data = attributes.get('custom_data', {})
                if isinstance(attr_custom_data, dict) and 'user_id' in attr_custom_data:
                    user_id = attr_custom_data.get('user_id')
                    print(f"Found user_id in attributes.custom_data: {user_id}")
            
            # If we still don't have a user_id, try to get it from the existing subscription
            if not user_id:
                try:
                    response = self.supabase.table('subscriptions').select('user_id').eq('subscription_id', subscription_id).execute()
                    if response.data and len(response.data) > 0:
                        user_id = response.data[0].get('user_id')
                        print(f"Found user_id from existing subscription record: {user_id}")
                except Exception as e:
                    print(f"Error looking up existing subscription: {str(e)}")
            
            if not user_id:
                print("ERROR: Could not find user_id in webhook payload or existing record")
                return False
            
            # Check if subscription record exists
            try:
                response = self.supabase.table('subscriptions').select('*').eq('subscription_id', subscription_id).execute()
                
                if response.data and len(response.data) > 0:
                    print(f"Updating existing subscription record for subscription {subscription_id}")
                    
                    # Update the existing record
                    self.supabase.table('subscriptions').update({
                        'status': 'active',
                        'current_period_end': attributes.get('renews_at'),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }).eq('subscription_id', subscription_id).execute()
                    
                    print("Subscription record updated successfully")
                else:
                    print(f"No existing record found for subscription {subscription_id}, creating new record")
                    
                    # Get variant_id from attributes
                    variant_id = attributes.get('variant_id')
                    
                    # Create a new subscription record
                    new_subscription = {
                        'user_id': user_id,
                        'subscription_id': subscription_id,
                        'customer_id': attributes.get('customer_id'),
                        'plan_id': variant_id,
                        'status': 'active',
                        'current_period_end': attributes.get('renews_at')
                    }
                    
                    response = self.supabase.table('subscriptions').insert(new_subscription).execute()
                    print(f"Created new subscription record: {response.data}")
                
                return True
                
            except Exception as e:
                print(f"Error checking/updating subscription: {str(e)}")
                import traceback
                print(traceback.format_exc())
                return False
                
        except Exception as e:
            print(f"Error handling subscription update: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return False
    
    def _handle_subscription_cancelled(self, payload):
        """Handle subscription_cancelled webhook event"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            
            self.supabase.table('subscriptions').update({
                'status': 'cancelled',
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('subscription_id', subscription_id).execute()
            
            return True
        except Exception as e:
            print(f"Error handling subscription cancellation: {str(e)}")
            return False
    
    def _handle_subscription_resumed(self, payload):
        """Handle subscription_resumed webhook event"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            attributes = subscription_data.get('attributes', {})
            
            self.supabase.table('subscriptions').update({
                'status': 'active',
                'current_period_end': attributes.get('renews_at'),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('subscription_id', subscription_id).execute()
            
            return True
        except Exception as e:
            print(f"Error handling subscription resumption: {str(e)}")
            return False
    
    def _handle_subscription_expired(self, payload):
        """Handle subscription_expired webhook event"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            
            self.supabase.table('subscriptions').update({
                'status': 'expired',
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('subscription_id', subscription_id).execute()
            
            return True
        except Exception as e:
            print(f"Error handling subscription expiration: {str(e)}")
            return False
    
    def cancel_user_subscription(self, user_id):
        """Cancel a user's subscription"""
        try:
            # Get active subscription
            response = self.supabase.table('subscriptions').select('*').eq('user_id', user_id).eq('status', 'active').execute()
            
            if response.data and len(response.data) > 0:
                subscription = response.data[0]
                subscription_id = subscription['subscription_id']
                
                # Cancel subscription in Lemon Squeezy
                if self.ls_client.cancel_subscription(subscription_id):
                    # Update local record
                    self.supabase.table('subscriptions').update({
                        'status': 'cancelled',
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }).eq('id', subscription['id']).execute()
                    
                    return True
            
            return False
        except Exception as e:
            print(f"Error cancelling subscription: {str(e)}")
            return False

# Decorator for subscription-required routes
def subscription_required(plan_levels=None):
    """
    Decorator to check if user has an active subscription.
    
    Args:
        plan_levels: List of acceptable plan levels or None for any subscription
    """
    def decorator(view_function):
        @wraps(view_function)
        def wrapped_view(*args, **kwargs):
            if 'user' not in session:
                flash('Please log in to access this feature', 'warning')
                return redirect(url_for('login'))
            
            # Get user subscription from the session or database
            subscription_manager = get_subscription_manager()
            user_subscription = subscription_manager.get_user_subscription(session['user']['id'])
            
            if not user_subscription:
                flash('This feature requires an active subscription', 'warning')
                return redirect(url_for('pricing'))
            
            # If specific plan levels are required
            if plan_levels:
                user_plan = user_subscription.get('plan_id')
                if user_plan not in plan_levels:
                    flash('This feature requires a higher subscription level', 'warning')
                    return redirect(url_for('pricing'))
            
            return view_function(*args, **kwargs)
        return wrapped_view
    return decorator

# Singleton instance
_subscription_manager_instance = None

# Helper function to get subscription manager instance
def get_subscription_manager():
    """Get or create a SubscriptionManager instance"""
    global _subscription_manager_instance
    
    if _subscription_manager_instance is None:
        from app import supabase  # Import here to avoid circular imports
        _subscription_manager_instance = SubscriptionManager(supabase)
    
    return _subscription_manager_instance