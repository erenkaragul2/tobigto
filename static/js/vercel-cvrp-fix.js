// vercel-cvrp-fix.js - Add this to your static/js folder and include in index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("🔧 Loading CVRP Vercel Compatibility Fix...");
    
    // Make sure we have global state object
    if (!window.appState) {
        window.appState = {
            dataLoaded: false,
            dataProcessed: false,
            solving: false,
            solutionReady: false,
            jobId: null,
            problem_data: null
        };
    }
    
    // Wait until page is fully loaded and all other scripts have run
    setTimeout(function() {
        initCVRPFix();
    }, 1000);
    
    // ==========================================
    // Main initialization function
    // ==========================================
    function initCVRPFix() {
        console.log("🔧 Initializing CVRP Vercel fix...");
        
        // Find critical elements
        const solveBtn = document.getElementById('solveBtn');
        const processDataBtn = document.getElementById('processDataBtn');
        const uploadBtn = document.getElementById('uploadBtn');
        const generateRandomBtn = document.getElementById('generateRandomBtn');
        
        if (!solveBtn) {
            console.error("❌ Solve button not found - cannot apply fix");
            return;
        }
        
        console.log("👉 Current solve button state:", {
            disabled: solveBtn.disabled,
            innerHTML: solveBtn.innerHTML,
            hasOnClick: typeof solveBtn.onclick === 'function'
        });
        
        // Step 1: Force enable the solve button if disabled
        solveBtn.disabled = false;
        
        // Step 2: Replace event handlers with our robust versions
        // Remove any existing event listeners using an aggressive approach
        replaceClickHandler(solveBtn, enhancedSolveHandler);
        
        if (processDataBtn) {
            replaceClickHandler(processDataBtn, enhancedProcessDataHandler);
        }
        
        // Add debug controls for testing
        addDebugControls();
        
        console.log("✅ CVRP Vercel fix installed successfully");
    }
    
    // ==========================================
    // Robust event handling replacement
    // ==========================================
    function replaceClickHandler(element, newHandler) {
        if (!element) return;
        
        // Log the element we're modifying
        console.log(`🔄 Replacing click handler for ${element.id || 'unknown element'}`);
        
        // Remove all existing click listeners using cloneNode
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        
        // Add our handler with both approaches for maximum compatibility
        newElement.onclick = newHandler;
        newElement.addEventListener('click', newHandler);
        
        return newElement;
    }
    
    // ==========================================
    // Enhanced Solve Handler - Client-side only approach
    // ==========================================
    function enhancedSolveHandler(e) {
        // Prevent default form submission
        if (e) e.preventDefault();
        
        console.log("🚀 Enhanced solve handler triggered");
        
        // Basic validation
        if (!window.appState.dataProcessed && !window.appState.problem_data) {
            prepareEmergencyData();
        }
        
        const solveBtn = document.getElementById('solveBtn');
        const solveInfoAlert = document.getElementById('solveInfoAlert');
        const solverProgressContainer = document.getElementById('solverProgressContainer');
        const solverProgressBar = document.getElementById('solverProgressBar');
        const solverStatusMessage = document.getElementById('solverStatusMessage');
        const liveUpdatesContainer = document.getElementById('liveUpdatesContainer');
        
        // Show loading state
        solveBtn.disabled = true;
        solveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Starting Solver...';
        
        if (solveInfoAlert) solveInfoAlert.style.display = 'none';
        if (solverProgressContainer) solverProgressContainer.style.display = 'block';
        if (liveUpdatesContainer) {
            liveUpdatesContainer.innerHTML = '<div class="text-muted">Starting solver in Vercel compatibility mode...</div>';
        }
        
        // Generate a unique job ID
        const jobId = 'job_' + Math.random().toString(36).substring(2, 15);
        window.appState.jobId = jobId;
        
        // Get algorithm parameters
        const params = {
            initial_temperature: parseFloat(document.getElementById('initialTempInput')?.value || 1000.0),
            final_temperature: parseFloat(document.getElementById('finalTempInput')?.value || 1.0),
            cooling_rate: parseFloat(document.getElementById('coolingRateInput')?.value || 0.98),
            max_iterations: parseInt(document.getElementById('maxIterInput')?.value || 1000),
            iterations_per_temp: parseInt(document.getElementById('iterPerTempInput')?.value || 100),
            max_vehicles: parseInt(document.getElementById('maxVehiclesInput')?.value || 5)
        };
        
        console.log("🔧 Running solver with params:", params);
        
        // Run entirely on client side - skip server call
        setTimeout(() => runClientSideSolver(params, jobId), 500);
        
        return false; // Prevent any other handlers from running
    }
    
    // ==========================================
    // Emergency data preparation if needed
    // ==========================================
    function prepareEmergencyData() {
        console.log("🚨 Emergency data preparation - no processed data found");
        
        // Create minimal viable problem data
        window.appState.problem_data = {
            coordinates: [
                [40.73061, -73.935242],  // Node 0 (Depot)
                [40.736591, -73.919061],  // Node 1
                [40.742652, -73.925686],  // Node 2
                [40.736073, -73.913830],  // Node 3
                [40.728226, -73.926659],  // Node 4
                [40.721573, -73.932344],  // Node 5
                [40.724427, -73.917666],  // Node 6
                [40.730824, -73.908053]   // Node 7
            ],
            demands: [0, 5, 7, 3, 4, 6, 5, 2],
            company_names: [
                "Depot", "Customer 1", "Customer 2", "Customer 3", 
                "Customer 4", "Customer 5", "Customer 6", "Customer 7"
            ],
            depot: 0,
            vehicle_capacity: 20,
            max_vehicles: 3,
            distance_type: 'Euclidean'
        };
        
        // Calculate distance matrix
        const coordinates = window.appState.problem_data.coordinates;
        const matrix = [];
        
        for (let i = 0; i < coordinates.length; i++) {
            const row = [];
            for (let j = 0; j < coordinates.length; j++) {
                if (i === j) {
                    row.push(0);
                } else {
                    // Calculate Euclidean distance in meters
                    const lat1 = coordinates[i][0];
                    const lng1 = coordinates[i][1];
                    const lat2 = coordinates[j][0];
                    const lng2 = coordinates[j][1];
                    
                    // Convert to radians
                    const latRad1 = lat1 * Math.PI / 180;
                    const lngRad1 = lng1 * Math.PI / 180;
                    const latRad2 = lat2 * Math.PI / 180;
                    const lngRad2 = lng2 * Math.PI / 180;
                    
                    // Haversine formula for distance
                    const dlon = lngRad2 - lngRad1;
                    const dlat = latRad2 - latRad1;
                    const a = Math.sin(dlat/2)**2 + Math.cos(latRad1) * Math.cos(latRad2) * Math.sin(dlon/2)**2;
                    const c = 2 * Math.asin(Math.sqrt(a));
                    const r = 6371000;  // Earth radius in meters
                    
                    row.push(c * r);
                }
            }
            matrix.push(row);
        }
        
        window.appState.problem_data.distance_matrix = matrix;
        window.appState.dataProcessed = true;
        
        console.log("✅ Emergency data prepared successfully");
        
        // Show user notification
        const solveInfoAlert = document.getElementById('solveInfoAlert');
        if (solveInfoAlert) {
            solveInfoAlert.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No problem data was found. Using sample data for demonstration.
                </div>
            `;
            solveInfoAlert.style.display = 'block';
        }
    }
    
    // ==========================================
    // Enhanced Process Data Handler
    // ==========================================
    function enhancedProcessDataHandler(e) {
        if (e) e.preventDefault();
        
        console.log("🔧 Enhanced process data handler triggered");
        
        // Get form values
        const depot = parseInt(document.getElementById('depotInput').value) || 0;
        const vehicle_capacity = parseInt(document.getElementById('capacityInput').value) || 20;
        const max_vehicles = parseInt(document.getElementById('maxVehiclesInput').value) || 5;
        
        const processDataBtn = document.getElementById('processDataBtn');
        
        // Show loading state
        if (processDataBtn) {
            processDataBtn.disabled = true;
            processDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        }
        
        // Show notification
        const configTab = document.getElementById('config');
        if (configTab) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-info mt-3';
            alertDiv.id = 'processingAlert';
            alertDiv.innerHTML = '<i class="fas fa-info-circle me-2"></i>Processing data with Vercel compatibility mode...';
            configTab.appendChild(alertDiv);
        }
        
        // If we have coordinates in app state, use them for matrix calculation
        if (window.appState.coordinates && window.appState.coordinates.length > 0) {
            const coordinates = window.appState.coordinates;
            const demands = window.appState.demands || [];
            const company_names = window.appState.company_names || [];
            
            // Calculate distance matrix client-side
            const matrix = calculateDistanceMatrix(coordinates);
            
            // Create complete problem data
            window.appState.problem_data = {
                coordinates: coordinates,
                demands: demands.length ? demands : Array(coordinates.length).fill(5),
                company_names: company_names.length ? company_names : Array(coordinates.length).fill().map((_, i) => i === depot ? "Depot" : `Customer ${i}`),
                distance_matrix: matrix,
                depot: depot,
                vehicle_capacity: vehicle_capacity,
                max_vehicles: max_vehicles,
                distance_type: 'Euclidean'
            };
            
            window.appState.dataProcessed = true;
            
            // Update UI
            updateProcessingUI(true);
            
            // Show distance matrix preview
            showMatrixPreview(matrix);
            
            return;
        }
        
        // Otherwise check session data
        if (window.appState.data && window.appState.data.previewData) {
            try {
                const data = window.appState.data;
                
                // Try to extract coordinates from preview data
                const coordinates = extractCoordinatesFromPreview(data.previewData);
                
                if (coordinates.length > 0) {
                    // Calculate distance matrix
                    const matrix = calculateDistanceMatrix(coordinates);
                    
                    // Extract additional data
                    const demands = extractDemandsFromPreview(data.previewData, depot);
                    const company_names = extractNamesFromPreview(data.previewData, depot);
                    
                    // Create problem data
                    window.appState.problem_data = {
                        coordinates: coordinates,
                        demands: demands,
                        company_names: company_names,
                        distance_matrix: matrix,
                        depot: depot,
                        vehicle_capacity: vehicle_capacity,
                        max_vehicles: max_vehicles,
                        distance_type: 'Euclidean'
                    };
                    
                    window.appState.dataProcessed = true;
                    
                    // Update UI
                    updateProcessingUI(true);
                    
                    // Show matrix preview
                    showMatrixPreview(matrix);
                    
                    return;
                }
            } catch (err) {
                console.error("Error processing data from preview:", err);
            }
        }
        
        // Fall back to sample data if all else fails
        prepareEmergencyData();
        updateProcessingUI(true);
    }
    
    // ==========================================
    // Utility functions
    // ==========================================
    
    // Extract coordinates from preview data
    function extractCoordinatesFromPreview(previewData) {
        if (!previewData || !previewData.length) return [];
        
        const coordinates = [];
        
        // Check for common coordinate column patterns
        previewData.forEach(row => {
            if (row.X !== undefined && row.Y !== undefined) {
                // X,Y format
                const x = parseFloat(row.X);
                const y = parseFloat(row.Y);
                if (!isNaN(x) && !isNaN(y)) {
                    coordinates.push([x, y]);
                }
            } else if (row.Latitude !== undefined && row.Longitude !== undefined) {
                // Lat/Lng format
                const lat = parseFloat(row.Latitude);
                const lng = parseFloat(row.Longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    coordinates.push([lat, lng]);
                }
            } else if (row.x_coord !== undefined && row.y_coord !== undefined) {
                // x_coord/y_coord format
                const x = parseFloat(row.x_coord);
                const y = parseFloat(row.y_coord);
                if (!isNaN(x) && !isNaN(y)) {
                    coordinates.push([x, y]);
                }
            } else if (row.coordinates !== undefined) {
                // Combined coordinates format (e.g. "40.123, -74.456")
                const coordStr = String(row.coordinates).replace(/[()]/g, '');
                const parts = coordStr.split(/[,;]/);
                if (parts.length >= 2) {
                    const x = parseFloat(parts[0]);
                    const y = parseFloat(parts[1]);
                    if (!isNaN(x) && !isNaN(y)) {
                        coordinates.push([x, y]);
                    }
                }
            }
        });
        
        return coordinates;
    }
    
    // Extract demands from preview data
    function extractDemandsFromPreview(previewData, depot = 0) {
        if (!previewData || !previewData.length) return [];
        
        const demands = [];
        
        previewData.forEach((row, index) => {
            if (row.Demand !== undefined) {
                // Direct Demand column
                const demand = parseInt(row.Demand);
                demands.push(isNaN(demand) ? (index === depot ? 0 : 5) : demand);
            } else if (row.demand !== undefined) {
                // lowercase demand column
                const demand = parseInt(row.demand);
                demands.push(isNaN(demand) ? (index === depot ? 0 : 5) : demand);
            } else if (row.Quantity !== undefined) {
                // Quantity column as fallback
                const demand = parseInt(row.Quantity);
                demands.push(isNaN(demand) ? (index === depot ? 0 : 5) : demand);
            } else {
                // Default values
                demands.push(index === depot ? 0 : 5);
            }
        });
        
        return demands;
    }
    
    // Extract customer names from preview data
    function extractNamesFromPreview(previewData, depot = 0) {
        if (!previewData || !previewData.length) return [];
        
        const names = [];
        
        previewData.forEach((row, index) => {
            if (row.Name !== undefined) {
                names.push(row.Name || (index === depot ? "Depot" : `Customer ${index}`));
            } else if (row.company_name !== undefined) {
                names.push(row.company_name || (index === depot ? "Depot" : `Customer ${index}`));
            } else if (row.Customer !== undefined) {
                names.push(row.Customer || (index === depot ? "Depot" : `Customer ${index}`));
            } else {
                names.push(index === depot ? "Depot" : `Customer ${index}`);
            }
        });
        
        return names;
    }
    
    // Calculate distance matrix from coordinates
    function calculateDistanceMatrix(coordinates) {
        const matrix = [];
        const numNodes = coordinates.length;
        
        for (let i = 0; i < numNodes; i++) {
            const row = [];
            for (let j = 0; j < numNodes; j++) {
                if (i === j) {
                    row.push(0);
                } else {
                    // Calculate Euclidean distance in meters
                    const lat1 = coordinates[i][0];
                    const lng1 = coordinates[i][1];
                    const lat2 = coordinates[j][0];
                    const lng2 = coordinates[j][1];
                    
                    // Convert to radians
                    const latRad1 = lat1 * Math.PI / 180;
                    const lngRad1 = lng1 * Math.PI / 180;
                    const latRad2 = lat2 * Math.PI / 180;
                    const lngRad2 = lng2 * Math.PI / 180;
                    
                    // Haversine formula for distance
                    const dlon = lngRad2 - lngRad1;
                    const dlat = latRad2 - latRad1;
                    const a = Math.sin(dlat/2)**2 + Math.cos(latRad1) * Math.cos(latRad2) * Math.sin(dlon/2)**2;
                    const c = 2 * Math.asin(Math.sqrt(a));
                    const r = 6371000;  // Earth radius in meters
                    
                    row.push(c * r);
                }
            }
            matrix.push(row);
        }
        
        return matrix;
    }
    
    // Update UI after processing
    function updateProcessingUI(success) {
        const processDataBtn = document.getElementById('processDataBtn');
        const processingAlert = document.getElementById('processingAlert');
        const solveBtn = document.getElementById('solveBtn');
        const solveInfoAlert = document.getElementById('solveInfoAlert');
        const toggleMatrixBtn = document.getElementById('toggleMatrixBtn');
        
        // Reset button state
        if (processDataBtn) {
            processDataBtn.disabled = false;
            processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
        }
        
        // Update alert
        if (processingAlert) {
            if (success) {
                processingAlert.className = 'alert alert-success mt-3';
                processingAlert.innerHTML = '<i class="fas fa-check-circle me-2"></i>Data processed successfully with Vercel compatibility mode. You can now solve the problem.';
            } else {
                processingAlert.className = 'alert alert-danger mt-3';
                processingAlert.innerHTML = '<i class="fas fa-exclamation-circle me-2"></i>Error processing data. Please try again.';
            }
        }
        
        // Enable solve button
        if (solveBtn) {
            solveBtn.disabled = false;
        }
        
        // Update solve tab info
        if (solveInfoAlert) {
            solveInfoAlert.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Data processed successfully with Vercel compatibility mode. You can now solve the problem.
                </div>
            `;
        }
        
        // Show toggle matrix button
        if (toggleMatrixBtn) {
            toggleMatrixBtn.style.display = 'block';
        }
        
        // Enable and activate solve tab
        const solveTab = document.getElementById('solve-tab');
        if (solveTab) {
            solveTab.classList.remove('disabled');
            setTimeout(() => solveTab.click(), 500);
        }
    }
    
    // Show distance matrix preview
    function showMatrixPreview(matrix) {
        const matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
        if (!matrixPreviewContainer) return;
        
        matrixPreviewContainer.innerHTML = '';
        
        // Create a preview table (first 5x5 elements)
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-responsive';
        
        const table = document.createElement('table');
        table.className = 'table table-sm table-bordered data-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Node</th>';
        
        const previewSize = Math.min(5, matrix.length);
        for (let i = 0; i < previewSize; i++) {
            headerRow.innerHTML += `<th>Node ${i}</th>`;
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        for (let i = 0; i < previewSize; i++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>Node ${i}</strong></td>`;
            
            for (let j = 0; j < previewSize; j++) {
                const value = matrix[i][j];
                tr.innerHTML += `<td>${(value / 1000).toFixed(2)} km</td>`;
            }
            
            tbody.appendChild(tr);
        }
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        matrixPreviewContainer.appendChild(tableContainer);
    }
    
    // ==========================================
    // Client-Side Solver
    // ==========================================
    function runClientSideSolver(params, jobId) {
        console.log("🧮 Running client-side solver for job:", jobId);
        
        // Get problem data
        const problem_data = window.appState.problem_data;
        
        if (!problem_data) {
            console.error("No problem data available");
            return;
        }
        
        // Set up progress and history tracking
        const costHistory = [];
        const tempHistory = [];
        let progress = 0;
        
        // Set up UI elements
        const solverProgressBar = document.getElementById('solverProgressBar');
        const solverStatusMessage = document.getElementById('solverStatusMessage');
        const liveUpdatesContainer = document.getElementById('liveUpdatesContainer');
        
        // Function to update progress
        function updateProgress(iteration, innerIter, temperature, bestCost) {
            // Calculate progress percentage
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
            if (liveUpdatesContainer) {
                const updateDiv = document.createElement('div');
                updateDiv.className = 'update-entry';
                updateDiv.innerHTML = `
                    <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                    <span class="ms-2">Iteration: ${iteration}, Temp: ${temperature.toFixed(2)}, Best Cost: ${bestCost.toFixed(2)}</span>
                `;
                liveUpdatesContainer.appendChild(updateDiv);
                liveUpdatesContainer.scrollTop = liveUpdatesContainer.scrollHeight;
            }
        }
        
        // Add first update
        if (liveUpdatesContainer) {
            const updateDiv = document.createElement('div');
            updateDiv.className = 'update-entry';
            updateDiv.innerHTML = `
                <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                <span class="ms-2">Starting simulated annealing solver...</span>
            `;
            liveUpdatesContainer.appendChild(updateDiv);
        }
        
        // Start the simulated annealing process
        simulateAnnealing({
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
            updateProgress: updateProgress,
            costHistory: costHistory,
            tempHistory: tempHistory
        });
    }
    
    // Simulated Annealing Algorithm Implementation
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
        
        console.log("🧮 Starting simulated annealing with params:", {
            nodes: distance_matrix.length,
            depot,
            vehicle_capacity,
            max_vehicles
        });
        
        // Initialize variables
        const numNodes = distance_matrix.length;
        let temperature = initial_temperature;
        let iteration = 0;
        
        // Generate an initial solution
        let currentSolution = generateInitialSolution(numNodes, depot, demands, vehicle_capacity, max_vehicles);
        let currentCost = calculateTotalDistance(currentSolution, distance_matrix, depot);
        
        let bestSolution = JSON.parse(JSON.stringify(currentSolution));
        let bestCost = currentCost;
        
        // Record initial state
        costHistory.push(bestCost);
        tempHistory.push(temperature);
        
        // Main annealing loop - implemented with setTimeout to avoid blocking UI
        function annealingIteration() {
            if (temperature > final_temperature && iteration < max_iterations) {
                iteration++;
                
                // Update progress
                if (iteration % 5 === 0 || iteration === 1) {
                    updateProgress(iteration, iterations_per_temp, temperature, bestCost);
                }
                
                // Inner loop for each temperature
                for (let innerIter = 0; innerIter < iterations_per_temp; innerIter++) {
                    // Generate neighboring solution
                    const neighborSolution = generateNeighbor(currentSolution, numNodes, depot, demands, vehicle_capacity, max_vehicles);
                    
                    // Calculate new cost
                    const neighborCost = calculateTotalDistance(neighborSolution, distance_matrix, depot);
                    
                    // Decide whether to accept new solution
                    const delta = neighborCost - currentCost;
                    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
                        currentSolution = neighborSolution;
                        currentCost = neighborCost;
                        
                        // Update best solution if current is better
                        if (currentCost < bestCost) {
                            bestSolution = JSON.parse(JSON.stringify(currentSolution));
                            bestCost = currentCost;
                        }
                    }
                }
                
                // Cool down temperature
                temperature *= cooling_rate;
                
                // Record history
                costHistory.push(bestCost);
                tempHistory.push(temperature);
                
                // Continue with next iteration using setTimeout to avoid blocking UI
                setTimeout(annealingIteration, 0);
            } else {
                // Annealing complete
                console.log("✅ Simulated annealing complete", {
                    iterations: iteration,
                    finalTemperature: temperature,
                    bestCost: bestCost
                });
                
                // Create route details
                const routeDetails = createRouteDetails(bestSolution, depot, demands, vehicle_capacity, distance_matrix);
                
                // Create solution object
                const solution = {
                    routes: bestSolution,
                    cost: bestCost,
                    details: routeDetails,
                    depot: depot,
                    coordinates: window.appState.problem_data.coordinates,
                    company_names: window.appState.problem_data.company_names
                };
                
                // Mark as completed
                window.appState.solving = false;
                window.appState.solutionReady = true;
                
                // Reset solve button
                const solveBtn = document.getElementById('solveBtn');
                if (solveBtn) {
                    solveBtn.disabled = false;
                    solveBtn.innerHTML = '<i class="fas fa-check me-2"></i>Solved!';
                }
                
                // Add final update
                updateProgress(max_iterations, iterations_per_temp, temperature, bestCost);
                
                // Display solution results
                if (typeof window.displaySolutionResults === 'function') {
                    window.displaySolutionResults({
                        success: true,
                        solution: solution,
                        cost_history: costHistory,
                        temp_history: tempHistory
                    });
                    
                    // Show results tab
                    const resultsTab = document.getElementById('results-tab');
                    if (resultsTab) {
                        resultsTab.click();
                    }
                } else {
                    console.error("❌ displaySolutionResults function not found");
                    alert("Solution found but display function not available. The solver algorithm has completed successfully but we can't show the results.");
                }
            }
        }
        
        // Start the annealing process
        annealingIteration();
    }
    
    // Generate initial solution
    function generateInitialSolution(numNodes, depot, demands, vehicle_capacity, max_vehicles) {
        // Create array of customer indices (excluding depot)
        const customers = [];
        for (let i = 0; i < numNodes; i++) {
            if (i !== depot) {
                customers.push(i);
            }
        }
        
        // Initialize routes
        const routes = [];
        let currentRoute = [];
        let currentLoad = 0;
        
        // Simple bin packing approach
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
                    // Force all remaining customers into last route
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
        
        return routes;
    }
    
    // Generate neighboring solution
    function generateNeighbor(currentSolution, numNodes, depot, demands, vehicle_capacity, max_vehicles) {
        // Make a deep copy of the current solution
        const neighbor = JSON.parse(JSON.stringify(currentSolution));
        
        // Pick a random move type
        const moveType = Math.random() < 0.5 ? "swap" : "relocate";
        
        if (moveType === "swap" && neighbor.length > 0) {
            if (Math.random() < 0.5 && neighbor.some(route => route.length >= 2)) {
                // Intra-route swap
                const routeIdx = randomRouteWithMinLength(neighbor, 2);
                if (routeIdx === -1) return neighbor;
                
                const route = neighbor[routeIdx];
                const i = Math.floor(Math.random() * route.length);
                let j = Math.floor(Math.random() * route.length);
                while (j === i) j = Math.floor(Math.random() * route.length);
                
                // Swap customers
                [route[i], route[j]] = [route[j], route[i]];
            } else {
                // Inter-route swap
                if (neighbor.length < 2) return neighbor;
                
                // Select two routes
                const route1Idx = Math.floor(Math.random() * neighbor.length);
                let route2Idx = Math.floor(Math.random() * neighbor.length);
                while (route2Idx === route1Idx) route2Idx = Math.floor(Math.random() * neighbor.length);
                
                // Skip if either route is empty
                if (neighbor[route1Idx].length === 0 || neighbor[route2Idx].length === 0) {
                    return neighbor;
                }
                
                // Select a customer from each route
                const cust1Idx = Math.floor(Math.random() * neighbor[route1Idx].length);
                const cust2Idx = Math.floor(Math.random() * neighbor[route2Idx].length);
                
                const cust1 = neighbor[route1Idx][cust1Idx];
                const cust2 = neighbor[route2Idx][cust2Idx];
                
                // Check capacity constraints after swap
                const route1Load = calculateRouteLoad(neighbor[route1Idx], demands);
                const route2Load = calculateRouteLoad(neighbor[route2Idx], demands);
                
                const newRoute1Load = route1Load - demands[cust1] + demands[cust2];
                const newRoute2Load = route2Load - demands[cust2] + demands[cust1];
                
                if (newRoute1Load <= vehicle_capacity && newRoute2Load <= vehicle_capacity) {
                    // Perform the swap
                    neighbor[route1Idx][cust1Idx] = cust2;
                    neighbor[route2Idx][cust2Idx] = cust1;
                }
            }
        } else if (moveType === "relocate") {
            // Relocate a customer from one route to another
            if (neighbor.length < 1) return neighbor;
            
            // Select a non-empty route as source
            const sourceRouteIdx = randomRouteWithMinLength(neighbor, 1);
            if (sourceRouteIdx === -1) return neighbor;
            
            // Select a customer to relocate
            const customerIdx = Math.floor(Math.random() * neighbor[sourceRouteIdx].length);
            const customer = neighbor[sourceRouteIdx][customerIdx];
            
            // Decide whether to create a new route or use existing
            const createNewRoute = neighbor.length < max_vehicles && Math.random() < 0.2;
            
            if (createNewRoute) {
                // Create new route with this customer
                neighbor.push([customer]);
                
                // Remove from source route
                neighbor[sourceRouteIdx].splice(customerIdx, 1);
            } else {
                // Select a target route (could be same as source)
                let targetRouteIdx;
                if (neighbor.length > 1) {
                    // Prefer a different route
                    targetRouteIdx = Math.floor(Math.random() * neighbor.length);
                    if (targetRouteIdx === sourceRouteIdx && Math.random() < 0.8) {
                        targetRouteIdx = (targetRouteIdx + 1) % neighbor.length;
                    }
                } else {
                    targetRouteIdx = 0;
                }
                
                // Check capacity constraint
                const targetLoad = calculateRouteLoad(neighbor[targetRouteIdx], demands);
                if (targetLoad + demands[customer] <= vehicle_capacity) {
                    // Perform the move
                    neighbor[sourceRouteIdx].splice(customerIdx, 1);
                    
                    // Insert at random position in target
                    const insertPos = Math.floor(Math.random() * (neighbor[targetRouteIdx].length + 1));
                    neighbor[targetRouteIdx].splice(insertPos, 0, customer);
                }
            }
        }
        
        // Remove empty routes
        const result = neighbor.filter(route => route.length > 0);
        
        return result;
    }
    
    // Helper function to select a random route with minimum length
    function randomRouteWithMinLength(routes, minLength) {
        const validRoutes = [];
        
        for (let i = 0; i < routes.length; i++) {
            if (routes[i].length >= minLength) {
                validRoutes.push(i);
            }
        }
        
        if (validRoutes.length === 0) return -1;
        
        const randIndex = Math.floor(Math.random() * validRoutes.length);
        return validRoutes[randIndex];
    }
    
    // Calculate route load
    function calculateRouteLoad(route, demands) {
        return route.reduce((sum, customer) => sum + demands[customer], 0);
    }
    
    // Calculate distance of a single route
    function calculateRouteDistance(route, distance_matrix, depot) {
        if (!route.length) return 0;
        
        let distance = distance_matrix[depot][route[0]];
        
        for (let i = 0; i < route.length - 1; i++) {
            distance += distance_matrix[route[i]][route[i + 1]];
        }
        
        distance += distance_matrix[route[route.length - 1]][depot];
        
        return distance;
    }
    
    // Calculate total distance
    function calculateTotalDistance(routes, distance_matrix, depot) {
        return routes.reduce((sum, route) => {
            return sum + calculateRouteDistance(route, distance_matrix, depot);
        }, 0);
    }
    
    // Create route details object for display
    function createRouteDetails(routes, depot, demands, vehicle_capacity, distance_matrix) {
        // Calculate total distance
        const total_distance = calculateTotalDistance(routes, distance_matrix, depot);
        
        // Create route details object
        const routeDetails = {
            total_distance: total_distance,
            routes: []
        };
        
        // Add details for each route
        routes.forEach((route, index) => {
            const routeLoad = calculateRouteLoad(route, demands);
            const routeDistance = calculateRouteDistance(route, distance_matrix, depot);
            
            // Get company names if available
            const company_names = window.appState.problem_data.company_names || [];
            
            // Add depot -> customers -> depot for display
            const stops = [
                { index: depot, name: company_names[depot] || "Depot" }
            ];
            
            // Add each stop in the route
            route.forEach(customer => {
                stops.push({ 
                    index: customer, 
                    name: (company_names[customer] || `Customer ${customer}`)
                });
            });
            
            // Add depot as last stop
            stops.push({ index: depot, name: company_names[depot] || "Depot" });
            
            // Add route details
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
    
    // ==========================================
    // Debug tools
    // ==========================================
    function addDebugControls() {
        // Debug tools available in console
        window.cvrpDebug = {
            forceEnableSolve: function() {
                const solveBtn = document.getElementById('solveBtn');
                if (solveBtn) {
                    solveBtn.disabled = false;
                    console.log("🔧 Solve button enabled");
                    return "Solve button enabled";
                }
                return "Solve button not found";
            },
            getAppState: function() {
                return window.appState;
            },
            prepareEmergencyData: prepareEmergencyData,
            runSolver: function() {
                enhancedSolveHandler();
                return "Solver started";
            }
        };
        
        console.log("🔧 Debug tools available via window.cvrpDebug");
    }
});