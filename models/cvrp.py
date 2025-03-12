import numpy as np
import random
import math
import copy
from datetime import datetime

class CVRP_SimulatedAnnealing:
    def __init__(self, distance_matrix, demands, depot, vehicle_capacity, 
                 initial_temperature=1000.0, final_temperature=1.0,max_vehicles=5, 
                 cooling_rate=0.98, max_iterations=1000, iterations_per_temp=100):
        """
        Initialize the CVRP Simulated Annealing solver
        
        Parameters:
        - distance_matrix: 2D array of distances between nodes
        - demands: Array of customer demands (demand[depot] should be 0)
        - depot: Index of the depot node
        - vehicle_capacity: Maximum capacity of each vehicle
        - initial_temperature: Starting temperature for SA
        - final_temperature: Stopping temperature for SA
        - cooling_rate: Rate at which temperature decreases
        - max_iterations: Maximum number of temperature steps
        - iterations_per_temp: Number of iterations at each temperature
        """
        self.distance_matrix = np.array(distance_matrix)
        self.demands = demands
        self.depot = depot
        self.vehicle_capacity = vehicle_capacity
        self.max_vehicles = max_vehicles
        self.num_nodes = len(distance_matrix)
        
        # SA parameters
        self.initial_temperature = initial_temperature
        self.final_temperature = final_temperature
        self.cooling_rate = cooling_rate
        self.max_iterations = max_iterations
        self.iterations_per_temp = iterations_per_temp
        
        # Solution tracking
        self.current_solution = None
        self.best_solution = None
        self.current_cost = float('inf')
        self.best_cost = float('inf')
        
        # History for convergence plots
        self.cost_history = []
        self.temp_history = []
        
        # Initialize a solution
        self.initialize_solution()
    
    def initialize_solution(self):
        """Generate an initial feasible solution using a greedy approach"""
        customers = list(range(self.num_nodes))
        customers.remove(self.depot)
        
        # Sort customers by distance from depot (farthest first)
        customers.sort(key=lambda x: -self.distance_matrix[self.depot][x])
        
        # Initialize routes
        routes = []
        current_route = []
        current_load = 0
        
        for customer in customers:
            customer_demand = self.demands[customer]
            
            # If adding this customer exceeds capacity, start a new route
            # But only if we haven't reached max_vehicles
            if current_load + customer_demand > self.vehicle_capacity:
                if current_route:  # Only add non-empty routes
                    routes.append(current_route)
                # Only start a new route if we haven't reached max_vehicles
                if len(routes) < self.max_vehicles - 1:  # Add this check
                    current_route = [customer]
                    current_load = customer_demand
                else:
                    # Add to the last route even if it exceeds capacity
                    # (this ensures all customers are served)
                    if not current_route:  # If the last route is empty, create it
                        current_route = [customer]
                        current_load = customer_demand
                    else:
                        current_route.append(customer)
                        current_load += customer_demand
            else:
                current_route.append(customer)
                current_load += customer_demand
        
        # Add the last route if not empty
        if current_route:
            routes.append(current_route)
        
        # Ensure we don't use more than max_vehicles routes
        while len(routes) > self.max_vehicles:
            # Merge the two shortest routes
            routes.sort(key=lambda r: len(r))
            routes[1].extend(routes[0])
            routes.pop(0)
        
        self.current_solution = routes
        self.current_cost = self.calculate_total_distance(routes)
        self.best_solution = copy.deepcopy(routes)
        self.best_cost = self.current_cost
    
    def calculate_route_distance(self, route):
        """Calculate the total distance of a single route"""
        if not route:
            return 0
            
        distance = self.distance_matrix[self.depot][route[0]]
        for i in range(len(route) - 1):
            distance += self.distance_matrix[route[i]][route[i + 1]]
        distance += self.distance_matrix[route[-1]][self.depot]
        
        return distance
    
    def calculate_total_distance(self, routes):
        """Calculate the total distance of all routes"""
        return sum(self.calculate_route_distance(route) for route in routes)
    
    def calculate_route_load(self, route):
        """Calculate the total demand of a route"""
        return sum(self.demands[customer] for customer in route)
    
    def generate_neighbor(self):
        """Generate a neighboring solution by performing one of several move operations"""
        # Create a deep copy of the current solution
        neighbor = copy.deepcopy(self.current_solution)
        
        # If we have an empty solution, initialize it
        if not neighbor or all(len(route) == 0 for route in neighbor):
            self.initialize_solution()
            return copy.deepcopy(self.current_solution)
        
        # Randomly select a move operation
        move_type = random.choice(["swap", "relocate", "2opt", "route_swap"])
        
        if move_type == "swap" and len(neighbor) >= 1:
            # Swap two customers within the same route or between different routes
            if random.random() < 0.5 and any(len(route) >= 2 for route in neighbor):
                # Intra-route swap
                route_idx = random.choice([i for i, route in enumerate(neighbor) if len(route) >= 2])
                route = neighbor[route_idx]
                i, j = random.sample(range(len(route)), 2)
                route[i], route[j] = route[j], route[i]
            else:
                # Inter-route swap
                if len(neighbor) < 2:
                    return neighbor  # Not enough routes
                
                # Select two routes with at least one customer each
                route_indices = [i for i, route in enumerate(neighbor) if len(route) >= 1]
                if len(route_indices) < 2:
                    return neighbor
                
                i, j = random.sample(route_indices, 2)
                
                # Select one customer from each route
                customer_i_idx = random.randrange(len(neighbor[i]))
                customer_j_idx = random.randrange(len(neighbor[j]))
                
                # Check capacity constraints
                route_i_load = self.calculate_route_load(neighbor[i])
                route_j_load = self.calculate_route_load(neighbor[j])
                
                customer_i = neighbor[i][customer_i_idx]
                customer_j = neighbor[j][customer_j_idx]
                
                new_route_i_load = route_i_load - self.demands[customer_i] + self.demands[customer_j]
                new_route_j_load = route_j_load - self.demands[customer_j] + self.demands[customer_i]
                
                if (new_route_i_load <= self.vehicle_capacity and 
                    new_route_j_load <= self.vehicle_capacity):
                    # Swap the customers
                    neighbor[i][customer_i_idx], neighbor[j][customer_j_idx] = neighbor[j][customer_j_idx], neighbor[i][customer_i_idx]
        
        elif move_type == "relocate" and len(neighbor) >= 1:
            # Move a customer from one route to another
            if len(neighbor) < 2:
                return neighbor  # Not enough routes
            
            # Select a non-empty route as source
            source_route_indices = [i for i, route in enumerate(neighbor) if len(route) >= 1]
            if not source_route_indices:
                return neighbor
            if len(neighbor) >= self.max_vehicles:
                target_idx = random.randrange(len(neighbor))
            else:
                # Allow creating a new route if we're under max_vehicles
                target_idx = random.randrange(len(neighbor) + 1)
                if target_idx == len(neighbor):
                    # Create a new route
                    neighbor.append([])
            source_idx = random.choice(source_route_indices)
            source_route = neighbor[source_idx]
            
            # Select a customer
            customer_idx = random.randrange(len(source_route))
            customer = source_route[customer_idx]
            
            # Select a destination route (can be the same route for relocation within route)
            target_idx = random.randrange(len(neighbor))
            target_route = neighbor[target_idx]
            
            # Check if capacity would be exceeded
            if target_idx != source_idx:
                target_load = self.calculate_route_load(target_route)
                if target_load + self.demands[customer] > self.vehicle_capacity:
                    return neighbor
            
            # Remove customer from source route
            source_route.pop(customer_idx)
            
            # Insert customer into target route at random position
            insert_pos = random.randint(0, len(target_route))
            target_route.insert(insert_pos, customer)
            
            # Remove empty routes
            neighbor = [route for route in neighbor if len(route) > 0]
        
        elif move_type == "2opt" and any(len(route) >= 3 for route in neighbor):
            # Perform 2-opt move (reverse a segment within a route)
            route_idx = random.choice([i for i, route in enumerate(neighbor) if len(route) >= 3])
            route = neighbor[route_idx]
            
            # Select two positions for reversal
            i, j = sorted(random.sample(range(len(route)), 2))
            
            # Reverse the segment
            route[i:j+1] = reversed(route[i:j+1])
        
        elif move_type == "route_swap" and len(neighbor) >= 2:
            # Swap two entire routes
            if len(neighbor) < 2:
                return neighbor
            
            i, j = random.sample(range(len(neighbor)), 2)
            neighbor[i], neighbor[j] = neighbor[j], neighbor[i]
        
        # Clean up empty routes
        neighbor = [route for route in neighbor if route]
        if len(neighbor) > self.max_vehicles:
            # Merge routes until we have max_vehicles
            while len(neighbor) > self.max_vehicles:
                # Find two routes with smallest combined load
                min_load = float('inf')
                merge_indices = (0, 1)
                for i in range(len(neighbor)):
                    for j in range(i+1, len(neighbor)):
                        combined_load = self.calculate_route_load(neighbor[i]) + self.calculate_route_load(neighbor[j])
                        if combined_load < min_load:
                            min_load = combined_load
                            merge_indices = (i, j)
                
                # Merge the selected routes
                i, j = merge_indices
                neighbor[i].extend(neighbor[j])
                neighbor.pop(j)
        
        return neighbor
    
    def solve(self, callback=None):
        """
        Run the simulated annealing algorithm to solve the CVRP
        
        Parameters:
        - callback: Optional function to call after each iteration for progress updates
        
        Returns:
        - best_solution: List of routes (each route is a list of customer indices)
        - best_cost: Total distance of the best solution
        - cost_history: List of best costs at each temperature
        - temp_history: List of temperatures
        """
        temperature = self.initial_temperature
        iteration = 0
        
        # Record initial state
        self.cost_history.append(self.best_cost)
        self.temp_history.append(temperature)
        
        # Main loop - continue until final temperature or max iterations
        while temperature > self.final_temperature and iteration < self.max_iterations:
            iteration += 1
            
            # Perform several iterations at each temperature
            for inner_iter in range(self.iterations_per_temp):
                # Generate a neighboring solution
                neighbor = self.generate_neighbor()
                
                # Calculate the cost of the new solution
                neighbor_cost = self.calculate_total_distance(neighbor)
                
                # Calculate cost difference
                delta_cost = neighbor_cost - self.current_cost
                
                # Accept the new solution if it's better or with a probability
                if delta_cost < 0 or random.random() < math.exp(-delta_cost / temperature):
                    self.current_solution = neighbor
                    self.current_cost = neighbor_cost
                    
                    # Update best solution if current is better
                    if self.current_cost < self.best_cost:
                        self.best_solution = copy.deepcopy(self.current_solution)
                        self.best_cost = self.current_cost
                
                # Call callback if provided
                if callback and inner_iter % 10 == 0:  # Reduce callback frequency to avoid overhead
                    progress = min(100, int((iteration / self.max_iterations) * 100))
                    callback(iteration, inner_iter, temperature, self.best_cost, progress)
            
            # Cool down the temperature
            temperature *= self.cooling_rate
            
            # Record history
            self.cost_history.append(self.best_cost)
            self.temp_history.append(temperature)
            
            # Call callback for the temperature iteration
            if callback:
                progress = min(100, int((iteration / self.max_iterations) * 100))
                callback(iteration, self.iterations_per_temp, temperature, self.best_cost, progress)
        
        return self.best_solution, self.best_cost, self.cost_history, self.temp_history
    
    def get_solution_details(self, company_names=None):
        """
        Get detailed information about the solution
        
        Parameters:
        - company_names: Optional list of names for each node
        
        Returns:
        - Dictionary with solution details
        """
        routes = self.best_solution
        total_distance = self.best_cost
        
        solution_details = {
            'total_distance': total_distance,
            'routes': []
        }
        
        for i, route in enumerate(routes):
            route_demand = self.calculate_route_load(route)
            route_distance = self.calculate_route_distance(route)
            
            route_with_depot = [self.depot] + route + [self.depot]
            
            # Use company names if available
            if company_names:
                route_display = [
                    {'index': node, 'name': company_names[node]} 
                    for node in route_with_depot
                ]
            else:
                route_display = [
                    {'index': node, 'name': f"Node {node}"} 
                    for node in route_with_depot
                ]
                
            solution_details['routes'].append({
                'id': i + 1,
                'stops': route_display,
                'load': route_demand,
                'capacity': self.vehicle_capacity,
                'distance': route_distance
            })
        
        return solution_details