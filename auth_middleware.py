from functools import wraps
from flask import session, redirect, url_for, flash, request, g
import os
from supabase import create_client

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
supabase = create_client(supabase_url, supabase_key)

def login_required(f):
    """
    Decorator to require authentication for routes.
    Redirects to login page if user is not authenticated.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            # Remember the page user was trying to access
            session['next_url'] = request.url
            flash('Please log in to access this page', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """
    Decorator to require admin privileges for routes.
    Redirects to dashboard if user is not an admin.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            session['next_url'] = request.url
            flash('Please log in to access this page', 'warning')
            return redirect(url_for('login'))
        
        if not session.get('user', {}).get('is_admin', False):
            flash('You do not have permission to access this page', 'danger')
            return redirect(url_for('dashboard'))
            
        return f(*args, **kwargs)
    return decorated_function

def verify_session():
    """
    Middleware to verify the user's session is still valid with Supabase.
    Should be called before each request.
    """
    if 'user' in session and 'access_token' in session['user']:
        try:
            # Verify the token is still valid
            response = supabase.auth.get_user(session['user']['access_token'])
            if not response or not response.user:
                # Clear invalid session
                session.pop('user', None)
        except Exception as e:
            print(f"Session verification error: {str(e)}")
            # Clear session on error
            session.pop('user', None)

def configure_auth_middleware(app):
    """
    Configure authentication middleware for the Flask app
    """
    @app.before_request
    def before_request():
        # Verify the session on each request
        verify_session()
        
        # Make user available in all templates
        g.user = session.get('user', None)
    
    @app.context_processor
    def inject_user():
        """Make user available in all templates"""
        return {'user': session.get('user', None)}
    
    return app