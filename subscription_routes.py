from flask import Blueprint, render_template, redirect, url_for, request, flash, session, jsonify
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
    
    subscription_manager = get_subscription_manager()
    
    # Check if the plan exists
    if plan_id not in subscription_manager.PLANS:
        flash('Invalid subscription plan', 'danger')
        return redirect(url_for('subscription.pricing'))
    
    # Check if user already has an active subscription
    current_subscription = subscription_manager.get_user_subscription(session['user']['id'])
    if current_subscription:
        flash('You already have an active subscription', 'warning')
        return redirect(url_for('dashboard'))
    
    # Create a checkout session
    success_url = url_for('subscription.success', _external=True)
    cancel_url = url_for('subscription.pricing', _external=True)
    
    checkout_url = subscription_manager.create_checkout_session(
        user_id=session['user']['id'],
        email=session['user']['email'],
        plan_id=plan_id,
        success_url=success_url,
        cancel_url=cancel_url
    )
    
    if not checkout_url:
        flash('Failed to create checkout session', 'danger')
        return redirect(url_for('subscription.pricing'))
    
    # Redirect to the checkout page
    return redirect(checkout_url)

@subscription_bp.route('/subscription/success')
def success():
    """Handle successful subscription"""
    flash('Your subscription has been activated!', 'success')
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
    
    # For Lemon Squeezy, you'll need to implement a customer portal URL generation
    # This would typically involve creating a customer portal link via the Lemon Squeezy API
    # For now, we'll redirect to a placeholder
    flash('Customer portal functionality will be implemented soon', 'info')
    return redirect(url_for('dashboard'))

@subscription_bp.route('/webhooks/lemon-squeezy', methods=['POST'])
def lemon_squeezy_webhook():
    """Handle webhooks from Lemon Squeezy"""
    # Get the webhook signature
    signature = request.headers.get('X-Signature')
    
    if not signature:
        return jsonify({'success': False, 'error': 'Missing signature'}), 400
    
    # Get the webhook payload
    payload = request.json
    
    # Get the webhook secret from environment
    webhook_secret = os.getenv('LEMON_SQUEEZY_WEBHOOK_SECRET')
    
    # Verify the signature
    computed_signature = hmac.new(
        webhook_secret.encode(),
        request.data,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(computed_signature, signature):
        return jsonify({'success': False, 'error': 'Invalid signature'}), 403
    
    # Process the webhook
    subscription_manager = get_subscription_manager()
    success = subscription_manager.process_webhook(payload, signature)
    
    if success:
        return jsonify({'success': True}), 200
    else:
        return jsonify({'success': False, 'error': 'Failed to process webhook'}), 500

@subscription_bp.route('/subscription/status')
def status():
    """Check subscription status"""
    # Check if user is logged in
    if 'user' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    subscription_manager = get_subscription_manager()
    
    # Get the user's subscription
    subscription = subscription_manager.get_user_subscription(session['user']['id'])
    
    if subscription:
        return jsonify({
            'success': True,
            'subscription': {
                'status': subscription.get('status'),
                'plan': subscription.get('plan_id'),
                'expires': subscription.get('current_period_end')
            }
        })
    else:
        return jsonify({
            'success': True,
            'subscription': None
        })