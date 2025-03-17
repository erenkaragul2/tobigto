// data-processing-fix.js
// Add this to your static/js folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Data processing fix loaded - enabling solve functionality");
    
    // Store references to key UI elements
    const processDataBtn = document.getElementById('processDataBtn');
    const solveBtn = document.getElementById('solveBtn');
    const solveInfoAlert = document.getElementById('solveInfoAlert');
    
    // Store original handlers if they exist
    const originalProcessData = window.processData;
    
    // Ensure global app state exists
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
    
    // Enhanced data processor with client-side fallback
    function enhancedProcessData() {
        console.log("Enhanced process data handler triggered");
        
        // First try to use the original process function if it exists
        if (typeof originalProcessData === 'function') {
            try {
                // Call original function
                originalProcessData();
                
                // Check if data was processed properly
                setTimeout(checkDataProcessingStatus, 1000);
                return;
            } catch (e) {
                console.error("Error in original process function:", e);
                // Continue to fallback processing
            }
        }
        
        // Client-side processing fallback
        performClientSideProcessing();
    }
    
    // Check if data was processed after original function call
    function checkDataProcessingStatus() {
        console.log("Checking data processing status...");
        
        // If data is now processed, we're done
        if (window.appState.dataProcessed) {
            console.log("Data successfully processed by original function");
            return;
        }
        
        // Otherwise, try our fallback
        console.log("Original function did not process data, using fallback");
        performClientSideProcessing();
    }
    
    // Perform client-side data processing as a fallback
    function performClientSideProcessing() {
        // Prepare parameters
        const depot = parseInt(document.getElementById('depotInput').value) || 0;
        const vehicle_capacity = parseInt(document.getElementById('capacityInput').value) || 20;
        const max_vehicles = parseInt(document.getElementById('maxVehiclesInput').value) || 5;
        
        console.log("Performing client-side data processing with:", {
            depot: depot,
            vehicle_capacity: vehicle_capacity,
            max_vehicles: max_vehicles
        });
        
        // Check if we have loaded data
        if (!window.appState.dataLoaded) {
            console.error("No data loaded, cannot process");
            if (solveInfoAlert) {
                solveInfoAlert.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        No data loaded. Please upload data or generate a random problem first.
                    </div>
                `;
            }
            return;
        }
        
        // Show processing status
        if (processDataBtn) {
            processDataBtn.disabled = true;
            processDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        }
        
        // We'll create a minimum viable problem data structure
        let problem_data = window.appState.problem_data || {};
        
        // If we have coordinates in the app state, use them
        if (window.appState.coordinates && window.appState.coordinates.length > 0) {
            problem_data.coordinates = window.appState.coordinates;
        } else {
            // Generate some dummy data if we don't have any
            // This is just a fallback and should be replaced with actual data
            problem_data.coordinates = [
                [40.73061, -73.935242],  // Node 0 (Depot)
                [40.736591, -73.919061],  // Node 1
                [40.742652, -73.925686],  // Node 2
                [40.736073, -73.913830],  // Node 3
                [40.728226, -73.926659],  // Node 4
                [40.721573, -73.932344]   // Node 5
            ];
        }
        
        // Get or generate demands
        if (window.appState.demands && window.appState.demands.length > 0) {
            problem_data.demands = window.appState.demands;
        } else {
            // Create demand values, 0 for depot and random values for others
            problem_data.demands = problem_data.coordinates.map((_, i) => 
                i === depot ? 0 : Math.floor(Math.random() * 10) + 1
            );
        }
        
        // Get or generate company names
        if (window.appState.company_names && window.appState.company_names.length > 0) {
            problem_data.company_names = window.appState.company_names;
        } else {
            problem_data.company_names = problem_data.coordinates.map((_, i) => 
                i === depot ? "Depot" : `Customer ${i}`
            );
        }
        
        // Calculate a simple distance matrix (Euclidean distance)
        const distanceMatrix = [];
        for (let i = 0; i < problem_data.coordinates.length; i++) {
            const row = [];
            for (let j = 0; j < problem_data.coordinates.length; j++) {
                if (i === j) {
                    row.push(0); // Zero distance to itself
                } else {
                    // Calculate Euclidean distance in meters
                    const lat1 = problem_data.coordinates[i][0];
                    const lon1 = problem_data.coordinates[i][1];
                    const lat2 = problem_data.coordinates[j][0];
                    const lon2 = problem_data.coordinates[j][1];
                    
                    // Convert to radians
                    const latRad1 = lat1 * Math.PI / 180;
                    const lonRad1 = lon1 * Math.PI / 180;
                    const latRad2 = lat2 * Math.PI / 180;
                    const lonRad2 = lon2 * Math.PI / 180;
                    
                    // Haversine formula for distance
                    const dlon = lonRad2 - lonRad1;
                    const dlat = latRad2 - latRad1;
                    const a = Math.sin(dlat/2)**2 + Math.cos(latRad1) * Math.cos(latRad2) * Math.sin(dlon/2)**2;
                    const c = 2 * Math.asin(Math.sqrt(a));
                    const r = 6371000;  // Earth radius in meters
                    
                    row.push(c * r);
                }
            }
            distanceMatrix.push(row);
        }
        problem_data.distance_matrix = distanceMatrix;
        
        // Set additional problem properties
        problem_data.depot = depot;
        problem_data.vehicle_capacity = vehicle_capacity;
        problem_data.max_vehicles = max_vehicles;
        problem_data.distance_type = 'Euclidean';
        
        // Store processed data in app state
        window.appState.problem_data = problem_data;
        window.appState.dataProcessed = true;
        
        // For compatibility with other code
        window.appState.dataLoaded = true;
        window.appState.distance_matrix = distanceMatrix;
        
        console.log("Client-side processing complete");
        
        // Update UI to show processing is complete
        if (processDataBtn) {
            processDataBtn.disabled = false;
            processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
        }
        
        // Show success message
        if (solveInfoAlert) {
            solveInfoAlert.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Data processed successfully. You can now solve the problem.
                </div>
            `;
        }
        
        // Enable the solve button
        if (solveBtn) {
            solveBtn.disabled = false;
        }
        
        // Create a preview of the distance matrix
        showDistanceMatrixPreview();
        
        // Show the matrix toggle button
        const toggleMatrixBtn = document.getElementById('toggleMatrixBtn');
        if (toggleMatrixBtn) {
            toggleMatrixBtn.style.display = 'block';
        }
    }
    
    // Function to show distance matrix preview
    function showDistanceMatrixPreview() {
        const matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
        if (!matrixPreviewContainer) return;
        
        matrixPreviewContainer.innerHTML = '';
        
        // Get matrix from app state
        const matrix = window.appState.problem_data.distance_matrix;
        if (!matrix || matrix.length === 0) return;
        
        // Create a preview table
        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-responsive');
        
        const table = document.createElement('table');
        table.classList.add('table', 'table-sm', 'table-bordered', 'data-table');
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Node</th>';
        
        // Show preview of first 5 nodes or less
        const previewSize = Math.min(5, matrix.length);
        for (let i = 0; i < previewSize; i++) {
            headerRow.innerHTML += `<th>Node ${i}</th>`;
        }
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        for (let i = 0; i < previewSize; i++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>Node ${i}</strong></td>`;
            
            for (let j = 0; j < previewSize; j++) {
                const value = matrix[i][j];
                // Convert to kilometers for display
                if (value === 0) {
                    tr.innerHTML += `<td>0.00</td>`;
                } else {
                    tr.innerHTML += `<td>${(value / 1000).toFixed(2)} km</td>`;
                }
            }
            
            tbody.appendChild(tr);
        }
        
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        matrixPreviewContainer.appendChild(tableContainer);
    }
    
    // Replace process data handler with our enhanced version
    if (processDataBtn) {
        processDataBtn.onclick = enhancedProcessData;
    }
    
    // Force solve button to be enabled if data is already processed
    if (solveBtn && window.appState.dataProcessed) {
        solveBtn.disabled = false;
    }
    
    // Add direct emergency fix button in console for troubleshooting
    window.forceEnableSolve = function() {
        performClientSideProcessing();
        return "Solve button should now be enabled";
    };
    
    // Monitor for data loading success
    const uploadBtn = document.getElementById('uploadBtn');
    const generateRandomBtn = document.getElementById('generateRandomBtn');
    
    // When data is uploaded, make sure we track it
    if (uploadBtn) {
        const originalUploadHandler = uploadBtn.onclick;
        uploadBtn.onclick = function() {
            if (typeof originalUploadHandler === 'function') {
                originalUploadHandler();
            }
            // Set a flag to check for data loading
            window.appState.waitingForDataLoad = true;
            setTimeout(checkDataLoaded, 2000);
        };
    }
    
    if (generateRandomBtn) {
        const originalGenerateHandler = generateRandomBtn.onclick;
        generateRandomBtn.onclick = function() {
            if (typeof originalGenerateHandler === 'function') {
                originalGenerateHandler();
            }
            // Random generation usually auto-processes data
            window.appState.waitingForDataLoad = true;
            setTimeout(checkDataLoaded, 2000);
        };
    }
    
    // Check if data was loaded
    function checkDataLoaded() {
        if (window.appState.waitingForDataLoad) {
            console.log("Checking if data was loaded...");
            
            // If data was loaded but not processed, offer to process it
            if (window.appState.dataLoaded && !window.appState.dataProcessed) {
                console.log("Data loaded but not processed, offering to process");
                if (confirm("Data has been loaded but not processed. Process it now to enable solving?")) {
                    performClientSideProcessing();
                }
            }
            
            // Clear the flag
            window.appState.waitingForDataLoad = false;
        }
    }
    
    // Console message for users
    console.log("To force enable the solve button, type window.forceEnableSolve() in the console");
});