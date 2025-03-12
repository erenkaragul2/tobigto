// This script ensures our fixes are properly loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading CVRP visualization fixes...");
    
    // Store global state references
    window.appState = window.appState || {
        dataLoaded: false,
        dataProcessed: false,
        solving: false,
        solutionReady: false,
        jobId: null,
        coordinates: null,
        company_names: null,
        demands: null
    };
    
    // Fix for the getSolution function to properly update appState
    const originalGetSolution = window.getSolution;
    if (typeof originalGetSolution === 'function') {
        window.getSolution = function() {
            console.log("Enhanced getSolution called");
            if (!window.appState.jobId) return;
            
            fetch(`/get_solution/${window.appState.jobId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Log solution data for debugging
                        console.log("Received solution data:", {
                            "has_routes": !!data.solution.routes,
                            "routes_length": data.solution.routes?.length || 0,
                            "has_coordinates": !!data.solution.coordinates,
                            "has_cost_history": !!data.cost_history,
                            "cost_history_length": data.cost_history?.length || 0
                        });
                        
                        // Display solution results
                        if (typeof window.displaySolutionResults === 'function') {
                            window.displaySolutionResults(data);
                        } else {
                            console.error("displaySolutionResults function not found");
                        }
                        
                        // Switch to results tab
                        const resultsTab = document.getElementById('results-tab');
                        if (resultsTab) {
                            resultsTab.click();
                        }
                    } else {
                        console.error("Solution error:", data.error);
                        alert(`Error fetching solution: ${data.error}`);
                    }
                })
                .catch(error => {
                    console.error("Solution fetch error:", error);
                    alert(`Error fetching solution: ${error.message}`);
                });
        };
    }
    
    // Create a helper function to check if elements exist on the page
    function checkElements() {
        const mapContainer = document.getElementById('mapContainer');
        const convergencePlotContainer = document.getElementById('convergencePlotContainer');
        
        console.log("Checking critical elements:", {
            "mapContainer": !!mapContainer,
            "convergencePlotContainer": !!convergencePlotContainer
        });
        
        // If we're on a page with these elements, add some debugging info
        if (mapContainer) {
            mapContainer.setAttribute('data-status', 'initialized');
        }
        
        if (convergencePlotContainer) {
            convergencePlotContainer.setAttribute('data-status', 'initialized');
            
            // Add a debug message
            const debugMsg = document.createElement('div');
            debugMsg.className = 'small text-muted mb-2';
            debugMsg.textContent = 'Convergence plot initialized. Will show when data is available.';
            convergencePlotContainer.parentNode.insertBefore(debugMsg, convergencePlotContainer);
        }
    }
    
    // Check elements on page load
    checkElements();
    
    // Also check when tabs are shown
    const tabTriggers = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabTriggers.forEach(tabTrigger => {
        tabTrigger.addEventListener('shown.bs.tab', function(event) {
            console.log("Tab shown:", event.target.id);
            
            // Force map to update when tab becomes visible
            if (event.target.id === 'results-tab' && window.map) {
                setTimeout(() => {
                    window.map.invalidateSize();
                    console.log("Map size invalidated");
                    
                    // If we have an active solution, try redrawing
                    if (window.appState && window.appState.jobId && 
                        typeof window.visualizeSolutionOnMap === 'function') {
                        fetch(`/get_solution/${window.appState.jobId}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    window.visualizeSolutionOnMap(data.solution);
                                }
                            })
                            .catch(err => console.error("Error fetching solution data:", err));
                    }
                }, 100);
            }
        });
    });
    
    // Export methods to window for debugging
    window.debugVisualization = {
        checkElements: checkElements,
        redrawMap: function() {
            if (window.map) {
                window.map.invalidateSize();
                return "Map invalidated";
            }
            return "Map not available";
        },
        redrawChart: function() {
            const container = document.getElementById('convergencePlotContainer');
            if (container) {
                container.innerHTML = '<div class="alert alert-info">Manually triggered redraw</div>';
                return "Chart container reset";
            }
            return "Chart container not found";
        }
    };
    
    console.log("CVRP visualization fixes loaded successfully");
});