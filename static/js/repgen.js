// Fix for report generation - save to static/js/report-generation-fix.js

(function() {
    console.log("Loading report generation fix...");
    
    // Ensure we have a global app state
    window.appState = window.appState || {
        dataLoaded: false,
        dataProcessed: false,
        solving: false,
        solutionReady: false,
        jobId: null,
        lastSolution: null
    };
    
    // Store original functions we need to enhance
    const originalDisplaySolutionResults = window.displaySolutionResults;
    const originalGetSolution = window.getSolution;
    
    // Enhanced version of displaySolutionResults to properly save solution
    window.displaySolutionResults = function(data) {
        console.log("Enhanced displaySolutionResults called");
        
        // Store solution data in global state
        if (data && data.solution) {
            window.appState.lastSolution = data.solution;
            window.appState.solutionReady = true;
            console.log("Solution data saved to appState");
        }
        
        // Call original function
        if (typeof originalDisplaySolutionResults === 'function') {
            originalDisplaySolutionResults(data);
        }
    };
    
    // Enhanced version of getSolution to track job ID
    window.getSolution = function() {
        console.log("Enhanced getSolution called");
        const jobId = window.appState.jobId;
        
        if (!jobId) {
            console.error("No job ID available");
            return;
        }
        
        fetch(`/get_solution/${jobId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("Solution data received");
                    
                    // Important: Save solution data to global state
                    window.appState.lastSolution = data.solution;
                    window.appState.solutionReady = true;
                    console.log("Solution saved to global state:", !!window.appState.lastSolution);
                    
                    // Call original display function
                    if (typeof originalDisplaySolutionResults === 'function') {
                        originalDisplaySolutionResults(data);
                    } else {
                        console.warn("Original displaySolutionResults not found");
                        
                        // Fallback display
                        displaySolutionOverview(data.solution);
                        displayRouteDetails(data.solution);
                        visualizeSolutionOnMap(data.solution);
                        if (data.cost_history && data.temp_history) {
                            showConvergencePlot(data.cost_history, data.temp_history);
                        }
                    }
                    
                    // Switch to results tab
                    const resultsTab = document.getElementById('results-tab');
                    if (resultsTab) {
                        resultsTab.click();
                    }
                } else {
                    console.error("Error fetching solution:", data.error);
                    alert(`Error fetching solution: ${data.error}`);
                }
            })
            .catch(error => {
                console.error("Error in fetch:", error);
                alert(`Error fetching solution: ${error.message}`);
            });
    };
    
    // Fix for the generateDetailedReport function
    window.generateDetailedReport = function() {
        console.log("Enhanced generateDetailedReport called");
        
        // First try to use the solution in appState
        if (window.appState.lastSolution) {
            console.log("Using solution from appState");
            generateReportFromSolution(window.appState.lastSolution);
            return;
        }
        
        // If no solution in appState, try to fetch it
        if (window.appState.jobId) {
            console.log("Fetching solution from server");
            
            // Add loading indicator
            const body = document.body;
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
                        <div>
                            Fetching solution data...
                        </div>
                    </div>
                </div>
            `;
            
            body.appendChild(loadingDiv);
            
            // Fetch solution
            fetch(`/get_solution/${window.appState.jobId}`)
                .then(response => response.json())
                .then(data => {
                    // Remove loading indicator
                    body.removeChild(loadingDiv);
                    
                    if (data.success && data.solution) {
                        console.log("Solution fetched successfully");
                        window.appState.lastSolution = data.solution;
                        window.appState.solutionReady = true;
                        generateReportFromSolution(data.solution);
                    } else {
                        console.error("Failed to fetch solution:", data.error);
                        alert("Failed to fetch solution: " + (data.error || "Unknown error"));
                    }
                })
                .catch(error => {
                    // Remove loading indicator
                    if (document.getElementById('reportLoadingIndicator')) {
                        body.removeChild(loadingDiv);
                    }
                    
                    console.error("Error fetching solution:", error);
                    alert("Error fetching solution: " + error.message);
                });
            
            return;
        }
        
        // Last resort - try to find solution data rendered in the DOM
        try {
            console.log("Trying to extract solution from DOM");
            const routeCards = document.querySelectorAll('.route-card');
            
            if (routeCards.length > 0) {
                console.log("Found route cards in DOM, checking for solution data");
                
                // If DOM contains route information, build a minimal solution object
                const routeDetails = Array.from(routeCards).map((card, index) => {
                    const routeId = parseInt(card.querySelector('.card-title')?.textContent?.match(/Route (\d+)/)?.[1] || (index + 1));
                    return { id: routeId };
                });
                
                if (routeDetails.length > 0) {
                    alert("Direct report generation not possible. Please solve the problem again to regenerate the solution data.");
                    return;
                }
            }
        } catch (e) {
            console.error("Error extracting solution from DOM:", e);
        }
        
        // If all else fails
        alert("No solution data available to generate report! Please solve the problem first.");
    };
    
    // Intercept the original poll function to capture job ID
    const originalPollSolverStatus = window.pollSolverStatus;
    if (typeof originalPollSolverStatus === 'function') {
        window.pollSolverStatus = function(jobId) {
            // Save job ID to app state
            if (jobId) {
                window.appState.jobId = jobId;
                console.log("Job ID saved to app state:", jobId);
            }
            
            // Call original function
            return originalPollSolverStatus.apply(this, arguments);
        };
    }
    
    // Add direct event listener to report button in case the original one isn't working
    document.addEventListener('DOMContentLoaded', function() {
        const reportBtn = document.getElementById('generateReportBtn');
        if (reportBtn) {
            reportBtn.addEventListener('click', function() {
                window.generateDetailedReport();
            });
        }
    });
    
    console.log("Report generation fix loaded successfully");
})();

// Helper function to generate the report from a solution
// This is a simplified version of the function in repgen.js
function generateReportFromSolution(solution) {
    console.log("Generating report from solution");
    
    if (!solution || !solution.details || !solution.coordinates) {
        console.error("Invalid solution data:", solution);
        alert("Invalid solution data. Please try solving again.");
        return;
    }
    
    try {
        const reportWindow = window.open('', '_blank');
        
        if (!reportWindow) {
            alert('Please allow pop-ups to view the report');
            return;
        }
        
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
                
                @media print {
                    .no-print { display: none !important; }
                    .page-break { page-break-after: always; }
                    a { text-decoration: none !important; color: #000 !important; }
                    .route-card { break-inside: avoid; }
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
        
        // Route colors for consistent styling
        const routeColors = [
            '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
            '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
        ];
        
        // Add details for each route
        details.routes.forEach((route, index) => {
            const routeColor = routeColors[index % routeColors.length];
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
                // Helper function to count total customers
                function countCustomers(routes) {
                    let total = 0;
                    routes.forEach(route => {
                        total += (route.stops.length - 2); // Exclude depot at start and end
                    });
                    return total;
                }
            </script>
        </body>
        </html>
        `;
        
        // Write to the new window
        reportWindow.document.write(reportContent);
        reportWindow.document.close();
    } catch (error) {
        console.error("Error generating report:", error);
        alert("Error generating report: " + error.message);
    }
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