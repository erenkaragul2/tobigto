# Create a new file called usage_limits.py

from functools import wraps
from flask import jsonify, session, flash, redirect, url_for, request
from subscription_manager import get_subscription_manager

def route_limit_required(f):
    """
    Decorator to check if user has remaining route creations available.
    If not, redirects to the pricing page or returns an error for API calls.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is logged in
        if 'user' not in session:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'error': 'Authentication required',
                    'redirect': url_for('login')
                }), 401
            flash('Please log in to access this feature', 'warning')
            return redirect(url_for('login'))
        
        # Get subscription manager
        subscription_manager = get_subscription_manager()
        
        # Check if user has hit their route limit
        has_routes_left, routes_created, max_routes = subscription_manager.check_route_limit(session['user']['id'])
        
        if not has_routes_left:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'error': f'Route limit reached ({routes_created}/{max_routes})',
                    'limit_reached': True,
                    'redirect': url_for('subscription.pricing')
                }), 403
            
            flash(f'You have reached your monthly route creation limit ({routes_created}/{max_routes}). Please upgrade your plan for more routes.', 'warning')
            return redirect(url_for('subscription.pricing'))
        
        # Call the original function
        return f(*args, **kwargs)
    
    return decorated_function

def driver_limit_check(max_vehicles, user_id=None):
    """
    Check if the requested number of vehicles exceeds the user's plan limit.
    Returns a tuple of (is_allowed, max_allowed, error_message)
    """
    if not user_id and 'user' in session:
        user_id = session['user']['id']
    
    if not user_id:
        # No user ID available, use default limit
        return True, 3, None
    
    # Get subscription manager
    subscription_manager = get_subscription_manager()
    
    # Get max drivers allowed for this user
    max_allowed = subscription_manager.get_max_drivers(user_id)
    
    if max_vehicles > max_allowed:
        error_message = f"Your subscription allows a maximum of {max_allowed} drivers. You requested {max_vehicles}."
        return False, max_allowed, error_message
    
    return True, max_allowed, None