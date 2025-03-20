// vercel-tracking-fix.js - Add to your static/js folder and include in index.html
// This script ensures route credits are properly deducted when using the client-side solver

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading route usage tracking for Vercel compatibility mode");
    
    // Flag to track if we've already recorded usage for the current session
    window.routeUsageRecorded = false;
    
    // Function to record route usage via API call
    window.recordRouteUsage = function() {
        // Check if we've already recorded usage for this session
        if (window.routeUsageRecorded) {
            console.log("Route usage already recorded for this session");
            return Promise.resolve({ success: true, alreadyRecorded: true });
        }
        
        console.log("Recording route usage via API");
        
        // Make API call to record route usage
        return fetch('/record_route_usage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_side: true,
                timestamp: new Date().toISOString()
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Route usage recorded successfully");
                window.routeUsageRecorded = true;
                
                // Update any UI elements showing route usage
                updateRouteUsageDisplay(data.routes_used, data.max_routes);
                
                return data;
            } else {
                console.error("Failed to record route usage:", data.error);
                
                // Check if this is a limit reached error
                if (data.limit_reached) {
                    handleRouteLimitReached(data);
                }
                
                return data;
            }
        })
        .catch(error => {
            console.error("Error recording route usage:", error);
            return { success: false, error: error.message };
        });
    };
    
    // Function to update UI elements showing route usage
    function updateRouteUsageDisplay(routesUsed, maxRoutes) {
        // Find elements that display route usage (if any exist)
        const routeUsageElements = document.querySelectorAll('.route-usage-count');
        routeUsageElements.forEach(element => {
            element.textContent = routesUsed;
        });
        
        // Update progress bars
        const routeProgressBars = document.querySelectorAll('.route-usage-progress');
        routeProgressBars.forEach(progressBar => {
            const percentage = Math.min(100, Math.round((routesUsed / maxRoutes) * 100));
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', routesUsed);
        });
    }
    
    // Function to handle route limit reached error
    function handleRouteLimitReached(data) {
        const errorMessage = data.error || 'You have reached your route creation limit for this billing period.';
        
        // Show error with option to upgrade
        if (confirm(`${errorMessage}\n\nWould you like to view upgrade options?`)) {
            window.location.href = data.redirect || '/pricing';
        }
    }
    
    // Function to check subscription limits for drivers/vehicles
    window.checkDriverLimit = function(requestedDrivers) {
        return fetch('/check_driver_limit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                max_vehicles: requestedDrivers
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success && data.limit_exceeded) {
                // Alert the user about the limit
                alert(data.error || `You can only use up to ${data.max_allowed} drivers on your current plan.`);
                
                // Return the max allowed value
                return {
                    allowed: false,
                    maxAllowed: data.max_allowed
                };
            }
            
            return {
                allowed: true,
                maxAllowed: data.max_allowed || requestedDrivers
            };
        })
        .catch(error => {
            console.error("Error checking driver limit:", error);
            return {
                allowed: true, // Default to allowing - better UX than blocking erroneously
                maxAllowed: requestedDrivers,
                error: error.message
            };
        });
    };
    
    // Intercept original solve function in vercel-solve-fix.js
    if (typeof window.runClientSideSolver === 'function') {
        const originalRunClientSideSolver = window.runClientSideSolver;
        
        window.runClientSideSolver = function(params, jobId) {
            console.log("Intercepted client-side solver call to enforce limits");
            
            // Check driver limit first
            window.checkDriverLimit(params.max_vehicles)
                .then(limitResult => {
                    if (!limitResult.allowed) {
                        // Update max vehicles parameter to the allowed value
                        params.max_vehicles = limitResult.maxAllowed;
                        console.log(`Adjusted max_vehicles to subscription limit: ${limitResult.maxAllowed}`);
                        
                        // Update the input field if possible
                        const maxVehiclesInput = document.getElementById('maxVehiclesInput');
                        if (maxVehiclesInput) {
                            maxVehiclesInput.value = limitResult.maxAllowed;
                        }
                    }
                    
                    // Record route usage before solving
                    window.recordRouteUsage()
                        .then(usageResult => {
                            if (usageResult.success) {
                                // Run the original solver
                                originalRunClientSideSolver(params, jobId);
                            } else if (usageResult.limit_reached) {
                                // Don't run solver if limit reached
                                const solveBtn = document.getElementById('solveBtn');
                                if (solveBtn) {
                                    solveBtn.disabled = false;
                                    solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                                }
                                
                                const solverProgressContainer = document.getElementById('solverProgressContainer');
                                if (solverProgressContainer) {
                                    solverProgressContainer.style.display = 'none';
                                }
                            }
                        });
                });
        };
        
        console.log("Successfully intercepted client-side solver function");
    }
    
    // Also intercept the simulateAnnealing function to ensure route credit is recorded after completion
    const originalSimulateAnnealing = window.simulateAnnealing;
    if (typeof originalSimulateAnnealing === 'function') {
        window.simulateAnnealing = function(options) {
            // Record usage at the beginning
            window.recordRouteUsage();
            
            // Call original function
            return originalSimulateAnnealing(options);
        };
        console.log("Successfully intercepted simulateAnnealing function");
    }
    
    console.log("Route usage tracking for Vercel compatibility mode loaded");
});