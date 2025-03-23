// enhanced-vehicle-input.js
// Add this to your static/js/ folder and include it in your index.html

document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing enhanced vehicle input...");
    
    // Function to enhance the max vehicles input
    function enhanceVehicleInput() {
        const maxVehiclesInput = document.getElementById('maxVehiclesInput');
        if (!maxVehiclesInput) return;
        
        // First, get the user's plan limits
        fetch('/get_user_limits')
            .then(response => response.json())
            .then(data => {
                if (!data.success) return;
                
                const maxDrivers = data.max_drivers || 3;
                const planName = data.plan_name || 'Trial';
                const isTrial = data.is_trial || false;
                
                // Create a container for the enhanced input
                const container = document.createElement('div');
                container.className = 'vehicle-input-container mt-2';
                
                // Replace the existing input with our enhanced version
                const originalInput = maxVehiclesInput;
                const parent = originalInput.parentNode;
                
                // Create a wrapper with a range slider and number input
                container.innerHTML = `
                    <div class="d-flex align-items-center vehicle-input-group">
                        <input type="range" class="form-range flex-grow-1 me-2" 
                               id="vehicleSlider" min="1" max="${maxDrivers}" 
                               value="${Math.min(originalInput.value, maxDrivers)}" step="1">
                        <input type="number" class="form-control" style="width: 80px"
                               id="vehicleNumber" min="1" max="${maxDrivers}"
                               value="${Math.min(originalInput.value, maxDrivers)}">
                    </div>
                    <div class="vehicle-limit-indicator mt-2 mb-3">
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar bg-primary vehicle-progress" role="progressbar" 
                                 style="width: ${(Math.min(originalInput.value, maxDrivers) / maxDrivers) * 100}%" 
                                 aria-valuenow="${Math.min(originalInput.value, maxDrivers)}" 
                                 aria-valuemin="1" aria-valuemax="${maxDrivers}"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small>1</small>
                            <small class="text-center">
                                <span class="badge ${isTrial ? 'bg-warning' : 'bg-primary'}">
                                    ${planName} Plan: ${maxDrivers} drivers max
                                </span>
                            </small>
                            <small>${maxDrivers}</small>
                        </div>
                    </div>
                `;
                
                // Insert after the label
                parent.insertBefore(container, originalInput.nextSibling);
                
                // Hide original input but keep it for form submission
                originalInput.style.display = 'none';
                
                // Set up event handlers for the slider and number input
                const slider = document.getElementById('vehicleSlider');
                const number = document.getElementById('vehicleNumber');
                const progress = container.querySelector('.vehicle-progress');
                
                // Slider changes number
                slider.addEventListener('input', function() {
                    const value = parseInt(this.value);
                    number.value = value;
                    originalInput.value = value;
                    updateProgress(value);
                });
                
                // Number changes slider
                number.addEventListener('input', function() {
                    let value = parseInt(this.value);
                    
                    // Ensure value is within bounds
                    if (isNaN(value) || value < 1) value = 1;
                    if (value > maxDrivers) value = maxDrivers;
                    
                    this.value = value;
                    slider.value = value;
                    originalInput.value = value;
                    updateProgress(value);
                });
                
                // Function to update progress bar
                function updateProgress(value) {
                    const percentage = (value / maxDrivers) * 100;
                    progress.style.width = `${percentage}%`;
                    progress.setAttribute('aria-valuenow', value);
                    
                    // Change color based on how close to limit
                    if (value === maxDrivers) {
                        progress.className = 'progress-bar bg-warning';
                    } else if (value > maxDrivers * 0.8) {
                        progress.className = 'progress-bar bg-info';
                    } else {
                        progress.className = 'progress-bar bg-primary';
                    }
                }
                
                console.log(`Enhanced vehicle input with max drivers: ${maxDrivers}`);
                
                // Add an upgrade prompt if on trial or lower tier plan
                if (isTrial || maxDrivers < 24) {
                    const upgradePrompt = document.createElement('div');
                    upgradePrompt.className = 'text-center mt-3 mb-3';
                    upgradePrompt.innerHTML = `
                        <a href="/subscription/pricing" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-arrow-up me-1"></i> Upgrade your plan for more drivers
                        </a>
                    `;
                    container.appendChild(upgradePrompt);
                }
            })
            .catch(error => {
                console.error("Error enhancing vehicle input:", error);
            });
    }
    
    // Initialize on the config tab
    const configTab = document.getElementById('config-tab');
    if (configTab) {
        // Apply enhancement when the config tab is shown
        configTab.addEventListener('shown.bs.tab', function() {
            enhanceVehicleInput();
        });
        
        // Also check if config tab is already active
        if (configTab.classList.contains('active')) {
            enhanceVehicleInput();
        }
    }
});