// dashboard-refresh.js
// Add this to your static/js folder and include it in dashboard.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing dashboard refresh functionality...");
    
    // Add refresh button to the usage stats card
    function addRefreshButton() {
        // Find the usage stats section
        const usageStatsCard = document.querySelector('.card:has(.route-usage-count)');
        if (!usageStatsCard) return;
        
        const cardHeader = usageStatsCard.querySelector('.card-header');
        if (!cardHeader) return;
        
        // Check if button already exists
        if (cardHeader.querySelector('#refreshStatsBtn')) return;
        
        // Create a flexbox wrapper for the header content
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex justify-content-between align-items-center w-100';
        
        // Move existing content to wrapper
        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = cardHeader.innerHTML;
        wrapper.appendChild(titleDiv);
        
        // Create refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshStatsBtn';
        refreshBtn.className = 'btn btn-sm btn-outline-primary';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        refreshBtn.title = 'Refresh usage statistics';
        
        // Add click event
        refreshBtn.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            
            refreshUsageStats()
                .then(() => {
                    this.disabled = false;
                    this.innerHTML = '<i class="fas fa-sync-alt"></i>';
                })
                .catch(() => {
                    this.disabled = false;
                    this.innerHTML = '<i class="fas fa-sync-alt"></i>';
                });
        });
        
        wrapper.appendChild(refreshBtn);
        
        // Replace card header content
        cardHeader.innerHTML = '';
        cardHeader.appendChild(wrapper);
        
        console.log("Refresh button added to usage stats card");
    }
    
    // Enhanced refreshUsageStats function with better error handling
    window.refreshUsageStats = function() {
        console.log("Refreshing usage statistics...");
        
        return fetch('/subscription/status')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success && data.subscription) {
                    console.log("Received fresh subscription data");
                    updateUsageDisplay(data.subscription);
                    return true;
                } else {
                    console.warn("Received invalid subscription data:", data);
                    return false;
                }
            })
            .catch(error => {
                console.error("Error refreshing usage statistics:", error);
                
                // Try fallback endpoint
                return fetch('/get_current_usage')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.usage_stats) {
                            console.log("Received usage data from fallback endpoint");
                            updateUsageDisplay(data.usage_stats);
                            return true;
                        }
                        return false;
                    })
                    .catch(fallbackError => {
                        console.error("Fallback refresh also failed:", fallbackError);
                        return false;
                    });
            });
    };
    
    // Enhanced updateUsageDisplay function 
    function updateUsageDisplay(subscription) {
        // Update route usage count
        const routesUsed = subscription.routes_created || 0;
        const maxRoutes = subscription.max_routes || 5;
        
        // Update all elements showing route usage count
        document.querySelectorAll('.route-usage-count').forEach(element => {
            element.textContent = routesUsed;
        });
        
        // Update progress bars
        const percentage = Math.min(100, Math.round((routesUsed / maxRoutes) * 100));
        document.querySelectorAll('.route-usage-progress').forEach(progressBar => {
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', routesUsed);
            progressBar.setAttribute('aria-valuemax', maxRoutes);
        });
        
        // Update any text showing the count
        document.querySelectorAll('.routes-used-text').forEach(element => {
            element.textContent = `${routesUsed} of ${maxRoutes}`;
        });
        
        // Update algorithm credits display if available
        const creditsUsed = subscription.credits_used || 0;
        const maxCredits = subscription.max_credits || 10;
        
        document.querySelectorAll('.algorithm-credits').forEach(element => {
            element.textContent = `${creditsUsed}/${maxCredits}`;
        });
        
        // Update algorithm credits progress bar
        const creditsPercentage = Math.min(100, Math.round((creditsUsed / maxCredits) * 100));
        document.querySelectorAll('.credits-progress').forEach(progressBar => {
            progressBar.style.width = `${creditsPercentage}%`;
            progressBar.setAttribute('aria-valuenow', creditsUsed);
            progressBar.setAttribute('aria-valuemax', maxCredits);
        });
        
        console.log("Usage display updated with new data:", {
            routesUsed,
            maxRoutes,
            creditsUsed,
            maxCredits
        });
    }
    
    // Initialize dashboard enhancements
    function initDashboard() {
        // Add refresh button
        addRefreshButton();
        
        // Refresh stats immediately
        refreshUsageStats();
        
        // Set up interval to refresh stats periodically
        setInterval(refreshUsageStats, 60000); // Refresh every minute
        
        // Refresh when returning to page
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                refreshUsageStats();
            }
        });
        
        console.log("Dashboard enhancements initialized");
    }
    
    // Run initialization
    initDashboard();
});