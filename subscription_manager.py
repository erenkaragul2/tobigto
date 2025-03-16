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
    # Replace the existing _handle_subscription_created method

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
            
            # First check for custom_data in attributes
            if 'custom_data' in attributes:
                custom_data = attributes.get('custom_data', {})
                if isinstance(custom_data, dict) and 'user_id' in custom_data:
                    user_id = custom_data.get('user_id')
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
            
            # Check in meta data
            if not user_id and 'meta' in payload:
                meta = payload.get('meta', {})
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
                    
                    # Update the existing record instead of creating a new one
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
        """Handle subscription_updated webhook event"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            attributes = subscription_data.get('attributes', {})
            
            self.supabase.table('subscriptions').update({
                'current_period_end': attributes.get('renews_at'),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('subscription_id', subscription_id).execute()
            
            return True
        except Exception as e:
            print(f"Error handling subscription update: {str(e)}")
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