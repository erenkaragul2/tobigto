# usage_tracking.py
# Add this file to your project

import logging
from flask import request, jsonify, session
from functools import wraps
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class UsageTracker:
    """Enhanced usage tracking with improved reliability and validation"""
    
    def __init__(self, app=None, subscription_manager=None, service_client=None):
        self.app = app
        self.subscription_manager = subscription_manager
        self.service_client = service_client
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app"""
        self.app = app
        
        # Register routes for usage tracking
        app.route('/record_route_usage', methods=['POST'])(self.record_route_usage_endpoint)
        app.route('/record_algorithm_run', methods=['POST'])(self.record_algorithm_run_endpoint)
        app.route('/get_current_usage', methods=['GET'])(self.get_current_usage_endpoint)
        
        # Patch the solve endpoint to ensure usage tracking
        self._patch_solve_endpoint(app)
        
        # Register a context processor for usage stats
        @app.context_processor
        def inject_usage_stats():
            if 'user' in session:
                user_id = session['user']['id']
                usage_stats = self.get_usage_stats(user_id)
                return {'usage_stats': usage_stats}
            return {}
    
    def _patch_solve_endpoint(self, app):
        """Patch the solve endpoint to ensure usage is tracked"""
        original_solve = app.view_functions.get('solve')
        if original_solve:
            @wraps(original_solve)
            def enhanced_solve(*args, **kwargs):
                # Call original function
                result = original_solve(*args, **kwargs)
                
                # Record usage if successful
                if isinstance(result, dict) and result.get('success'):
                    if 'user' in session:
                        user_id = session['user']['id']
                        self.subscription_manager.record_route_creation(user_id)
                        # Algorithm usage will be recorded during solving
                
                return result
            
            # Replace the original function
            app.view_functions['solve'] = enhanced_solve
    
    def record_route_usage_endpoint(self):
        """Endpoint for recording route usage"""
        if 'user' not in session:
            return jsonify({'success': False, 'error': 'Not logged in'}), 401
        
        user_id = session['user']['id']
        
        try:
            # Log the request for debugging
            logger.info(f"Recording route usage for user {user_id}")
            
            # Record the usage
            success = self.subscription_manager.record_route_creation(user_id)
            
            if success:
                # Get updated usage
                usage_stats = self.get_usage_stats(user_id)
                
                return jsonify({
                    'success': True,
                    'message': 'Route usage recorded successfully',
                    'routes_used': usage_stats.get('routes_created', 0),
                    'max_routes': usage_stats.get('max_routes', 5)
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to record route usage'
                }), 500
                
        except Exception as e:
            logger.error(f"Error recording route usage: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    def record_algorithm_run_endpoint(self):
        """Endpoint for recording algorithm run"""
        if 'user' not in session:
            return jsonify({'success': False, 'error': 'Not logged in'}), 401
        
        user_id = session['user']['id']
        
        try:
            # Log the request for debugging
            logger.info(f"Recording algorithm run for user {user_id}")
            
            # Record the usage
            success = self.subscription_manager.record_algorithm_run(user_id)
            
            if success:
                # Get updated usage
                credits_info = self.subscription_manager.get_algorithm_credits(user_id)
                
                return jsonify({
                    'success': True,
                    'message': 'Algorithm run recorded successfully',
                    'credits_used': credits_info.get('credits_used', 0),
                    'max_credits': credits_info.get('max_credits', 10)
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to record algorithm run'
                }), 500
                
        except Exception as e:
            logger.error(f"Error recording algorithm run: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    def get_current_usage_endpoint(self):
        """Endpoint to get current usage statistics"""
        if 'user' not in session:
            return jsonify({'success': False, 'error': 'Not logged in'}), 401
        
        user_id = session['user']['id']
        
        try:
            # Get current usage stats
            usage_stats = self.get_usage_stats(user_id)
            
            return jsonify({
                'success': True,
                'usage_stats': usage_stats
            })
            
        except Exception as e:
            logger.error(f"Error getting usage stats: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    def get_usage_stats(self, user_id):
        """Get comprehensive usage statistics for a user"""
        try:
            # Get subscription info
            subscription = self.subscription_manager.get_user_subscription(user_id)
            
            # Get user limits
            limits = self.subscription_manager.get_user_limits(user_id)
            
            # Get route usage
            route_usage = self.subscription_manager.get_user_usage(user_id)
            
            # Get algorithm credits
            credits_info = self.subscription_manager.get_algorithm_credits(user_id)
            
            # Combine all info
            usage_stats = {
                'routes_created': route_usage.get('routes_created', 0),
                'max_routes': limits.get('max_routes', 5),
                'max_drivers': limits.get('max_drivers', 3),
                'algorithm_runs': route_usage.get('algorithm_runs', 0),
                'credits_used': credits_info.get('credits_used', 0),
                'max_credits': credits_info.get('max_credits', 10),
                'is_trial': limits.get('is_trial', True),
                'has_subscription': subscription is not None
            }
            
            # Add subscription details if available
            if subscription:
                usage_stats['plan_id'] = subscription.get('plan_id')
                usage_stats['plan_name'] = subscription.get('plan_name')
                usage_stats['status'] = subscription.get('status')
                usage_stats['current_period_end'] = subscription.get('current_period_end')
            
            return usage_stats
            
        except Exception as e:
            logger.error(f"Error building usage stats: {str(e)}")
            # Return minimal stats to avoid breaking the UI
            return {
                'routes_created': 0,
                'max_routes': 5,
                'max_drivers': 3,
                'algorithm_runs': 0,
                'credits_used': 0,
                'max_credits': 10,
                'is_trial': True,
                'has_subscription': False,
                'error': str(e)
            }

# Create a patch for the run_solver function
def patch_run_solver(app):
    """
    Patch the run_solver function to ensure usage is recorded after a successful solve
    This should be called during app initialization
    """
    # Original function from app.py
    original_run_solver = None
    for rule in app.url_map.iter_rules():
        if rule.endpoint == 'solve':
            original_run_solver = app.view_functions['solve']
            break
    
    if not original_run_solver:
        app.logger.warning("Could not patch run_solver: solve endpoint not found")
        return
    
    # Get the actual solver function
    from app import run_solver as original_solver_function
    
    # Create enhanced version
    def enhanced_run_solver(job_id, problem_data, params):
        """Enhanced version of run_solver that ensures usage tracking"""
        try:
            # Call original function
            result = original_solver_function(job_id, problem_data, params)
            
            # After successful solve, record the usage
            from app import solver_jobs
            if solver_jobs[job_id]['status'] == 'completed' and solver_jobs[job_id].get('user_id'):
                user_id = solver_jobs[job_id]['user_id']
                
                # Record the operations in the database
                from subscription_manager import get_subscription_manager
                subscription_manager = get_subscription_manager()
                
                # Record route creation if not already done
                subscription_manager.record_route_creation(user_id)
                
                # Record algorithm run
                subscription_manager.record_algorithm_run(user_id)
                
                app.logger.info(f"Usage recorded after successful solve for user {user_id}")
            
            return result
        except Exception as e:
            app.logger.error(f"Error in enhanced run_solver: {str(e)}")
            # Call original to maintain functionality even if our enhancement fails
            return original_solver_function(job_id, problem_data, params)
    
    # Replace the function in app module
    import app
    app.run_solver = enhanced_run_solver
    
    app.logger.info("Successfully patched run_solver function")

# The following ensures that algorithm usage is properly tracked after the solver completes
def fix_algorithm_recording():
    """
    Add this to subscription_manager.py to fix algorithm run recording
    """
    def record_multiple_operations(self, user_id, record_route=True, record_algorithm=True):
        """
        Record both route creation and algorithm run in a single operation
        
        Args:
            user_id: The user ID
            record_route: Whether to record a route creation
            record_algorithm: Whether to record an algorithm run
            
        Returns:
            dict: Result with success flags for each operation
        """
        result = {
            'route_success': False,
            'algorithm_success': False
        }
        
        if record_route:
            result['route_success'] = self.record_route_creation(user_id)
            
        if record_algorithm:
            result['algorithm_success'] = self.record_algorithm_run(user_id)
            
        return result