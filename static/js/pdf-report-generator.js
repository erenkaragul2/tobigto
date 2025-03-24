// pdf-report-generator.js
// Handles PDF generation and storage to Supabase

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading PDF report generator...");
    
    // Original report generator function
    const originalGenerateReport = window.generateDetailedReport;
    
    // Replace with enhanced version that supports PDF generation and saving
    window.generateDetailedReport = function(options = {}) {
        console.log("Enhanced report generation with PDF storage");
        
        // Default options
        const defaultOptions = {
            format: options.format || 'pdf', // 'pdf', 'html', or 'both'
            saveToDatabase: options.saveToDatabase !== false, // Default to true
            showPreview: options.showPreview !== false, // Default to true
        };
        
        options = {...defaultOptions, ...options};
        
        // Make sure we have an app state
        if (!window.appState) {
            window.appState = {};
        }
        
        // Try to find the solution in the current page
        const solutionContainer = document.getElementById('solutionContainer');
        
        // Get job ID if available
        const jobId = window.appState.jobId;
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'fixed';
        loadingDiv.style.top = '0';
        loadingDiv.style.left = '0';
        loadingDiv.style.width = '100%';
        loadingDiv.style.height = '100%';
        loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
        loadingDiv.style.zIndex = '9999';
        loadingDiv.style.display = 'flex';
        loadingDiv.style.justifyContent = 'center';
        loadingDiv.style.alignItems = 'center';
        
        loadingDiv.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
                <div class="d-flex align-items-center">
                    <div class="spinner-border text-primary me-3" role="status"></div>
                    <div>Generating report...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(loadingDiv);
        
        // Function to remove loading indicator
        function removeLoading() {
            if (document.body.contains(loadingDiv)) {
                document.body.removeChild(loadingDiv);
            }
        }
        
        // If we have a job ID, try to fetch the solution
        if (jobId) {
            console.log("Fetching solution for job ID:", jobId);
            
            fetch(`/get_solution/${jobId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.solution) {
                        console.log("Solution data fetched successfully");
                        generateAndSaveReport(data.solution, options);
                    } else {
                        removeLoading();
                        alert("Could not fetch solution data: " + (data.error || "Unknown error"));
                    }
                })
                .catch(error => {
                    removeLoading();
                    console.error("Error fetching solution:", error);
                    alert("Error fetching solution: " + error.message);
                });
        } else {
            // No job ID, show error
            removeLoading();
            alert("No solution data available. Please solve the problem first.");
        }
        
        // Main function to generate and optionally save the report
        async function generateAndSaveReport(solution, options) {
            if (!solution || !solution.details) {
                removeLoading();
                alert("Invalid solution data. Please solve the problem again.");
                return;
            }
            
            try {
                // Generate HTML content
                const htmlContent = generateReportHtml(solution);
                
                // If HTML format is requested, show it
                if (options.format === 'html' || options.format === 'both') {
                    const reportWindow = window.open('', '_blank');
                    
                    if (!reportWindow) {
                        alert('Please allow pop-ups to view the HTML report');
                    } else {
                        reportWindow.document.write(htmlContent);
                        reportWindow.document.close();
                    }
                }
                
                // If PDF format is requested, generate it
                if (options.format === 'pdf' || options.format === 'both') {
                    // Load jsPDF and html2canvas if not already loaded
                    await loadDependencies();
                    
                    // Create a temporary div to render the report
                    const tempDiv = document.createElement('div');
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.left = '-9999px';
                    tempDiv.style.width = '800px'; // Fixed width for PDF generation
                    tempDiv.innerHTML = htmlContent;
                    document.body.appendChild(tempDiv);
                    
                    try {
                        // Convert HTML to canvas for better styling
                        const canvas = await html2canvas(tempDiv, {
                            scale: 1.5, // Higher scale for better quality
                            useCORS: true,
                            logging: false
                        });
                        
                        // Create PDF with appropriate size
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        
                        // Calculate dimensions to fit the content properly
                        const imgProps = pdf.getImageProperties(imgData);
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                        
                        // Add image to PDF
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                        
                        // Save to Supabase if requested
                        if (options.saveToDatabase) {
                            await saveReportToDatabase(pdf, solution);
                        }
                        
                        // Show preview if requested
                        if (options.showPreview) {
                            pdf.output('dataurlnewwindow');
                        }
                        
                    } finally {
                        // Clean up temporary div
                        document.body.removeChild(tempDiv);
                    }
                }
                
                // Remove loading indicator
                removeLoading();
                
            } catch (error) {
                removeLoading();
                console.error("Error generating report:", error);
                alert("Error generating report: " + error.message);
            }
        }
        
        // Function to save report to database
        async function saveReportToDatabase(pdf, solution) {
            try {
                // Convert PDF to base64
                const pdfBase64 = pdf.output('datauristring');
                
                // Create metadata
                const metadata = {
                    created_at: new Date().toISOString(),
                    route_count: solution.details.routes.length,
                    total_distance: solution.details.total_distance,
                    vehicle_capacity: solution.details.routes[0].capacity,
                    node_count: solution.coordinates.length,
                    job_id: jobId
                };
                
                // Send to server
                const response = await fetch('/save_report', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pdf_data: pdfBase64,
                        metadata: metadata
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log("Report saved successfully:", result);
                    showSuccessNotification(result.report_id);
                } else {
                    console.error("Error saving report:", result.error);
                    showErrorNotification(result.error);
                }
                
            } catch (error) {
                console.error("Error saving report to database:", error);
                showErrorNotification("Failed to save report: " + error.message);
            }
        }
        
        // Function to dynamically load jsPDF and html2canvas
        async function loadDependencies() {
            // Check if dependencies are already loaded
            if (window.jsPDF && window.html2canvas) {
                return;
            }
            
            // Load html2canvas
            if (!window.html2canvas) {
                console.log("Loading html2canvas...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            // Load jsPDF
            if (!window.jsPDF) {
                console.log("Loading jsPDF...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }
            
            console.log("Dependencies loaded successfully");
        }
        
        // Show success notification
        function showSuccessNotification(reportId) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-success alert-dismissible fade show';
            alertDiv.innerHTML = `
                <i class="fas fa-check-circle me-2"></i>
                Report saved to your account successfully!
                <a href="/view_report/${reportId}" class="alert-link ms-2">View saved report</a>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            // Insert at the top of results tab
            const resultsTab = document.getElementById('results');
            if (resultsTab) {
                resultsTab.insertBefore(alertDiv, resultsTab.firstChild);
            }
        }
        
        // Show error notification
        function showErrorNotification(errorMessage) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger alert-dismissible fade show';
            alertDiv.innerHTML = `
                <i class="fas fa-exclamation-circle me-2"></i>
                ${errorMessage}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            
            // Insert at the top of results tab
            const resultsTab = document.getElementById('results');
            if (resultsTab) {
                resultsTab.insertBefore(alertDiv, resultsTab.firstChild);
            }
        }
    };
    
    // Generate HTML content for the report
    function generateReportHtml(solution) {
        const details = solution.details;
        const coordinates = solution.coordinates;
        const depot = solution.depot || 0;
        
        // Calculate total customers
        function countTotalCustomers() {
            let total = 0;
            details.routes.forEach(route => {
                total += route.stops.length - 2; // Subtract 2 for depot at start and end
            });
            return total;
        }
        
        // Get route colors
        function getRouteColor(index) {
            const colors = [
                '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff',
                '#ff9f40', '#c9cbcf', '#7cbb00', '#f652a0', '#00bcf2'
            ];
            return colors[index % colors.length];
        }
        
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
                                        <h4>${countTotalCustomers()}</h4>
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
        </body>
        </html>
        `;
        
        return reportContent;
    }
});