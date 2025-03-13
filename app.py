from flask import Flask, render_template, request, jsonify, session
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
from datetime import datetime
from werkzeug.utils import secure_filename
import os
from dotenv import load_dotenv
from models.distance_matrix import compute_google_distance_matrix, compute_euclidean_distance_matrix


load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
# Import the CVRP_SimulatedAnnealing class from app.py
# Make sure it's accessible here

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cvrp-secret-key'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Global storage for ongoing solver jobs
solver_jobs = {}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        return f"Error loading template: {str(e)}"

# Route to serve templates directly - this helps with debugging
@app.route('/templates')
def templates():
    return render_template('index.html')

@app.route('/get_google_maps_key', methods=['GET'])
def get_google_maps_key():
    """Return the Google Maps API key for client-side use"""
    return jsonify({
        'success': True,
        'api_key': GOOGLE_MAPS_API_KEY
    })

# Add this route to dynamically inject the API key into the page
@app.route('/google_maps_config.js')
def google_maps_config():
    """Serve a JavaScript file with the Google Maps API key"""
    js_content = f"""
    // Google Maps API Configuration
    const GOOGLE_MAPS_API_KEY = "{GOOGLE_MAPS_API_KEY}";
    console.log("Google Maps API key loaded");
    """
    response = make_response(js_content)
    response.headers['Content-Type'] = 'application/javascript'
    return response
@app.route('/get_distance_matrix', methods=['GET'])
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
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    # Generate a unique filename
    file_ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    
    # Save the file
    file.save(filepath)
    
    try:
        # Read the file based on its extension
        if file_ext in ['.xlsx', '.xls']:
            data_df = pd.read_excel(filepath)
        elif file_ext == '.csv':
            data_df = pd.read_csv(filepath)
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
            'filepath': filepath,
            'columns': data_df.columns.tolist()
        }
        
        # Return headers to client
        return jsonify({
            'success': True, 
            'message': f'File {file.filename} uploaded successfully',
            'columns': data_df.columns.tolist(),
            'previewData': data_df.to_dict(orient='records')
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/generate_random', methods=['POST'])
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
            'max_vehicles': int(params.get('max_vehicles', 5)),  # Add this line
            
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

# Update the process_data route in app.py

@app.route('/process_data', methods=['POST'])
def process_data():
    if 'data' not in session:
        return jsonify({'success': False, 'error': 'No data uploaded'})
    
    try:
        # Get parameters from request
        params = request.get_json()
        filepath = session['data']['filepath']
        
        # Read data again
        file_ext = os.path.splitext(filepath)[1].lower()
        if file_ext in ['.xlsx', '.xls']:
            data_df = pd.read_excel(filepath)
        elif file_ext == '.csv':
            data_df = pd.read_csv(filepath)
        
        # Standardize column names (from previous step)
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
            'max_vehicles': int(params.get('max_vehicles', 5)),  # Add this line
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
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/solve', methods=['POST'])
def solve():
    if 'problem_data' not in session:
        return jsonify({'success': False, 'error': 'No problem data available'})
    
    try:
        # Get algorithm parameters
        params = request.get_json()
        problem_data = session['problem_data']
        
        # Create a unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize progress
        solver_jobs[job_id] = {
            'status': 'initializing',
            'progress': 0,
            'message': 'Initializing solver...',
            'updates': []
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
def solver_status(job_id):
    if job_id not in solver_jobs:
        return jsonify({'success': False, 'error': 'Job not found'})
    
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
def get_solution(job_id):
    if job_id not in solver_jobs:
        return jsonify({'success': False, 'error': 'Job not found'})
    
    job_info = solver_jobs[job_id]
    
    if job_info['status'] != 'completed':
        return jsonify({'success': False, 'error': 'Solution not ready yet'})
    
    return jsonify({
        'success': True,
        'solution': job_info.get('solution', None),
        'cost_history': job_info.get('cost_history', []),
        'temp_history': job_info.get('temp_history', [])
    })

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
        
    except Exception as e:
        # Update job status with error
        solver_jobs[job_id]['status'] = 'error'
        solver_jobs[job_id]['message'] = f"Error: {str(e)}"
        print(f"Solver error: {str(e)}")

def generate_dummy_solution(num_nodes, depot, demands, vehicle_capacity):
    """Generate a dummy solution for demonstration purposes"""
    customers = list(range(num_nodes))
    customers.remove(depot)
    
    # Shuffle customers for some randomness
    random.shuffle(customers)
    
    # Split into routes based on capacity
    routes = []
    current_route = []
    current_load = 0
    
    for customer in customers:
        if current_load + demands[customer] <= vehicle_capacity:
            current_route.append(customer)
            current_load += demands[customer]
        else:
            # Start a new route
            if current_route:
                routes.append(current_route)
            current_route = [customer]
            current_load = demands[customer]
    
    # Add the last route if not empty
    if current_route:
        routes.append(current_route)
    
    return routes

def calculate_route_distance(route, distance_matrix, depot):
    """Calculate the total distance of a route"""
    if not route:
        return 0
        
    distance = distance_matrix[depot, route[0]]
    for i in range(len(route) - 1):
        distance += distance_matrix[route[i], route[i + 1]]
    distance += distance_matrix[route[-1], depot]
    
    return distance

def calculate_total_distance(routes, distance_matrix, depot):
    """Calculate the total distance of all routes"""
    return sum(calculate_route_distance(route, distance_matrix, depot) for route in routes)

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

def compute_euclidean_distance_matrix(coordinates):
    """Compute distance matrix using Euclidean distance"""
    num_nodes = len(coordinates)
    distance_matrix = np.zeros((num_nodes, num_nodes))
    for i in range(num_nodes):
        for j in range(num_nodes):
            distance_matrix[i, j] = np.sqrt(np.sum((coordinates[i] - coordinates[j])**2))
    return distance_matrix

if __name__ == '__main__':
    print("Starting Flask server...")
    print("Open http://127.0.0.1:5000/ in your browser")
    app.run(debug=True)