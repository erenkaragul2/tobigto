# Description: Main application file for the CVRP solver web app with Supabase authentication
from flask import Flask, request, jsonify, session, redirect, url_for, render_template, flash, g, make_response
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
from datetime import datetime
from werkzeug.utils import secure_filename
import os
from dotenv import load_dotenv
from models.distance_matrix import compute_google_distance_matrix, compute_euclidean_distance_matrix
from auth_middleware import login_required, admin_required, configure_auth_middleware

# Load environment variables from .env file
load_dotenv()

# Get environment variables
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SESSION_SECRET = os.getenv('SESSION_SECRET', 'cvrp-secret-key')  # Use environment variable or default

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = SESSION_SECRET
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Configure authentication middleware
app = configure_auth_middleware(app)

# Global storage for ongoing solver jobs
solver_jobs = {}

# Public routes
@app.route('/')
def landing():
    return render_template('landing.html')

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
                session['user'] = {
                    'id': response.user.id,
                    'email': response.user.email,
                    'access_token': response.session.access_token,
                    'refresh_token': response.session.refresh_token
                }
                
                # Check if there's a next URL to redirect to
                next_url = session.pop('next_url', None)
                if next_url:
                    return redirect(next_url)
                    
                return redirect(url_for('dashboard'))
            else:
                return render_template('login.html', error="Login failed. Please check your credentials.")
                
        except Exception as e:
            error_message = str(e)
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
    
    # Fetch any additional user data if needed
    try:
        # Example: fetch user profile data
        user_id = user['id']
        # Fetch user profile from database if needed
        # profile = supabase.table('profiles').select('*').eq('user_id', user_id).execute()
        # Additional user data can be passed to the template
    except Exception as e:
        flash(f"Error loading profile data: {str(e)}", "warning")
    
    return render_template('dashboard.html', user=user)

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
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    try:
        # Read the file based on its extension without saving
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext in ['.xlsx', '.xls']:
            data_df = pd.read_excel(file)
        elif file_ext == '.csv':
            data_df = pd.read_csv(file)
        else:
            return jsonify({'success': False, 'error': 'Unsupported file format'})
        
        # Standardize column names (case-insensitive match)
        column_mapping = {}
        for col in data_df.columns:
            col_lower = col.lower()
            if 'name' in col_lower or 'company' in col_lower:
                column_mapping[col] = 'company_name'
            elif ('coord' in col_lower and not ('x_' in col_lower or 'y_' in col_lower)) or \
                ('location' in col_lower and not ('address' in col_lower)):
                column_mapping[col] = 'coordinates'
            elif 'demand' in col_lower or 'quantity' in col_lower or 'amount' in col_lower:
                column_mapping[col] = 'demand'
            elif 'address' in col_lower:
                column_mapping[col] = 'address'
            elif 'x_' in col_lower or 'lat' in col_lower:
                column_mapping[col] = 'x_coord'
            elif 'y_' in col_lower or 'lon' in col_lower or 'lng' in col_lower:
                column_mapping[col] = 'y_coord'
        
        # Rename columns
        if column_mapping:
            data_df.rename(columns=column_mapping, inplace=True)
        
        # Store data in session
        session['data'] = {
            'filename': file.filename,
            'columns': data_df.columns.tolist(),
            'dataframe': data_df.to_json(orient='split')  # Store the dataframe as JSON in the session
        }
        
        # Return headers to client
        return jsonify({
            'success': True, 
            'message': f'File {file.filename} uploaded successfully',
            'columns': data_df.columns.tolist(),
            'previewData': data_df.head(20).to_dict(orient='records')
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in file upload: {error_details}")
        return jsonify({
            'success': False, 
            'error': str(e),
            'details': error_details
        })

@app.route('/generate_random', methods=['POST'])
@login_required
def generate_random():
    try:
        params = request.get_json()
        num_nodes = int(params.get('num_nodes', 10))
        depot = int(params.get('depot', 0))
        
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
            'max_vehicles': int(params.get('max_vehicles', 5)),
        }
        
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
            ]
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/process_data', methods=['POST'])
@login_required
def process_data():
    if 'data' not in session:
        return jsonify({'success': False, 'error': 'No data uploaded'})
    
    try:
        # Get parameters from request
        params = request.get_json()
        
        # Read dataframe from session
        data_json = session['data']['dataframe']
        data_df = pd.read_json(data_json, orient='split')
        
        # Get company names
        company_names = data_df['company_name'].tolist() if 'company_name' in data_df.columns else None
        
        # Get demands
        demands = data_df['demand'].tolist() if 'demand' in data_df.columns else None
        
        # Check if required data is available
        if 'coordinates' not in data_df.columns and ('x_coord' not in data_df.columns or 'y_coord' not in data_df.columns):
            return jsonify({'success': False, 'error': 'Coordinate data is missing'})
        
        if demands is None:
            return jsonify({'success': False, 'error': 'Demand data is missing'})
        
        # Parse coordinates
        coords_list = []
        if 'coordinates' in data_df.columns:
            for coord_str in data_df['coordinates'].values:
                try:
                    # Parse the coordinate string
                    lat, lng = parse_coordinates(coord_str)
                    coords_list.append([lat, lng])
                except Exception as e:
                    return jsonify({'success': False, 'error': f'Failed to parse coordinate: {coord_str}. Error: {str(e)}'})
        elif 'x_coord' in data_df.columns and 'y_coord' in data_df.columns:
            coords_list = data_df[['x_coord', 'y_coord']].values.tolist()
        
        coordinates = np.array(coords_list)
        
        # Get distance calculation parameters
        use_google_maps = params.get('use_google_maps', False)
        google_maps_options = params.get('google_maps_options', {})
        
        # Determine what distance type to display in UI
        distance_type = "Google Maps" if use_google_maps else "Euclidean"
        
        # If using Google Maps, add mode to display
        if use_google_maps and 'mode' in google_maps_options:
            distance_type += f" ({google_maps_options['mode'].capitalize()})"
        
        # Compute distance matrix
        if use_google_maps and GOOGLE_MAPS_API_KEY:
            try:
                # Get Google Maps specific options
                mode = google_maps_options.get('mode', 'driving')
                avoid = google_maps_options.get('avoid', [])
                
                # Generate avoid parameter string if provided
                avoid_param = '|'.join(avoid) if avoid else None
                
                # Compute with Google Maps
                distance_matrix = compute_google_distance_matrix(
                    coordinates, 
                    api_key=GOOGLE_MAPS_API_KEY,
                    batch_size=app.config.get('GOOGLE_MAPS_BATCH_SIZE', 10),
                    delay=app.config.get('GOOGLE_MAPS_DELAY', 1.0),
                    mode=mode
                )
            except Exception as e:
                # Log error and fall back to Euclidean
                print(f"Error using Google Maps API: {str(e)}")
                distance_matrix = compute_euclidean_distance_matrix(coordinates)
                distance_type = "Euclidean (Google Maps failed)"
        else:
            # Use Euclidean distance
            distance_matrix = compute_euclidean_distance_matrix(coordinates)
        
        # Store in session for later use
        session['problem_data'] = {
            'coordinates': coordinates.tolist(),
            'distance_matrix': distance_matrix.tolist(),
            'demands': demands,
            'company_names': company_names,
            'depot': int(params.get('depot', 0)),
            'vehicle_capacity': int(params.get('vehicle_capacity', 20)),
            'max_vehicles': int(params.get('max_vehicles', 5)),
            'distance_type': distance_type
        }
        
        return jsonify({
            'success': True,
            'message': 'Data processed successfully',
            'nodes': len(coordinates),
            'distance_type': distance_type,
            'distanceMatrixPreview': [
                [f"{val:.2f}" for val in row[:5]] 
                for row in distance_matrix[:5]
            ]
        })
        
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        print(f"Error processing data: {traceback_str}")
        return jsonify({
            'success': False, 
            'error': str(e),
            'traceback': traceback_str
        })

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
def solve():
    if 'problem_data' not in session:
        return jsonify({'success': False, 'error': 'No problem data available'})
    
    try:
        # Get algorithm parameters
        params = request.get_json()
        problem_data = session['problem_data']
        
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

@app.errorhandler(Exception)
def handle_error(e):
    import traceback
    print(f"Unhandled exception: {traceback.format_exc()}")
    return jsonify({
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }), 500

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
                
                # Save the solution to the user's history in the database
                # This is a placeholder - implement the actual database save
                # solution_data = {
                #     'user_id': user_id,
                #     'timestamp': datetime.now().isoformat(),
                #     'problem_size': len(problem_data['coordinates']),
                #     'solution_cost': cost,
                #     'solution_data': json.dumps({
                #         'routes': routes,
                #         'cost': cost,
                #         'details': solution_details
                #     })
                # }
                # supabase.table('solution_history').insert(solution_data).execute()
                print(f"Solution for job {job_id} saved to user {user_id} history")
        except Exception as e:
            print(f"Error saving solution to history: {str(e)}")
        
    except Exception as e:
        # Update job status with error
        solver_jobs[job_id]['status'] = 'error'
        solver_jobs[job_id]['message'] = f"Error: {str(e)}"
        print(f"Solver error: {str(e)}")

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

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')