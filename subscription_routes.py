from flask import Blueprint, render_template, redirect, url_for, request, flash, session, jsonify, current_app
import os
import hmac
import hashlib
import json
from functools import wraps
from datetime import datetime, timezone

from subscription_manager import get_subscription_manager, subscription_required

# Create Blueprint
subscription_bp = Blueprint('subscription', __name__)

@subscription_bp.route('/pricing')
def pricing():
    """Display pricing page with subscription options"""
    subscription_manager = get_subscription_manager()
    plans = subscription_manager.PLANS
    
    # Check if user is logged in
    user = session.get('user')
    
    # Get current subscription if the user is logged in
    current_subscription = None
    if user:
        current_subscription = subscription_manager.get_user_subscription(user['id'])
    
    return render_template(
        'pricing.html',
        plans=plans,
        user=user,
        current_subscription=current_subscription
    )

@subscription_bp.route('/subscribe/<plan_id>')
def subscribe(plan_id):
    """Redirect to Lemon Squeezy checkout for the selected plan"""
    # Check if user is logged in
    if 'user' not in session:
        flash('Please log in to subscribe', 'warning')
        return redirect(url_for('login', next=request.url))
    
    try:
        subscription_manager = get_subscription_manager()
        current_app.logger.info(f"Starting checkout process for plan: {plan_id}")
        
        # Check if the plan exists
        if plan_id not in subscription_manager.PLANS:
            current_app.logger.error(f"Invalid plan ID: {plan_id}")
            flash('Invalid subscription plan', 'danger')
            return redirect(url_for('subscription.pricing'))
        
        # Check if user already has an active subscription
        current_subscription = subscription_manager.get_user_subscription(session['user']['id'])
        if current_subscription:
            current_app.logger.info(f"User already has subscription: {current_subscription}")
            flash('You already have an active subscription', 'warning')
            return redirect(url_for('dashboard'))
        
        # Create a checkout session
        success_url = url_for('subscription.success', _external=True)
        cancel_url = url_for('subscription.pricing', _external=True)
        
        current_app.logger.info(f"Creating checkout session with: plan={plan_id}, user_id={session['user']['id']}, email={session['user']['email']}")
        
        try:
            checkout_url = subscription_manager.create_checkout_session(
                user_id=session['user']['id'],
                email=session['user']['email'],
                plan_id=plan_id,
                success_url=success_url,
                cancel_url=cancel_url
            )
            
            if not checkout_url:
                current_app.logger.error("Checkout URL creation failed - returned None")
                flash('Failed to create checkout session. Please try the direct link instead.', 'danger')
                return redirect(url_for('subscription.pricing'))
            
            current_app.logger.info(f"Successfully created checkout URL: {checkout_url}")
            # Redirect to the checkout page
            return redirect(checkout_url)
            
        except Exception as checkout_error:
            current_app.logger.error(f"Error creating checkout session: {str(checkout_error)}")
            current_app.logger.error(f"Traceback: {traceback.format_exc()}")
            flash(f'Error creating checkout: {str(checkout_error)}', 'danger')
            return redirect(url_for('subscription.pricing'))
        
    except Exception as e:
        current_app.logger.error(f"General error in subscribe route: {str(e)}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        flash(f'Error: {str(e)}', 'danger')
        return redirect(url_for('subscription.pricing'))

@subscription_bp.route('/subscription/success')
def success():
    """Handle successful subscription"""
    if 'user' not in session:
        flash('Please log in to continue', 'warning')
        return redirect(url_for('login'))
    
    # Try to find the subscription in the database
    subscription_manager = get_subscription_manager()
    user_id = session['user']['id']
    
    # Give Lemon Squeezy webhook a moment to process (optional)
    # time.sleep(2)
    
    # Check if subscription exists
    subscription = subscription_manager.get_user_subscription(user_id)
    
    if subscription:
        flash('Your subscription has been activated! Welcome to your new plan.', 'success')
    else:
        # If not found yet, show a "processing" message
        flash('Your subscription is being processed. It may take a few moments to appear in your account.', 'info')
    
    return redirect(url_for('dashboard'))

@subscription_bp.route('/subscription/cancel')
def cancel():
    """Cancel user subscription"""
    # Check if user is logged in
    if 'user' not in session:
        flash('Please log in to manage subscriptions', 'warning')
        return redirect(url_for('login'))
    
    subscription_manager = get_subscription_manager()
    
    # Cancel the subscription
    if subscription_manager.cancel_user_subscription(session['user']['id']):
        flash('Your subscription has been cancelled', 'success')
    else:
        flash('Failed to cancel subscription', 'danger')
    
    return redirect(url_for('subscription.pricing'))

@subscription_bp.route('/subscription/portal')
def portal():
    """Redirect to customer portal"""
    # Check if user is logged in
    if 'user' not in session:
        flash('Please log in to access the customer portal', 'warning')
        return redirect(url_for('login'))
    
    subscription_manager = get_subscription_manager()
    
    # Get the user's subscription
    subscription = subscription_manager.get_user_subscription(session['user']['id'])
    if not subscription:
        flash('You don\'t have an active subscription', 'warning')
        return redirect(url_for('subscription.pricing'))
    
    # Get customer ID from subscription
    customer_id = subscription.get('customer_id')
    if not customer_id:
        flash('Unable to access customer portal: Missing customer ID', 'danger')
        return redirect(url_for('dashboard'))
    
    # Create return URL (where to redirect after customer actions)
    return_url = url_for('dashboard', _external=True)
    
    # Generate customer portal URL
    portal_url = subscription_manager.ls_client.create_customer_portal_url(
        customer_id=customer_id, 
        return_url=return_url
    )
    
    if portal_url:
        return redirect(portal_url)
    else:
        flash('Unable to generate customer portal link. Please try again later.', 'danger')
        return redirect(url_for('dashboard'))

@subscription_bp.route('/webhooks/lemon-squeezy', methods=['POST'])
def lemon_squeezy_webhook():
    """Handle webhooks from Lemon Squeezy with improved security"""
    # Get the webhook signature
    signature = request.headers.get('X-Signature')
    
    if not signature:
        current_app.logger.warning("Missing webhook signature")
        return jsonify({'success': False, 'error': 'Missing signature'}), 400
    
    # Get the raw request body
    request_data = request.get_data()
    if not request_data:
        current_app.logger.warning("Empty webhook payload")
        return jsonify({'success': False, 'error': 'Empty payload'}), 400
    
    # Get the webhook secret from environment
    webhook_secret = os.getenv('LEMON_SQUEEZY_WEBHOOK_SECRET')
    if not webhook_secret:
        current_app.logger.error("LEMON_SQUEEZY_WEBHOOK_SECRET not configured")
        return jsonify({'success': False, 'error': 'Server configuration error'}), 500
    
    # Verify the signature
    computed_signature = hmac.new(
        webhook_secret.encode(),
        request_data,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant time comparison to prevent timing attacks
    if not hmac.compare_digest(computed_signature, signature):
        current_app.logger.warning("Invalid webhook signature")
        return jsonify({'success': False, 'error': 'Invalid signature'}), 403
    
    # Parse JSON payload
    try:
        payload = request.json
    except Exception as e:
        current_app.logger.error(f"Invalid JSON payload: {str(e)}")
        return jsonify({'success': False, 'error': 'Invalid JSON'}), 400
    
    # Validate the payload has the expected structure
    if not payload or 'meta' not in payload or 'event_name' not in payload['meta']:
        current_app.logger.warning("Malformed webhook payload")
        return jsonify({'success': False, 'error': 'Malformed payload'}), 400
    
    # Log the webhook event for debugging
    event_name = payload['meta']['event_name']
    current_app.logger.info(f"Processing Lemon Squeezy webhook: {event_name}")
    
    # Process the webhook - FIX: Pass both payload AND signature to process_webhook
    try:
        subscription_manager = get_subscription_manager()
        
        # THE FIX: Use try/except to handle different method signatures
        try:
            # Try with both parameters (payload, signature)
            success = subscription_manager.process_webhook(payload, signature)
        except TypeError:
            # Fallback to just the payload if that's all the method accepts
            current_app.logger.info("Falling back to process_webhook with only payload parameter")
            success = subscription_manager.process_webhook(payload)
        
        if success:
            current_app.logger.info(f"Successfully processed webhook: {event_name}")
            return jsonify({'success': True}), 200
        else:
            current_app.logger.error(f"Failed to process webhook: {event_name}")
            return jsonify({'success': False, 'error': 'Failed to process webhook'}), 500
    except Exception as e:
        import traceback
        current_app.logger.error(f"Exception processing webhook: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'success': False, 
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# Add this to your subscription_routes.py file

@subscription_bp.route('/subscription/status')
@login_required
def subscription_status():
    """Get current subscription status including usage"""
    if 'user' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    try:
        # Get subscription manager
        subscription_manager = get_subscription_manager()
        
        # Get user's subscription
        subscription = subscription_manager.get_user_subscription(session['user']['id'])
        
        # Get user's usage
        user_usage = subscription_manager.get_user_usage(session['user']['id'])
        
        # Get user's limits
        user_limits = subscription_manager.get_user_limits(session['user']['id'])
        
        # Combine into a single response
        combined_data = {
            'subscription_active': bool(subscription),
            'routes_used': user_usage.get('routes_created', 0),
            'max_routes': user_limits.get('max_routes', 5),
            'max_drivers': user_limits.get('max_drivers', 3),
            'is_trial': user_limits.get('is_trial', True),
        }
        
        if subscription:
            combined_data.update({
                'plan_id': subscription.get('plan_id'),
                'status': subscription.get('status'),
                'current_period_end': subscription.get('current_period_end')
            })
        
        return jsonify({
            'success': True,
            'subscription': combined_data
        })
    except Exception as e:
        current_app.logger.error(f"Error getting subscription status: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500