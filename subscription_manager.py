import os
import requests
import json
from datetime import datetime, timezone
from functools import wraps
from flask import request, redirect, url_for, session, flash

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
    
    def get_user_subscription(self, user_id):
        """Get the current subscription for a user with improved error handling"""
        if not user_id:
            app.logger.error("get_user_subscription called with empty user_id")
            return None
            
        try:
            response = self.supabase.table('subscriptions').select('*').eq('user_id', user_id).eq('status', 'active').execute()
            
            if response.data and len(response.data) > 0:
                subscription = response.data[0]
                
                # Check if subscription is still valid
                if subscription['current_period_end']:
                    end_date = datetime.fromisoformat(subscription['current_period_end'].replace('Z', '+00:00'))
                    if end_date < datetime.now(timezone.utc):
                        # Subscription has expired, update status
                        app.logger.info(f"Subscription {subscription['id']} has expired, updating status")
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
            app.logger.error(f"Error fetching subscription for user {user_id}: {str(e)}")
            return None
    
    def get_customer(self, customer_id):
        """Get customer details"""
        url = f"{self.BASE_URL}/customers/{customer_id}"
        response = requests.get(url, headers=self.headers)
        return response.json() if response.ok else None
    def create_checkout(self, store_id, variant_id, checkout_data):
        """
        Create a checkout session via Lemon Squeezy API
        
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
            response = requests.post(url, headers=self.headers, json=payload)
            if response.ok:
                return response.json()
            else:
                print(f"Error creating checkout: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Exception creating checkout: {str(e)}")
            return None
    
    def create_checkout_session(self, user_id, email, plan_id, success_url, cancel_url):
        """Create a checkout session for a subscription with improved validation"""
        if not user_id or not email:
            app.logger.error("Missing required parameters for checkout session")
            raise ValueError("User ID and email are required")
            
        if plan_id not in self.PLANS:
            app.logger.error(f"Invalid plan ID: {plan_id}")
            raise ValueError(f"Invalid plan ID: {plan_id}")
        
        plan = self.PLANS[plan_id]
        
        if not plan.get('variant_id'):
            app.logger.error(f"Missing variant ID for plan: {plan_id}")
            raise ValueError(f"Plan configuration error: missing variant ID")
        
        if not self.store_id:
            app.logger.error("Missing store ID in subscription manager")
            raise ValueError("Subscription manager configuration error: missing store ID")
        
        checkout_data = {
            "email": email,
            "custom": {
                "user_id": user_id
            },
            "success_url": success_url,
            "cancel_url": cancel_url
        }
        
        app.logger.info(f"Creating checkout session for user {user_id}, plan {plan_id}")
        
        try:
            response = self.ls_client.create_checkout(
                store_id=self.store_id,
                variant_id=plan['variant_id'],
                checkout_data=checkout_data
            )
            
            if response and 'data' in response:
                checkout_url = response['data']['attributes']['url']
                app.logger.info(f"Checkout session created successfully: {checkout_url}")
                return checkout_url
            else:
                app.logger.error("Invalid response from Lemon Squeezy API")
                if response:
                    app.logger.error(f"Response: {response}")
                return None
        except Exception as e:
            app.logger.error(f"Error creating checkout session: {str(e)}")
            raise
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
            'variant_id': '727207',  # Replace with your variant ID
            'features': ['5 vehicles', 'Basic route optimization', 'Email support']
        },
        'professional': {
            'name': 'Professional',
            'variant_id': '727230',  # Replace with your variant ID
            'features': ['20 vehicles', 'Advanced route optimization', 'Priority support']
        },
        'enterprise': {
            'name': 'Enterprise',
            'variant_id': '727232',  # Replace with your variant ID
            'features': ['Unlimited vehicles', 'Premium features', '24/7 support']
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
                
                return subscription
            return None
        except Exception as e:
            print(f"Error fetching subscription: {str(e)}")
            return None
    
    def create_checkout_session(self, user_id, email, plan_id, success_url, cancel_url):
        """Create a checkout session for a subscription"""
        if plan_id not in self.PLANS:
            raise ValueError(f"Invalid plan ID: {plan_id}")
        
        plan = self.PLANS[plan_id]
        checkout_data = {
            "email": email,
            "custom": {
                "user_id": user_id
            },
            "success_url": success_url,
            "cancel_url": cancel_url
        }
        
        response = self.ls_client.create_checkout(
            store_id=self.store_id,
            variant_id=plan['variant_id'],
            checkout_data=checkout_data
        )
        
        if response and 'data' in response:
            return response['data']['attributes']['url']
        return None
    
    def process_webhook(self, payload, signature):
        """Process webhook from Lemon Squeezy"""
        # Verify webhook signature
        # Implementation depends on how Lemon Squeezy sends webhooks
        
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
        
        return False
    
    def _handle_subscription_created(self, payload):
        """Handle subscription_created webhook event"""
        try:
            subscription_data = payload.get('data', {})
            subscription_id = subscription_data.get('id')
            attributes = subscription_data.get('attributes', {})
            
            # Get user_id from custom data in subscription
            custom_data = attributes.get('user_data', {})
            user_id = custom_data.get('user_id')
            
            if not user_id:
                return False
            
            # Create subscription record
            self.supabase.table('subscriptions').insert({
                'user_id': user_id,
                'subscription_id': subscription_id,
                'customer_id': attributes.get('customer_id'),
                'plan_id': attributes.get('variant_id'),
                'status': 'active',
                'current_period_end': attributes.get('renews_at')
            }).execute()
            
            return True
        except Exception as e:
            print(f"Error handling subscription created: {str(e)}")
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

# Helper function to get subscription manager instance
def get_subscription_manager():
    """Get or create a SubscriptionManager instance"""
    from app import supabase  # Import here to avoid circular imports
    
    if not hasattr(get_subscription_manager, 'instance'):
        get_subscription_manager.instance = SubscriptionManager(supabase)
    
    return get_subscription_manager.instance