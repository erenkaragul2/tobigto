"""
Trial expiration middleware for Flask application.
This middleware checks if a user's trial is about to expire and shows notifications.
"""

from functools import wraps
from flask import session, flash, g, request
from datetime import datetime, timedelta, timezone
from subscription_manager import get_subscription_manager

def configure_trial_middleware(app):
    """
    Configure trial expiration middleware for the Flask app
    """
    @app.before_request
    def check_trial_expiration():
        # Only check on specific routes where the user would see a notification
        dashboard_routes = ['dashboard', 'solver_app', 'profile']
        current_route = request.endpoint
        
        if current_route in dashboard_routes and 'user' in session:
            user_id = session['user']['id']
            subscription_manager = get_subscription_manager()
            
            # Get user's subscription
            subscription = subscription_manager.get_user_subscription(user_id)
            
            # If no subscription, user is either on trial or has no plan
            if not subscription:
                # Check if trial info exists in session
                if 'trial_end_date' not in session:
                    # Set trial end date to 14 days from registration
                    # In a real app, you'd store this in the database
                    trial_end = datetime.now(timezone.utc) + timedelta(days=14)
                    session['trial_end_date'] = trial_end.isoformat()
                else:
                    # Parse stored trial end date
                    trial_end = datetime.fromisoformat(session['trial_end_date'])
                    
                    # Check if trial is expired
                    if datetime.now(timezone.utc) > trial_end:
                        flash('Your free trial has expired. Please subscribe to continue using all features.', 'danger')
                        g.trial_expired = True
                    # Check if trial is about to expire (within 3 days)
                    elif datetime.now(timezone.utc) + timedelta(days=3) > trial_end:
                        days_left = (trial_end - datetime.now(timezone.utc)).days
                        flash(f'Your free trial expires in {days_left} days. Subscribe now to keep access to all features.', 'warning')
                        g.trial_expiring_soon = True
                        
            # Make subscription data available to all templates
            g.subscription = subscription
    
    @app.context_processor
    def inject_trial_status():
        """Make trial status available in all templates"""
        return {
            'trial_expired': getattr(g, 'trial_expired', False),
            'trial_expiring_soon': getattr(g, 'trial_expiring_soon', False),
            'subscription': getattr(g, 'subscription', None)
        }
    
    return app