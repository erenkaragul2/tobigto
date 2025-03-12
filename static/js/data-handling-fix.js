// Enhanced solution data handling and global state management
(function() {
    console.log("Loading solution data handling fix...");
    
    // Set up global app state if it doesn't exist
    window.appState = window.appState || {
        dataLoaded: false,
        dataProcessed: false,
        solving: false,
        solutionReady: false,
        jobId: null,
        coordinates: null,
        company_names: null,
        demands: null,
        lastSolution: null,
        costHistory: null,
        tempHistory: null
    };
    
    // Create an enhanced version of the displaySolutionResults function
    function displaySolutionResultsAdvanced(data) {
        console.log("Enhanced displaySolutionResults called with data");
        
        try {
            // Validate data structure
            if (!data) {
                console.error("No data provided to displaySolutionResults");
                return;
            }
            
            if (!data.solution) {
                console.error("Missing solution object in data:", data);
                const solutionContainer = document.getElementById('solutionContainer');
                if (solutionContainer) {
                    solutionContainer.innerHTML = '<div class="alert alert-danger">Invalid solution data received from server</div>';
                }
                return;
            }
            
            // Store the solution in the app state for future reference
            window.appState.lastSolution = data.solution;
            window.appState.costHistory = data.cost_history;
            window.appState.tempHistory = data.temp_history;
            
            // Log what we have
            console.log("Solution:", {
                has_routes: !!data.solution.routes,
                routes_length: data.solution.routes?.length || 0,
                has_coordinates: !!data.solution.coordinates,
                coordinates_length: data.solution.coordinates?.length || 0,
                has_cost_history: !!data.cost_history,
                cost_history_length: data.cost_history?.length || 0,
                has_temp_history: !!data.temp_history,
                temp_history_length: data.temp_history?.length || 0
            });
            
            // Call the original functions with our validated data
            
            // 1. Display solution overview
            const overviewFunc = window.displaySolutionOverview || displaySolutionOverviewFallback;
            try {
                overviewFunc(data.solution);
            } catch (err) {
                console.error("Error in displaySolutionOverview:", err);
                const solutionContainer = document.getElementById('solutionContainer');
                if (solutionContainer) {
                    solutionContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <strong>Error displaying solution overview:</strong> ${err.message}
                        </div>
                    `;
                }
            }
            
            // 2. Display route details
            const routeDetailsFunc = window.displayRouteDetails || displayRouteDetailsFallback;
            try {
                routeDetailsFunc(data.solution);
            } catch (err) {
                console.error("Error in displayRouteDetails:", err);
                const routeDetailsContainer = document.getElementById('routeDetailsContainer');
                if (routeDetailsContainer) {
                    routeDetailsContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <strong>Error displaying route details:</strong> ${err.message}
                        </div>
                    `;
                }
            }
            
            // 3. Visualize solution on map (with validation)
            try {
                window.visualizeSolutionOnMap(data.solution);
            } catch (err) {
                console.error("Error in visualizeSolutionOnMap:", err);
                const mapContainer = document.getElementById('mapContainer');
                if (mapContainer) {
                    mapContainer.innerHTML += `
                        <div class="alert alert-danger">
                            <strong>Error visualizing map:</strong> ${err.message}
                        </div>
                    `;
                }
            }
            
            // 4. Show convergence plot
            try {
                if (data.cost_history && data.temp_history) {
                    console.log("Displaying convergence plot with history data");
                    window.showConvergencePlot(data.cost_history, data.temp_history);
                } else {
                    console.error("Missing history data for convergence plot");
                    const convergencePlotContainer = document.getElementById('convergencePlotContainer');
                    if (convergencePlotContainer) {
                        convergencePlotContainer.innerHTML = `
                            <div class="alert alert-warning">
                                <strong>Missing Data:</strong> No convergence history available.
                            </div>
                        `;
                    }
                }
            } catch (err) {
                console.error("Error in showConvergencePlot:", err);
                const convergencePlotContainer = document.getElementById('convergencePlotContainer');
                if (convergencePlotContainer) {
                    convergencePlotContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <strong>Error displaying convergence plot:</strong> ${err.message}
                        </div>
                    `;
                }
            }
            
        } catch (err) {
            console.error("Global error in displaySolutionResults:", err);
            alert(`Error displaying solution: ${err.message}`);
        }
    }
    
    // Simple fallback functions if the originals are missing
    function displaySolutionOverviewFallback(solution) {
        console.warn("Using fallback displaySolutionOverview function");
        const solutionContainer = document.getElementById('solutionContainer');
        if (solutionContainer) {
            solutionContainer.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Solution Received:</strong> Solutions details are available but the overview renderer is missing.
                </div>
            `;
        }
    }
    
    function displayRouteDetailsFallback(solution) {
        console.warn("Using fallback displayRouteDetails function");
        const routeDetailsContainer = document.getElementById('routeDetailsContainer');
        if (routeDetailsContainer) {
            routeDetailsContainer.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Route Details Available:</strong> Route details are available but the details renderer is missing.
                </div>
            `;
        }
    }
    
    // Enhanced version of the getSolution function
    function getSolutionAdvanced() {
        console.log("Enhanced getSolution called");
        
        if (!window.appState.jobId) {
            console.error("No job ID available");
            return;
        }
        
        console.log("Fetching solution for job:", window.appState.jobId);
        
        // Show loading indicators
        const containers = [
            document.getElementById('solutionContainer'),
            document.getElementById('routeDetailsContainer'),
            document.getElementById('convergencePlotContainer')
        ];
        
        containers.forEach(container => {
            if (container) {
                container.innerHTML = `
                    <div class="d-flex justify-content-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                `;
            }
        });
        
        // Fetch solution from server
        fetch(`/get_solution/${window.appState.jobId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log("Solution data received successfully");
                    
                    // Display solution results
                    displaySolutionResultsAdvanced(data);
                    
                    // Switch to results tab
                    const resultsTab = document.getElementById('results-tab');
                    if (resultsTab) {
                        resultsTab.click();
                    }
                } else {
                    console.error("Server returned error:", data.error);
                    alert(`Error fetching solution: ${data.error}`);
                    
                    // Clear loading indicators
                    containers.forEach(container => {
                        if (container) {
                            container.innerHTML = `
                                <div class="alert alert-danger">
                                    <strong>Error:</strong> ${data.error}
                                </div>
                            `;
                        }
                    });
                }
            })
            .catch(error => {
                console.error("Error fetching solution:", error);
                alert(`Error fetching solution: ${error.message}`);
                
                // Clear loading indicators
                containers.forEach(container => {
                    if (container) {
                        container.innerHTML = `
                            <div class="alert alert-danger">
                                <strong>Error:</strong> ${error.message}
                            </div>
                        `;
                    }
                });
            });
    }
    
    // Replace the original functions with our enhanced versions
    window.displaySolutionResults = displaySolutionResultsAdvanced;
    window.getSolution = getSolutionAdvanced;
    
    // Create a reload function to manually reload the current solution
    window.reloadSolution = function() {
        if (window.appState.jobId) {
            console.log("Manually reloading solution for job:", window.appState.jobId);
            getSolutionAdvanced();
            return "Solution reload requested";
        } else {
            console.error("No job ID available for reload");
            return "No solution job ID available";
        }
    };
    
    // Add event listeners to ensure data is properly loaded when switching tabs
    document.addEventListener('DOMContentLoaded', function() {
        // When results tab is shown, make sure we have the latest data
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                // Check if we have solution data loaded
                if (window.appState.solutionReady && window.appState.jobId) {
                    console.log("Results tab shown - ensuring fresh data");
                    getSolutionAdvanced();
                }
            });
        }
        
        // Monitor solution polling to capture the job ID
        const originalPollSolverStatus = window.pollSolverStatus;
        if (typeof originalPollSolverStatus === 'function') {
            window.pollSolverStatus = function() {
                console.log("Enhanced poll solver status called");
                // Save the job ID to the global state
                if (arguments.length > 0 && arguments[0]) {
                    window.appState.jobId = arguments[0];
                }
                return originalPollSolverStatus.apply(this, arguments);
            };
        }
    });
    
    // Add diagnostic function to check solution data
    window.diagnoseSolution = function() {
        console.log("App State:", window.appState);
        
        if (window.appState.lastSolution) {
            console.log("Latest solution:", window.appState.lastSolution);
            console.log("Cost history:", window.appState.costHistory);
            console.log("Temp history:", window.appState.tempHistory);
            
            return {
                hasValidSolution: !!window.appState.lastSolution,
                hasRoutes: !!window.appState.lastSolution?.routes,
                routesCount: window.appState.lastSolution?.routes?.length || 0,
                hasCoordinates: !!window.appState.lastSolution?.coordinates,
                coordsCount: window.appState.lastSolution?.coordinates?.length || 0,
                hasCostHistory: !!window.appState.costHistory,
                costHistoryLength: window.appState.costHistory?.length || 0,
                hasTempHistory: !!window.appState.tempHistory,
                tempHistoryLength: window.appState.tempHistory?.length || 0
            };
        } else {
            return "No solution data available";
        }
    };
    
    console.log("Solution data handling fix loaded successfully");
})();