// vercel-process-fix.js
// Add this to your static/js folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading Vercel process data compatibility fix...");
    
    // Get DOM elements
    const processDataBtn = document.getElementById('processDataBtn');
    
    if (!processDataBtn) {
        console.error("Process data button not found - fix cannot be applied");
        return;
    }
    
    // Store the original click handler if it exists
    const originalClickHandler = processDataBtn.onclick;
    
    // Replace with our enhanced handler
    processDataBtn.onclick = function(e) {
        if (e) e.preventDefault();
        console.log("Enhanced process data handler triggered");

        // Prepare process data
        const depot = parseInt(document.getElementById('depotInput').value) || 0;
        const vehicle_capacity = parseInt(document.getElementById('capacityInput').value) || 20;
        const max_vehicles = parseInt(document.getElementById('maxVehiclesInput').value) || 5;
        
        // Get distance calculation method
        const useGoogleMaps = document.getElementById('distanceGoogle')?.checked || false;
        
        // Get Google Maps specific options if selected
        let googleMapsOptions = {};
        if (useGoogleMaps) {
            googleMapsOptions = {
                mode: document.getElementById('travelModeInput')?.value || 'driving',
                avoid: Array.from(document.getElementById('avoidInput')?.selectedOptions || [])
                         .map(option => option.value)
            };
        }
        
        // Show loading state
        processDataBtn.disabled = true;
        processDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        
        // Show an alert or status message
        const configTab = document.getElementById('config');
        if (configTab) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-info mt-3';
            alertDiv.id = 'processingAlert';
            alertDiv.innerHTML = '<i class="fas fa-info-circle me-2"></i>Processing data with Vercel compatibility mode...';
            configTab.appendChild(alertDiv);
        }
        
        // Get the coordinates and data from window.appState
        const processData = async () => {
            try {
                // First check if we have data in window.appState
                if (!window.appState) {
                    window.appState = {};
                }
                
                // Get coordinates from the data in window state or from the data preview
                let coordinates = null;
                let demands = null;
                let company_names = null;
                
                // Prioritize extraction from window.appState
                if (window.appState.coordinates && window.appState.coordinates.length > 0) {
                    coordinates = window.appState.coordinates;
                    demands = window.appState.demands || [];
                    company_names = window.appState.company_names || [];
                } else {
                    // Try to extract from DOM if not in appState
                    const extractedData = extractDataFromDOM();
                    if (extractedData) {
                        coordinates = extractedData.coordinates;
                        demands = extractedData.demands;
                        company_names = extractedData.company_names;
                    } else {
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'alert alert-danger mt-3';
                        alertDiv.innerHTML = '<i class="fas fa-exclamation-circle me-2"></i>No data found. Please upload data or generate a random problem first.';
                        configTab.appendChild(alertDiv);
                        processDataBtn.disabled = false;
                        processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
                        return;
                    }
                }
                
                if (!coordinates || coordinates.length === 0) {
                    throw new Error("No coordinate data available");
                }
                
                // Calculate distance matrix based on selected method
                let distance_matrix;
                if (useGoogleMaps) {
                    // Show additional message about using Google Maps API
                    const processingAlert = document.getElementById('processingAlert');
                    if (processingAlert) {
                        processingAlert.innerHTML = '<i class="fas fa-info-circle me-2"></i>Calculating distances using Google Maps API. This might take a moment...';
                    }
                    
                    distance_matrix = await calculateGoogleDistanceMatrix(coordinates, googleMapsOptions);
                } else {
                    distance_matrix = calculateDistanceMatrix(coordinates);
                }
                
                // Ensure we have demands and company names
                if (!demands || demands.length === 0) {
                    demands = Array(coordinates.length).fill().map((_, i) => i === depot ? 0 : 5);
                }
                
                if (!company_names || company_names.length === 0) {
                    company_names = Array(coordinates.length).fill().map((_, i) => i === depot ? "Depot" : `Customer ${i}`);
                }
                
                // Create the final problem data object
                const problemData = {
                    coordinates,
                    demands,
                    company_names,
                    distance_matrix,
                    depot,
                    vehicle_capacity,
                    max_vehicles,
                    distance_type: useGoogleMaps ? 'Google Maps API' : 'Euclidean'
                };
                
                // Store in window.appState for later use
                window.appState.problem_data = problemData;
                window.appState.dataProcessed = true;
                
                console.log("Problem data processed client-side:", problemData);
                
                // Create a small preview of the matrix for display (5x5)
                const matrixPreview = [];
                const max_preview = Math.min(5, distance_matrix.length);
                for (let i = 0; i < max_preview; i++) {
                    const row = [];
                    for (let j = 0; j < max_preview; j++) {
                        row.push(distance_matrix[i][j]);
                    }
                    matrixPreview.push(row);
                }
                
                // Update UI components
                updateMatrixPreview(matrixPreview);
                
                // Show toggle matrix button
                const toggleMatrixBtn = document.getElementById('toggleMatrixBtn');
                if (toggleMatrixBtn) {
                    toggleMatrixBtn.style.display = 'block';
                }
                
                // Update the alert to success
                const processingAlert = document.getElementById('processingAlert');
                if (processingAlert) {
                    processingAlert.className = 'alert alert-success mt-3';
                    processingAlert.innerHTML = '<i class="fas fa-check-circle me-2"></i>Data processed successfully with Vercel compatibility mode. You can now solve the problem.';
                }
                
                // Reset button state
                processDataBtn.disabled = false;
                processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
                
                // Enable solve tab and auto-navigate
                const solveTab = document.getElementById('solve-tab');
                if (solveTab) {
                    solveTab.classList.remove('disabled');
                    setTimeout(() => solveTab.click(), 500);
                }
                
                // Update solve tab info
                const solveInfoAlert = document.getElementById('solveInfoAlert');
                if (solveInfoAlert) {
                    solveInfoAlert.innerHTML = `
                        <div class="alert alert-success">
                            <i class="fas fa-check-circle me-2"></i>
                            Data processed successfully with Vercel compatibility mode. You can now solve the problem.
                        </div>
                    `;
                }
                
                // Enable the solve button
                const solveBtn = document.getElementById('solveBtn');
                if (solveBtn) {
                    solveBtn.disabled = false;
                }
                
            } catch (error) {
                console.error("Error processing data:", error);
                
                // Update the alert to error
                const processingAlert = document.getElementById('processingAlert');
                if (processingAlert) {
                    processingAlert.className = 'alert alert-danger mt-3';
                    processingAlert.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>Error processing data: ${error.message}`;
                }
                
                // Reset button state
                processDataBtn.disabled = false;
                processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
            }
        };
        
        // Run the processing
        processData();
    };
    
    // Function to extract data from DOM elements (fallback if not stored in appState)
    function extractDataFromDOM() {
        try {
            const dataPreviewContainer = document.getElementById('dataPreviewContainer');
            if (!dataPreviewContainer) return null;
            
            const table = dataPreviewContainer.querySelector('table');
            if (!table) return null;
            
            // Extract coordinates and demands from the table
            const coordinates = [];
            const demands = [];
            const company_names = [];
            
            // Get column indices
            const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
            
            const nameIdx = headers.findIndex(h => 
                h.toLowerCase().includes('name') || h.toLowerCase().includes('company'));
            
            const xIdx = headers.findIndex(h => 
                h.toLowerCase() === 'x' || h.toLowerCase().includes('lat'));
            
            const yIdx = headers.findIndex(h => 
                h.toLowerCase() === 'y' || h.toLowerCase().includes('lon') || h.toLowerCase().includes('lng'));
            
            const coordsIdx = headers.findIndex(h => 
                h.toLowerCase().includes('coord'));
            
            const demandIdx = headers.findIndex(h => 
                h.toLowerCase().includes('demand'));
            
            // Process rows
            const rows = Array.from(table.querySelectorAll('tbody tr'));
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                
                // Extract company name
                if (nameIdx >= 0 && cells[nameIdx]) {
                    company_names.push(cells[nameIdx].textContent.trim());
                } else {
                    company_names.push(`Customer ${coordinates.length}`);
                }
                
                // Extract coordinates
                if (xIdx >= 0 && yIdx >= 0 && cells[xIdx] && cells[yIdx]) {
                    // Separate X and Y columns
                    const x = parseFloat(cells[xIdx].textContent.trim());
                    const y = parseFloat(cells[yIdx].textContent.trim());
                    if (!isNaN(x) && !isNaN(y)) {
                        coordinates.push([x, y]);
                    }
                } else if (coordsIdx >= 0 && cells[coordsIdx]) {
                    // Combined coordinates
                    const coordText = cells[coordsIdx].textContent.trim();
                    const coordParts = coordText.replace(/[()]/g, '').split(/,\s*/);
                    if (coordParts.length >= 2) {
                        const x = parseFloat(coordParts[0]);
                        const y = parseFloat(coordParts[1]);
                        if (!isNaN(x) && !isNaN(y)) {
                            coordinates.push([x, y]);
                        }
                    }
                }
                
                // Extract demand
                if (demandIdx >= 0 && cells[demandIdx]) {
                    const demand = parseInt(cells[demandIdx].textContent.trim());
                    demands.push(isNaN(demand) ? 0 : demand);
                } else {
                    // Default demand
                    demands.push(coordinates.length === 1 ? 0 : 5);
                }
            });
            
            if (coordinates.length > 0) {
                return {
                    coordinates,
                    demands,
                    company_names
                };
            }
        } catch (err) {
            console.error("Error extracting data from DOM:", err);
        }
        
        return null;
    }
    
    // Function to update matrix preview display
    function updateMatrixPreview(matrixPreview) {
        const matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
        if (!matrixPreviewContainer) return;
        
        matrixPreviewContainer.innerHTML = '';
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-responsive';
        
        const table = document.createElement('table');
        table.className = 'table table-sm table-bordered data-table';
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Node</th>' + 
            Array.from({length: matrixPreview.length}, (_, i) => `<th>Node ${i}</th>`).join('');
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        matrixPreview.forEach((row, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>Node ${i}</strong></td>` + 
                row.map(val => {
                    // Convert values to kilometers
                    const numVal = parseFloat(val);
                    if (isNaN(numVal) || numVal === 0) {
                        return `<td>${val}</td>`;
                    } else {
                        return `<td>${(numVal / 1000).toFixed(2)} km</td>`;
                    }
                }).join('');
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        
        tableContainer.appendChild(table);
        matrixPreviewContainer.appendChild(tableContainer);
    }
    
    // Function to calculate Euclidean distance matrix
    function calculateDistanceMatrix(coordinates) {
        console.log("Calculating Euclidean distance matrix...");
        const n = coordinates.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                
                // Calculate Euclidean distance in meters
                const lat1 = coordinates[i][0];
                const lon1 = coordinates[i][1];
                const lat2 = coordinates[j][0];
                const lon2 = coordinates[j][1];
                
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
                
                matrix[i][j] = c * r;
            }
        }
        
        return matrix;
    }
    
    // Function to calculate distance using Google Maps API
    async function calculateGoogleDistanceMatrix(coordinates, googleMapsOptions) {
        console.log("Calculating distance matrix using Google Maps API...");
        
        // First fetch the API key from the server
        try {
            const keyResponse = await fetch('/get_google_maps_key');
            const keyData = await keyResponse.json();
            
            if (!keyData.success || !keyData.api_key) {
                console.error("Failed to get Google Maps API key - falling back to Euclidean distance");
                return calculateDistanceMatrix(coordinates);
            }
            
            const apiKey = keyData.api_key;
            const n = coordinates.length;
            const matrix = Array(n).fill().map(() => Array(n).fill(0));
            
            // Google Maps API can process only 25 origins or destinations at once
            // We'll need to split into batches if there are more
            const batchSize = 10; // Smaller batch size to avoid hitting rate limits
            const totalBatches = Math.ceil(n / batchSize) * Math.ceil(n / batchSize);
            let completedBatches = 0;
            
            // Process in batches
            for (let originStart = 0; originStart < n; originStart += batchSize) {
                const originEnd = Math.min(originStart + batchSize, n);
                const originBatch = coordinates.slice(originStart, originEnd);
                
                for (let destStart = 0; destStart < n; destStart += batchSize) {
                    const destEnd = Math.min(destStart + batchSize, n);
                    const destBatch = coordinates.slice(destStart, destEnd);
                    
                    completedBatches++;
                    console.log(`Processing batch ${completedBatches}/${totalBatches}: ${originBatch.length}x${destBatch.length} elements`);
                    
                    // Create origins and destinations strings
                    const origins = originBatch.map(coord => `${coord[0]},${coord[1]}`).join('|');
                    const destinations = destBatch.map(coord => `${coord[0]},${coord[1]}`).join('|');
                    
                    // Set up Google Maps API request parameters
                    const mode = googleMapsOptions?.mode || 'driving';
                    const avoid = googleMapsOptions?.avoid?.join('|') || '';
                    
                    try {
                        // Use a proxy endpoint to make the Google Maps API call
                        // This avoids CORS issues and protects your API key
                        const response = await fetch('/proxy_google_distance_matrix', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                origins: origins,
                                destinations: destinations,
                                mode: mode,
                                avoid: avoid
                            })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success && data.results) {
                            const results = data.results;
                            
                            // Process the results
                            for (let i = 0; i < results.rows.length; i++) {
                                const row = results.rows[i];
                                for (let j = 0; j < row.elements.length; j++) {
                                    const element = row.elements[j];
                                    if (element.status === "OK") {
                                        const originIdx = originStart + i;
                                        const destIdx = destStart + j;
                                        matrix[originIdx][destIdx] = element.distance.value;
                                    } else {
                                        // Fall back to Euclidean if route not found
                                        const originIdx = originStart + i;
                                        const destIdx = destStart + j;
                                        const p1 = coordinates[originIdx];
                                        const p2 = coordinates[destIdx];
                                        matrix[originIdx][destIdx] = calculateEuclideanDistance(p1, p2);
                                    }
                                }
                            }
                        } else {
                            console.error("Google API error:", data.error);
                            // Fall back to Euclidean for this batch
                            for (let i = 0; i < originBatch.length; i++) {
                                for (let j = 0; j < destBatch.length; j++) {
                                    const originIdx = originStart + i;
                                    const destIdx = destStart + j;
                                    const p1 = coordinates[originIdx];
                                    const p2 = coordinates[destIdx];
                                    matrix[originIdx][destIdx] = calculateEuclideanDistance(p1, p2);
                                }
                            }
                        }
                        
                        // Add a short delay between API calls to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                    } catch (error) {
                        console.error("Error making Google API request:", error);
                        // Fall back to Euclidean for this batch
                        for (let i = 0; i < originBatch.length; i++) {
                            for (let j = 0; j < destBatch.length; j++) {
                                const originIdx = originStart + i;
                                const destIdx = destStart + j;
                                const p1 = coordinates[originIdx];
                                const p2 = coordinates[destIdx];
                                matrix[originIdx][destIdx] = calculateEuclideanDistance(p1, p2);
                            }
                        }
                    }
                }
            }
            
            return matrix;
        } catch (error) {
            console.error("Error in Google Maps distance calculation:", error);
            // Fall back to Euclidean distance calculation
            return calculateDistanceMatrix(coordinates);
        }
    }
    
    // Helper function for distance calculation
    function calculateEuclideanDistance(p1, p2) {
        const lat1 = p1[0];
        const lon1 = p1[1];
        const lat2 = p2[0];
        const lon2 = p2[1];
        
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
        
        return c * r;
    }
    
    console.log("Vercel process data compatibility fix loaded");
});