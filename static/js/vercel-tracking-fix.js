// Enhanced client-side usage tracking system
// Replace the existing content in vercel-tracking-fix.js with this code

document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced route usage tracking system (v2)");
    
    // Flag to track if we've already recorded usage for the current session
    window.routeUsageRecorded = false;
    // Track pending recording attempts
    window.pendingRecordingAttempt = null;
    
    // Function to record route usage via API call with improved retry logic
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
                body: JSON.stringify(requestData),
                // Add credentials to ensure cookies are sent
                credentials: 'same-origin'
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
                    
                    // Save record in localStorage as backup
                    try {
                        localStorage.setItem('lastRecordedUsage', JSON.stringify({
                            timestamp: new Date().toISOString(),
                            routes_used: data.routes_used,
                            max_routes: data.max_routes
                        }));
                    } catch (e) {
                        console.warn("Could not save to localStorage:", e);
                    }
                    
                    // Update any UI elements showing route usage
                    updateRouteUsageDisplay(data.routes_used, data.max_routes);
                    
                    resolve(data);
                } else {
                    console.error("Failed to record route usage:", data.error);
                    
                    // Check if this is a limit reached error
                    if (data.limit_reached) {
                        handleRouteLimitReached(data);
                        reject(new Error("Route limit reached"));
                    } 
                    // Check if server scheduled a retry
                    else if (data.retry_scheduled) {
                        console.log("Server scheduled a retry for next request");
                        // Mark as tentatively successful since server will retry
                        window.routeUsageRecorded = true;
                        resolve({
                            success: true,
                            message: "Server will retry on next request",
                            retryScheduled: true
                        });
                    } 
                    else {
                        reject(new Error(data.error || 'Unknown error recording usage'));
                    }
                }
            })
            .catch(error => {
                console.error("Error recording route usage:", error);
                
                // Implement retry mechanism with exponential backoff
                if (retryCount < 3) {
                    console.log(`Retrying route usage recording (attempt ${retryCount + 1}/3)`);
                    
                    // Clear the pending promise
                    window.pendingRecordingAttempt = null;
                    
                    // Wait with exponential backoff and retry
                    const backoffTime = 1000 * Math.pow(2, retryCount);
                    console.log(`Waiting ${backoffTime}ms before retry`);
                    
                    setTimeout(() => {
                        window.recordRouteUsage(retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, backoffTime);
                } else {
                    // Try one last fallback - store in localStorage for recovery
                    try {
                        localStorage.setItem('pendingUsageRecord', JSON.stringify({
                            timestamp: new Date().toISOString(),
                            retryCount: retryCount,
                            error: error.message,
                            requestData: requestData
                        }));
                        console.log("Stored pending usage record in localStorage for recovery");
                        
                        // Show warning to the user
                        showTrackingWarning();
                        
                        // Despite the error, let's consider it a "success" from the flow perspective
                        // but mark it as untracked
                        resolve({ 
                            success: false, 
                            error: error.message,
                            untracked: true,
                            fallbackStorage: true
                        });
                    } catch (storageError) {
                        console.error("Failed to store in localStorage:", storageError);
                        
                        // Show more severe warning
                        showTrackingError();
                        
                        // We've tried everything, consider it a failure
                        reject(new Error("Failed to record usage after all attempts"));
                    }
                }
            })
            .finally(() => {
                // Clear the pending promise reference when done
                window.pendingRecordingAttempt = null;
            });
        });
        
        return window.pendingRecordingAttempt;
    };
    window.recordAlgorithmRun = function() {
        console.log("Recording algorithm run...");
        
        // If already recorded in this session, don't record again
        if (window.algorithmRunRecorded) {
            console.log("Algorithm run already recorded for this session");
            return Promise.resolve({
                success: true,
                alreadyRecorded: true
            });
        }
        
        // Record the algorithm run
        return fetch('/record_algorithm_run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            console.log("Algorithm run response status:", response.status);
            return response.json();
        })
        .then(data => {
            console.log("Algorithm run response:", data);
            
            if (data.success) {
                // Mark as recorded for this session
                window.algorithmRunRecorded = true;
                
                // Update credits display if it exists
                updateCreditsDisplay(data.credits_used, data.max_credits);
            }
            
            return data;
        })
        .catch(error => {
            console.error("Error recording algorithm run:", error);
            return {
                success: false,
                error: error.message
            };
        });
    };
    
    // Helper function to update credits display
    function updateCreditsDisplay(used, max) {
        const creditsElements = document.querySelectorAll('.algorithm-credits');
        creditsElements.forEach(element => {
            element.textContent = `${used}/${max}`;
        });
        
        const progressBars = document.querySelectorAll('.credits-progress');
        progressBars.forEach(bar => {
            const percentage = Math.min(100, Math.round((used / max) * 100));
            bar.style.width = `${percentage}%`;
        });
    }
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
                modalEl.setAttribute('tabindex', '-1');
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
    
    // Show more severe error when all tracking attempts fail
    function showTrackingError() {
        // Create an alert div to show the error
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show mt-3';
        alertDiv.innerHTML = `
            <strong>Error:</strong> We couldn't record your route usage after multiple attempts. Please reload the page and try again.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Find a suitable container to display the alert
        const container = document.querySelector('.container') || document.body;
        if (container.firstChild) {
            container.insertBefore(alertDiv, container.firstChild);
        } else {
            container.appendChild(alertDiv);
        }
    }
    
    // Check for and try to recover any pending usage records on page load
    function checkForPendingUsageRecords() {
        try {
            const pendingRecord = localStorage.getItem('pendingUsageRecord');
            if (pendingRecord) {
                const record = JSON.parse(pendingRecord);
                const recordAge = new Date() - new Date(record.timestamp);
                
                // Only attempt recovery for records less than 24 hours old
                if (recordAge < 24 * 60 * 60 * 1000) {
                    console.log("Found pending usage record, attempting recovery");
                    
                    // Clear the record immediately to prevent multiple attempts
                    localStorage.removeItem('pendingUsageRecord');
                    
                    // Try to record it now
                    window.recordRouteUsage();
                } else {
                    // Record is too old, just remove it
                    console.log("Found stale pending usage record, removing");
                    localStorage.removeItem('pendingUsageRecord');
                }
            }
        } catch (e) {
            console.error("Error checking for pending usage records:", e);
        }
    }
    
    // Intercept solver calls to record usage
    if (typeof window.runClientSideSolver === 'function') {
        const originalRunClientSideSolver = window.runClientSideSolver;
        
        window.runClientSideSolver = function(params, jobId) {
            console.log("Intercepted client-side solver call to enforce limits and track usage");
            
            // First record usage, then run solver
            window.recordRouteUsage()
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
                    console.error("Error recording usage:", error);
                    
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
    
    // Run recovery checks on page load
    checkForPendingUsageRecords();
    
    console.log("Enhanced route usage tracking system loaded");
});