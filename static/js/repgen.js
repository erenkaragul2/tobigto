// Enhanced report generation fix
(function() {
    console.log("Loading enhanced report generation fix...");
    
    // Make sure global appState exists
    window.appState = window.appState || {
        dataLoaded: false,
        dataProcessed: false,
        solving: false,
        solutionReady: false,
        jobId: null,
        lastSolution: null
    };
    
    // Fix for the report generation function
    window.generateDetailedReport = function() {
        console.log("Generate detailed report called");
        
        // Check for solution directly in the window.appState
        if (window.appState && window.appState.lastSolution) {
            console.log("Solution found in appState, generating report");
            generateReportFromSolution(window.appState.lastSolution);
        } 
        // If not in appState, try to fetch it again using the stored jobId
        else if (window.appState && window.appState.jobId) {
            console.log("Solution not found in appState, attempting to fetch from server");
            showLoading("Fetching solution data...");
            
            fetch(`/get_solution/${window.appState.jobId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.solution) {
                        console.log("Solution fetched from server successfully");
                        window.appState.lastSolution = data.solution;
                        window.appState.solutionReady = true;
                        generateReportFromSolution(data.solution);
                    } else {
                        console.error("Solution fetch failed:", data.error || "Unknown error");
                        hideLoading();
                        alert("Could not fetch solution data from server. Please try solving again.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching solution:", error);
                    hideLoading();
                    alert("Error fetching solution: " + error.message);
                });
        } else {
            console.error("No solution data or job ID available");
            alert("No solution data available to generate report! Please solve the problem first.");
        }
    };
    
    // Function to generate the report from a solution
    function generateReportFromSolution(solution) {
        console.log("Generating report from solution");
        
        // Check if solution has the necessary details
        if (!solution || !solution.details || !solution.coordinates) {
            console.error("Invalid solution data:", solution);
            alert("Invalid solution data. Please try solving again.");
            return;
        }
        
        const reportWindow = window.open('', '_blank');
        
        if (!reportWindow) {
            alert('Please allow pop-ups to view the report');
            return;
        }
        
        hideLoading();
        
        const details = solution.details;
        const coordinates = solution.coordinates;
        const depot = solution.depot || 0;
        
        // Start building the report content
        let reportContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CVRP Solution Report - ${new Date().toLocaleString()}</title>
            
            <!-- Bootstrap CSS -->
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <!-- Font Awesome -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
            
            <style>
                body {
                    padding: 20px;
                    font-family: Arial, sans-serif;
                }
                
                .route-card {
                    margin-bottom: 20px;
                    break-inside: avoid;
                }
                
                .route-header {
                    padding: 10px;
                    border-radius: 5px 5px 0 0;
                    color: white;
                    font-weight: bold;
                }
                
                .google-maps-link {
                    display: inline-block;
                    padding: 6px 12px;
                    background-color: #4285F4;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 5px 0;
                }
                
                .google-maps-link:hover {
                    background-color: #3367D6;
                    color: white;
                }
                
                .stop-badge {
                    display: inline-block;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    text-align: center;
                    line-height: 30px;
                    color: white;
                    margin-right: 5px;
                }
                
                .depot-badge {
                    background-color: #d9534f;
                }
                
                .customer-badge {
                    background-color: #5bc0de;
                }
                
                .route-map-container {
                    height: 300px;
                    width: 100%;
                    border: 1px solid #ddd;
                    margin: 10px 0;
                }
                
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    
                    .page-break {
                        page-break-after: always;
                    }
                    
                    a {
                        text-decoration: none !important;
                        color: #000 !important;
                    }
                    
                    .route-card {
                        break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Header -->
            <div class="container">
                <div class="row mb-4">
                    <div class="col-12">
                        <h1 class="text-center">CVRP Solution Report</h1>
                        <p class="text-center text-muted">Generated on ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                
                <!-- Controls -->
                <div class="row mb-4 no-print">
                    <div class="col-12 text-center">
                        <button class="btn btn-primary me-2" onclick="window.print()">
                            <i class="fas fa-print me-2"></i>Print Report
                        </button>
                        <button class="btn btn-secondary" onclick="window.close()">
                            <i class="fas fa-times me-2"></i>Close
                        </button>
                    </div>
                </div>
                
                <!-- Summary -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h3 class="card-title mb-0">Solution Summary</h3>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-4 text-center">
                                        <h4>${(details.total_distance / 1000).toFixed(2)} km</h4>
                                        <p class="text-muted">Total Distance</p>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <h4>${details.routes.length}</h4>
                                        <p class="text-muted">Number of Routes</p>
                                    </div>
                                    <div class="col-md-4 text-center">
                                        <h4>${countCustomers(details.routes)}</h4>
                                        <p class="text-muted">Total Customers</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        // Add each route with Google Maps link
        reportContent += `
                <!-- Routes -->
                <div class="row mb-4">
                    <div class="col-12">
                        <h2>Route Details</h2>
                    </div>
                </div>
        `;
        
        // Add details for each route
        details.routes.forEach((route, index) => {
            const routeColor = getRouteColor(index);
            const routeKm = (route.distance / 1000).toFixed(2);
            const loadPercent = ((route.load / route.capacity) * 100).toFixed(0);
            
            // Build waypoints for Google Maps URL
            let waypoints = [];
            let waypointsParam = "";
            
            if (route.stops.length > 2) { // More than just depot-depot
                // Skip first and last (depot)
                const routeCustomers = route.stops.slice(1, -1);
                
                // Build waypoints string for Google Maps
                routeCustomers.forEach(stop => {
                    const coord = coordinates[stop.index];
                    if (coord && coord.length >= 2) {
                        waypoints.push(`${coord[0]},${coord[1]}`);
                    }
                });
                
                if (waypoints.length > 0) {
                    waypointsParam = `&waypoints=${waypoints.join('|')}`;
                }
            }
            
            // Get depot coordinates
            const depotCoord = coordinates[depot];
            const depotLatLng = depotCoord && depotCoord.length >= 2 ? `${depotCoord[0]},${depotCoord[1]}` : '';
            
            // Create Google Maps URL for the route
            let googleMapsUrl = '';
            if (depotLatLng && waypoints.length > 0) {
                googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${depotLatLng}&destination=${depotLatLng}${waypointsParam}&travelmode=driving`;
            }
            
            // Add route card
            reportContent += `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card route-card">
                            <div class="route-header" style="background-color: ${routeColor};">
                                <h3 class="card-title mb-0">Route ${route.id}</h3>
                            </div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-4">
                                        <strong>Distance:</strong> ${routeKm} km
                                    </div>
                                    <div class="col-md-4">
                                        <strong>Load:</strong> ${route.load}/${route.capacity} (${loadPercent}%)
                                    </div>
                                    <div class="col-md-4">
                                        <strong>Stops:</strong> ${route.stops.length - 2} customers
                                    </div>
                                </div>
                                
                                <div class="row mb-3">
                                    <div class="col-12">
                                        <h5>Route Sequence</h5>
                                        <div class="table-responsive">
                                            <table class="table table-striped table-hover">
                                                <thead>
                                                    <tr>
                                                        <th>Stop #</th>
                                                        <th>Name</th>
                                                        <th>Type</th>
                                                        <th>Coordinates</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
            `;
            
            // Add each stop in the route
            route.stops.forEach((stop, stopIndex) => {
                const isDepot = stopIndex === 0 || stopIndex === route.stops.length - 1;
                const stopType = isDepot ? 'Depot' : 'Customer';
                const badgeClass = isDepot ? 'depot-badge' : 'customer-badge';
                const coord = coordinates[stop.index];
                const coordStr = coord && coord.length >= 2 ? `${coord[0]}, ${coord[1]}` : 'N/A';
                
                reportContent += `
                                                    <tr>
                                                        <td>
                                                            <span class="stop-badge ${badgeClass}">${stopIndex}</span>
                                                        </td>
                                                        <td>${stop.name}</td>
                                                        <td>${stopType}</td>
                                                        <td>${coordStr}</td>
                                                    </tr>
                `;
            });
            
            // Close the table
            reportContent += `
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
            `;
            
            // Add Google Maps link if available
            if (googleMapsUrl) {
                reportContent += `
                                <div class="row mt-2">
                                    <div class="col-12">
                                        <a href="${googleMapsUrl}" target="_blank" class="google-maps-link">
                                            <i class="fas fa-map-marked-alt me-2"></i>Open in Google Maps
                                        </a>
                                        <p class="small text-muted mt-1">
                                            Click the link above to view this route in Google Maps. 
                                            You can then follow the directions on your mobile device.
                                        </p>
                                    </div>
                                </div>
                `;
            }
            
            // Close the card
            reportContent += `
                            </div>
                        </div>
                    </div>
                </div>
                ${index < details.routes.length - 1 ? '<div class="page-break"></div>' : ''}
            `;
        });
        
        // Close the HTML
        reportContent += `
                <!-- Notes -->
                <div class="row mt-5">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-light">
                                <h4 class="card-title mb-0">Notes</h4>
                            </div>
                            <div class="card-body">
                                <ul>
                                    <li>This report was generated using the CVRP Solver application.</li>
                                    <li>Google Maps links are provided for each route for navigation purposes.</li>
                                    <li>Print this report or save it as PDF for offline use.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                // Helper functions for the report
                function countCustomers(routes) {
                    let total = 0;
                    routes.forEach(route => {
                        total += (route.stops.length - 2); // Exclude depot at start and end
                    });
                    return total;
                }
                
                // Initialize when the page loads
                document.addEventListener('DOMContentLoaded', function() {
                    console.log("Report loaded successfully");
                });
            </script>
        </body>
        </html>
        `;
        
        // Write to the new window
        reportWindow.document.write(reportContent);
        reportWindow.document.close();
    }
    
    // Helper functions for report generation
    function countCustomers(routes) {
        let total = 0;
        routes.forEach(route => {
            // Subtract 2 for the depot (start and end)
            total += route.stops.length - 2;
        });
        return total;
    }
    
    function getRouteColor(index) {
        const routeColors = [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
            '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
        ];
        return routeColors[index % routeColors.length];
    }
    
    // Loading indicator functions
    function showLoading(message) {
        // Create loading indicator if it doesn't exist
        if (!document.getElementById('reportLoadingIndicator')) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'reportLoadingIndicator';
            loadingDiv.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center';
            loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
            loadingDiv.style.zIndex = '9999';
            
            loadingDiv.innerHTML = `
                <div class="bg-white p-3 rounded shadow">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border text-primary me-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div id="reportLoadingMessage">
                            ${message || 'Loading...'}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(loadingDiv);
        } else {
            // Update message if indicator already exists
            document.getElementById('reportLoadingMessage').textContent = message || 'Loading...';
            document.getElementById('reportLoadingIndicator').style.display = 'flex';
        }
    }
    
    function hideLoading() {
        const loadingIndicator = document.getElementById('reportLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
    
    // Fix for the displaySolutionResults function to properly save solution
    const originalDisplaySolutionResults = window.displaySolutionResults;
    if (typeof originalDisplaySolutionResults === 'function') {
        window.displaySolutionResults = function(data) {
            console.log("Enhanced displaySolutionResults called to save solution data");
            
            // Save solution data in global appState
            if (data && data.solution) {
                window.appState.lastSolution = data.solution;
                window.appState.solutionReady = true;
                console.log("Solution data saved to appState");
            }
            
            // Call original function
            originalDisplaySolutionResults(data);
        };
    }
    
    // Also intercept the getSolution function to save the job ID
    const originalGetSolution = window.getSolution;
    if (typeof originalGetSolution === 'function') {
        window.getSolution = function(jobId) {
            if (jobId) {
                window.appState.jobId = jobId;
                console.log("Job ID saved:", jobId);
            }
            
            // Call original function
            if (arguments.length > 0) {
                return originalGetSolution.apply(this, arguments);
            } else {
                return originalGetSolution();
            }
        };
    }
    
    // Intercept the solve function to save the job ID
    const originalSolveProblem = window.solveProblem;
    if (typeof originalSolveProblem === 'function') {
        window.solveProblem = function() {
            console.log("Enhanced solve problem called");
            
            // Reset solution data on new solve
            window.appState.solutionReady = false;
            window.appState.lastSolution = null;
            
            // Call original function
            return originalSolveProblem.apply(this, arguments);
        };
    }
    
    console.log("Enhanced report generation fix loaded successfully");
})();