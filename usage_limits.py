import logging
from functools import wraps
from flask import jsonify, session, flash, redirect, url_for, request, g, current_app
from subscription_manager import get_subscription_manager
from db_connection import get_db_connection

# Configure logging
logger = logging.getLogger(__name__)

def route_limit_required(f):
    """
    Decorator to check if user has remaining route creations available.
    If not, redirects to the pricing page or returns an error for API calls.
    Uses database connection with service role to bypass RLS.
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
        
        user_id = session['user']['id']
        
        try:
            # Try direct database access first (more reliable)
            conn = get_db_connection(use_service_role=True)
            
            try:
                with conn.cursor() as cursor:
                    # Get subscription information for max routes
                    cursor.execute("""
                        SELECT plan_id FROM subscriptions
                        WHERE user_id = %s AND status = 'active'
                        LIMIT 1
                    """, (user_id,))
                    
                    subscription = cursor.fetchone()
                    max_routes = 5  # Default trial limit
                    
                    # If subscription exists, get plan limits
                    if subscription:
                        plan_id = subscription['plan_id']
                        
                        # Implementation would depend on how plans are stored
                        # This is a simplified example
                        if plan_id == '727207':  # Starter
                            max_routes = 25
                        elif plan_id == '727230':  # Professional
                            max_routes = 55
                        elif plan_id == '727232':  # Enterprise
                            max_routes = 120
                    
                    # Get current month's usage
                    from datetime import datetime, timezone
                    today = datetime.now(timezone.utc).date()
                    first_day = today.replace(day=1)
                    
                    cursor.execute("""
                        SELECT SUM(routes_created) as routes_used
                        FROM usage_tracking
                        WHERE user_id = %s AND usage_date >= %s
                    """, (user_id, first_day))
                    
                    result = cursor.fetchone()
                    routes_used = result['routes_used'] if result and result['routes_used'] else 0
                    
                    # Check if limit is reached
                    if routes_used >= max_routes:
                        if request.is_json:
                            return jsonify({
                                'success': False,
                                'error': f'Route limit reached ({routes_used}/{max_routes})',
                                'limit_reached': True,
                                'routes_used': routes_used,
                                'max_routes': max_routes,
                                'redirect': url_for('subscription.pricing')
                            }), 403
                        
                        flash(f'You have reached your monthly route creation limit ({routes_used}/{max_routes}). Please upgrade your plan for more routes.', 'warning')
                        return redirect(url_for('subscription.pricing'))
                    
                    # Store in g for later use
                    g.routes_used = routes_used
                    g.max_routes = max_routes
                    
            finally:
                conn.close()
                
        except Exception as e:
            # Log the error
            logger.error(f"Error checking route limit via DB: {str(e)}")
            
            # Fall back to subscription manager
            try:
                # Get subscription manager
                subscription_manager = get_subscription_manager()
                
                # Check if user has hit their route limit
                has_routes_left, routes_created, max_routes = subscription_manager.check_route_limit(user_id)
                
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
            except Exception as fallback_error:
                # If both methods fail, log but allow the operation
                logger.error(f"Fallback check also failed: {str(fallback_error)}")
                logger.warning("Allowing operation despite limit check failure")
        
        # Call the original function
        return f(*args, **kwargs)
    
    return decorated_function

def driver_limit_check(max_vehicles, user_id=None):
    """
    Check if the requested number of vehicles exceeds the user's plan limit.
    Uses database connection with service role to bypass RLS.
    Returns a tuple of (is_allowed, max_allowed, error_message)
    """
    if not user_id and 'user' in session:
        user_id = session['user']['id']
    
    if not user_id:
        # No user ID available, use default limit
        return True, 3, None
    
    try:
        # Try direct database access first
        conn = get_db_connection(use_service_role=True)
        
        try:
            with conn.cursor() as cursor:
                # Get subscription information for max drivers
                cursor.execute("""
                    SELECT plan_id FROM subscriptions
                    WHERE user_id = %s AND status = 'active'
                    LIMIT 1
                """, (user_id,))
                
                subscription = cursor.fetchone()
                max_allowed = 3  # Default trial limit
                
                # If subscription exists, get plan limits
                if subscription:
                    plan_id = subscription['plan_id']
                    
                    # Implementation would depend on how plans are stored
                    if plan_id == '727207':  # Starter
                        max_allowed = 8
                    elif plan_id == '727230':  # Professional
                        max_allowed = 15
                    elif plan_id == '727232':  # Enterprise
                        max_allowed = 24
        finally:
            conn.close()
            
    except Exception as e:
        # Log the error
        logger.error(f"Error checking driver limit via DB: {str(e)}")
        
        # Fall back to subscription manager
        try:
            # Get subscription manager
            subscription_manager = get_subscription_manager()
            
            # Get max drivers allowed for this user
            max_allowed = subscription_manager.get_max_drivers(user_id)
        except Exception as fallback_error:
            # If both methods fail, use default
            logger.error(f"Fallback driver check also failed: {str(fallback_error)}")
            max_allowed = 3  # Use conservative default
            
    # Compare requested vs allowed
    if max_vehicles > max_allowed:
        error_message = f"Your subscription allows a maximum of {max_allowed} drivers. You requested {max_vehicles}."
        return False, max_allowed, error_message
    
    return True, max_allowed, None