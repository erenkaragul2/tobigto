// Function to add console logging capability for the distance matrix
function addConsoleMatrixLogger() {
    // Find the toggle matrix button container
    const toggleBtnContainer = document.querySelector('.card-header:has(#toggleMatrixBtn)');
    
    if (!toggleBtnContainer) {
        console.error('Toggle matrix button container not found');
        return;
    }
    
    // Create console log button
    const consoleLogBtn = document.createElement('button');
    consoleLogBtn.id = 'consoleLogMatrixBtn';
    consoleLogBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
    consoleLogBtn.innerHTML = '<i class="fas fa-terminal me-1"></i>Log Matrix to Console';
    
    // Add button next to toggle button
    toggleBtnContainer.appendChild(consoleLogBtn);
    
    // Add click event listener
    consoleLogBtn.addEventListener('click', logMatrixToConsole);
}

// Function to log the distance matrix to the console
function logMatrixToConsole() {
    console.log('Fetching distance matrix for console logging...');
    
    // Fetch the matrix data from server
    fetch('/get_distance_matrix')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const matrix = data.matrix;
                const numNodes = matrix.length;
                const nodeLabels = data.node_labels || Array.from({length: numNodes}, (_, i) => `Node ${i}`);
                const distanceType = data.distance_type || 'Euclidean';
                
                // Log general info
                console.log(`%c Distance Matrix (${distanceType}) - ${numNodes} nodes`, 'font-weight: bold; font-size: 14px; color: #0066cc;');
                
                // Create a table representation for the console
                console.log('%cRaw Matrix Data (in meters):', 'font-weight: bold;');
                console.table(matrix);
                
                // Create a formatted matrix with km values
                const formattedMatrix = matrix.map(row => 
                    row.map(value => value === 0 ? '0.00' : (value / 1000).toFixed(2) + ' km')
                );
                
                console.log('%cFormatted Matrix Data (in kilometers):', 'font-weight: bold;');
                
                // Create an object with node labels as keys for better console.table display
                const labeledMatrix = formattedMatrix.map((row, i) => {
                    const rowObj = { 'From': nodeLabels[i] || `Node ${i}` };
                    row.forEach((value, j) => {
                        rowObj[nodeLabels[j] || `Node ${j}`] = value;
                    });
                    return rowObj;
                });
                
                console.table(labeledMatrix);
                
                // Create CSV format that can be copied to spreadsheet
                let csvContent = "From/To," + nodeLabels.join(",") + "\n";
                matrix.forEach((row, i) => {
                    csvContent += (nodeLabels[i] || `Node ${i}`) + "," + 
                        row.map(val => (val / 1000).toFixed(2)).join(",") + "\n";
                });
                
                console.log('%cCSV Format (copy and paste to spreadsheet):', 'font-weight: bold;');
                console.log(csvContent);
                
                // Add instructions for copying
                console.log('%cTip: To export this data, right-click on the matrix above and select "Copy" or use the CSV format provided.', 'font-style: italic; color: #666;');
            } else {
                console.error('Error fetching matrix data:', data.error || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error fetching matrix data:', error);
        });
}

// Add the console matrix logger when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a short time to ensure other elements are loaded
    setTimeout(addConsoleMatrixLogger, 1000);
});