import numpy as np
import random
import math
import copy
import json
from datetime import datetime

class CVRP_SimulatedAnnealing:
    def __init__(self, distance_matrix, demands, vehicle_capacity, depot=0):
        """
        Initialize the CVRP Simulated Annealing solver.
        
        Args:
            distance_matrix: 2D numpy array with distances between nodes
            demands: List of customer demands (index 0 is usually the depot with demand 0)
            vehicle_capacity: Maximum capacity of each vehicle
            depot: Index of the depot (default is 0)
        """
        self.distance_matrix = distance_matrix
        self.demands = demands
        self.vehicle_capacity = vehicle_capacity
        self.depot = depot
        self.num_nodes = len(distance_matrix)
        
        # Simulated annealing parameters
        self.initial_temperature = 1000.0
        self.final_temperature = 1.0
        self.alpha = 0.98  # Cooling rate
        self.iterations_per_temperature = 100
        
    def generate_initial_solution(self):
        """Generate a random initial solution where each customer appears exactly once"""
        customers = list(range(self.num_nodes))
        customers.remove(self.depot)
        random.shuffle(customers)
        
        # Build routes with capacity constraints
        routes = []
        current_route = []
        current_load = 0
        
        for customer in customers:
            if current_load + self.demands[customer] <= self.vehicle_capacity:
                current_route.append(customer)
                current_load += self.demands[customer]
            else:
                # Start a new route
                if current_route:
                    routes.append(current_route)
                current_route = [customer]
                current_load = self.demands[customer]
        
        # Add the last route if not empty
        if current_route:
            routes.append(current_route)
            
        # Verify solution
        all_customers = []
        for route in routes:
            all_customers.extend(route)
        
        # Check for duplicates
        if len(all_customers) != len(set(all_customers)):
            print("WARNING: Duplicate customers detected in initial solution!")
        
        # Check for missing customers
        expected_customers = set(range(self.num_nodes))
        expected_customers.remove(self.depot)
        actual_customers = set(all_customers)
        if expected_customers != actual_customers:
            missing = expected_customers - actual_customers
            print(f"WARNING: Missing customers in initial solution: {missing}")
            
        return routes
    
    def validate_solution(self, solution):
        """
        Validate that a solution is feasible:
        - Each customer appears exactly once
        - Each route respects capacity constraints
        - All customers are visited
        
        Returns: 
        - (True, None) if valid
        - (False, error_message) if invalid
        """
        # Check for empty solution
        if not solution:
            return False, "Empty solution"
        
        # Get all customers in the solution
        all_customers = []
        for route in solution:
            all_customers.extend(route)
        
        # Check for duplicates
        customer_counts = {}
        for customer in all_customers:
            customer_counts[customer] = customer_counts.get(customer, 0) + 1
        
        duplicates = [c for c, count in customer_counts.items() if count > 1]
        if duplicates:
            return False, f"Duplicate customers: {duplicates}"
        
        # Check all customers are visited
        expected_customers = set(range(self.num_nodes))
        expected_customers.remove(self.depot)  # Remove depot
        actual_customers = set(all_customers)
        
        if expected_customers != actual_customers:
            missing = expected_customers - actual_customers
            extra = actual_customers - expected_customers
            error_msg = ""
            if missing:
                error_msg += f"Missing customers: {missing} "
            if extra:
                error_msg += f"Extra customers: {extra}"
            return False, error_msg
        
        # Check capacity constraints
        for i, route in enumerate(solution):
            route_demand = sum(self.demands[customer] for customer in route)
            if route_demand > self.vehicle_capacity:
                return False, f"Route {i} exceeds capacity: {route_demand} > {self.vehicle_capacity}"
        
        return True, None
    
    def calculate_route_distance(self, route):
        """Calculate the total distance of a route"""
        if not route:
            return 0
            
        distance = self.distance_matrix[self.depot, route[0]]
        for i in range(len(route) - 1):
            distance += self.distance_matrix[route[i], route[i + 1]]
        distance += self.distance_matrix[route[-1], self.depot]
        
        return distance
    
    def calculate_total_distance(self, routes):
        """Calculate the total distance of all routes"""
        return sum(self.calculate_route_distance(route) for route in routes)
    
    def check_capacity_constraints(self, routes):
        """Check if all routes satisfy capacity constraints"""
        for route in routes:
            total_demand = sum(self.demands[customer] for customer in route)
            if total_demand > self.vehicle_capacity:
                return False
        return True
    
    def get_route_load(self, route):
        """Calculate the total demand of a route"""
        return sum(self.demands[customer] for customer in route)
    
    def generate_neighbor(self, solution):
        """Generate a neighboring solution using one of several operators"""
        neighbor = copy.deepcopy(solution)
        
        # Choose a random operator
        operator = random.choice(['relocate', 'swap', 'two_opt', 'route_exchange'])
        
        if operator == 'relocate' and len(neighbor) > 1:
            # Move a customer from one route to another
            source_idx = random.randint(0, len(neighbor) - 1)
            target_idx = random.randint(0, len(neighbor) - 1)
            
            while len(neighbor[source_idx]) <= 1 or source_idx == target_idx:
                source_idx = random.randint(0, len(neighbor) - 1)
                target_idx = random.randint(0, len(neighbor) - 1)
            
            customer_idx = random.randint(0, len(neighbor[source_idx]) - 1)
            customer = neighbor[source_idx][customer_idx]
            
            # Check capacity constraint
            if self.get_route_load(neighbor[target_idx]) + self.demands[customer] <= self.vehicle_capacity:
                # Remove from source
                del neighbor[source_idx][customer_idx]
                
                # Insert into target
                insert_pos = random.randint(0, len(neighbor[target_idx]))
                neighbor[target_idx].insert(insert_pos, customer)
                
                # Remove empty routes
                neighbor = [route for route in neighbor if route]
            
        elif operator == 'swap':
            # Swap two customers
            if len(neighbor) == 1 and len(neighbor[0]) < 2:
                return neighbor
                
            route1_idx = random.randint(0, len(neighbor) - 1)
            
            # For intra-route swap
            if len(neighbor[route1_idx]) >= 2 and random.random() < 0.5:
                pos1 = random.randint(0, len(neighbor[route1_idx]) - 1)
                pos2 = random.randint(0, len(neighbor[route1_idx]) - 1)
                while pos1 == pos2:
                    pos2 = random.randint(0, len(neighbor[route1_idx]) - 1)
                    
                neighbor[route1_idx][pos1], neighbor[route1_idx][pos2] = neighbor[route1_idx][pos2], neighbor[route1_idx][pos1]
            
            # For inter-route swap
            elif len(neighbor) > 1:
                route2_idx = random.randint(0, len(neighbor) - 1)
                while route2_idx == route1_idx:
                    route2_idx = random.randint(0, len(neighbor) - 1)
                
                pos1 = random.randint(0, len(neighbor[route1_idx]) - 1)
                pos2 = random.randint(0, len(neighbor[route2_idx]) - 1)
                
                customer1 = neighbor[route1_idx][pos1]
                customer2 = neighbor[route2_idx][pos2]
                
                # Check capacity constraints for the swap
                new_load1 = self.get_route_load(neighbor[route1_idx]) - self.demands[customer1] + self.demands[customer2]
                new_load2 = self.get_route_load(neighbor[route2_idx]) - self.demands[customer2] + self.demands[customer1]
                
                if new_load1 <= self.vehicle_capacity and new_load2 <= self.vehicle_capacity:
                    neighbor[route1_idx][pos1], neighbor[route2_idx][pos2] = neighbor[route2_idx][pos2], neighbor[route1_idx][pos1]
            
        elif operator == 'two_opt':
            # Reverse a segment within a route (2-opt)
            route_idx = random.randint(0, len(neighbor) - 1)
            if len(neighbor[route_idx]) >= 3:
                i = random.randint(0, len(neighbor[route_idx]) - 3)
                j = random.randint(i + 1, len(neighbor[route_idx]) - 1)
                neighbor[route_idx][i:j+1] = reversed(neighbor[route_idx][i:j+1])
        
        elif operator == 'route_exchange' and len(neighbor) > 1:
            # Exchange parts between two routes
            route1_idx = random.randint(0, len(neighbor) - 1)
            route2_idx = random.randint(0, len(neighbor) - 1)
            
            while route1_idx == route2_idx:
                route2_idx = random.randint(0, len(neighbor) - 1)
            
            if len(neighbor[route1_idx]) > 0 and len(neighbor[route2_idx]) > 0:
                # Choose split points
                split1 = random.randint(0, len(neighbor[route1_idx]))
                split2 = random.randint(0, len(neighbor[route2_idx]))
                
                # Check capacity constraints
                segment1 = neighbor[route1_idx][split1:]
                segment2 = neighbor[route2_idx][split2:]
                
                # Check for duplicate customers
                if not (set(neighbor[route1_idx][:split1]) & set(segment2)) and not (set(neighbor[route2_idx][:split2]) & set(segment1)):
                    new_route1 = neighbor[route1_idx][:split1] + segment2
                    new_route2 = neighbor[route2_idx][:split2] + segment1
                    
                    if (sum(self.demands[c] for c in new_route1) <= self.vehicle_capacity and
                        sum(self.demands[c] for c in new_route2) <= self.vehicle_capacity):
                        neighbor[route1_idx] = new_route1
                        neighbor[route2_idx] = new_route2
                        
        # Remove empty routes
        neighbor = [route for route in neighbor if route]
        
        # Verify solution (no duplicate customers)
        all_customers = []
        for route in neighbor:
            all_customers.extend(route)
        
        # Check for duplicates
        if len(all_customers) != len(set(all_customers)):
            # If duplicates found, return the original solution
            print("Warning: Duplicate customers detected in neighbor solution, returning original")
            return solution
        
        return neighbor
    
    def acceptance_probability(self, old_cost, new_cost, temperature):
        """Calculate the acceptance probability using the Metropolis criterion"""
        if new_cost < old_cost:
            return 1.0
        return math.exp((old_cost - new_cost) / temperature)
    
    def solve(self, max_iterations=10000, callback=None):
        """
        Run the simulated annealing algorithm
        
        Args:
            max_iterations: Maximum number of iterations
            callback: Optional callback function for progress updates
        """
        # Generate initial solution
        current_solution = self.generate_initial_solution()
        
        # Validate initial solution
        is_valid, error_msg = self.validate_solution(current_solution)
        if not is_valid:
            print(f"Warning: Initial solution is invalid: {error_msg}")
            print("Attempting to generate a new initial solution...")
            for _ in range(10):  # Try a few times to get a valid solution
                current_solution = self.generate_initial_solution()
                is_valid, error_msg = self.validate_solution(current_solution)
                if is_valid:
                    break
            
            if not is_valid:
                print("Failed to generate a valid initial solution after multiple attempts")
                print("Proceeding with the best solution found, but results may be unreliable")
        
        current_cost = self.calculate_total_distance(current_solution)
        
        best_solution = copy.deepcopy(current_solution)
        best_cost = current_cost
        
        temperature = self.initial_temperature
        iteration = 0
        
        # For tracking progress
        cost_history = [current_cost]
        temp_history = [temperature]
        progress = {}
        
        while temperature > self.final_temperature and iteration < max_iterations:
            for i in range(self.iterations_per_temperature):
                new_solution = self.generate_neighbor(current_solution)
                
                # Validate neighbor solution
                is_valid, error_msg = self.validate_solution(new_solution)
                if not is_valid:
                    continue  # Skip invalid solutions
                    
                # Skip invalid solutions
                if not self.check_capacity_constraints(new_solution):
                    continue
                    
                new_cost = self.calculate_total_distance(new_solution)
                
                # Decide whether to accept the new solution
                if self.acceptance_probability(current_cost, new_cost, temperature) > random.random():
                    current_solution = new_solution
                    current_cost = new_cost
                    
                    # Update best solution if necessary
                    if current_cost < best_cost:
                        best_solution = copy.deepcopy(current_solution)
                        best_cost = current_cost
            
            # Cool down
            temperature *= self.alpha
            iteration += 1
            
            # Track progress
            cost_history.append(best_cost)
            temp_history.append(temperature)
            
            # Update progress info for Web UI
            if iteration % 5 == 0 and callback:
                progress = {
                    'iteration': iteration,
                    'temperature': temperature,
                    'best_cost': best_cost,
                    'progress': min(100, int((iteration / max_iterations) * 100)),
                    'time': datetime.now().strftime("%H:%M:%S")
                }
                callback(progress)
            
            if iteration % 10 == 0:
                print(f"Iteration {iteration}, Temperature: {temperature:.2f}, Best Cost: {best_cost:.2f}")
        
        # Final validation of best solution
        is_valid, error_msg = self.validate_solution(best_solution)
        if not is_valid:
            print(f"Warning: Best solution is invalid: {error_msg}")
        
        return best_solution, best_cost, cost_history, temp_history

    def get_solution_details(self, solution, company_names=None):
        """
        Get detailed information about the solution for display in the web app
        
        Returns: A dictionary with route details
        """
        details = {
            'total_distance': self.calculate_total_distance(solution),
            'routes': []
        }
        
        for i, route in enumerate(solution):
            route_demand = sum(self.demands[customer] for customer in route)
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
                
            details['routes'].append({
                'id': i + 1,
                'stops': route_display,
                'load': route_demand,
                'capacity': self.vehicle_capacity,
                'distance': route_distance
            })
            
        return details