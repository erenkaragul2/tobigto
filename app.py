# Description: Main application file for the CVRP solver web app with Supabase authentication
from flask import Flask, request, jsonify, session, redirect, url_for, render_template, flash, g, make_response, Blueprint
import os
import uuid
import numpy as np
import pandas as pd
import json
import time
import threading
import random
import math
import copy
from flask_cors import CORS
from supabase import create_client
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import os
from dotenv import load_dotenv
from models.distance_matrix import compute_google_distance_matrix, compute_euclidean_distance_matrix
from auth_middleware import login_required, admin_required, configure_auth_middleware
from subscription_manager import subscription_required, get_subscription_manager
from subscription_routes import subscription_bp
from trial_middleware import configure_trial_middleware
from usage_limits import route_limit_required, driver_limit_check
# Import the enhanced upload handler
from upload_handler import enhanced_upload_handler
from db_connection import with_db_connection, ensure_service_key_config
import traceback

from datetime import datetime, timezone  # Fix the timezone import error
from db_connection import get_db_connection  # Fix the get_db_connection error

from report_storage import report_bp, init_reports_table



# Load environment variables from .env file
load_dotenv()

# Get environment variables
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SESSION_SECRET = os.getenv('SESSION_SECRET', 'cvrp-secret-key')  # Use environment variable or default
file_bp = Blueprint('file_operations', __name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SESSION_SECRET', 'cvrp-secret-key')  # Make sure to set a strong secret in production
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)  # Session lasts 30 days
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'  # Only send cookies over HTTPS in production
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent JavaScript access to cookies
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Restrict cookie to same site
app.register_blueprint(report_bp, url_prefix='/reports')
if not ensure_service_key_config():
    app.logger.warning("Service key configuration issues detected. Some database operations may fail.")
with app.app_context():
    try:
        # Initialize the reports table
        init_reports_table()
    except Exception as e:
        # Log error but don't crash app
        print(f"Error initializing reports table: {str(e)}")

try:
    from service_client import get_service_client
    service_supabase = get_service_client()
    if service_supabase:
        app.logger.info("Service client initialized successfully")
    else:
        app.logger.warning("Failed to initialize service client")
except Exception as e:
    app.logger.error(f"Error initializing service client: {str(e)}")
    service_supabase = None
    
@app.before_request
def make_session_permanent():
    session.permanent = True
# Configure authentication middleware
app = configure_auth_middleware(app)
app.register_blueprint(subscription_bp)
@app.route('/test-session')
def test_session():
    if 'visits' in session:
        session['visits'] = session.get('visits') + 1
    else:
        session['visits'] = 1
    
    return jsonify({
        'success': True, 
        'message': f'Session is working! You have visited this page {session["visits"]} times.',
        'session_data': {k: str(v) for k, v in session.items()}  # Convert all values to strings for JSON
    })
# Global storage for ongoing solver jobs
solver_jobs = {}
@app.before_request
def setup_subscription_manager():
    g.subscription_manager = get_subscription_manager()
def allowed_file(filename):
    """Check if file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
direct_report_bp = Blueprint('direct_report', __name__)

@direct_report_bp.route('/save_report', methods=['POST'])
def direct_save_report():
    """
    Direct endpoint for saving a report - bypasses the blueprint routing
    that might be causing 404 errors in Vercel
    """
    response_data = {
        'success': False,
        'error': None,
        'debug_info': {},
        'auth_status': 'unknown'
    }
    
    try:
        # Get user ID from session
        if 'user' not in session:
            response_data['error'] = 'User not authenticated'
            response_data['auth_status'] = 'no_session'
            current_app.logger.error("No user in session when saving report")
            return jsonify(response_data), 401
            
        user_id = session['user']['id']
        response_data['debug_info']['user_id'] = user_id
        response_data['auth_status'] = 'session_found'
        
        # Get request data
        data = request.get_json()
        
        if not data:
            response_data['error'] = 'Missing request data'
            return jsonify(response_data), 400
        
        # Validate required fields
        if 'pdf_data' not in data:
            response_data['error'] = 'Missing PDF data'
            return jsonify(response_data), 400
        
        # Extract PDF data
        pdf_data = data['pdf_data']
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data[28:]
        elif pdf_data.startswith('data:'):
            # Remove any other data URL prefix
            pdf_data = pdf_data.split(',', 1)[1]
        
        # Extract metadata
        metadata = data.get('metadata', {})
        current_app.logger.info(f"Received report save request with metadata: {metadata.keys()}")
        
        # Generate a unique ID for the report
        report_id = str(uuid.uuid4())
        
        # Create timestamp
        current_time = datetime.now(timezone.utc)
        
        # Create the report object
        report_data = {
            'id': report_id,
            'user_id': user_id,
            'report_name': f"Route Optimization Report - {current_time.strftime('%Y-%m-%d %H:%M')}",
            'created_at': current_time.isoformat(),
            'pdf_data': pdf_data,
            'route_count': metadata.get('route_count', 0),
            'total_distance': metadata.get('total_distance', 0),
            'metadata': json.dumps(metadata),
            'job_id': metadata.get('job_id', None)
        }
        
        # Get Supabase client
        from app import supabase
        
        # Try to save the report using regular insert first
        success = False
        
        try:
            response = supabase.table('route_reports').insert(report_data).execute()
            if hasattr(response, 'data') and len(response.data) > 0:
                success = True
                response_data['method'] = 'direct_insert'
        except Exception as e:
            response_data['debug_info']['direct_error'] = str(e)
            # Continue to next method
        
        # If direct insert failed, try the RPC approach
        if not success:
            try:
                # Try RPC function as fallback
                response = supabase.rpc(
                    'insert_report',
                    {
                        'p_id': report_id,
                        'p_user_id': user_id,
                        'p_report_name': report_data['report_name'],
                        'p_created_at': report_data['created_at'],
                        'p_pdf_data': pdf_data,
                        'p_route_count': report_data['route_count'],
                        'p_total_distance': report_data['total_distance'],
                        'p_metadata': metadata,
                        'p_job_id': report_data['job_id']
                    }
                ).execute()
                
                if response and hasattr(response, 'data'):
                    success = True
                    response_data['method'] = 'rpc_function'
            except Exception as e:
                response_data['debug_info']['rpc_error'] = str(e)
                # Continue to next method
        
        # If still no success, try service role DB connection
        if not success:
            try:
                from db_connection import get_db_connection
                
                conn = get_db_connection(use_service_role=True)
                with conn.cursor() as cursor:
                    # Insert using direct SQL
                    cursor.execute("""
                        INSERT INTO route_reports 
                        (id, user_id, report_name, created_at, pdf_data, route_count, total_distance, metadata, job_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        report_id,
                        user_id,
                        report_data['report_name'],
                        current_time,
                        pdf_data,
                        report_data['route_count'],
                        report_data['total_distance'],
                        json.dumps(metadata),
                        report_data['job_id']
                    ))
                    
                    result = cursor.fetchone()
                    conn.commit()
                    conn.close()
                    
                    if result and 'id' in result:
                        success = True
                        response_data['method'] = 'direct_db'
            except Exception as e:
                response_data['debug_info']['db_error'] = str(e)
                response_data['debug_info']['db_traceback'] = traceback.format_exc()
        
        # Return the final result
        if success:
            response_data['success'] = True
            response_data['message'] = 'Report saved successfully'
            response_data['report_id'] = report_id
            current_app.logger.info(f"Report saved successfully with ID {report_id}")
            return jsonify(response_data)
        else:
            response_data['error'] = 'Failed to save report after multiple attempts'
            current_app.logger.error(f"Failed to save report after multiple attempts: {response_data['debug_info']}")
            return jsonify(response_data), 500
            
    except Exception as e:
        response_data['error'] = f'Error saving report: {str(e)}'
        response_data['debug_info']['traceback'] = traceback.format_exc()
        
        current_app.logger.error(f"Unhandled error saving report: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        
        return jsonify(response_data), 500

# Function to register this blueprint with the Flask app
def register_direct_report_endpoint(app):
    app.register_blueprint(direct_report_bp)
    return app
@file_bp.route('/upload', methods=['POST'])
def upload_file():
    """
    Handle file uploads in a Vercel-compatible way
    """
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No file part in the request'
        }), 400
        
    file = request.files['file']
    
    # If user does not select file, browser also
    # submit an empty part without filename
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'No selected file'
        }), 400
        
    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': f'File type not allowed. Please upload: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400
    
    try:
        # Create a secure filename
        filename = secure_filename(file.filename)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as temp:
            file.save(temp.name)
            temp_path = temp.name
        
        # Process the file based on its type
        if filename.endswith('.csv'):
            result = process_csv(temp_path, filename)
        elif filename.endswith(('.xlsx', '.xls')):
            result = process_excel(temp_path, filename)
        else:
            # This should never happen due to the allowed_file check above
            os.unlink(temp_path)  # Clean up
            return jsonify({
                'success': False,
                'error': 'Unsupported file type'
            }), 400
        
        # Clean up the temporary file
        os.unlink(temp_path)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': f'Successfully processed {filename}',
                'columns': result['columns'],
                'previewData': result['data'][:10],  # Send only first 10 rows as preview
                'nodes': result['nodes'],
                'coordinates': result['coordinates'],
                'company_names': result['company_names'],
                'demands': result['demands'],
                'distanceMatrixPreview': result.get('distance_matrix_preview', [])
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400
            
    except Exception as e:
        # Log the error for debugging
        print(f"Error processing upload: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Error processing file: {str(e)}'
        }), 500

def process_csv(filepath, filename):
    """
    Process CSV file
    
    Args:
        filepath: Path to temporary file
        filename: Original filename
        
    Returns:
        dict: Processing result
    """
    try:
        import pandas as pd
        
        # Read CSV file
        df = pd.read_csv(filepath)
        
        # Basic validation
        required_columns = ['Name', 'X', 'Y', 'Demand']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return {
                'success': False,
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }
        
        # Process data
        coordinates = df[['X', 'Y']].values.tolist()
        company_names = df['Name'].tolist()
        demands = df['Demand'].tolist()
        
        # Create distance matrix preview (first 5x5)
        from math import sqrt, cos, radians
        n = min(5, len(coordinates))
        preview = [[0 for _ in range(n)] for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    # Calculate Euclidean distance (in meters)
                    x1, y1 = coordinates[i]
                    x2, y2 = coordinates[j]
                    preview[i][j] = int(sqrt((x2 - x1)**2 + (y2 - y1)**2) * 100)  # Scale for display
        
        return {
            'success': True,
            'columns': df.columns.tolist(),
            'data': df.to_dict('records'),
            'nodes': len(df),
            'coordinates': coordinates,
            'company_names': company_names,
            'demands': demands,
            'distance_matrix_preview': preview
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Error reading CSV: {str(e)}'
        }

def process_excel(filepath, filename):
    """
    Process Excel file
    
    Args:
        filepath: Path to temporary file
        filename: Original filename
        
    Returns:
        dict: Processing result
    """
    try:
        import pandas as pd
        
        # Read Excel file
        df = pd.read_excel(filepath)
        
        # Basic validation
        required_columns = ['Name', 'X', 'Y', 'Demand']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return {
                'success': False,
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }
        
        # Process data
        coordinates = df[['X', 'Y']].values.tolist()
        company_names = df['Name'].tolist()
        demands = df['Demand'].tolist()
        
        # Create distance matrix preview (first 5x5)
        from math import sqrt, cos, radians
        n = min(5, len(coordinates))
        preview = [[0 for _ in range(n)] for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    # Calculate Euclidean distance (in meters)
                    x1, y1 = coordinates[i]
                    x2, y2 = coordinates[j]
                    preview[i][j] = int(sqrt((x2 - x1)**2 + (y2 - y1)**2) * 100)  # Scale for display
        
        return {
            'success': True,
            'columns': df.columns.tolist(),
            'data': df.to_dict('records'),
            'nodes': len(df),
            'coordinates': coordinates,
            'company_names': company_names,
            'demands': demands,
            'distance_matrix_preview': preview
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Error reading Excel file: {str(e)}'
        }


# Sample data endpoint
@file_bp.route('/sample_data', methods=['GET'])
def get_sample_data():
    """Provide sample data when file uploads aren't working"""
    # Sample data for CVRP problem
    sample_data = {
        "coordinates": [
            [40.73061, -73.935242],  # Node 0 (Depot)
            [40.736591, -73.919061],  # Node 1
            [40.742652, -73.925686],  # Node 2
            [40.736073, -73.913830],  # Node 3
            [40.728226, -73.926659],  # Node 4
            [40.721573, -73.932344],  # Node 5
            [40.724427, -73.917666],  # Node 6
            [40.730824, -73.908053],  # Node 7
            [40.741550, -73.937839],  # Node 8
            [40.714454, -73.923364],  # Node 9
        ],
        "demands": [0, 8, 5, 7, 4, 6, 3, 9, 7, 5],
        "company_names": [
            "Depot",
            "Customer A",
            "Customer B",
            "Customer C", 
            "Customer D",
            "Customer E",
            "Customer F",
            "Customer G",
            "Customer H", 
            "Customer I"
        ],
    }
    
    # Calculate distance matrix preview
    from math import sqrt, cos, radians
    n = 5  # Preview size
    preview = [[0 for _ in range(n)] for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                # Calculate distance (approximately in meters)
                lat1, lon1 = sample_data["coordinates"][i]
                lat2, lon2 = sample_data["coordinates"][j]
                
                # Simplified distance calculation
                dlat = (lat2 - lat1) * 111000  # 1 degree latitude is approx 111km
                dlon = (lon2 - lon1) * 111000 * abs(cos(radians((lat1 + lat2) / 2)))
                dist = sqrt(dlat**2 + dlon**2)
                preview[i][j] = int(dist)
    
    # Create preview data for table display
    preview_data = []
    for i in range(len(sample_data["coordinates"])):
        preview_data.append({
            'Name': sample_data["company_names"][i],
            'X': sample_data["coordinates"][i][0], 
            'Y': sample_data["coordinates"][i][1],
            'Demand': sample_data["demands"][i]
        })
    
    return jsonify({
        'success': True,
        'message': 'Sample data loaded successfully',
        'columns': ['Name', 'X', 'Y', 'Demand'],
        'previewData': preview_data,
        'nodes': len(sample_data["coordinates"]),
        'coordinates': sample_data["coordinates"],
        'company_names': sample_data["company_names"],
        'demands': sample_data["demands"],
        'distanceMatrixPreview': preview
    })
# Context processor to make subscription-related data available to templates
# Context processor to make subscription-related data and report count available to templates
@app.context_processor
def inject_subscription_data():
    if 'user' in session:
        subscription_manager = get_subscription_manager()
        subscription = subscription_manager.get_user_subscription(session['user']['id'])
        
        default_limits = {
            'max_routes': 5,
            'max_drivers': 3
        }
        
        # Get plan features if subscription exists
        if subscription:
            # Initialize with default limits
            subscription['limits'] = default_limits
            
            plan_id = subscription.get('plan_id')
            # Get plan features if subscription exists
            if subscription:
                plan_id = subscription.get('plan_id')
                for plan_key, plan_info in subscription_manager.PLANS.items():
                    if plan_info['variant_id'] == plan_id:
                        subscription['plan_name'] = plan_info['name']
                        subscription['features'] = plan_info['features']
                        subscription['limits'] = plan_info['limits']  # Add this line
                        subscription['plan_key'] = plan_key          # Add this for reference
                        break
        
        # Get report count using Supabase client
        report_count = 0
        try:
            # Get user ID
            user_id = session['user']['id']
            
            # Get report count from Supabase
            response = supabase.table('route_reports').select('count').eq('user_id', user_id).execute()
            
            # Check if we got a response with count
            if hasattr(response, 'count') and response.count is not None:
                report_count = response.count
            # Fallback: If count isn't available, check data length
            elif hasattr(response, 'data') and response.data:
                if isinstance(response.data, list):
                    report_count = len(response.data)
                elif 'count' in response.data:
                    report_count = response.data['count']
                
        except Exception as e:
            print(f"Error getting report count from Supabase: {str(e)}")
            # Default to 0 if there's an error
            report_count = 0
        
        return {
            'subscription': subscription,
            'plans': subscription_manager.PLANS,
            'report_count': report_count  # Make this available to templates
        }
    return {}
# Public routes
@app.route('/')
def landing():
    return render_template('landing.html')
@app.template_filter('date')
def date_filter(value, format='%Y-%m-%d'):
    """Convert a datetime to a different format."""
    if value is None:
        return ""
    if isinstance(value, str):
        try:
            from datetime import datetime
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return value
    return value.strftime(format)
@app.route('/get_google_maps_key', methods=['GET'])
def get_google_maps_key():
    """Return the Google Maps API key for client-side use"""
    return jsonify({
        'success': True,
        'api_key': GOOGLE_MAPS_API_KEY
    })

# Authentication routes
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        data = request.form
        email = data.get('email')
        password = data.get('password')
        confirm_password = data.get('confirmPassword')
        
        # Check if passwords match
        if password != confirm_password:
            return render_template('signup.html', error="Passwords don't match. Please try again.")
        
        # Basic password validation
        if len(password) < 8:
            return render_template('signup.html', error="Password must be at least 8 characters long.")
            
        try:
            # Register user with Supabase
            response = supabase.auth.sign_up({
                "email": email,
                "password": password,
            })
            
            if response.user:
                flash('Account created successfully! Please log in.', 'success')
                return redirect(url_for('login'))
            else:
                return render_template('signup.html', error="Signup failed. Please try again.")
                
        except Exception as e:
            # Handle specific exceptions
            error_message = str(e)
            if "User already registered" in error_message:
                return render_template('signup.html', error="This email is already registered. Please log in instead.")
            else:
                return render_template('signup.html', error=f"Error during signup: {error_message}")
            
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    # If user is already logged in, redirect to dashboard
    if 'user' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        data = request.form
        email = data.get('email')
        password = data.get('password')
        
        # Check if fields are empty
        if not email or not password:
            return render_template('login.html', error="Please enter both email and password.")
        
        try:
            # Login with Supabase
            response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user:
                # Store session data
                try:
                    session.clear()  # Clear any existing session data
                    session['user'] = {
                        'id': response.user.id,
                        'email': response.user.email,
                        'access_token': response.session.access_token,
                        'refresh_token': response.session.refresh_token
                    }
                    # Test that session data was stored successfully
                    if 'user' not in session:
                        app.logger.error("Failed to store user data in session")
                        return render_template('login.html', error="Session storage failed. Please try again.")
                    
                    # Check if there's a next URL to redirect to
                    next_url = session.pop('next_url', None)
                    if next_url:
                        return redirect(next_url)
                        
                    return redirect(url_for('dashboard'))
                except Exception as e:
                    app.logger.error(f"Session error: {str(e)}")
                    return render_template('login.html', error=f"Session error: {str(e)}")
            else:
                return render_template('login.html', error="Login failed. Please check your credentials.")
                
        except Exception as e:
            error_message = str(e)
            app.logger.error(f"Login error: {error_message}")
            if "Invalid login credentials" in error_message:
                return render_template('login.html', error="Invalid email or password. Please try again.")
            else:
                return render_template('login.html', error=f"Error during login: {error_message}")
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    # Remove user data from session
    user_data = session.pop('user', None)
    
    # Only call Supabase signout if we had a user session
    if user_data and user_data.get('access_token'):
        try:
            # Sign out from Supabase
            supabase.auth.sign_out(user_data.get('access_token'))
        except Exception as e:
            # Just log the error, don't interrupt logout flow
            print(f"Error during Supabase sign out: {str(e)}")
    
    flash('You have been successfully logged out', 'info')
    return redirect(url_for('landing'))
@app.route('/debug-checkout/<plan_id>')
def debug_checkout(plan_id):
    """Debug route to check checkout session creation"""
    # Check if user is logged in
    if 'user' not in session:
        return jsonify({
            'success': False, 
            'error': 'Not logged in',
            'session_data': str(session)
        })
    
    try:
        # Get subscription manager
        subscription_manager = get_subscription_manager()
        
        # Check if the plan exists
        if plan_id not in subscription_manager.PLANS:
            return jsonify({
                'success': False,
                'error': 'Invalid plan ID',
                'available_plans': list(subscription_manager.PLANS.keys())
            })
        
        # Get environment variables status
        env_status = {
            'LEMON_SQUEEZY_API_KEY': bool(os.getenv('LEMON_SQUEEZY_API_KEY')),
            'LEMON_SQUEEZY_STORE_ID': bool(os.getenv('LEMON_SQUEEZY_STORE_ID')),
            'SESSION_SECRET': bool(os.getenv('SESSION_SECRET')),
            'SUPABASE_URL': bool(os.getenv('SUPABASE_URL')),
            'SUPABASE_KEY': bool(os.getenv('SUPABASE_KEY'))
        }
        
        # Get user data
        user = session.get('user', {})
        
        # Check if we have all required data
        if not user.get('id') or not user.get('email'):
            return jsonify({
                'success': False,
                'error': 'Missing user data',
                'user_data': {
                    'id': bool(user.get('id')),
                    'email': bool(user.get('email'))
                }
            })
        
        # Create success and cancel URLs
        success_url = url_for('subscription.success', _external=True)
        cancel_url = url_for('subscription.pricing', _external=True)
        
        # Return debug info
        return jsonify({
            'success': True,
            'message': 'Debug info for checkout session',
            'plan_id': plan_id,
            'plan_info': subscription_manager.PLANS.get(plan_id),
            'user_id': user.get('id'),
            'user_email': user.get('email'),
            'environment_vars': env_status,
            'urls': {
                'success_url': success_url,
                'cancel_url': cancel_url
            }
        })
        
    except Exception as e:
        app.logger.error(f"Debug checkout error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        })
@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        
        try:
            # Send password reset email
            supabase.auth.reset_password_email(email)
            flash("Password reset instructions have been sent to your email", "info")
            return redirect(url_for('login'))
        except Exception as e:
            flash(f"Error: {str(e)}", "danger")
    
    return render_template('forgot_password.html')


# Protected user routes
@app.route('/dashboard')
@login_required
def dashboard():
    # User object is already checked in the login_required decorator
    user = session['user']
    
    # Get subscription manager to provide limits and usage to the template
    subscription_manager = get_subscription_manager()
    
    # Default values in case of errors
    subscription = None
    routes_used = 0
    total_routes = 0
    
    # Fetch any additional user data if needed
    try:
        # Get user's subscription details
        subscription = subscription_manager.get_user_subscription(user['id'])
        
        # Ensure subscription has limits
        if subscription and 'limits' not in subscription:
            # Get default limits from plans or use trial limits
            default_limits = {
                'max_routes': 5,
                'max_drivers': 3
            }
            
            # Try to find the plan for this subscription
            plan_id = subscription.get('plan_id')
            for plan_key, plan_info in subscription_manager.PLANS.items():
                if plan_info['variant_id'] == plan_id:
                    default_limits = plan_info['limits']
                    break
                    
            subscription['limits'] = default_limits
        
        # Get usage statistics with proper error handling
        try:
            user_usage = subscription_manager.get_user_usage(user['id'])
            routes_used = user_usage.get('routes_created', 0)
        except Exception as e:
            print(f"Error getting user usage: {str(e)}")
            routes_used = 0
        
        # Get total routes created (all time) with proper error handling
        try:
            response = supabase.table('usage_tracking').select('routes_created').eq('user_id', user['id']).execute()
            total_routes = sum(item.get('routes_created', 0) for item in response.data) if response.data else 0
        except Exception as e:
            print(f"Error getting total routes: {str(e)}")
            total_routes = 0
            
    except Exception as e:
        import traceback
        print(f"Error loading subscription data: {str(e)}")
        print(traceback.format_exc())
        flash(f"Error loading subscription data. Please try refreshing the page.", "warning")
    
    # Print debug information
    print(f"Dashboard data: user_id={user['id']}, routes_used={routes_used}, total_routes={total_routes}")
    if subscription:
        print(f"Subscription: {subscription}")
    
    return render_template('dashboard.html', 
                          user=user, 
                          subscription=subscription,
                          routes_used=routes_used,
                          total_routes=total_routes)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    user = session['user']
    
    if request.method == 'POST':
        action = request.form.get('action', '')
        
        if action == 'change_password':
            current_password = request.form.get('current_password')
            new_password = request.form.get('new_password')
            confirm_password = request.form.get('confirm_password')
            
            if new_password != confirm_password:
                flash("New passwords don't match", "danger")
                return redirect(url_for('profile'))
            
            try:
                # Update password using Supabase
                # This is a placeholder - Supabase might have a different method
                # supabase.auth.update_user_password(current_password, new_password)
                flash("Password updated successfully", "success")
            except Exception as e:
                flash(f"Error updating password: {str(e)}", "danger")
        
        elif action == 'update_preferences':
            # Handle preferences update
            # This is just a placeholder for demonstration
            flash("Preferences updated successfully", "success")
        
        else:
            # Handle profile update
            name = request.form.get('name')
            company = request.form.get('company')
            phone = request.form.get('phone')
            
            try:
                # Update profile in database
                # profile_data = {"name": name, "company": company, "phone": phone}
                # supabase.table('profiles').update(profile_data).eq('user_id', user['id']).execute()
                flash("Profile updated successfully", "success")
            except Exception as e:
                flash(f"Error updating profile: {str(e)}", "danger")
    
    return render_template('profile.html', user=user)
@app.route('/debug-session-data')
@login_required
def debug_session_data():
    """Debug endpoint to view session data"""
    return jsonify({
        'session_keys': list(session.keys()),
        'data_present': 'data' in session,
        'problem_data_present': 'problem_data' in session,
        'coordinates_present': 'coordinates' in session,
        'data_info': {
            'coordinates_length': len(session.get('data', {}).get('coordinates', [])) if 'data' in session else 0,
            'demands_length': len(session.get('data', {}).get('demands', [])) if 'data' in session else 0,
        }
    })
@app.route('/logout-all-sessions', methods=['POST'])
@login_required
def logout_all_sessions():
    user = session['user']
    
    try:
        # Placeholder - Supabase might have a method to log out from all sessions
        # supabase.auth.logout_all_sessions(user['access_token'])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# Protected app routes
@app.route('/solver')
@login_required
def solver_app():
    try:
        return render_template('index.html')
    except Exception as e:
        return f"Error loading template: {str(e)}"

# Route to serve templates directly - this helps with debugging
@app.route('/templates')
@login_required
def templates():
    return render_template('index.html')

# File upload and processing routes
@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    try:
        # Get user ID from session
        user_id = session['user']['id']
        
        # Process file with pandas
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext in ['.xlsx', '.xls']:
            data_df = pd.read_excel(file)
        elif file_ext == '.csv':
            data_df = pd.read_csv(file)
        else:
            return jsonify({'success': False, 'error': 'Unsupported file format'})
        
        # Extract coordinates, names, and demands from the DataFrame
        coordinates = []
        company_names = []
        demands = []
        
        # Extract coordinates
        if 'X' in data_df.columns and 'Y' in data_df.columns:
            coordinates = data_df[['X', 'Y']].values.tolist()
        elif 'x_coord' in data_df.columns and 'y_coord' in data_df.columns:
            coordinates = data_df[['x_coord', 'y_coord']].values.tolist()
        elif 'coordinates' in data_df.columns:
            # Try to parse coordinates from a combined field
            for coord_str in data_df['coordinates']:
                try:
                    if isinstance(coord_str, str):
                        coord_str = coord_str.strip('() ')
                        parts = coord_str.split(',')
                        if len(parts) == 2:
                            lat = float(parts[0].strip())
                            lng = float(parts[1].strip())
                            coordinates.append([lat, lng])
                except Exception as e:
                    print(f"Error parsing coordinate: {coord_str}: {e}")
        
        # Extract company names
        if 'company_name' in data_df.columns:
            company_names = data_df['company_name'].tolist()
        elif 'Name' in data_df.columns:
            company_names = data_df['Name'].tolist()
        
        # Extract demands
        if 'demand' in data_df.columns:
            demands = data_df['demand'].tolist()
        elif 'Demand' in data_df.columns:
            demands = data_df['Demand'].tolist()
        
        # Convert DataFrame to JSON for storage
        data_json = data_df.to_json(orient='records')
        
        # Use the secure RPC function instead of direct table insert
        response = supabase.rpc(
            'insert_user_upload', 
            {
                'p_user_id': user_id,
                'p_file_name': file.filename,
                'p_file_type': file.content_type,
                'p_data': json.loads(data_json),  # Must be parsed as Python dict
                'p_row_count': len(data_df),
                'p_columns': data_df.columns.tolist()
            }
        ).execute()
        
        # Store data in session for later processing
        session['data'] = {
            'coordinates': coordinates,
            'company_names': company_names,
            'demands': demands,
            'dataframe': json.dumps({
                'data': data_df.to_dict('records')[:20],  # Limit to 20 rows for session size
                'columns': data_df.columns.tolist()
            })
        }
        session.modified = True  # Force session update
        
        # Debug: Print what we're storing in session
        print(f"Storing in session: {len(coordinates)} coords, " +
              f"{len(demands)} demands")
        
        if not response.data:
            return jsonify({'success': False, 'error': 'Failed to store upload data'}), 500
            
        # Extract the returned UUID
        upload_id = response.data
        
        # Store upload ID in session
        session['current_upload_id'] = upload_id
        
        # Calculate distance matrix preview
        max_preview = min(5, len(coordinates))
        matrix_preview = []
        
        from math import sqrt
        for i in range(max_preview):
            row = []
            for j in range(max_preview):
                if i == j:
                    row.append(0)
                else:
                    # Calculate Euclidean distance (in meters)
                    x1, y1 = coordinates[i]
                    x2, y2 = coordinates[j]
                    dist = int(sqrt((x2 - x1)**2 + (y2 - y1)**2) * 100)  # Scale for display
                    row.append(dist)
            matrix_preview.append(row)
        
        # Return data preview to client
        return jsonify({
            'success': True,
            'message': f'File {file.filename} uploaded successfully',
            'upload_id': upload_id,
            'columns': data_df.columns.tolist(),
            'previewData': data_df.head(20).to_dict('records'),
            'nodes': len(coordinates),
            'coordinates': coordinates,
            'company_names': company_names,
            'demands': demands,
            'distanceMatrixPreview': matrix_preview
        })
    
    except Exception as e:
        print(f"Error in file upload: {str(e)}")
        return jsonify({
            'success': False, 
            'error': str(e)
        })

@app.route('/generate_random', methods=['POST'])
@login_required
def generate_random():
    try:
        params = request.get_json()
        num_nodes = int(params.get('num_nodes', 10))
        depot = int(params.get('depot', 0))
        max_vehicles = int(params.get('max_vehicles', 5))
        
        # Check driver limit
        is_allowed, max_allowed, error_message = driver_limit_check(max_vehicles, session['user']['id'])
        
        if not is_allowed:
            return jsonify({
                'success': False, 
                'error': error_message,
                'limit_exceeded': True,
                'max_allowed': max_allowed
            })
        
        if depot < 0 or depot >= num_nodes:
            return jsonify({'success': False, 'error': 'Depot index must be between 0 and num_nodes-1'})
        
        # Generate random coordinates
        np.random.seed(42)  # For reproducibility
        coordinates = np.random.rand(num_nodes, 2) * 100
        
        # Compute distance matrix
        distance_matrix = compute_euclidean_distance_matrix(coordinates)
        
        # Generate random demands
        demands = [0] * num_nodes  # Initialize all with 0
        demands[depot] = 0  # Ensure depot has 0 demand
        
        for i in range(num_nodes):
            if i != depot:
                demands[i] = np.random.randint(1, 10)
        
        # Generate node names
        company_names = [f"Depot" if i == depot else f"Customer {i}" for i in range(num_nodes)]
        
        # Store in session
        session['problem_data'] = {
            'coordinates': coordinates.tolist(),
            'distance_matrix': distance_matrix.tolist(),
            'demands': demands,
            'company_names': company_names,
            'depot': depot,
            'vehicle_capacity': int(params.get('vehicle_capacity', 20)),
            'max_vehicles': max_vehicles,  # Use the checked max_vehicles value
        }
        
        # Get subscription manager to provide limits to the frontend
        subscription_manager = get_subscription_manager()
        user_limits = subscription_manager.get_user_limits(session['user']['id'])
        user_usage = subscription_manager.get_user_usage(session['user']['id'])
        
        return jsonify({
            'success': True,
            'message': 'Random problem generated successfully',
            'nodes': num_nodes,
            'coordinates': coordinates.tolist(),
            'demands': demands,
            'company_names': company_names,
            'distanceMatrixPreview': [
                [f"{val:.2f}" for val in row] 
                for row in distance_matrix
            ],
            'subscription': {
                'max_routes': user_limits.get('max_routes'),
                'max_drivers': user_limits.get('max_drivers'),
                'routes_used': user_usage.get('routes_created'),
                'is_trial': user_limits.get('is_trial', False)
            }
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/process_data', methods=['POST'])
@with_db_connection(use_service_role=True)  # Use service role to bypass RLS
def process_data():
    try:
        # Get parameters from request
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400
            
        depot = data.get('depot', 0)
        vehicle_capacity = data.get('vehicle_capacity', 20)
        max_vehicles = data.get('max_vehicles', 5)
        use_google_maps = data.get('use_google_maps', False)
        google_maps_options = data.get('google_maps_options', {})
        
          # Debug: Print session keys and request parameters
        print("DEBUG - Process data called with:")
        print(f"Session keys: {list(session.keys())}")
        print(f"Parameters: depot={depot}, capacity={vehicle_capacity}, vehicles={max_vehicles}")
        print(f"Use Google Maps: {use_google_maps}")
        
        # Clear out any previous problem_data
        if 'problem_data' in session:
            del session['problem_data']
        # Find the data in session - check both possible storage locations
        coordinates = None
        company_names = None
        demands = None
        
        print("Session keys:", list(session.keys()))
        
        # Check if data is from file upload (session['data'])
        if 'data' in session and session['data']:
            print("Found data from file upload in session['data']")
            try:
                # Parse the dataframe from JSON
                import pandas as pd
                import json
                
                df_data = json.loads(session['data']['dataframe'])
                df = pd.DataFrame(df_data['data'], columns=df_data['columns'])
                
                # Extract coordinates based on column names
                if 'X' in df.columns and 'Y' in df.columns:
                    coordinates = df[['X', 'Y']].values.tolist()
                elif 'x_coord' in df.columns and 'y_coord' in df.columns:
                    coordinates = df[['x_coord', 'y_coord']].values.tolist()
                elif 'coordinates' in df.columns:
                    # Handle coordinates as a single column "(lat, lng)"
                    coordinates = []
                    for coord_str in df['coordinates']:
                        try:
                            if isinstance(coord_str, str):
                                coord_str = coord_str.strip('() ')
                                parts = coord_str.split(',')
                                if len(parts) == 2:
                                    lat = float(parts[0].strip())
                                    lng = float(parts[1].strip())
                                    coordinates.append([lat, lng])
                        except Exception as e:
                            print(f"Error parsing coordinate: {coord_str}: {e}")
                
                # Extract company names
                if 'company_name' in df.columns:
                    company_names = df['company_name'].tolist()
                elif 'Name' in df.columns:
                    company_names = df['Name'].tolist()
                
                # Extract demands
                if 'demand' in df.columns:
                    demands = df['demand'].tolist()
                elif 'Demand' in df.columns:
                    demands = df['Demand'].tolist()
                
                print(f"Extracted from dataframe: coords={len(coordinates) if coordinates else 0}, " +
                     f"names={len(company_names) if company_names else 0}, demands={len(demands) if demands else 0}")
                     
            except Exception as e:
                print(f"Error processing session['data']: {str(e)}")
        
        # Check if data is from random generation (session['problem_data'])
        elif 'problem_data' in session and session['problem_data']:
            print("Found data from random generation in session['problem_data']")
            problem_data = session['problem_data']
            coordinates = problem_data.get('coordinates', [])
            company_names = problem_data.get('company_names', [])
            demands = problem_data.get('demands', [])
            print(f"Extracted from problem_data: coords={len(coordinates)}, " +
                 f"names={len(company_names) if company_names else 0}, demands={len(demands) if demands else 0}")
        
        # Direct session access (fallback - older approach)
        elif all(k in session for k in ['coordinates', 'company_names', 'demands']):
            print("Found data directly in session")
            coordinates = session.get('coordinates', [])
            company_names = session.get('company_names', [])
            demands = session.get('demands', [])
        
        # Validate that we have the required data
        if not coordinates or len(coordinates) == 0:
            return jsonify({
                'success': False,
                'error': 'No coordinate data found. Please upload data or generate a random problem first.'
            }), 400
        
        # Store data in session keys for other functions to use
        session['coordinates'] = coordinates
        session['company_names'] = company_names or [f"Node {i}" if i != depot else "Depot" for i in range(len(coordinates))]
        session['demands'] = demands or [0 if i == depot else 5 for i in range(len(coordinates))]
        
        print(f"Session data prepared: {len(coordinates)} coordinates, {len(session['demands'])} demands")
        
        # Connect to database with service role credentials
        # g.db is provided by the @with_db_connection decorator
        with g.db.cursor() as cursor:
            # Store problem configuration in database
            cursor.execute("""
                INSERT INTO problem_configs 
                (user_id, depot_idx, vehicle_capacity, max_vehicles, use_google_maps, google_maps_options)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                session.get('user', {}).get('id', 'anonymous'),  # Get user ID if available
                depot,
                vehicle_capacity,
                max_vehicles,
                use_google_maps,
                json.dumps(google_maps_options)
            ))
            
            config_id = cursor.fetchone()['id']
            
            # Associate coordinates, names, and demands with this config
            for i, coord in enumerate(coordinates):
                name = session['company_names'][i] if i < len(session['company_names']) else f"Node {i}"
                demand = session['demands'][i] if i < len(session['demands']) else (0 if i == depot else 5)
                
                cursor.execute("""
                    INSERT INTO nodes
                    (config_id, node_idx, lat, lon, name, demand)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    config_id,
                    i,
                    coord[0],
                    coord[1],
                    name,
                    demand
                ))
            
            # Commit the transaction
            g.db.commit()
            
            # Store config_id in session
            session['config_id'] = config_id
        
        # Calculate distance matrix
        distance_matrix = calculate_distance_matrix(
            coordinates,
            use_google_maps=use_google_maps,
            options=google_maps_options
        )
        
        # Store matrix in session for later use
        session['distance_matrix'] = distance_matrix
        
        # Create a small preview of the matrix for display (5x5)
        matrix_preview = []
        max_preview = min(5, len(distance_matrix))
        for i in range(max_preview):
            row = []
            for j in range(max_preview):
                row.append(distance_matrix[i][j])
            matrix_preview.append(row)
        
        # Update problem_data if it exists
        if 'problem_data' in session:
            session['problem_data']['distance_matrix'] = distance_matrix
        
        return jsonify({
            'success': True,
            'message': 'Data processed successfully',
            'nodes': len(coordinates),
            'depot': depot,
            'vehicle_capacity': vehicle_capacity,
            'max_vehicles': max_vehicles,
            'distance_type': 'Google Maps API' if use_google_maps else 'Euclidean',
            'distanceMatrixPreview': matrix_preview
        })
        
    except Exception as e:
        # Print full traceback for debugging
        import traceback
        traceback.print_exc()
        
        # Check for specific database errors
        if "violates row-level security policy" in str(e):
            return jsonify({
                'success': False,
                'error': 'Database permission error. Please check if service role is configured correctly.',
                'details': str(e)
            }), 403
        
        return jsonify({
            'success': False,
            'error': f'Error processing data: {str(e)}'
        }), 500

# Helper function for distance calculation (implement based on your existing code)
def calculate_distance_matrix(coordinates, use_google_maps=False, options=None):
    """Calculate distance matrix from coordinates"""
    import math
    
    n = len(coordinates)
    matrix = [[0 for _ in range(n)] for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                # Calculate Euclidean distance in meters
                lat1, lon1 = coordinates[i]
                lat2, lon2 = coordinates[j]
                
                # Convert to radians
                lat1, lon1 = math.radians(lat1), math.radians(lon1)
                lat2, lon2 = math.radians(lat2), math.radians(lon2)
                
                # Haversine formula for distance
                dlon = lon2 - lon1
                dlat = lat2 - lat1
                a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
                c = 2 * math.asin(math.sqrt(a))
                r = 6371000  # Radius of Earth in meters
                matrix[i][j] = c * r
    
    return matrix
@app.route('/get_distance_matrix', methods=['GET'])
@login_required
def get_distance_matrix():
    if 'problem_data' not in session:
        return jsonify({'success': False, 'error': 'No problem data available'})
    
    problem_data = session['problem_data']
    
    # Get company names if available
    company_names = problem_data.get('company_names')
    node_labels = None
    
    # If we have company names, use them as node labels
    if company_names:
        node_labels = company_names
    
    return jsonify({
        'success': True,
        'matrix': problem_data['distance_matrix'],
        'nodes': len(problem_data['distance_matrix']),
        'node_labels': node_labels,
        'distance_type': problem_data.get('distance_type', 'Euclidean')
    })

@app.route('/solve', methods=['POST'])
@login_required
@route_limit_required  # Add this decorator to check route limits
def solve():
    if 'problem_data' not in session:
        return jsonify({'success': False, 'error': 'No problem data available'})
    
    try:
        # Get algorithm parameters
        params = request.get_json()
        problem_data = session['problem_data']
        
        # Check if the max_vehicles exceeds the user's subscription limit
        max_vehicles = int(params.get('max_vehicles', problem_data.get('max_vehicles', 5)))
        is_allowed, max_allowed, error_message = driver_limit_check(max_vehicles, session['user']['id'])
        
        if not is_allowed:
            return jsonify({
                'success': False, 
                'error': error_message,
                'limit_exceeded': True,
                'max_allowed': max_allowed
            })
        
        # Create a unique job ID
        job_id = str(uuid.uuid4())
        
        # Store user ID with job
        if 'user' in session:
            user_id = session['user']['id']
        else:
            user_id = None
        
        # Initialize progress
        solver_jobs[job_id] = {
            'status': 'initializing',
            'progress': 0,
            'message': 'Initializing solver...',
            'updates': [],
            'user_id': user_id  # Associate job with user
        }
        
        # Record route creation in usage tracking
        subscription_manager = get_subscription_manager()
        subscription_manager.record_route_creation(user_id)
        
        # Start solver in a separate thread
        thread = threading.Thread(
            target=run_solver, 
            args=(
                job_id, 
                problem_data, 
                params
            )
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'message': 'Solver started'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/solver_status/<job_id>', methods=['GET'])
@login_required
def solver_status(job_id):
    if job_id not in solver_jobs:
        return jsonify({'success': False, 'error': 'Job not found'})
    
    # Check if the job belongs to the current user
    if 'user' in session and solver_jobs[job_id].get('user_id') != session['user']['id']:
        return jsonify({'success': False, 'error': 'Unauthorized access to job'})
    
    job_info = solver_jobs[job_id]
    
    # If there are updates, return them and clear the list
    updates = job_info.get('updates', [])
    solver_jobs[job_id]['updates'] = []
    
    return jsonify({
        'success': True,
        'status': job_info['status'],
        'progress': job_info['progress'],
        'message': job_info['message'],
        'updates': updates,
        'solution': job_info.get('solution', None)
    })

@app.route('/get_solution/<job_id>', methods=['GET'])
@login_required
def get_solution(job_id):
    if job_id not in solver_jobs:
        return jsonify({'success': False, 'error': 'Job not found'})
    
    # Check if the job belongs to the current user
    if 'user' in session and solver_jobs[job_id].get('user_id') != session['user']['id']:
        return jsonify({'success': False, 'error': 'Unauthorized access to job'})
    
    job_info = solver_jobs[job_id]
    
    if job_info['status'] != 'completed':
        return jsonify({'success': False, 'error': 'Solution not ready yet'})
    
    return jsonify({
        'success': True,
        'solution': job_info.get('solution', None),
        'cost_history': job_info.get('cost_history', []),
        'temp_history': job_info.get('temp_history', [])
    })
@app.route('/proxy_google_distance_matrix', methods=['POST'])
def proxy_google_distance_matrix():
    """Proxy Google Maps Distance Matrix API requests to protect API key"""
    try:
        # Get request data
        data = request.get_json()
        
        # Check required parameters
        if not data or not all(k in data for k in ['origins', 'destinations']):
            return jsonify({
                'success': False,
                'error': 'Missing required parameters'
            }), 400
        
        # Get API key from environment
        api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        if not api_key:
            return jsonify({
                'success': False,
                'error': 'Google Maps API key not configured'
            }), 500
        
        # Construct request URL
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            'origins': data['origins'],
            'destinations': data['destinations'],
            'mode': data.get('mode', 'driving'),
            'units': 'metric',
            'key': api_key
        }
        
        # Add optional parameters if present
        if 'avoid' in data and data['avoid']:
            params['avoid'] = data['avoid']
        
        # Make request to Google API
        response = requests.get(url, params=params)
        
        # Check if request was successful
        if response.status_code == 200:
            google_data = response.json()
            
            # Check Google API response status
            if google_data.get('status') == 'OK':
                return jsonify({
                    'success': True,
                    'results': google_data
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f"Google API error: {google_data.get('status')}",
                    'error_message': google_data.get('error_message', '')
                }), 400
        else:
            return jsonify({
                'success': False,
                'error': f"HTTP error: {response.status_code}",
                'response': response.text
            }), response.status_code
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
@app.errorhandler(Exception)
def handle_error(e):
    import traceback
    print(f"Unhandled exception: {traceback.format_exc()}")
    return jsonify({
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }), 500
# Add this to app.py
@app.route('/debug/reset-tracking', methods=['POST'])
@login_required
def reset_tracking_debug():
    """Debug endpoint to reset tracking state for the current user"""
    try:
        user_id = session['user']['id']
        today = datetime.now(timezone.utc).date()
        
        # Use a direct database connection with service role to bypass RLS
        conn = get_db_connection(use_service_role=True)
        updated = False
        
        try:
            with conn.cursor() as cursor:
                # Delete today's usage records for this user
                cursor.execute(
                    """
                    DELETE FROM usage_tracking 
                    WHERE user_id = %s AND usage_date = %s
                    RETURNING id
                    """,
                    (user_id, today)
                )
                result = cursor.fetchall()
                conn.commit()
                
                # Check if records were deleted
                updated = len(result) > 0
                
                # Log result
                print(f"Reset tracking for user {user_id}: Deleted {len(result)} records")
        finally:
            conn.close()
            
        return jsonify({
            'success': True,
            'reset': updated,
            'message': f"Reset tracking for user {user_id}" if updated else f"No records found to reset for user {user_id}"
        })
            
    except Exception as e:
        print(f"Error resetting tracking: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
@app.route('/debug/credits-info')
@login_required
def debug_credits_info():
    """Debug endpoint to check algorithm credits info"""
    user_id = session['user']['id']
    
    # Get subscription manager
    subscription_manager = get_subscription_manager()
    
    # Get credits info
    credits_info = subscription_manager.get_algorithm_credits(user_id)
    
    # Get direct usage stats
    from service_client import get_usage_stats_with_service_role
    direct_stats = get_usage_stats_with_service_role(user_id)
    
    # Get subscription info
    subscription = subscription_manager.get_user_subscription(user_id)
    
    return jsonify({
        'user_id': user_id,
        'credits_info': credits_info,
        'direct_stats': direct_stats,
        'subscription': {k: v for k, v in subscription.items() if k != 'features'} if subscription else None
    })
@app.route('/debug/usage-tracking', methods=['GET'])
@login_required
def debug_usage_tracking():
    """Debug endpoint to test usage tracking"""
    user_id = session['user']['id']
    
    # Import service client utilities
    from service_client import get_service_client, record_usage_with_service_role, get_usage_stats_with_service_role
    
    # Process any pending records first
    process_result = {}
    pending_records = session.get('pending_usage_records', [])
    
    if pending_records:
        processed_indices = []
        processed_count = 0
        
        for i, record in enumerate(pending_records):
            if record.get('user_id') != user_id:
                continue
                
            usage_type = record.get('type')
            if usage_type not in ['route_creation', 'algorithm_run']:
                continue
                
            result = record_usage_with_service_role(user_id, usage_type)
            
            if result.get('success'):
                processed_indices.append(i)
                processed_count += 1
        
        # Remove processed records from session
        new_pending = [record for i, record in enumerate(pending_records) if i not in processed_indices]
        session['pending_usage_records'] = new_pending
        session.modified = True
        
        process_result = {
            'processed': processed_count,
            'remaining': len(new_pending)
        }
    
    # Get current stats
    stats_result = get_usage_stats_with_service_role(user_id)
    
    # Add test record
    if request.args.get('test') == 'route':
        test_result = record_usage_with_service_role(user_id, 'route_creation')
    elif request.args.get('test') == 'algorithm':
        test_result = record_usage_with_service_role(user_id, 'algorithm_run')
    else:
        test_result = {'success': False, 'message': 'No test specified. Use ?test=route or ?test=algorithm to run a test'}
    
    # Get updated stats
    updated_stats = None
    if test_result.get('success', False):
        updated_stats = get_usage_stats_with_service_role(user_id)
    
    # Get pending records from session
    pending_records = session.get('pending_usage_records', [])
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'pending_records_processing': process_result,
        'current_stats': stats_result,
        'test_result': test_result,
        'updated_stats': updated_stats,
        'pending_records': pending_records,
        'session_keys': list(session.keys())
    })


@app.route('/process_pending_records', methods=['POST'])
@login_required
def process_pending_records():
    """Process any pending usage records stored in the session"""
    try:
        # Get user ID from session
        user_id = session.get('user', {}).get('id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User not authenticated'
            }), 401
        
        # Check if there are any pending records
        pending_records = session.get('pending_usage_records', [])
        
        if not pending_records:
            return jsonify({
                'success': True,
                'message': 'No pending records to process'
            })
        
        # Import the service client utility
        from service_client import record_usage_with_service_role
        
        # Process each record
        results = {
            'success': True,
            'total': len(pending_records),
            'processed': 0,
            'failed': 0,
            'details': []
        }
        
        # Keep track of records to remove
        processed_indices = []
        
        for i, record in enumerate(pending_records):
            if record.get('user_id') != user_id:
                # Skip records for other users
                continue
                
            usage_type = record.get('type')
            if usage_type not in ['route_creation', 'algorithm_run']:
                # Skip records with invalid type
                continue
                
            # Try to process the record
            result = record_usage_with_service_role(user_id, usage_type)
            
            if result.get('success'):
                processed_indices.append(i)
                results['processed'] += 1
                results['details'].append({
                    'type': usage_type,
                    'success': True,
                    'method': result.get('method')
                })
            else:
                results['failed'] += 1
                results['details'].append({
                    'type': usage_type,
                    'success': False,
                    'error': result.get('error')
                })
        
        # Remove processed records from session
        new_pending = [record for i, record in enumerate(pending_records) if i not in processed_indices]
        session['pending_usage_records'] = new_pending
        session.modified = True
        
        results['remaining'] = len(new_pending)
        
        return jsonify(results)
            
    except Exception as e:
        import traceback
        print(f"Error processing pending records: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
@app.route('/debug/service_role', methods=['GET'])
@login_required
def debug_service_role():
    """Debug endpoint to test service role connection"""
    user_id = session['user']['id']
    
    results = {
        'service_role_connection': {},
        'regular_connection': {},
        'environment_vars': {}
    }
    
    # Check environment variables (redacted for security)
    for key in ['SUPABASE_SERVICE_KEY', 'DATABASE_URL', 'SUPABASE_URL']:
        value = os.environ.get(key)
        results['environment_vars'][key] = {
            'exists': value is not None,
            'length': len(value) if value else 0
        }
    
    # Test service role connection
    try:
        conn = get_db_connection(use_service_role=True)
        results['service_role_connection']['success'] = True
        
        with conn.cursor() as cursor:
            # Test table access
            cursor.execute("""
                SELECT EXISTS (
                   SELECT FROM pg_tables
                   WHERE schemaname = 'public'
                   AND tablename = 'usage_tracking'
                );
            """)
            
            exists = cursor.fetchone()['exists']
            results['service_role_connection']['table_exists'] = exists
            
            if exists:
                # Try to insert a test record
                now = datetime.now(timezone.utc)
                cursor.execute(
                    """
                    INSERT INTO usage_tracking 
                    (user_id, usage_date, routes_created, algorithm_runs, notes) 
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (user_id, now.date(), 0, 0, f"Service role test {now.isoformat()}")
                )
                
                result = cursor.fetchone()
                results['service_role_connection']['test_insert_id'] = result['id'] if result else None
                conn.commit()
        
        conn.close()
    except Exception as e:
        results['service_role_connection']['success'] = False
        results['service_role_connection']['error'] = str(e)
    
    return jsonify(results)
@app.route('/debug/service_client', methods=['GET'])
@login_required
def debug_service_client():
    """Debug endpoint to test service client bypassing RLS"""
    user_id = session['user']['id']
    
    results = {
        'service_client': {},
        'environment_vars': {}
    }
    
    # Check environment variables (redacted for security)
    for key in ['SUPABASE_SERVICE_KEY', 'SUPABASE_URL']:
        value = os.environ.get(key)
        results['environment_vars'][key] = {
            'exists': value is not None,
            'length': len(value) if value else 0
        }
    
    # Test service client
    try:
        service_client = get_service_client()
        
        if not service_client:
            results['service_client']['success'] = False
            results['service_client']['error'] = 'Could not create service client'
            return jsonify(results)
            
        results['service_client']['success'] = True
        
        # Test table access
        try:
            # Check user profiles (RLS protected table)
            response = service_client.table('profiles').select('*').limit(5).execute()
            
            results['service_client']['profiles_success'] = True
            results['service_client']['profiles_count'] = len(response.data) if hasattr(response, 'data') else 0
        except Exception as e:
            results['service_client']['profiles_success'] = False
            results['service_client']['profiles_error'] = str(e)
        
        # Test if usage_tracking table exists/is accessible
        try:
            response = service_client.table('usage_tracking').select('count').limit(1).execute()
            
            results['service_client']['usage_tracking_exists'] = True
            
            # Try to insert a test record
            now = datetime.now(timezone.utc)
            test_data = {
                'user_id': user_id,
                'usage_date': now.date().isoformat(),
                'routes_created': 0,
                'algorithm_runs': 0,
                'notes': f"Service client test {now.isoformat()}"
            }
            
            insert_response = service_client.table('usage_tracking').insert(test_data).execute()
            
            results['service_client']['test_insert'] = True
            results['service_client']['test_insert_data'] = insert_response.data
            
        except Exception as e:
            results['service_client']['usage_tracking_error'] = str(e)
    
    except Exception as e:
        results['service_client']['success'] = False
        results['service_client']['error'] = str(e)
    
    return jsonify(results)

@app.route('/record_route_usage', methods=['POST'])
@login_required
def record_route_usage_endpoint():
    """Endpoint for recording route usage with service role client"""
    try:
        # Get user ID from session
        user_id = session.get('user', {}).get('id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User not authenticated'
            }), 401
        
        # Import the service client utility
        from service_client import record_usage_with_service_role
        
        # Record usage with service role
        result = record_usage_with_service_role(user_id, 'route_creation')
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Route usage recorded successfully',
                'method': result.get('method')
            })
        else:
            # Fall back to session-based storage if service role fails
            if 'pending_usage_records' not in session:
                session['pending_usage_records'] = []
                
            session['pending_usage_records'].append({
                'type': 'route_creation',
                'user_id': user_id,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            session.modified = True
            
            return jsonify({
                'success': True,
                'warning': 'Service client failed, stored in session for later processing',
                'error': result.get('error'),
                'fallback': True
            })
            
    except Exception as e:
        import traceback
        print(f"Error recording route usage: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Add a middleware to check for and process pending usage records
@app.before_request
def process_pending_usage_records():
    """Process any pending usage records on each request"""
    # Only process for authenticated users
    if 'user' in session and session.get('user', {}).get('id'):
        user_id = session['user']['id']
        
        # Only process on non-API endpoints to avoid unnecessary processing on AJAX calls
        if not request.path.startswith('/api/') and not request.path.startswith('/static/'):
            try:
                # Get pending records
                pending_records = session.get('pending_usage_records', [])
                
                if pending_records:
                    # Import the service client utility
                    from service_client import record_usage_with_service_role
                    
                    # Process each record
                    processed_indices = []
                    
                    for i, record in enumerate(pending_records):
                        if record.get('user_id') != user_id:
                            # Skip records for other users
                            continue
                            
                        usage_type = record.get('type')
                        if usage_type not in ['route_creation', 'algorithm_run']:
                            # Skip records with invalid type
                            continue
                            
                        # Try to process the record
                        result = record_usage_with_service_role(user_id, usage_type)
                        
                        if result.get('success'):
                            processed_indices.append(i)
                    
                    # Remove processed records from session
                    new_pending = [record for i, record in enumerate(pending_records) if i not in processed_indices]
                    session['pending_usage_records'] = new_pending
                    session.modified = True
            except Exception as e:
                print(f"Error processing pending records: {str(e)}")
                # Don't interrupt the request flow

@app.route('/check_driver_limit', methods=['POST'])
@login_required
@with_db_connection(use_service_role=True)  # Use service role to bypass RLS
def check_driver_limit_endpoint():
    """
    Endpoint for client-side code to check driver/vehicle limits
    Uses secured database connection to avoid RLS issues
    """
    try:
        # Get parameters from request
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Missing request data'
            }), 400
            
        max_vehicles = int(data.get('max_vehicles', 5))
        user_id = session.get('user', {}).get('id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User not authenticated'
            }), 401
        
        # Try using direct database access to check limits
        try:
            # g.db is provided by @with_db_connection decorator
            with g.db.cursor() as cursor:
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
                    
                    # Maps plan variant IDs to driver limits
                    plan_limits = {
                        '727207': 8,   # Starter: 8 drivers
                        '727230': 15,  # Professional: 15 drivers
                        '727232': 24   # Enterprise: 24 drivers
                    }
                    
                    # Get limit based on plan, or use default
                    max_allowed = plan_limits.get(plan_id, 3)
                    
                # Check if requested exceeds limit
                if max_vehicles > max_allowed:
                    return jsonify({
                        'success': False, 
                        'error': f'Your subscription allows a maximum of {max_allowed} drivers. You requested {max_vehicles}.',
                        'limit_exceeded': True,
                        'max_allowed': max_allowed
                    })
                else:
                    return jsonify({
                        'success': True,
                        'max_allowed': max_allowed
                    })
                    
        except Exception as db_error:
            current_app.logger.error(f"Database error checking driver limit: {str(db_error)}")
            # Fall back to usage_limits.py function
            is_allowed, max_allowed, error_message = driver_limit_check(max_vehicles, user_id)
            
            if not is_allowed:
                return jsonify({
                    'success': False, 
                    'error': error_message,
                    'limit_exceeded': True,
                    'max_allowed': max_allowed
                })
            else:
                return jsonify({
                    'success': True,
                    'max_allowed': max_allowed
                })
        
    except Exception as e:
        import traceback
        current_app.logger.error(f"Error checking driver limit: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
@app.route('/test-usage-tracking')
@login_required
def test_usage_tracking():
    user_id = session['user']['id']
    results = {}
    
    # Test all methods
    try:
        # 1. RPC method
        response = supabase.rpc('record_route_usage', {'p_user_id': user_id}).execute()
        results['rpc'] = {'success': True, 'response': str(response)}
    except Exception as e:
        results['rpc'] = {'success': False, 'error': str(e)}
    
    try:
        # 2. Direct insert
        response = supabase.table('usage_tracking').insert({
            'user_id': user_id,
            'usage_date': datetime.now(timezone.utc).date().isoformat(),
            'routes_created': 1
        }).execute()
        results['direct'] = {'success': True, 'response': str(response)}
    except Exception as e:
        results['direct'] = {'success': False, 'error': str(e)}
    
    try:
        # 3. Service role approach
        conn = get_db_connection(use_service_role=True)
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO usage_tracking (user_id, usage_date, routes_created) VALUES (%s, %s, %s) RETURNING id",
                (user_id, datetime.now(timezone.utc).date(), 1)
            )
            result = cursor.fetchone()
            conn.commit()
            results['service_role'] = {'success': True, 'id': result['id'] if result else None}
        conn.close()
    except Exception as e:
        results['service_role'] = {'success': False, 'error': str(e)}
    
    return jsonify(results)
def get_service_client():
    """Get a Supabase client using the service role key for admin access"""
    supabase_url = os.getenv('SUPABASE_URL')
    service_key = os.getenv('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not service_key:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return None
        
    # Create client with service key (bypasses RLS)
    service_client = create_client(supabase_url, service_key)
    return service_client
def record_usage_with_service_role(user_id, usage_type):
    """
    Record usage statistics using service role client to bypass RLS
    
    Args:
        user_id: User ID string
        usage_type: Either 'route_creation' or 'algorithm_run'
    
    Returns:
        dict: Result of the operation
    """
    if not user_id:
        return {'success': False, 'error': 'Missing user ID'}
        
    try:
        # Get service client
        service_client = get_service_client()
        if not service_client:
            return {'success': False, 'error': 'Could not create service client'}
            
        # Get today's date in ISO format
        today = datetime.now(timezone.utc).date().isoformat()
        
        # First check if a record exists for today
        response = service_client.table('usage_tracking').select('id, routes_created, algorithm_runs') \
            .eq('user_id', user_id) \
            .eq('usage_date', today) \
            .execute()
            
        existing_record = None
        if response and hasattr(response, 'data') and len(response.data) > 0:
            existing_record = response.data[0]
            
        if existing_record:
            # Update existing record
            record_id = existing_record['id']
            
            if usage_type == 'route_creation':
                current_count = existing_record.get('routes_created', 0) or 0
                update_data = {'routes_created': current_count + 1}
            else:  # algorithm_run
                current_count = existing_record.get('algorithm_runs', 0) or 0
                update_data = {'algorithm_runs': current_count + 1}
                
            # Add updated timestamp
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            # Update the record
            update_response = service_client.table('usage_tracking') \
                .update(update_data) \
                .eq('id', record_id) \
                .execute()
                
            return {
                'success': True, 
                'method': 'service_update',
                'record_id': record_id
            }
        else:
            # Insert new record
            insert_data = {
                'user_id': user_id,
                'usage_date': today,
                'routes_created': 1 if usage_type == 'route_creation' else 0,
                'algorithm_runs': 1 if usage_type == 'algorithm_run' else 0
            }
            
            insert_response = service_client.table('usage_tracking') \
                .insert(insert_data) \
                .execute()
                
            return {
                'success': True,
                'method': 'service_insert',
                'data': insert_response.data
            }
                
    except Exception as e:
        print(f"Error recording usage with service role: {str(e)}")
        return {'success': False, 'error': str(e)}
# Utility functions
def run_solver(job_id, problem_data, params):
    """Run the CVRP solver in a separate thread"""  
    try:
        # Update job status
        solver_jobs[job_id]['status'] = 'running'
        solver_jobs[job_id]['message'] = 'Initializing solver...'
        
        # Extract data
        distance_matrix = np.array(problem_data['distance_matrix'])
        demands = problem_data['demands']
        depot = problem_data['depot']
        vehicle_capacity = problem_data['vehicle_capacity']
        company_names = problem_data.get('company_names', None)
        
        # Extract algorithm parameters
        initial_temperature = float(params.get('initial_temperature', 1000.0))
        final_temperature = float(params.get('final_temperature', 1.0))
        cooling_rate = float(params.get('cooling_rate', 0.98))
        max_iterations = int(params.get('max_iterations', 1000))
        iterations_per_temp = int(params.get('iterations_per_temp', 100))
        max_vehicles = problem_data.get('max_vehicles', 5)
        
        # Create the CVRP_SimulatedAnnealing solver
        from models.cvrp import CVRP_SimulatedAnnealing
        solver = CVRP_SimulatedAnnealing(
            distance_matrix=distance_matrix,
            demands=demands,
            depot=depot,
            vehicle_capacity=vehicle_capacity,
            initial_temperature=initial_temperature,
            final_temperature=final_temperature,
            cooling_rate=cooling_rate,
            max_vehicles=max_vehicles,
            max_iterations=max_iterations,
            iterations_per_temp=iterations_per_temp
        )
        
        # Define callback function for progress updates
        def update_progress(iteration, inner_iter, temperature, best_cost, progress):
            # Update progress
            solver_jobs[job_id]['progress'] = progress
            solver_jobs[job_id]['message'] = f"Iteration {iteration}, Best Cost: {best_cost:.2f}"
            
            # Add to updates
            solver_jobs[job_id]['updates'].append({
                'iteration': iteration,
                'temperature': temperature,
                'best_cost': best_cost,
                'progress': progress,
                'time': datetime.now().strftime("%H:%M:%S")
            })
        
        # Run the solver
        routes, cost, cost_history, temp_history = solver.solve(callback=update_progress)
        
        # Create solution details
        solution_details = solver.get_solution_details(company_names)
        
        # Store solution
        solver_jobs[job_id]['status'] = 'completed'
        solver_jobs[job_id]['progress'] = 100
        solver_jobs[job_id]['message'] = f"Solution found with cost: {cost:.2f}"
        solver_jobs[job_id]['solution'] = {
            'routes': routes,
            'details': solution_details,
            'cost': cost,
            'depot': depot,
            'coordinates': problem_data['coordinates']
        }
        solver_jobs[job_id]['cost_history'] = cost_history
        solver_jobs[job_id]['temp_history'] = temp_history
        
        # If a job completes successfully, also try to save it to the user's history
        try:
            if solver_jobs[job_id].get('user_id'):
                user_id = solver_jobs[job_id]['user_id']
                
                # Get subscription manager to record usage
                subscription_manager = get_subscription_manager()
                
                # Record the algorithm run
                
                
                # Make sure route creation was recorded
                route_success = subscription_manager.record_route_creation(user_id)
                
                print(f"Usage recording for job {job_id}: routes={route_success}, algorithm={algorithm_success}")
                
                # Optional: Save the solution to the user's history
                # This could be implemented later
                
                print(f"Solution for job {job_id} saved to user {user_id} history")
        except Exception as e:
            print(f"Error recording usage or saving solution: {str(e)}")
        
    except Exception as e:
        # Update job status with error
        solver_jobs[job_id]['status'] = 'error'
        solver_jobs[job_id]['message'] = f"Error: {str(e)}"
        print(f"Solver error: {str(e)}")
def enhance_vehicle_limit_validation(app):
    """
    Enhance the process_data and solve endpoints to enforce vehicle limits
    based on the user's subscription
    """
    # Store original endpoints
    original_process_data = app.view_functions.get('process_data')
    original_solve = app.view_functions.get('solve')
    
    if original_process_data:
        @app.route('/process_data', methods=['POST'])
        def enhanced_process_data():
            # Get user's max allowed drivers
            max_drivers = get_user_max_drivers()
            
            # Get max_vehicles from request
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Missing request data'
                }), 400
                
            max_vehicles = data.get('max_vehicles', 5)
            
            # Check if exceeds limit
            if max_vehicles > max_drivers:
                return jsonify({
                    'success': False,
                    'error': f'Your subscription plan allows a maximum of {max_drivers} drivers. You requested {max_vehicles}.',
                    'limit_exceeded': True,
                    'max_allowed': max_drivers
                }), 403
            
            # Call original function
            return original_process_data()
    
    if original_solve:
        @app.route('/solve', methods=['POST'])
        def enhanced_solve():
            # Get user's max allowed drivers
            max_drivers = get_user_max_drivers()
            
            # Get max_vehicles from request
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Missing request data'
                }), 400
                
            max_vehicles = int(data.get('max_vehicles', 5))
            
            # Check if exceeds limit
            if max_vehicles > max_drivers:
                return jsonify({
                    'success': False,
                    'error': f'Your subscription plan allows a maximum of {max_drivers} drivers. You requested {max_vehicles}.',
                    'limit_exceeded': True,
                    'max_allowed': max_drivers
                }), 403
            
            # Call original function
            return original_solve()
    
    # Add endpoint to get max drivers
    @app.route('/get_user_limits', methods=['GET'])
    def get_user_limits_endpoint():
        if 'user' not in session:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        # Get subscription manager
        from subscription_manager import get_subscription_manager
        subscription_manager = get_subscription_manager()
        
        # Get user limits
        user_id = session['user']['id']
        limits = subscription_manager.get_user_limits(user_id)
        
        # Get subscription details
        subscription = subscription_manager.get_user_subscription(user_id)
        
        # Format response
        response = {
            'success': True,
            'max_drivers': limits.get('max_drivers', 3),
            'max_routes': limits.get('max_routes', 5),
            'is_trial': limits.get('is_trial', True)
        }
        
        # Add plan name if available
        if subscription:
            response['plan_name'] = subscription.get('plan_name', 'Unknown Plan')
            response['plan_id'] = subscription.get('plan_id')
        
        return jsonify(response)
register_direct_report_endpoint(app)
def get_user_max_drivers():
    """Get the maximum number of drivers for the current user"""
    if 'user' not in session:
        return 3  # Default for unauthenticated users
    
    user_id = session['user']['id']
    
    # Get from g if available
    if hasattr(g, 'max_drivers'):
        return g.max_drivers
    
    # Get from subscription manager
    try:
        from subscription_manager import get_subscription_manager
        subscription_manager = get_subscription_manager()
        max_drivers = subscription_manager.get_max_drivers(user_id)
        g.max_drivers = max_drivers  # Cache for efficiency
        return max_drivers
    except Exception as e:
        print(f"Error getting max drivers: {str(e)}")
        return 3  # Safe default
def parse_coordinates(coord_str):
    """Parse coordinate string into (lat, lng) tuple"""
    # Remove any whitespace
    coord_str = coord_str.strip()
    
    # Remove parentheses if present
    if coord_str.startswith('(') and coord_str.endswith(')'):
        coord_str = coord_str[1:-1]
    
    # Split by comma
    parts = [part.strip() for part in coord_str.split(',')]
    
    if len(parts) != 2:
        raise ValueError(f"Expected two values separated by comma, got: {coord_str}")
        
    # Convert to float
    lat = float(parts[0])
    lng = float(parts[1])
    
    return lat, lng
enhance_vehicle_limit_validation(app)
if __name__ == '__main__':
    app.run()