// Integrated fix for CVRP solver visualization issues
(function() {
    console.log("Loading integrated CVRP visualization fix...");
    
    // Store original functions we need to hook into
    const originalGetSolution = window.getSolution;
    const originalDisplaySolutionResults = window.displaySolutionResults;
    const originalVisualizeSolutionOnMap = window.visualizeSolutionOnMap;
    const originalShowConvergencePlot = window.showConvergencePlot;
    
    // Make sure we have a global appState
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
    
    // Direct injection fix for solution capture
    window.getSolution = function() {
        console.log("Enhanced getSolution called");
        
        if (!window.appState.jobId) {
            console.error("No job ID available");
            return;
        }
        
        fetch(`/get_solution/${window.appState.jobId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log("Solution data received successfully");
                    
                    // CRITICAL: Save data in appState
                    window.appState.lastSolution = data.solution;
                    window.appState.costHistory = data.cost_history;
                    window.appState.tempHistory = data.temp_history;
                    window.appState.solutionReady = true;
                    
                    // Log what we captured
                    console.log("Captured in appState:", {
                        solution: !!data.solution,
                        cost_history: data.cost_history?.length || 0,
                        temp_history: data.temp_history?.length || 0
                    });
                    
                    // Call the original function to maintain compatibility
                    if (originalDisplaySolutionResults) {
                        originalDisplaySolutionResults(data);
                    }
                    
                    // Switch to results tab
                    const resultsTab = document.getElementById('results-tab');
                    if (resultsTab) {
                        resultsTab.click();
                    }
                } else {
                    console.error("Server returned error:", data.error);
                    alert(`Error fetching solution: ${data.error}`);
                }
            })
            .catch(error => {
                console.error("Error fetching solution:", error);
                alert(`Error fetching solution: ${error.message}`);
            });
    };
    
    // Enhanced solution rendering
    window.displaySolutionResults = function(data) {
        console.log("Enhanced displaySolutionResults called");
        
        try {
            // CRITICAL: Save data in appState again as a backup
            if (data && data.solution) {
                window.appState.lastSolution = data.solution;
                window.appState.costHistory = data.cost_history;
                window.appState.tempHistory = data.temp_history;
                window.appState.solutionReady = true;
                console.log("Solution data stored in appState");
            }
            
            // Call the original function first for compatibility
            if (originalDisplaySolutionResults) {
                originalDisplaySolutionResults(data);
            }
            
            // Apply our own rendering to ensure things work
            renderVisualizationsFromAppState();
            
        } catch (err) {
            console.error("Error in enhanced displaySolutionResults:", err);
        }
    };
    
    // Fix for polling to capture job ID
    const originalPollSolverStatus = window.pollSolverStatus;
    if (typeof originalPollSolverStatus === 'function') {
        window.pollSolverStatus = function() {
            // Extract and save job ID from arguments
            if (!window.appState.jobId && arguments.length > 0) {
                window.appState.jobId = arguments[0];
                console.log("Job ID captured:", window.appState.jobId);
            }
            
            // Call original function
            return originalPollSolverStatus.apply(this, arguments);
        };
    }
    
    // Make sure we save data when solver completes
    const fetchOriginal = window.fetch;
    window.fetch = function() {
        const url = arguments[0];
        const promise = fetchOriginal.apply(this, arguments);
        
        // Check if this is a solver status request that might contain solution data
        if (typeof url === 'string' && url.includes('/solver_status/')) {
            promise.then(response => response.clone().json())
                .then(data => {
                    if (data.success && data.status === 'completed' && data.solution) {
                        console.log("Solution detected in solver status response");
                        window.appState.lastSolution = data.solution;
                        window.appState.solutionReady = true;
                    }
                })
                .catch(err => console.error("Error processing fetch intercept:", err));
        }
        
        // Check if this is a get_solution request
        if (typeof url === 'string' && url.includes('/get_solution/')) {
            promise.then(response => response.clone().json())
                .then(data => {
                    if (data.success && data.solution) {
                        console.log("Solution detected in get_solution response");
                        window.appState.lastSolution = data.solution;
                        window.appState.costHistory = data.cost_history;
                        window.appState.tempHistory = data.temp_history;
                        window.appState.solutionReady = true;
                    }
                })
                .catch(err => console.error("Error processing fetch intercept:", err));
        }
        
        return promise;
    };
    
    // Enhanced map visualization function
    window.visualizeSolutionOnMap = function(solution) {
        console.log("Enhanced visualizeSolutionOnMap called");
        
        // If no solution provided, try to use the one from appState
        if (!solution && window.appState.lastSolution) {
            console.log("Using solution from appState");
            solution = window.appState.lastSolution;
        }
        
        // Validate solution
        if (!solution) {
            console.error("No solution available for map visualization");
            const mapContainer = document.getElementById('mapContainer');
            if (mapContainer) {
                mapContainer.innerHTML = '<div class="alert alert-warning">No solution data available for map visualization</div>';
            }
            return;
        }
        
        try {
            // Call original function
            if (originalVisualizeSolutionOnMap) {
                originalVisualizeSolutionOnMap(solution);
            }
        } catch (err) {
            console.error("Error in original visualizeSolutionOnMap:", err);
            const mapContainer = document.getElementById('mapContainer');
            if (mapContainer) {
                mapContainer.innerHTML = `<div class="alert alert-danger">Error visualizing map: ${err.message}</div>`;
            }
        }
    };
    
    // Enhanced convergence plot function
    window.showConvergencePlot = function(costHistory, tempHistory) {
        console.log("Enhanced showConvergencePlot called");
        
        // If no histories provided, try to use the ones from appState
        if ((!costHistory || !tempHistory) && window.appState.costHistory && window.appState.tempHistory) {
            console.log("Using history data from appState");
            costHistory = window.appState.costHistory;
            tempHistory = window.appState.tempHistory;
        }
        
        // Validate data
        if (!costHistory || !tempHistory || costHistory.length === 0 || tempHistory.length === 0) {
            console.error("Invalid or missing history data for convergence plot");
            const convergencePlotContainer = document.getElementById('convergencePlotContainer');
            if (convergencePlotContainer) {
                convergencePlotContainer.innerHTML = '<div class="alert alert-warning">No history data available for convergence plot</div>';
            }
            return;
        }
        
        try {
            // Call original function
            if (originalShowConvergencePlot) {
                originalShowConvergencePlot(costHistory, tempHistory);
            }
        } catch (err) {
            console.error("Error in original showConvergencePlot:", err);
            const convergencePlotContainer = document.getElementById('convergencePlotContainer');
            if (convergencePlotContainer) {
                convergencePlotContainer.innerHTML = `<div class="alert alert-danger">Error creating convergence plot: ${err.message}</div>`;
            }
        }
    };
    
    // Function to render visualizations from app state
    function renderVisualizationsFromAppState() {
        console.log("Rendering visualizations from appState");
        
        if (window.appState.lastSolution) {
            // Render map
            try {
                window.visualizeSolutionOnMap(window.appState.lastSolution);
            } catch (err) {
                console.error("Error rendering map from appState:", err);
            }
            
            // Render convergence plot
            if (window.appState.costHistory && window.appState.tempHistory) {
                try {
                    window.showConvergencePlot(window.appState.costHistory, window.appState.tempHistory);
                } catch (err) {
                    console.error("Error rendering convergence plot from appState:", err);
                }
            }
        } else {
            console.warn("No solution in appState to render");
        }
    }
    
    // Fix for tab switching to ensure data is displayed
    document.addEventListener('DOMContentLoaded', function() {
        const resultsTab = document.getElementById('results-tab');
        if (resultsTab) {
            resultsTab.addEventListener('shown.bs.tab', function() {
                console.log("Results tab shown - checking for visualization data");
                
                // Wait a moment for DOM to be ready
                setTimeout(() => {
                    // If we have solution data in appState, render visualizations
                    if (window.appState.solutionReady) {
                        console.log("Re-rendering visualizations for tab switch");
                        renderVisualizationsFromAppState();
                    }
                    
                    // Make sure map is properly sized
                    if (window.map) {
                        window.map.invalidateSize();
                    }
                }, 200);
            });
        }
    });
    
    // Add diagnostic and troubleshooting tools
    window.cvrpDebug = {
        // Force reload solution from server
        reloadSolution: function(jobId) {
            const id = jobId || window.appState.jobId;
            if (!id) {
                console.error("No job ID available");
                return "No job ID available";
            }
            
            console.log(`Reloading solution for job ${id}`);
            fetch(`/get_solution/${id}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log("Solution reloaded successfully");
                        window.appState.lastSolution = data.solution;
                        window.appState.costHistory = data.cost_history;
                        window.appState.tempHistory = data.temp_history;
                        window.appState.solutionReady = true;
                        renderVisualizationsFromAppState();
                        return "Solution reloaded and rendered";
                    } else {
                        console.error("Error reloading solution:", data.error);
                        return `Error: ${data.error}`;
                    }
                })
                .catch(err => {
                    console.error("Error fetching solution:", err);
                    return `Error: ${err.message}`;
                });
            
            return "Reload request sent";
        },
        
        // Get data about the current solution
        getSolutionInfo: function() {
            if (!window.appState.lastSolution) {
                return "No solution data available";
            }
            
            return {
                routes: window.appState.lastSolution.routes?.length || 0,
                coordinates: window.appState.lastSolution.coordinates?.length || 0,
                depot: window.appState.lastSolution.depot,
                costHistory: window.appState.costHistory?.length || 0,
                tempHistory: window.appState.tempHistory?.length || 0
            };
        },
        
        // Force refresh map
        refreshMap: function() {
            if (!window.map) {
                return "Map not initialized";
            }
            
            try {
                window.map.invalidateSize();
                
                if (window.appState.lastSolution) {
                    window.visualizeSolutionOnMap(window.appState.lastSolution);
                    return "Map refreshed with solution data";
                } else {
                    return "Map refreshed but no solution data available";
                }
            } catch (err) {
                console.error("Error refreshing map:", err);
                return `Error: ${err.message}`;
            }
        },
        
        // Force refresh convergence plot
        refreshConvergencePlot: function() {
            if (!window.appState.costHistory || !window.appState.tempHistory) {
                return "No convergence data available";
            }
            
            try {
                window.showConvergencePlot(window.appState.costHistory, window.appState.tempHistory);
                return "Convergence plot refreshed";
            } catch (err) {
                console.error("Error refreshing convergence plot:", err);
                return `Error: ${err.message}`;
            }
        },
        
        // Fix for common issues
        applyEmergencyFix: function() {
            // Try to force redraw everything
            try {
                // Reset map container
                const mapContainer = document.getElementById('mapContainer');
                if (mapContainer) {
                    mapContainer.style.height = '400px';
                    mapContainer.style.width = '100%';
                }
                
                // Reset convergence plot container
                const convergencePlotContainer = document.getElementById('convergencePlotContainer');
                if (convergencePlotContainer) {
                    convergencePlotContainer.style.height = '350px';
                    convergencePlotContainer.style.width = '100%';
                    convergencePlotContainer.innerHTML = '<canvas id="convergenceChart"></canvas>';
                }
                
                // Force redraw
                if (window.appState.lastSolution) {
                    setTimeout(() => {
                        renderVisualizationsFromAppState();
                    }, 100);
                }
                
                return "Emergency fix applied";
            } catch (err) {
                console.error("Error applying emergency fix:", err);
                return `Error: ${err.message}`;
            }
        }
    };
    
    // Replace the diagnose function
    window.diagnoseSolution = function() {
        console.log("App State:", window.appState);
        
        if (window.appState.lastSolution) {
            return {
                hasValidSolution: true,
                routes: window.appState.lastSolution.routes?.length || 0,
                coordinates: window.appState.lastSolution.coordinates?.length || 0,
                depot: window.appState.lastSolution.depot,
                costHistory: window.appState.costHistory?.length || 0,
                tempHistory: window.appState.tempHistory?.length || 0
            };
        } else {
            return "No solution data available";
        }
    };
    
    console.log("Integrated CVRP visualization fix loaded successfully");
})();