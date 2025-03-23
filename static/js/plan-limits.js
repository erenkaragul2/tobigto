// plan-limits.js
// Add this to your static/js/ folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing plan-based vehicle limits...");
    
    // Function to get user's subscription limits
    function getUserLimits() {
        return fetch('/subscription/status')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.subscription) {
                    console.log("Retrieved user subscription limits:", data.subscription);
                    return {
                        maxDrivers: data.subscription.max_drivers || 3,
                        isPro: !!data.subscription.plan_id,
                        planName: data.subscription.plan_name || 'Trial'
                    };
                }
                // Default values if no subscription data
                return { maxDrivers: 3, isPro: false, planName: 'Trial' };
            })
            .catch(error => {
                console.error("Error fetching user limits:", error);
                return { maxDrivers: 3, isPro: false, planName: 'Trial' }; // Safe default
            });
    }
    
    // Function to apply limits to the max vehicles input
    function applyDriverLimits(limits) {
        const maxVehiclesInput = document.getElementById('maxVehiclesInput');
        if (!maxVehiclesInput) return;
        
        // Set the max attribute
        maxVehiclesInput.setAttribute('max', limits.maxDrivers);
        
        // If current value exceeds limit, reduce it
        const currentValue = parseInt(maxVehiclesInput.value);
        if (currentValue > limits.maxDrivers) {
            maxVehiclesInput.value = limits.maxDrivers;
        }
        
        // Add helper text showing the limit
        const helpText = document.createElement('div');
        helpText.className = 'form-text';
        helpText.innerHTML = `Your ${limits.planName} plan allows a maximum of <strong>${limits.maxDrivers}</strong> drivers.`;
        
        // Add a container for the help text if not already present
        let helpContainer = maxVehiclesInput.nextElementSibling;
        if (!helpContainer || !helpContainer.classList.contains('form-text')) {
            helpContainer = document.createElement('div');
            helpContainer.className = 'form-text';
            maxVehiclesInput.parentNode.insertBefore(helpContainer, maxVehiclesInput.nextSibling);
        }
        
        helpContainer.innerHTML = helpText.innerHTML;
        
        // Add visual indicator - Change the input color based on how close to the limit
        maxVehiclesInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            const max = parseInt(this.getAttribute('max'));
            
            // Remove any existing classes
            this.classList.remove('is-invalid', 'border-warning');
            
            if (value > max) {
                // Over limit - make it red
                this.classList.add('is-invalid');
                this.value = max; // Enforce the limit
                
                // Show a message
                helpContainer.innerHTML = `<span class="text-danger">
                    Maximum ${max} drivers allowed on your ${limits.planName} plan.
                    <a href="/subscription/pricing" class="ms-1">Upgrade plan?</a>
                </span>`;
            } else if (value === max) {
                // At limit - give a warning color
                this.classList.add('border-warning');
                
                // Show a message
                helpContainer.innerHTML = `<span class="text-warning">
                    You've reached your maximum of ${max} drivers.
                    <a href="/subscription/pricing" class="ms-1">Upgrade for more?</a>
                </span>`;
            } else {
                // Under limit - normal
                helpContainer.innerHTML = `Your ${limits.planName} plan allows a maximum of <strong>${max}</strong> drivers.`;
            }
        });
        
        console.log(`Applied driver limit of ${limits.maxDrivers} to max vehicles input`);
    }
    
    // Initialize when on solver page
    function initVehicleLimits() {
        const maxVehiclesInput = document.getElementById('maxVehiclesInput');
        if (!maxVehiclesInput) return; // Not on the solver page
        
        // Get and apply user limits
        getUserLimits().then(applyDriverLimits);
    }
    
    // Run initialization
    initVehicleLimits();
});