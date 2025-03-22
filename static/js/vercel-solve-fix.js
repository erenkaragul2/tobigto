// vercel-solve-fix.js - Updated Version
// Add this to your static/js folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading updated Vercel solver compatibility fix...");
    
    // DEBUG: Log the current page state
    console.log("Initial page state:", {
        "solve-button": !!document.getElementById('solveBtn'),
        "process-button": !!document.getElementById('processDataBtn'),
        "appState": !!window.appState
    });
    
    // Ensure window.appState exists
    if (!window.appState) {
        window.appState = {
            dataLoaded: false,
            dataProcessed: false,
            solving: false,
            solutionReady: false,
            jobId: null
        };
    }
    
    // Wait for DOM to be fully loaded and accessible
    setTimeout(function() {
        // Get DOM elements
        const solveBtn = document.getElementById('solveBtn');
        
        if (!solveBtn) {
            console.error("Solve button not found - fix cannot be applied");
            return;
        }
        
        console.log("Found solve button:", solveBtn);
        console.log("Current onclick handler:", solveBtn.onclick);
        
        // Force enable the solve button
        solveBtn.disabled = false;
        
        // Replace with our enhanced handler using direct event attachment
        solveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log("Enhanced solve handler triggered for Vercel");
            console.log("Current app state:", window.appState);

            // Check if we have processed data
            if (!window.appState || !window.appState.problem_data) {
                console.error("No problem data available");
                
                // Show error message
                const solveInfoAlert = document.getElementById('solveInfoAlert');
                if (solveInfoAlert) {
                    solveInfoAlert.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            No problem data available. Please process data first.
                        </div>
                    `;
                }
                
                return;
            }
            
            // Get algorithm parameters
            const params = {
                initial_temperature: parseFloat(document.getElementById('initialTempInput')?.value || 1000.0),
                final_temperature: parseFloat(document.getElementById('finalTempInput')?.value || 1.0),
                cooling_rate: parseFloat(document.getElementById('coolingRateInput')?.value || 0.98),
                max_iterations: parseInt(document.getElementById('maxIterInput')?.value || 1000),
                iterations_per_temp: parseInt(document.getElementById('iterPerTempInput')?.value || 100),
                max_vehicles: parseInt(document.getElementById('maxVehiclesInput')?.value || 5)
            };

            // Show loading state
            solveBtn.disabled = true;
            solveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Starting Solver...';
            
            // Hide info alert and show progress container
            const solveInfoAlert = document.getElementById('solveInfoAlert');
            if (solveInfoAlert) {
                solveInfoAlert.style.display = 'none';
            }
            
            const solverProgressContainer = document.getElementById('solverProgressContainer');
            if (solverProgressContainer) {
                solverProgressContainer.style.display = 'block';
            }
            
            // Reset live updates container
            const liveUpdatesContainer = document.getElementById('liveUpdatesContainer');
            if (liveUpdatesContainer) {
                liveUpdatesContainer.innerHTML = '<div class="text-muted">Starting solver in Vercel compatibility mode...</div>';
            }
            
            // Generate a unique job ID
            const jobId = 'job_' + Math.random().toString(36).substring(2, 15);
            window.appState.jobId = jobId;

            // Skip server call and run client-side solver directly
            runClientSideSolver(params, jobId);
            
            // Prevent event propagation
            return false;
        }, true);  // Use capturing to ensure our handler runs first
        
        console.log("Solve button handler attached");
    }, 1000);  // Wait 1 second to ensure all other scripts have loaded
    // In client-side solver code (vercel-solve-fix.js), before starting the solving process:
    // In client-side solver code (vercel-solve-fix.js), before starting the solving process:
    window.recordAlgorithmRun().then(result => {
        if (result.success) {
            // Continue with solving
            startSolving();
        } else if (result.limit_reached) {
            // Show error about reaching credit limit
            alert("You've reached your monthly algorithm run limit. Please upgrade your plan to continue.");
            
            // Optionally redirect to pricing
            if (result.redirect) {
                window.location.href = result.redirect;
            }
        } else {
            // Show generic error
            console.error("Failed to record algorithm run:", result.error);
        }
    });
    // A simplified client-side solver implementation
    function runClientSideSolver(params, jobId) {
        console.log("Running simplified client-side solver in Vercel compatibility mode");
        
        // Get problem data from window.appState
        const problem_data = window.appState.problem_data;
        
        if (!problem_data) {
            console.error("No problem data available for client-side solver");
            return;
        }
        
        // Add first update
        addUpdate({
            time: new Date().toLocaleTimeString(),
            message: 'Starting client-side solver in Vercel compatibility mode...'
        });
        
        // Set up progress updates
        let progress = 0;
        const solverProgressBar = document.getElementById('solverProgressBar');
        const solverStatusMessage = document.getElementById('solverStatusMessage');
        
        // Function to update progress
        function updateProgress(iteration, innerIter, temperature, bestCost) {
            // Calculate progress as a percentage of max iterations
            progress = Math.min(100, Math.round((iteration / params.max_iterations) * 100));
            
            // Update progress bar
            if (solverProgressBar) {
                solverProgressBar.style.width = `${progress}%`;
                solverProgressBar.setAttribute('aria-valuenow', progress);
            }
            
            // Update status message
            if (solverStatusMessage) {
                solverStatusMessage.textContent = `Iteration ${iteration}, Best Cost: ${bestCost.toFixed(2)}`;
            }
            
            // Add update to live updates container
            addUpdate({
                iteration,
                temperature,
                best_cost: bestCost,
                progress,
                time: new Date().toLocaleTimeString()
            });
        }
        
        // Set up cost history and temperature history arrays
        const costHistory = [];
        const tempHistory = [];
        
        // Create a very simplified simulated annealing solver
        // This is a placeholder that creates a plausible solution without the full algorithm
        setTimeout(() => simulateAnnealing({
            distance_matrix: problem_data.distance_matrix,
            demands: problem_data.demands,
            depot: problem_data.depot || 0,
            vehicle_capacity: problem_data.vehicle_capacity,
            max_vehicles: params.max_vehicles,
            initial_temperature: params.initial_temperature,
            final_temperature: params.final_temperature,
            cooling_rate: params.cooling_rate,
            max_iterations: params.max_iterations,
            iterations_per_temp: params.iterations_per_temp,
            updateProgress,
            costHistory,
            tempHistory
        }), 500);
    }
    
    // Function to simulate the annealing process
    function simulateAnnealing(options) {
        const {
            distance_matrix,
            demands,
            depot,
            vehicle_capacity,
            max_vehicles,
            initial_temperature,
            final_temperature,
            cooling_rate,
            max_iterations,
            iterations_per_temp,
            updateProgress,
            costHistory,
            tempHistory
        } = options;
        
        console.log("Starting simplified simulated annealing");
        
        // Generate an initial greedy solution
        const numNodes = distance_matrix.length;
        const customers = [];
        for (let i = 0; i < numNodes; i++) {
            if (i !== depot) {
                customers.push(i);
            }
        }
        
        // Sort customers by distance from depot (farthest first)
        customers.sort((a, b) => distance_matrix[depot][b] - distance_matrix[depot][a]);
        
        // Initialize routes
        let routes = [];
        let currentRoute = [];
        let currentLoad = 0;
        
        // Distribute customers to routes
        const remainingCustomers = [...customers];
        while (remainingCustomers.length > 0) {
            const customer = remainingCustomers.shift();
            const customerDemand = demands[customer];
            
            // If adding this customer exceeds capacity, start a new route
            if (currentLoad + customerDemand > vehicle_capacity) {
                if (currentRoute.length > 0) {
                    routes.push(currentRoute);
                }
                
                // Check if we've reached max number of vehicles
                if (routes.length >= max_vehicles - 1 && remainingCustomers.length > 0) {
                    // Force remaining customers into last route
                    const lastRoute = [customer, ...remainingCustomers];
                    routes.push(lastRoute);
                    break;
                } else {
                    // Start new route
                    currentRoute = [customer];
                    currentLoad = customerDemand;
                }
            } else {
                // Add to current route
                currentRoute.push(customer);
                currentLoad += customerDemand;
            }
        }
        
        // Add the last route if not empty
        if (currentRoute.length > 0 && (routes.length === 0 || currentRoute !== routes[routes.length - 1])) {
            routes.push(currentRoute);
        }
        
        // Calculate initial cost
        let currentCost = calculateTotalDistance(routes, distance_matrix, depot);
        let bestRoutes = JSON.parse(JSON.stringify(routes));
        let bestCost = currentCost;
        
        // Record initial state
        costHistory.push(bestCost);
        tempHistory.push(initial_temperature);
        
        // Start with initial temperature
        let temperature = initial_temperature;
        let iteration = 0;
        
        // Main annealing loop
        const annealingIteration = () => {
            if (temperature > final_temperature && iteration < max_iterations) {
                iteration++;
                
                // Update progress periodically
                if (iteration % 5 === 0 || iteration === 1) {
                    updateProgress(iteration, iterations_per_temp, temperature, bestCost);
                }
                
                // Inner loop for each temperature
                for (let innerIter = 0; innerIter < iterations_per_temp; innerIter++) {
                    // Generate neighboring solution by random move
                    const neighborRoutes = generateNeighbor(routes, numNodes, depot, demands, vehicle_capacity, max_vehicles);
                    
                    // Calculate new cost
                    const neighborCost = calculateTotalDistance(neighborRoutes, distance_matrix, depot);
                    
                    // Decide whether to accept new solution
                    const delta = neighborCost - currentCost;
                    
                    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
                        routes = neighborRoutes;
                        currentCost = neighborCost;
                        
                        // Update best solution if current is better
                        if (currentCost < bestCost) {
                            bestRoutes = JSON.parse(JSON.stringify(routes));
                            bestCost = currentCost;
                        }
                    }
                }
                
                // Cool down temperature
                temperature *= cooling_rate;
                
                // Record history
                costHistory.push(bestCost);
                tempHistory.push(temperature);
                
                // Schedule next iteration with setTimeout to avoid blocking UI
                setTimeout(annealingIteration, 0);
            } else {
                // Annealing complete
                console.log("Simulated annealing complete");
                
                // Create route details (similar format to the server response)
                const routeDetails = createRouteDetails(bestRoutes, depot, demands, vehicle_capacity, distance_matrix);
                
                // Create solution object
                const solution = {
                    routes: bestRoutes,
                    cost: bestCost,
                    details: routeDetails,
                    depot: depot,
                    coordinates: window.appState.problem_data.coordinates,
                    company_names: window.appState.problem_data.company_names
                };
                
                // Mark as completed
                window.appState.solving = false;
                window.appState.solutionReady = true;
                
                const solveBtn = document.getElementById('solveBtn');
                if (solveBtn) {
                    solveBtn.disabled = false;
                    solveBtn.innerHTML = '<i class="fas fa-check me-2"></i>Solved!';
                }
                
                // Add final update
                addUpdate({
                    time: new Date().toLocaleTimeString(),
                    message: `Solution found with cost: ${bestCost.toFixed(2)} in Vercel compatibility mode`
                });
                
                // Update progress to 100%
                if (updateProgress) {
                    updateProgress(max_iterations, iterations_per_temp, temperature, bestCost);
                }
                
                // Display solution results
                if (typeof window.displaySolutionResults === 'function') {
                    window.displaySolutionResults({
                        success: true,
                        solution: solution,
                        cost_history: costHistory,
                        temp_history: tempHistory
                    });
                    
                    // Also try to show the results tab
                    const resultsTab = document.getElementById('results-tab');
                    if (resultsTab) {
                        resultsTab.click();
                    }
                } else {
                    console.error("displaySolutionResults function not found");
                    alert("Solution found but display function not available. Please check the console for details.");
                }
            }
        };
        
        // Start the annealing process
        annealingIteration();
    }
    
    // Helper functions for the simplified solver
    
    // Generate neighbor by random move operation
    function generateNeighbor(routes, numNodes, depot, demands, vehicle_capacity, max_vehicles) {
        const neighbor = JSON.parse(JSON.stringify(routes));
        
        // Pick a random move type
        const moveType = Math.random() < 0.5 ? "swap" : "relocate";
        
        if (moveType === "swap" && neighbor.length > 0) {
            if (Math.random() < 0.5 && neighbor.some(route => route.length >= 2)) {
                // Intra-route swap
                const routeIdx = randomIndexWithCondition(neighbor, route => route.length >= 2);
                if (routeIdx === -1) return neighbor;
                
                const route = neighbor[routeIdx];
                const i = Math.floor(Math.random() * route.length);
                let j = Math.floor(Math.random() * route.length);
                
                // Ensure i and j are different
                while (j === i) {
                    j = Math.floor(Math.random() * route.length);
                }
                
                // Swap customers
                [route[i], route[j]] = [route[j], route[i]];
            } else {
                // Inter-route swap
                if (neighbor.length < 2) return neighbor;
                
                // Select two different routes
                const route1Idx = Math.floor(Math.random() * neighbor.length);
                let route2Idx = Math.floor(Math.random() * neighbor.length);
                
                // Ensure routes are different
                while (route2Idx === route1Idx) {
                    route2Idx = Math.floor(Math.random() * neighbor.length);
                }
                
                // Select one customer from each route
                if (neighbor[route1Idx].length === 0 || neighbor[route2Idx].length === 0) {
                    return neighbor;
                }
                
                const customer1Idx = Math.floor(Math.random() * neighbor[route1Idx].length);
                const customer2Idx = Math.floor(Math.random() * neighbor[route2Idx].length);
                
                // Get the customers
                const customer1 = neighbor[route1Idx][customer1Idx];
                const customer2 = neighbor[route2Idx][customer2Idx];
                
                // Calculate loads after swap
                const route1Load = calculateRouteLoad(neighbor[route1Idx], demands);
                const route2Load = calculateRouteLoad(neighbor[route2Idx], demands);
                
                const new1Load = route1Load - demands[customer1] + demands[customer2];
                const new2Load = route2Load - demands[customer2] + demands[customer1];
                
                // Only swap if capacity constraints are satisfied
                if (new1Load <= vehicle_capacity && new2Load <= vehicle_capacity) {
                    neighbor[route1Idx][customer1Idx] = customer2;
                    neighbor[route2Idx][customer2Idx] = customer1;
                }
            }
        } else if (moveType === "relocate" && neighbor.length > 0) {
            // Move a customer from one route to another
            if (neighbor.length < 1) return neighbor;
            
            // Select a source route that's not empty
            const sourceRouteIdx = randomIndexWithCondition(neighbor, route => route.length > 0);
            if (sourceRouteIdx === -1) return neighbor;
            
            // Select a customer from source route
            const customerIdx = Math.floor(Math.random() * neighbor[sourceRouteIdx].length);
            const customer = neighbor[sourceRouteIdx][customerIdx];
            
            // Determine if we should create a new route
            const createNewRoute = neighbor.length < max_vehicles && Math.random() < 0.2;
            
            if (createNewRoute) {
                // Create a new route with this customer
                neighbor.push([customer]);
                
                // Remove from source route
                neighbor[sourceRouteIdx].splice(customerIdx, 1);
            } else {
                // Select a target route different from source
                let targetRouteIdx;
                if (neighbor.length > 1) {
                    do {
                        targetRouteIdx = Math.floor(Math.random() * neighbor.length);
                    } while (targetRouteIdx === sourceRouteIdx);
                } else {
                    targetRouteIdx = sourceRouteIdx;
                }
                
                // Check if capacity would be exceeded
                const targetLoad = calculateRouteLoad(neighbor[targetRouteIdx], demands);
                if (targetLoad + demands[customer] <= vehicle_capacity) {
                    // Remove from source route
                    neighbor[sourceRouteIdx].splice(customerIdx, 1);
                    
                    // Insert into target route at random position
                    const insertPos = Math.floor(Math.random() * (neighbor[targetRouteIdx].length + 1));
                    neighbor[targetRouteIdx].splice(insertPos, 0, customer);
                }
            }
            
            // Clean up empty routes
            for (let i = neighbor.length - 1; i >= 0; i--) {
                if (neighbor[i].length === 0) {
                    neighbor.splice(i, 1);
                }
            }
        }
        
        return neighbor;
    }
    
    // Helper for random selection with condition
    function randomIndexWithCondition(array, condition) {
        const validIndices = [];
        for (let i = 0; i < array.length; i++) {
            if (condition(array[i])) {
                validIndices.push(i);
            }
        }
        
        if (validIndices.length === 0) return -1;
        return validIndices[Math.floor(Math.random() * validIndices.length)];
    }
    
    // Calculate route load
    function calculateRouteLoad(route, demands) {
        return route.reduce((sum, customer) => sum + demands[customer], 0);
    }
    
    // Calculate distance of a single route
    function calculateRouteDistance(route, distance_matrix, depot) {
        if (route.length === 0) return 0;
        
        let distance = distance_matrix[depot][route[0]];
        
        for (let i = 0; i < route.length - 1; i++) {
            distance += distance_matrix[route[i]][route[i + 1]];
        }
        
        distance += distance_matrix[route[route.length - 1]][depot];
        
        return distance;
    }
    
    // Calculate total distance of all routes
    function calculateTotalDistance(routes, distance_matrix, depot) {
        return routes.reduce((sum, route) => sum + calculateRouteDistance(route, distance_matrix, depot), 0);
    }
    
    // Create route details object for display
    function createRouteDetails(routes, depot, demands, vehicle_capacity, distance_matrix) {
        const routeDetails = {
            total_distance: calculateTotalDistance(routes, distance_matrix, depot),
            routes: []
        };
        
        routes.forEach((route, index) => {
            const routeLoad = calculateRouteLoad(route, demands);
            const routeDistance = calculateRouteDistance(route, distance_matrix, depot);
            
            // Create stops with depot as first and last
            const stops = [
                { index: depot, name: "Depot" },
                ...route.map(node => ({ index: node, name: `Customer ${node}` })),
                { index: depot, name: "Depot" }
            ];
            
            routeDetails.routes.push({
                id: index + 1,
                stops: stops,
                load: routeLoad,
                capacity: vehicle_capacity,
                distance: routeDistance
            });
        });
        
        return routeDetails;
    }
    
    // Helper function to add an update to the live updates container
    function addUpdate(update) {
        const liveUpdatesContainer = document.getElementById('liveUpdatesContainer');
        if (!liveUpdatesContainer) return;
        
        const updateDiv = document.createElement('div');
        updateDiv.className = 'update-entry';
        
        if (update.message) {
            updateDiv.innerHTML = `
                <small class="text-muted">${update.time}</small>
                <span class="ms-2">${update.message}</span>
            `;
        } else {
            updateDiv.innerHTML = `
                <small class="text-muted">${update.time}</small>
                <span class="ms-2">
                    Iteration: ${update.iteration}, Temp: ${update.temperature.toFixed(2)}, 
                    Best Cost: ${update.best_cost.toFixed(2)}
                </span>
            `;
        }
        
        liveUpdatesContainer.appendChild(updateDiv);
        liveUpdatesContainer.scrollTop = liveUpdatesContainer.scrollHeight;
    }
    
    console.log("Updated Vercel solver compatibility fix loaded");
});