// vercel-tracking-fix.js - Add to your static/js folder and include in index.html
// This script ensures route credits are properly deducted when using the client-side solver

// Enhanced version of vercel-tracking-fix.js

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced route usage tracking system");
    
    // Flag to track if we've already recorded usage for the current session
    window.routeUsageRecorded = false;
    // Retry mechanism variables
    window.maxRetries = 3;
    window.retryDelay = 1000; // 1 second initial delay, with exponential backoff
    
    // Function to record route usage via API call with retry logic
    window.recordRouteUsage = function(retryCount = 0) {
        // Check if we've already recorded usage for this session
        if (window.routeUsageRecorded) {
            console.log("Route usage already recorded for this session");
            return Promise.resolve({ success: true, alreadyRecorded: true });
        }
        
        console.log("Recording route usage via API");
        
        // Prepare request with additional metadata for debugging
        const requestData = {
            client_side: true,
            timestamp: new Date().toISOString(),
            browser: navigator.userAgent,
            session_id: Math.random().toString(36).substring(2, 15)
        };
        
        // Make API call to record route usage
        return fetch('/record_route_usage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            // Handle HTTP-level errors
            if (!response.ok) {
                // If we get a 403 response, it likely means we've hit our limit
                if (response.status === 403) {
                    return response.json().then(errorData => {
                        handleRouteLimitReached(errorData);
                        throw new Error('Route limit reached');
                    });
                }
                
                // For other errors, try to get the error message from the response
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                });
            }
            
            return response.json();
        })
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
                
                throw new Error(data.error || 'Unknown error recording usage');
            }
        })
        .catch(error => {
            console.error("Error recording route usage:", error);
            
            // Implement retry mechanism
            if (retryCount < window.maxRetries) {
                // Exponential backoff
                const delay = window.retryDelay * Math.pow(2, retryCount);
                console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${window.maxRetries})`);
                
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(window.recordRouteUsage(retryCount + 1));
                    }, delay);
                });
            }
            
            // After max retries, still allow the operation to proceed
            // but mark it as potentially not tracked
            console.warn("Max retries reached - operation will proceed but may not be tracked");
            window.routeUsageWarningShown = true;
            
            // Show a warning to the user
            showTrackingWarning();
            
            return { 
                success: false, 
                error: error.message,
                untracked: true
            };
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
        
        // Update any text showing the count
        const routeCountTexts = document.querySelectorAll('.routes-used-text');
        routeCountTexts.forEach(element => {
            element.textContent = `${routesUsed} of ${maxRoutes}`;
        });
    }
    
    // Function to handle route limit reached error
    function handleRouteLimitReached(data) {
        const errorMessage = data.error || 'You have reached your route creation limit for this billing period.';
        
        // Show a modal or alert with the error
        if (window.showLimitReachedModal) {
            window.showLimitReachedModal(errorMessage, data.redirect || '/pricing');
        } else {
            // Fallback to simple confirm dialog
            if (confirm(`${errorMessage}\n\nWould you like to view upgrade options?`)) {
                window.location.href = data.redirect || '/pricing';
            }
        }
    }
    
    // Show warning when tracking fails
    function showTrackingWarning() {
        if (window.routeUsageWarningShown) return; // Only show once
        
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning alert-dismissible fade show mt-3';
        alertDiv.innerHTML = `
            <strong>Warning:</strong> We couldn't record this route creation. Your usage limit may not be updated correctly.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Find a container to show the alert
        const container = document.querySelector('.container') || document.body;
        container.prepend(alertDiv);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 10000);
    }
    
    // Function to check subscription limits for drivers/vehicles with improved error handling
    window.checkDriverLimit = function(requestedDrivers) {
        return fetch('/check_driver_limit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                max_vehicles: requestedDrivers
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
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
            
            // Default to allowing with warning
            showTrackingWarning();
            
            return {
                allowed: true, 
                maxAllowed: requestedDrivers,
                error: error.message,
                warning: "Limit check failed, proceeding with requested value"
            };
        });
    };
    
    // Modal for limit reached errors
    window.showLimitReachedModal = function(message, redirectUrl) {
        // Create modal element if it doesn't exist
        let modalEl = document.getElementById('limitReachedModal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'limitReachedModal';
            modalEl.className = 'modal fade';
            modalEl.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Route Limit Reached
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="limitReachedModalBody">
                            ${message}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <a href="${redirectUrl}" class="btn btn-primary">View Upgrade Options</a>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        } else {
            // Update existing modal content
            document.getElementById('limitReachedModalBody').textContent = message;
            modalEl.querySelector('.modal-footer a').href = redirectUrl;
        }
        
        // Show the modal
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };
    
    // Intercept solver calls to record usage
    if (typeof window.runClientSideSolver === 'function') {
        const originalRunClientSideSolver = window.runClientSideSolver;
        
        window.runClientSideSolver = function(params, jobId) {
            console.log("Intercepted client-side solver call to enforce limits and track usage");
            
            // First check driver limit
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
                            // If usage recording succeeded or we're proceeding despite potential tracking issues
                            if (usageResult.success || usageResult.untracked) {
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
        
        console.log("Successfully intercepted client-side solver function with enhanced tracking");
    }
    
    console.log("Enhanced route usage tracking system loaded");
});
