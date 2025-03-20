// Enhanced route usage tracking system
// Replace or update the existing vercel-tracking-fix.js file with this code

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced route usage tracking system");
    
    // Flag to track if we've already recorded usage for the current session
    window.routeUsageRecorded = false;
    // Track pending recording attempts
    window.pendingRecordingAttempt = null;
    
    // Function to record route usage via API call with retry logic
    window.recordRouteUsage = function(retryCount = 0) {
        // If already recording, return the pending promise
        if (window.pendingRecordingAttempt) {
            console.log("Route usage recording already in progress, returning pending promise");
            return window.pendingRecordingAttempt;
        }
        
        // Check if we've already recorded usage for this session
        if (window.routeUsageRecorded) {
            console.log("Route usage already recorded for this session");
            return Promise.resolve({ success: true, alreadyRecorded: true });
        }
        
        console.log("Recording route usage via API");
        
        // Create a timestamp for debugging
        const timestamp = new Date().toISOString();
        const sessionId = Math.random().toString(36).substring(2, 15);
        
        // Prepare request with additional metadata for debugging
        const requestData = {
            client_side: true,
            timestamp: timestamp,
            browser: navigator.userAgent,
            session_id: sessionId
        };
        
        // Create the promise and store it
        window.pendingRecordingAttempt = new Promise((resolve, reject) => {
            // Make API call to record route usage
            fetch('/record_route_usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(requestData)
            })
            .then(response => {
                // Handle non-JSON responses
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    // If not JSON, create a standardized error response
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    return { success: true, message: "Server returned non-JSON success response" };
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log("Route usage recorded successfully", data);
                    window.routeUsageRecorded = true;
                    
                    // Update any UI elements showing route usage
                    updateRouteUsageDisplay(data.routes_used, data.max_routes);
                    
                    resolve(data);
                } else {
                    console.error("Failed to record route usage:", data.error);
                    
                    // Check if this is a limit reached error
                    if (data.limit_reached) {
                        handleRouteLimitReached(data);
                        reject(new Error("Route limit reached"));
                    } else {
                        reject(new Error(data.error || 'Unknown error recording usage'));
                    }
                }
            })
            .catch(error => {
                console.error("Error recording route usage:", error);
                
                // Implement retry mechanism
                if (retryCount < 3) {
                    console.log(`Retrying route usage recording (attempt ${retryCount + 1}/3)`);
                    
                    // Clear the pending promise
                    window.pendingRecordingAttempt = null;
                    
                    // Wait and retry
                    setTimeout(() => {
                        window.recordRouteUsage(retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000 * Math.pow(2, retryCount)); // Exponential backoff
                } else {
                    // Log failure but allow operation to continue
                    showTrackingWarning();
                    
                    // Despite the error, let's consider it a "success" from the flow perspective
                    // but mark it as untracked
                    resolve({ 
                        success: false, 
                        error: error.message,
                        untracked: true
                    });
                }
            })
            .finally(() => {
                // Clear the pending promise reference when done
                window.pendingRecordingAttempt = null;
            });
        });
        
        return window.pendingRecordingAttempt;
    };
    
    // Function to update UI elements showing route usage
    function updateRouteUsageDisplay(routesUsed, maxRoutes) {
        if (typeof routesUsed !== 'number' || typeof maxRoutes !== 'number') {
            console.warn("Invalid data for updateRouteUsageDisplay", { routesUsed, maxRoutes });
            return;
        }
        
        // Find elements that display route usage
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
        if (window.bootstrap && typeof bootstrap.Modal !== 'undefined') {
            // Use Bootstrap modal if available
            let modalEl = document.getElementById('limitReachedModal');
            
            if (!modalEl) {
                // Create modal if it doesn't exist
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
                                ${errorMessage}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <a href="${data.redirect || '/pricing'}" class="btn btn-primary">View Upgrade Options</a>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalEl);
            } else {
                // Update existing modal
                document.getElementById('limitReachedModalBody').textContent = errorMessage;
            }
            
            // Show the modal
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            // Fallback to simple confirm dialog
            if (confirm(`${errorMessage}\n\nWould you like to view upgrade options?`)) {
                window.location.href = data.redirect || '/pricing';
            }
        }
    }
    
    // Show warning when tracking fails
    function showTrackingWarning() {
        // Create an alert div to show the warning
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning alert-dismissible fade show mt-3';
        alertDiv.innerHTML = `
            <strong>Warning:</strong> We couldn't record this route creation. Your usage limit may not be updated correctly.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Find a suitable container to display the alert
        const container = document.querySelector('.container') || document.body;
        if (container.firstChild) {
            container.insertBefore(alertDiv, container.firstChild);
        } else {
            container.appendChild(alertDiv);
        }
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 10000);
    }
    
    // Intercept solver calls to record usage
    if (typeof window.runClientSideSolver === 'function') {
        const originalRunClientSideSolver = window.runClientSideSolver;
        
        window.runClientSideSolver = function(params, jobId) {
            console.log("Intercepted client-side solver call to enforce limits and track usage");
            
            // First check driver limit, then record usage, then solve
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
                    
                    // Next, record route usage before solving
                    return window.recordRouteUsage();
                })
                .then(usageResult => {
                    console.log("Route usage recording result:", usageResult);
                    
                    // If usage recording succeeded or we're proceeding despite potential tracking issues
                    if (usageResult.success || usageResult.untracked) {
                        // Run the original solver
                        originalRunClientSideSolver(params, jobId);
                    } else {
                        console.error("Failed to record usage, not running solver");
                        
                        // Reset solve button
                        const solveBtn = document.getElementById('solveBtn');
                        if (solveBtn) {
                            solveBtn.disabled = false;
                            solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                        }
                        
                        // Hide progress container
                        const solverProgressContainer = document.getElementById('solverProgressContainer');
                        if (solverProgressContainer) {
                            solverProgressContainer.style.display = 'none';
                        }
                    }
                })
                .catch(error => {
                    console.error("Error in solver chain:", error);
                    
                    // Show error message
                    const solveInfoAlert = document.getElementById('solveInfoAlert');
                    if (solveInfoAlert) {
                        solveInfoAlert.innerHTML = `
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-circle me-2"></i>
                                ${error.message || "An error occurred while processing your request."}
                            </div>
                        `;
                        solveInfoAlert.style.display = 'block';
                    }
                    
                    // Reset solve button
                    const solveBtn = document.getElementById('solveBtn');
                    if (solveBtn) {
                        solveBtn.disabled = false;
                        solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                    }
                    
                    // Hide progress container
                    const solverProgressContainer = document.getElementById('solverProgressContainer');
                    if (solverProgressContainer) {
                        solverProgressContainer.style.display = 'none';
                    }
                });
        };
        
        console.log("Successfully intercepted client-side solver function");
    } else {
        console.warn("Could not find runClientSideSolver function to intercept");
    }
    
    console.log("Enhanced route usage tracking system loaded");
});