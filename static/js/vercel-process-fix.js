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
        
        // Check if we have data
        if (!window.appState) {
            window.appState = {};
        }
        
        // In Vercel, the session data may not be available directly
        // We need to prepare it differently based on what's available client-side
        
        // Function to get coordinates and data from the page
        function extractDataFromPage() {
            // Try to get coordinates from data preview
            const dataPreview = document.getElementById('dataPreviewContainer');
            if (!dataPreview) return null;
            
            try {
                // Look for a table in the data preview
                const table = dataPreview.querySelector('table');
                if (!table) return null;
                
                // Extract coordinates and demands from the table
                const coordinates = [];
                const demands = [];
                const companyNames = [];
                
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
                    
                    // Extract name
                    if (nameIdx >= 0 && cells[nameIdx]) {
                        companyNames.push(cells[nameIdx].textContent.trim());
                    } else {
                        companyNames.push(`Node ${coordinates.length}`);
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
                        // Default demand (0 for depot, 5 for others)
                        demands.push(companyNames.length === 1 ? 0 : 5);
                    }
                });
                
                if (coordinates.length > 0) {
                    return {
                        coordinates,
                        demands,
                        company_names: companyNames
                    };
                }
            } catch (err) {
                console.error("Error extracting data from page:", err);
            }
            
            return null;
        }
        
        // Let's try to get the data from the global state or from the page
        const processData = window.appState.dataPayload || 
                          window.appState.problem_data ||
                          extractDataFromPage();
        
        if (!processData || !processData.coordinates || processData.coordinates.length === 0) {
            console.error("No data found to process");
            processDataBtn.disabled = false;
            processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
            
            // Show error
            const processingAlert = document.getElementById('processingAlert');
            if (processingAlert) {
                processingAlert.className = 'alert alert-danger mt-3';
                processingAlert.innerHTML = '<i class="fas fa-exclamation-circle me-2"></i>No data found to process. Please upload data or generate a random problem first.';
            }
            
            return;
        }
        
        // Client-side distance matrix calculation
        const calculateDistanceMatrix = (coordinates) => {
            console.log("Calculating distance matrix client-side...");
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
        };
        
        // Build the complete processed data package
        const coordinates = processData.coordinates;
        const demands = processData.demands || Array(coordinates.length).fill(5);
        const company_names = processData.company_names || Array(coordinates.length).fill().map((_, i) => `Node ${i}`);
        
        // Calculate distance matrix client-side to avoid server timeout
        const distance_matrix = processData.distance_matrix || calculateDistanceMatrix(coordinates);
        
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
        const matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
        if (matrixPreviewContainer) {
            matrixPreviewContainer.innerHTML = '';
            
            const tableContainer = document.createElement('div');
            tableContainer.className = 'table-responsive';
            
            const table = document.createElement('table');
            table.className = 'table table-sm table-bordered data-table';
            
            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = '<th>Node</th>' + 
                Array.from({length: max_preview}, (_, i) => `<th>Node ${i}</th>`).join('');
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
        
        console.log("Process completed successfully with Vercel compatibility mode");
    };
    
    console.log("Vercel process data compatibility fix loaded");
});