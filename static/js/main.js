document.addEventListener('DOMContentLoaded', function() {
    // Global state
    const appState = {
        dataLoaded: false,
        dataProcessed: false,
        solving: false,
        solutionReady: false,
        jobId: null,
        coordinates: null,
        company_names: null,
        demands: null
    };

    // UI Elements
    const ui = {
        // Tabs
        dataTabs: {
            data: document.getElementById('data-tab'),
            config: document.getElementById('config-tab'),
            solve: document.getElementById('solve-tab'),
            results: document.getElementById('results-tab')
        },
        
        // Data Input
        fileInput: document.getElementById('fileInput'),
        uploadBtn: document.getElementById('uploadBtn'),
        generateRandomBtn: document.getElementById('generateRandomBtn'),
        randomNodesInput: document.getElementById('randomNodesInput'),
        randomDepotInput: document.getElementById('randomDepotInput'),
        randomCapacityInput: document.getElementById('randomCapacityInput'),
        dataPreviewContainer: document.getElementById('dataPreviewContainer'),
        
        // Configuration
        depotInput: document.getElementById('depotInput'),
        capacityInput: document.getElementById('capacityInput'),
        processDataBtn: document.getElementById('processDataBtn'),
        initialTempInput: document.getElementById('initialTempInput'),
        finalTempInput: document.getElementById('finalTempInput'),
        coolingRateInput: document.getElementById('coolingRateInput'),
        maxIterInput: document.getElementById('maxIterInput'),
        iterPerTempInput: document.getElementById('iterPerTempInput'),
        
        // Solve
        solveBtn: document.getElementById('solveBtn'),
        solveInfoAlert: document.getElementById('solveInfoAlert'),
        solverProgressContainer: document.getElementById('solverProgressContainer'),
        solverProgressBar: document.getElementById('solverProgressBar'),
        solverStatusMessage: document.getElementById('solverStatusMessage'),
        liveUpdatesContainer: document.getElementById('liveUpdatesContainer'),
        
        // Results
        solutionContainer: document.getElementById('solutionContainer'),
        mapContainer: document.getElementById('mapContainer'),
        convergencePlotContainer: document.getElementById('convergencePlotContainer'),
        routeDetailsContainer: document.getElementById('routeDetailsContainer')
    };

    // Attach event listeners
    ui.uploadBtn.addEventListener('click', uploadFile);
    ui.generateRandomBtn.addEventListener('click', generateRandomProblem);
    ui.processDataBtn.addEventListener('click', processData);
    ui.solveBtn.addEventListener('click', solveProblem);

    // Initialize tabs
    const tabTriggers = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabTriggers.forEach(tabTrigger => {
        tabTrigger.addEventListener('shown.bs.tab', event => {
            const tabId = event.target.id;
            // Handle tab switching logic
            if (tabId === 'solve-tab') {
                updateSolveTab();
            }
        });
    });

    // Function to upload a file
    function uploadFile() {
        if (!ui.fileInput.files.length) {
            showAlert(ui.dataPreviewContainer, 'Please select a file to upload', 'danger');
            return;
        }

        const file = ui.fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        // Show loading state
        showAlert(ui.dataPreviewContainer, 'Uploading file...', 'info');
        ui.uploadBtn.disabled = true;
        ui.uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            ui.uploadBtn.disabled = false;
            ui.uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';

            if (data.success) {
                appState.dataLoaded = true;
                // Show data preview
                showDataPreview(data);
                // Update UI state
                updateUIState();
                // Show success message
                showAlert(ui.dataPreviewContainer, data.message, 'success', false);
            } else {
                showAlert(ui.dataPreviewContainer, data.error, 'danger');
            }
        })
        .catch(error => {
            ui.uploadBtn.disabled = false;
            ui.uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';
            showAlert(ui.dataPreviewContainer, 'Error uploading file: ' + error, 'danger');
        });
    }
        // Distance calculation type toggle
    document.querySelectorAll('input[name="distanceType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const googleMapsOptions = document.getElementById('googleMapsOptions');
            if (this.value === 'google') {
                googleMapsOptions.style.display = 'block';
            } else {
                googleMapsOptions.style.display = 'none';
            }
        });
    });

    // Function to generate a random problem
    function generateRandomProblem() {
        const numNodes = parseInt(ui.randomNodesInput.value) || 10;
        const depot = parseInt(ui.randomDepotInput.value) || 0;
        const capacity = parseInt(ui.randomCapacityInput.value) || 20;

        if (depot < 0 || depot >= numNodes) {
            showAlert(ui.dataPreviewContainer, 'Depot index must be between 0 and num_nodes-1', 'danger');
            return;
        }

        // Show loading state
        showAlert(ui.dataPreviewContainer, 'Generating random problem...', 'info');
        ui.generateRandomBtn.disabled = true;
        ui.generateRandomBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';

        fetch('/generate_random', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                num_nodes: numNodes,
                depot: depot,
                vehicle_capacity: capacity
            })
        })
        .then(response => response.json())
        .then(data => {
            ui.generateRandomBtn.disabled = false;
            ui.generateRandomBtn.innerHTML = '<i class="fas fa-random me-2"></i>Generate Random Problem';

            if (data.success) {
                appState.dataLoaded = true;
                appState.dataProcessed = true;
                appState.coordinates = data.coordinates;
                appState.company_names = data.company_names;
                appState.demands = data.demands;
                
                // Show data preview
                showRandomDataPreview(data);
                
                // Update UI state
                updateUIState();
                
                // Automatically switch to configuration tab
                ui.dataTabs.config.click();
                
                // Set values in configuration
                ui.depotInput.value = depot;
                ui.capacityInput.value = capacity;
                
                // Show success message
                showAlert(ui.solveInfoAlert, 'Random problem generated and processed successfully. You can now solve it.', 'success');
            } else {
                showAlert(ui.dataPreviewContainer, data.error, 'danger');
            }
        })
        .catch(error => {
            ui.generateRandomBtn.disabled = false;
            ui.generateRandomBtn.innerHTML = '<i class="fas fa-random me-2"></i>Generate Random Problem';
            showAlert(ui.dataPreviewContainer, 'Error generating random problem: ' + error, 'danger');
        });
    }

    // Function to process uploaded data
    function processData() {
        if (!appState.dataLoaded) {
            showAlert(ui.solveInfoAlert, 'Please upload data first', 'danger');
            return;
        }
    
        const depot = parseInt(ui.depotInput.value) || 0;
        const capacity = parseInt(ui.capacityInput.value) || 20;
        
        // Get selected distance calculation method
        const useGoogleMaps = document.getElementById('distanceGoogle').checked;
        
        // Get Google Maps specific options if selected
        let googleMapsOptions = {};
        if (useGoogleMaps) {
            googleMapsOptions = {
                mode: document.getElementById('travelModeInput').value,
                avoid: Array.from(document.getElementById('avoidInput').selectedOptions)
                         .map(option => option.value)
            };
        }
    
        // Show loading state
        ui.processDataBtn.disabled = true;
        ui.processDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
    
        fetch('/process_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                depot: depot,
                vehicle_capacity: capacity,
                use_google_maps: useGoogleMaps,
                google_maps_options: googleMapsOptions
            })
        })
        .then(response => response.json())
        .then(data => {
            ui.processDataBtn.disabled = false;
            ui.processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
    
            if (data.success) {
                appState.dataProcessed = true;
                
                // Show distance matrix preview
                showDistanceMatrixPreview(data);
                
                // Update UI state
                updateUIState();
                
                // Automatically switch to solve tab
                ui.dataTabs.solve.click();
                
                // Show success message
                showAlert(ui.solveInfoAlert, 'Data processed successfully. You can now solve the problem.', 'success');
            } else {
                showAlert(ui.solveInfoAlert, data.error, 'danger');
            }
        })
        .catch(error => {
            ui.processDataBtn.disabled = false;
            ui.processDataBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Process Data with These Settings';
            showAlert(ui.solveInfoAlert, 'Error processing data: ' + error, 'danger');
        });
    }

    // Function to solve the problem
    function solveProblem() {
        if (!appState.dataProcessed) {
            showAlert(ui.solveInfoAlert, 'Please process data first', 'danger');
            return;
        }

        // Get algorithm parameters
        const params = {
            initial_temperature: parseFloat(ui.initialTempInput.value) || 1000.0,
            final_temperature: parseFloat(ui.finalTempInput.value) || 1.0,
            cooling_rate: parseFloat(ui.coolingRateInput.value) || 0.98,
            max_iterations: parseInt(ui.maxIterInput.value) || 1000,
            iterations_per_temp: parseInt(ui.iterPerTempInput.value) || 100
        };

        // Show loading state
        ui.solveBtn.disabled = true;
        ui.solveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Starting Solver...';
        ui.solveInfoAlert.style.display = 'none';
        ui.solverProgressContainer.style.display = 'block';

        // Reset live updates container
        ui.liveUpdatesContainer.innerHTML = '<div class="text-muted">Starting solver...</div>';

        fetch('/solve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                appState.solving = true;
                appState.jobId = data.job_id;
                
                // Start polling for updates
                pollSolverStatus();
            } else {
                ui.solveBtn.disabled = false;
                ui.solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                showAlert(ui.solveInfoAlert, data.error, 'danger');
                ui.solverProgressContainer.style.display = 'none';
            }
        })
        .catch(error => {
            ui.solveBtn.disabled = false;
            ui.solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
            showAlert(ui.solveInfoAlert, 'Error starting solver: ' + error, 'danger');
            ui.solverProgressContainer.style.display = 'none';
        });
    }

    // Function to poll solver status
    function pollSolverStatus() {
        if (!appState.jobId) return;

        fetch(`/solver_status/${appState.jobId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update progress
                    ui.solverProgressBar.style.width = `${data.progress}%`;
                    ui.solverStatusMessage.textContent = data.message;

                    // Add updates to the live updates container
                    if (data.updates && data.updates.length > 0) {
                        updateLiveUpdates(data.updates);
                    }

                    // Check if solver is done
                    if (data.status === 'completed') {
                        appState.solving = false;
                        appState.solutionReady = true;
                        
                        // Update UI
                        ui.solveBtn.disabled = false;
                        ui.solveBtn.innerHTML = '<i class="fas fa-check me-2"></i>Solved!';
                        
                        // Get solution details
                        getSolution();
                        
                        // Add final update
                        addUpdate({
                            time: new Date().toLocaleTimeString(),
                            message: 'Solver completed successfully!'
                        });
                    }
                    else if (data.status === 'error') {
                        // Show error
                        appState.solving = false;
                        ui.solveBtn.disabled = false;
                        ui.solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                        showAlert(ui.solveInfoAlert, `Solver error: ${data.message}`, 'danger');
                    }
                    else {
                        // Continue polling
                        setTimeout(pollSolverStatus, 1000);
                    }
                } else {
                    // Show error
                    appState.solving = false;
                    ui.solveBtn.disabled = false;
                    ui.solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                    showAlert(ui.solveInfoAlert, data.error, 'danger');
                }
            })
            .catch(error => {
                // Show error
                appState.solving = false;
                ui.solveBtn.disabled = false;
                ui.solveBtn.innerHTML = '<i class="fas fa-play me-2"></i>Start Solving';
                showAlert(ui.solveInfoAlert, 'Error checking solver status: ' + error, 'danger');
            });
    }

    // Function to get solution details
    function getSolution() {
        if (!appState.jobId) return;

        fetch(`/get_solution/${appState.jobId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Display solution results
                    displaySolutionResults(data);
                    
                    // Automatically switch to results tab
                    ui.dataTabs.results.click();
                } else {
                    showAlert(ui.solveInfoAlert, data.error, 'danger');
                }
            })
            .catch(error => {
                showAlert(ui.solveInfoAlert, 'Error fetching solution: ' + error, 'danger');
            });
    }

    // Function to display data preview
    function showDataPreview(data) {
        // Clear previous content
        ui.dataPreviewContainer.innerHTML = '';
        
        // Create column info
        const columnInfo = document.createElement('div');
        columnInfo.classList.add('mb-3');
        columnInfo.innerHTML = `
            <h6>Detected Columns:</h6>
            <ul class="list-group">
                ${data.columns.map(col => `<li class="list-group-item">${col}</li>`).join('')}
            </ul>
        `;
        ui.dataPreviewContainer.appendChild(columnInfo);
        
        // Create data preview table
        if (data.previewData && data.previewData.length > 0) {
            const tableContainer = document.createElement('div');
            tableContainer.classList.add('table-responsive', 'mt-3');
            
            const table = document.createElement('table');
            table.classList.add('table', 'table-sm', 'table-bordered', 'data-table');
            
            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            // Get all possible columns from all rows (in case some rows have different fields)
            const allColumns = new Set();
            data.previewData.forEach(row => {
                Object.keys(row).forEach(key => allColumns.add(key));
            });
            
            // Create table headers for all columns
            Array.from(allColumns).forEach(key => {
                const th = document.createElement('th');
                th.textContent = key;
                headerRow.appendChild(th);
            });
            
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            
            // Add all data rows
            data.previewData.forEach(row => {
                const tr = document.createElement('tr');
                
                // For each column, either show the data or an empty cell
                Array.from(allColumns).forEach(key => {
                    const td = document.createElement('td');
                    // Check if the row has this column
                    if (row.hasOwnProperty(key)) {
                        td.textContent = row[key] !== null ? row[key] : '';
                    } else {
                        td.textContent = '';
                    }
                    tr.appendChild(td);
                });
                
                tbody.appendChild(tr);
            });
            
            table.appendChild(tbody);
            tableContainer.appendChild(table);
            ui.dataPreviewContainer.appendChild(tableContainer);
        }
    }

    // Function to show random data preview
    function showRandomDataPreview(data) {
        // Clear previous content
        ui.dataPreviewContainer.innerHTML = '';
        
        // Create info card
        const infoCard = document.createElement('div');
        infoCard.classList.add('card', 'mb-3');
        infoCard.innerHTML = `
            <div class="card-body">
                <h6 class="card-title">Generated Problem:</h6>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item">Nodes: ${data.nodes}</li>
                    <li class="list-group-item">Depot: ${data.company_names[0]}</li>
                    <li class="list-group-item">Vehicle Capacity: ${ui.randomCapacityInput.value}</li>
                </ul>
            </div>
        `;
        ui.dataPreviewContainer.appendChild(infoCard);
        
        // Create data preview
        const tableContainer = document.createElement('div');
        tableContainer.classList.add('table-responsive', 'mt-3');
        
        const table = document.createElement('table');
        table.classList.add('table', 'table-sm', 'table-bordered', 'data-table');
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Node', 'Name', 'Coordinates', 'Demand'].forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        for (let i = 0; i < data.nodes; i++) {
            const tr = document.createElement('tr');
            
            // Node index
            const tdIndex = document.createElement('td');
            tdIndex.textContent = i;
            tr.appendChild(tdIndex);
            
            // Company name
            const tdName = document.createElement('td');
            tdName.textContent = data.company_names[i];
            tr.appendChild(tdName);
            
            // Coordinates
            const tdCoords = document.createElement('td');
            tdCoords.textContent = `(${data.coordinates[i][0].toFixed(2)}, ${data.coordinates[i][1].toFixed(2)})`;
            tr.appendChild(tdCoords);
            
            // Demand
            const tdDemand = document.createElement('td');
            tdDemand.textContent = data.demands[i];
            tr.appendChild(tdDemand);
            
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        
        tableContainer.appendChild(table);
        ui.dataPreviewContainer.appendChild(tableContainer);
        
        // Show distance matrix preview
        const matrixContainer = document.createElement('div');
        matrixContainer.classList.add('mt-4');
        matrixContainer.innerHTML = `
            <h6>Distance Matrix Preview:</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered data-table">
                    <thead>
                        <tr>
                            ${Array.from({length: 5}, (_, i) => `<th>Node ${i}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.distanceMatrixPreview.map((row, i) => `
                            <tr>
                                ${row.map(val => `<td>${val}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        ui.dataPreviewContainer.appendChild(matrixContainer);
    }

    // Function to show distance matrix preview
    function showDistanceMatrixPreview(data) {
        // Show in solve tab info alert
        ui.solveInfoAlert.innerHTML = `
            <div class="mb-3">
                <h6>Problem Overview:</h6>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        Nodes <span class="badge bg-primary rounded-pill">${data.nodes}</span>
                    </li>
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        Depot <span class="badge bg-primary rounded-pill">${ui.depotInput.value}</span>
                    </li>
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        Vehicle Capacity <span class="badge bg-primary rounded-pill">${ui.capacityInput.value}</span>
                    </li>
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        Distance Calculation <span class="badge bg-primary rounded-pill">${data.distance_type || 'Euclidean'}</span>
                    </li>
                </ul>
            </div>
            <div class="alert alert-success">
                Data processed successfully. You can now solve the problem.
            </div>
        `;
    }

    // Function to update live updates
    function updateLiveUpdates(updates) {
        updates.forEach(update => addUpdate(update));
    }
    
    // Function to add a single update
    function addUpdate(update) {
        const updateDiv = document.createElement('div');
        updateDiv.classList.add('update-entry');
        updateDiv.innerHTML = `
            <small class="text-muted">${update.time || new Date().toLocaleTimeString()}</small>
            <span class="ms-2">
                ${update.message || `Iteration: ${update.iteration}, Temp: ${update.temperature.toFixed(2)}, Best Cost: ${update.best_cost.toFixed(2)}`}
            </span>
        `;
        
        // Add to container
        ui.liveUpdatesContainer.appendChild(updateDiv);
        
        // Scroll to bottom
        ui.liveUpdatesContainer.scrollTop = ui.liveUpdatesContainer.scrollHeight;
    }

    // Function to display solution results
    function displaySolutionResults(data) {
        const solution = data.solution;
        
        // Display solution overview
        displaySolutionOverview(solution);
        
        // Display route details
        displayRouteDetails(solution);
        
        // Visualize solution on map
        visualizeSolutionOnMap(solution);
        
        // Show convergence plot
        showConvergencePlot(data.cost_history, data.temp_history);
    }

    // Function to update UI state
    function updateUIState() {
        // Enable/disable solve button
        ui.solveBtn.disabled = !appState.dataProcessed;
        
        // Update solve tab info
        updateSolveTab();
    }

    // Function to update solve tab
    function updateSolveTab() {
        if (!appState.dataLoaded) {
            ui.solveInfoAlert.innerHTML = `
                <i class="fas fa-info-circle me-2"></i>
                Please upload data first in the Data Input tab.
            `;
            ui.solveBtn.disabled = true;
        }
        else if (!appState.dataProcessed) {
            ui.solveInfoAlert.innerHTML = `
                <i class="fas fa-info-circle me-2"></i>
                Please process your data in the Configuration tab.
            `;
            ui.solveBtn.disabled = true;
        }
        else if (appState.solutionReady) {
            ui.solveInfoAlert.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Problem solved! View results in the Results tab.
                </div>
            `;
            ui.solveBtn.disabled = false;
            ui.solveBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Solve Again';
        }
        else {
            ui.solveInfoAlert.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Data processed successfully. You can now solve the problem.
                </div>
            `;
            ui.solveBtn.disabled = false;
        }
    }

    // Utility function to show an alert
    function showAlert(container, message, type = 'info', replace = true) {
        if (replace) {
            container.innerHTML = '';
        }
        
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', `alert-${type}`, 'alert-dismissible', 'fade', 'show');
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        container.appendChild(alertDiv);
    }
});