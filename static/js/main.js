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
        matrixPreviewContainer: document.getElementById('matrixPreviewContainer'),
        toggleMatrixBtn: document.getElementById('toggleMatrixBtn'),
        fullMatrixContainer: document.getElementById('fullMatrixContainer'),
        distanceMatrixTable: document.getElementById('distanceMatrixTable'),
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
    ui.toggleMatrixBtn = document.getElementById('toggleMatrixBtn');
    ui.matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
    ui.fullMatrixContainer = document.getElementById('fullMatrixContainer');
    ui.distanceMatrixTable = document.getElementById('distanceMatrixTable');
    if (ui.toggleMatrixBtn) {
        ui.toggleMatrixBtn.addEventListener('click', toggleDistanceMatrix);
    }

    // Attach event listeners
    ui.maxVehiclesInput = document.getElementById('maxVehiclesInput');
    ui.uploadBtn.addEventListener('click', uploadFile);
    ui.generateRandomBtn.addEventListener('click', generateRandomProblem);
    ui.processDataBtn.addEventListener('click', processData);
    ui.solveBtn.addEventListener('click', solveProblem);
    // Function to toggle between matrix preview and full matrix
    function toggleDistanceMatrix() {
        const isShowingFull = ui.fullMatrixContainer.style.display !== 'none';
        
        if (isShowingFull) {
            // Switch to preview
            ui.fullMatrixContainer.style.display = 'none';
            ui.matrixPreviewContainer.style.display = 'block';
            ui.toggleMatrixBtn.innerHTML = '<i class="fas fa-eye me-1"></i>Show Full Matrix';
        } else {
            // Switch to full matrix
            if (ui.distanceMatrixTable.rows.length <= 1) {
                // If matrix not yet loaded, fetch it
                fetchFullDistanceMatrix();
            }
            ui.matrixPreviewContainer.style.display = 'none';
            ui.fullMatrixContainer.style.display = 'block';
            ui.toggleMatrixBtn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Show Preview';
        }
    }
        // Function to toggle between matrix preview and full matrix
    function toggleDistanceMatrix() {
        const isShowingFull = ui.fullMatrixContainer.style.display !== 'none';
        
        if (isShowingFull) {
            // Switch to preview
            ui.fullMatrixContainer.style.display = 'none';
            ui.matrixPreviewContainer.style.display = 'block';
            ui.toggleMatrixBtn.innerHTML = '<i class="fas fa-eye me-1"></i>Show Full Matrix';
        } else {
            // Switch to full matrix
            if (ui.distanceMatrixTable.rows.length <= 1) {
                // If matrix not yet loaded, fetch it
                fetchFullDistanceMatrix();
            }
            ui.matrixPreviewContainer.style.display = 'none';
            ui.fullMatrixContainer.style.display = 'block';
            ui.toggleMatrixBtn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Show Preview';
        }
    }
    // Function to display the full distance matrix
    function displayFullDistanceMatrix(matrix, nodeLabels, distanceType) {
        // Reset the container and add back the table
        const fullMatrixContainer = document.getElementById('fullMatrixContainer');
        fullMatrixContainer.innerHTML = '';
        const table = document.createElement('table');
        table.id = 'distanceMatrixTable';
        table.className = 'table table-sm table-bordered table-striped table-hover';
        fullMatrixContainer.appendChild(table);
        
        // Add table header with distance type info
        const thead = document.createElement('thead');
        table.appendChild(thead);
        
        // Add title row with distance type
        const titleRow = document.createElement('tr');
        const titleCell = document.createElement('th');
        titleCell.colSpan = matrix.length + 1;
        titleCell.className = 'text-center bg-light';
        titleCell.textContent = `Full Distance Matrix (${distanceType}) - ${matrix.length} nodes`;
        titleRow.appendChild(titleCell);
        thead.appendChild(titleRow);
        
        // Add column headers
        const headerRow = document.createElement('tr');
        const cornerCell = document.createElement('th');
        cornerCell.className = 'bg-light';
        cornerCell.textContent = 'From \\ To';
        headerRow.appendChild(cornerCell);
        
        // Ensure we're using the full matrix dimensions
        const numNodes = matrix.length;
        
        // Add all column headers
        for (let i = 0; i < numNodes; i++) {
            const th = document.createElement('th');
            th.className = 'bg-light';
            th.textContent = nodeLabels[i] || `Node ${i}`;
            th.title = nodeLabels[i] || `Node ${i}`; // For tooltip on hover
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        
        // Add table body with matrix values - ensure all rows are included
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        
        // Create all rows for the matrix
        for (let i = 0; i < numNodes; i++) {
            const tr = document.createElement('tr');
            
            // Add row header
            const th = document.createElement('th');
            th.className = 'bg-light';
            th.textContent = nodeLabels[i] || `Node ${i}`;
            th.title = nodeLabels[i] || `Node ${i}`; // For tooltip on hover
            tr.appendChild(th);
            
            // Add row values
            for (let j = 0; j < numNodes; j++) {
                const td = document.createElement('td');
                const value = matrix[i][j];
                
                // Format the value based on magnitude
                if (value === 0) {
                    td.textContent = '0.00';
                } else {
                    // Always display in kilometers with consistent formatting
                    td.textContent = (value / 1000).toFixed(2) + ' km';
                }
                
                // Highlight diagonal cells
                if (i === j) {
                    td.className = 'table-secondary';
                }
                
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        }
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-sm btn-outline-secondary mt-2';
        downloadBtn.innerHTML = '<i class="fas fa-download me-1"></i>Download as CSV';
        downloadBtn.addEventListener('click', () => downloadMatrixAsCSV(matrix, nodeLabels));
        fullMatrixContainer.appendChild(downloadBtn);
    }
    
    // Function to download the matrix as a CSV file
    function downloadMatrixAsCSV(matrix, labels) {
        // Create CSV content
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add header row
        csvContent += "," + labels.join(",") + "\n";
        
        // Add data rows
        matrix.forEach((row, i) => {
            csvContent += labels[i] + "," + row.join(",") + "\n";
        });
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "distance_matrix.csv");
        document.body.appendChild(link);
        
        // Trigger download and clean up
        link.click();
        document.body.removeChild(link);
    }


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
        console.log("Upload function called");
        
        // Check if file input exists and has files
        if (!ui.fileInput || !ui.fileInput.files || !ui.fileInput.files.length) {
            showAlert(ui.dataPreviewContainer, 'Please select a file to upload', 'danger');
            return;
        }
    
        const file = ui.fileInput.files[0];
        console.log("Selected file:", file.name);
        
        // Create FormData object and append the file
        const formData = new FormData();
        formData.append('file', file);
    
        // Show loading state
        showAlert(ui.dataPreviewContainer, 'Uploading and processing file...', 'info');
        ui.uploadBtn.disabled = true;
        ui.uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
        
        console.log("Sending fetch request to /upload");
        
        // Send the request
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log("Received response", response.status);
            return response.json();
        })
        .then(data => {
            console.log("Processed response data:", data);
            
            // Reset button state
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
                
                // Enable process data button
                ui.processDataBtn.disabled = false;
                
                // Enable configuration tab
                ui.dataTabs.config.classList.remove('disabled');
            } else {
                showAlert(ui.dataPreviewContainer, data.error || 'Unknown error during upload', 'danger');
            }
        })
        .catch(error => {
            console.error("Upload error:", error);
            
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
                appState.distanceType = data.distance_type;
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
    function toggleDistanceMatrix() {
        const isShowingFull = ui.fullMatrixContainer.style.display !== 'none';
        
        if (isShowingFull) {
            // Switch to preview
            ui.fullMatrixContainer.style.display = 'none';
            ui.matrixPreviewContainer.style.display = 'block';
            ui.toggleMatrixBtn.innerHTML = '<i class="fas fa-eye me-1"></i>Show Full Matrix';
        } else {
            // Show loading state
            ui.fullMatrixContainer.innerHTML = '<div class="matrix-loading"><i class="fas fa-spinner fa-spin me-2"></i>Loading full matrix...</div>';
            ui.fullMatrixContainer.style.display = 'block';
            ui.matrixPreviewContainer.style.display = 'none';
            ui.toggleMatrixBtn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Show Preview';
            
            // Fetch the full matrix
            fetchFullDistanceMatrix();
        }
    }
    function displayFullDistanceMatrix(matrix, nodeLabels, distanceType) {
        // Reset the container and add back the table
        ui.fullMatrixContainer.innerHTML = '';
        const table = document.createElement('table');
        table.id = 'distanceMatrixTable';
        table.className = 'table table-sm table-bordered table-striped table-hover';
        ui.fullMatrixContainer.appendChild(table);
        
        // Add table header with distance type info
        const thead = document.createElement('thead');
        table.appendChild(thead);
        
        // Add title row with distance type
        const titleRow = document.createElement('tr');
        const titleCell = document.createElement('th');
        titleCell.colSpan = matrix.length + 1;
        titleCell.className = 'text-center bg-light';
        titleCell.textContent = `Full Distance Matrix (${distanceType}) - ${matrix.length} nodes`;
        titleRow.appendChild(titleCell);
        thead.appendChild(titleRow);
        
        // Add column headers
        const headerRow = document.createElement('tr');
        const cornerCell = document.createElement('th');
        cornerCell.className = 'bg-light';
        cornerCell.textContent = 'From \\ To';
        headerRow.appendChild(cornerCell);
        
        nodeLabels.forEach((label, i) => {
            const th = document.createElement('th');
            th.className = 'bg-light';
            th.textContent = label;
            th.title = label; // For tooltip on hover
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        
        // Add table body with matrix values
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        
        matrix.forEach((row, i) => {
            const tr = document.createElement('tr');
            
            // Add row header
            const th = document.createElement('th');
            th.className = 'bg-light';
            th.textContent = nodeLabels[i];
            th.title = nodeLabels[i]; // For tooltip on hover
            tr.appendChild(th);
            
            // Add row values
            row.forEach((value, j) => {
                const td = document.createElement('td');
                
                // Format the value based on magnitude
                if (value === 0) {
                    td.textContent = '-';
                    td.className = 'table-secondary';
                } else if (value < 1000) {
                    td.textContent = value.toFixed(1);
                } else {
                    // For large distances show km
                    td.textContent = (value / 1000).toFixed(2) + ' km';
                }
                
                // Highlight diagonal cells
                if (i === j) {
                    td.className = 'table-secondary';
                }
                
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-sm btn-outline-secondary mt-2';
        downloadBtn.innerHTML = '<i class="fas fa-download me-1"></i>Download as CSV';
        downloadBtn.addEventListener('click', () => downloadMatrixAsCSV(matrix, nodeLabels));
        ui.fullMatrixContainer.appendChild(downloadBtn);
    }

    // Function to process uploaded data
    function processData() {
        if (!appState.dataLoaded) {
            showAlert(ui.solveInfoAlert, 'Please upload data first', 'danger');
            return;
        }
        console.log("Process data called - checking for uploaded data");
    
        // Check if we have data loaded from an upload
        if (window.appState.dataLoaded) {
            console.log("Data was previously loaded, sending to server");
        } else {
            console.log("WARNING: No data loaded, processing may fail");
        }
        
        // Disable the javascript fallback to prevent it from generating dummy data
        window.useClientSideFallback = false;
    
        const depot = parseInt(ui.depotInput.value) || 0;
        const capacity = parseInt(ui.capacityInput.value) || 20;
        const maxVehicles = parseInt(ui.maxVehiclesInput.value) || 5; // Add this line
        
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
                max_vehicles: maxVehicles, // Add this line
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
                
                // Show toggle button
                ui.toggleMatrixBtn.style.display = 'block';
                
                // Automatically switch to solve tab
                ui.dataTabs.solve.click();
                
                // Show success message
                showAlert(ui.solveInfoAlert, 'Data processed successfully. You can now solve the problem.', 'success');
            } else {
                showAlert(ui.solveInfoAlert, data.error, 'danger');
            }
        })
    }
        // Function to fetch the full distance matrix
        function fetchFullDistanceMatrix() {
            // Show loading indicator
            const fullMatrixContainer = document.getElementById('fullMatrixContainer');
            fullMatrixContainer.innerHTML = '<div class="matrix-loading"><i class="fas fa-spinner fa-spin me-2"></i>Loading full distance matrix...</div>';
            
            // Fetch the full matrix data from server
            fetch('/get_distance_matrix')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Get matrix and nodes count
                        const matrix = data.matrix;
                        const numNodes = matrix.length; // Use actual matrix dimensions
                        
                        // Generate node labels if not available
                        let nodeLabels = data.node_labels || Array.from({length: numNodes}, (_, i) => `Node ${i}`);
                        
                        // Ensure we have labels for all nodes
                        if (nodeLabels.length < numNodes) {
                            nodeLabels = Array.from({length: numNodes}, (_, i) => nodeLabels[i] || `Node ${i}`);
                        }
                        
                        // Get distance type if available
                        const distanceType = data.distance_type || 'Euclidean';
                        
                        // Display the matrix with all rows and columns
                        displayFullDistanceMatrix(matrix, nodeLabels, distanceType);
                    } else {
                        fullMatrixContainer.innerHTML = `
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-circle me-2"></i>
                                Error loading distance matrix: ${data.error}
                            </div>
                        `;
                    }
                })
                .catch(error => {
                    fullMatrixContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error loading distance matrix: ${error}
                        </div>
                    `;
                });
        }
        
    
        function enhanceMatrixStyle() {
            const style = document.createElement('style');
            style.textContent = `
                #distanceMatrixTable {
                    width: 100%;
                    table-layout: fixed;
                    border-collapse: collapse;
                }
                
                #distanceMatrixTable th,
                #distanceMatrixTable td {
                    padding: 5px;
                    text-align: right;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                #distanceMatrixTable th:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 10;
                    background-color: #f8f9fa;
                    text-align: left;
                }
                
                #distanceMatrixTable thead th {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    background-color: #f8f9fa;
                }
                
                #distanceMatrixTable thead tr:first-child th {
                    top: 0;
                    z-index: 2;
                }
                
                #fullMatrixContainer {
                    max-height: 600px;
                    overflow: auto;
                }
            `;
            document.head.appendChild(style);
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
        // Get container references
        const matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
        const toggleMatrixBtn = document.getElementById('toggleMatrixBtn');
        const fullMatrixContainer = document.getElementById('fullMatrixContainer');
        const distanceMatrixTable = document.getElementById('distanceMatrixTable');
        
        // Clear previous content
        matrixPreviewContainer.innerHTML = '';
        
        // Show matrix preview
        if (data.distanceMatrixPreview) {
            const tableContainer = document.createElement('div');
            tableContainer.classList.add('table-responsive');
            
            const table = document.createElement('table');
            table.classList.add('table', 'table-sm', 'table-bordered', 'data-table');
            
            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = '<th>Node</th>' + 
                Array.from({length: data.nodes}, (_, i) => `<th>Node ${i}</th>`).join('');
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            data.distanceMatrixPreview.forEach((row, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>Node ${i}</strong></td>` + 
                    row.map(val => {
                        // Convert values to kilometers
                        const numVal = parseFloat(val);
                        if (isNaN(numVal) || numVal === 0) {
                            return `<td>${val}</td>`;
                        } else {
                            return `<td>${(numVal / 1000).toFixed(2)} km</td>`;
                        }
                    }).join('');
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            
            tableContainer.appendChild(table);
            matrixPreviewContainer.appendChild(tableContainer);
            
            // Show "view full matrix" button if we have more than 5 nodes
            if (data.nodes > 5) {
                toggleMatrixBtn.style.display = 'block';
                toggleMatrixBtn.onclick = function() {
                    if (fullMatrixContainer.style.display === 'none') {
                        // Show full matrix
                        fullMatrixContainer.style.display = 'block';
                        toggleMatrixBtn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Hide Full Matrix';
                        
                        // If table is empty, populate it
                        if (distanceMatrixTable.rows.length <= 1) {
                            // Request full matrix data
                            fetch('/get_distance_matrix')
                                .then(response => response.json())
                                .then(matrixData => {
                                    if (matrixData.success) {
                                        populateFullMatrix(matrixData.matrix, matrixData.nodes);
                                    }
                                })
                                .catch(error => {
                                    console.error('Error fetching full matrix:', error);
                                });
                        }
                    } else {
                        // Hide full matrix
                        fullMatrixContainer.style.display = 'none';
                        toggleMatrixBtn.innerHTML = '<i class="fas fa-eye me-1"></i>Show Full Matrix';
                    }
                };
            } else {
                toggleMatrixBtn.style.display = 'none';
            }
        } else {
            matrixPreviewContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No distance matrix data available.
                </div>
            `;
            toggleMatrixBtn.style.display = 'none';
        }
    }
    
    // Helper function to populate full matrix table
    function populateFullMatrix(matrix, numNodes) {
        const table = document.getElementById('distanceMatrixTable');
        
        // Clear existing rows
        while (table.rows.length > 0) {
            table.deleteRow(0);
        }
        
        // Create header row
        const headerRow = table.insertRow();
        const cornerCell = headerRow.insertCell();
        cornerCell.innerHTML = '<strong>Node</strong>';
        cornerCell.style.backgroundColor = '#f8f9fa';
        
        // Add column headers
        for (let i = 0; i < numNodes; i++) {
            const th = document.createElement('th');
            th.textContent = `Node ${i}`;
            headerRow.appendChild(th);
        }
        
        // Add data rows
        for (let i = 0; i < numNodes; i++) {
            const row = table.insertRow();
            
            // Add row header
            const rowHeader = row.insertCell();
            rowHeader.innerHTML = `<strong>Node ${i}</strong>`;
            rowHeader.style.backgroundColor = '#f8f9fa';
            
            // Add distance cells
            for (let j = 0; j < numNodes; j++) {
                const cell = row.insertCell();
                const distance = parseFloat(matrix[i][j]);
                
                // Convert to kilometers and format
                if (distance === 0) {
                    cell.textContent = '-';
                } else {
                    cell.textContent = (distance / 1000).toFixed(2) + ' km';
                }
                
                // Highlight the diagonal
                if (i === j) {
                    cell.style.backgroundColor = '#e9ecef';
                }
            }
        }
    }

    // Helper function to populate full matrix table
    function populateFullMatrix(matrix, numNodes) {
        const table = document.getElementById('distanceMatrixTable');
        
        // Clear existing rows
        while (table.rows.length > 0) {
            table.deleteRow(0);
        }
        
        // Create header row
        const headerRow = table.insertRow();
        const cornerCell = headerRow.insertCell();
        cornerCell.innerHTML = '<strong>Node</strong>';
        cornerCell.style.backgroundColor = '#f8f9fa';
        
        // Add column headers
        for (let i = 0; i < numNodes; i++) {
            const th = document.createElement('th');
            th.textContent = `Node ${i}`;
            headerRow.appendChild(th);
        }
        
        // Add data rows
        for (let i = 0; i < numNodes; i++) {
            const row = table.insertRow();
            
            // Add row header
            const rowHeader = row.insertCell();
            rowHeader.innerHTML = `<strong>Node ${i}</strong>`;
            rowHeader.style.backgroundColor = '#f8f9fa';
            
            // Add distance cells
            for (let j = 0; j < numNodes; j++) {
                const cell = row.insertCell();
                cell.textContent = parseFloat(matrix[i][j]).toFixed(2);
                
                // Highlight the diagonal
                if (i === j) {
                    cell.style.backgroundColor = '#e9ecef';
                }
            }
        }
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
    function showConvergencePlot(costHistory, tempHistory) {
        const convergencePlotContainer = document.getElementById('convergencePlotContainer');
        
        // Clear previous content and create canvas
        convergencePlotContainer.innerHTML = '<canvas id="convergenceChart"></canvas>';
        
        // Create chart
        const ctx = document.getElementById('convergenceChart').getContext('2d');
        
        // Prepare data
        const iterations = Array.from({length: costHistory.length}, (_, i) => i);
        
        // Convert cost values from meters to kilometers for display
        const costHistoryKm = costHistory.map(cost => cost / 1000);
        
        // Create chart
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: iterations,
                datasets: [
                    {
                        label: 'Best Cost (km)',
                        data: costHistoryKm,
                        borderColor: '#36a2eb',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Temperature',
                        data: tempHistory,
                        borderColor: '#ff6384',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Convergence of Simulated Annealing'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Best Cost: ${context.raw.toFixed(2)} km`;
                                } else {
                                    return `Temperature: ${context.raw.toFixed(2)}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Iteration'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Best Cost (km)'
                        }
                    },
                    y1: {
                        type: 'logarithmic',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Temperature'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
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
    enhanceMatrixStyle();
    // Store subscription information
let subscriptionInfo = {
    maxRoutes: 5,  // Default trial value
    maxDrivers: 3,  // Default trial value
    routesUsed: 0,
    isTrial: true
  };
  
  // Update max vehicles input based on subscription
  function updateMaxVehiclesInput() {
    const maxVehiclesInput = document.getElementById('maxVehiclesInput');
    if (maxVehiclesInput) {
      // Set the max attribute
      maxVehiclesInput.setAttribute('max', subscriptionInfo.maxDrivers);
      
      // If current value exceeds max, update it
      if (parseInt(maxVehiclesInput.value) > subscriptionInfo.maxDrivers) {
        maxVehiclesInput.value = subscriptionInfo.maxDrivers;
      }
      
      // Add a hint about the limit
      const formText = maxVehiclesInput.parentElement.querySelector('.form-text');
      if (formText) {
        formText.innerHTML = `Maximum number of vehicles (routes) to use <strong>(limit: ${subscriptionInfo.maxDrivers})</strong>`;
      }
    }
  }
  
  // Add a subscription alert section to the config tab
  function addSubscriptionAlerts() {
    const configTab = document.getElementById('config');
    if (!configTab) return;
    
    // Create alert for routes remaining
    const routesAlert = document.createElement('div');
    routesAlert.className = 'alert alert-info mb-4';
    routesAlert.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong><i class="fas fa-info-circle me-2"></i>Route Usage</strong>
          <div>You have used ${subscriptionInfo.routesUsed} of ${subscriptionInfo.maxRoutes} route creations this billing period.</div>
        </div>
        <a href="/pricing" class="btn btn-sm btn-outline-primary">Upgrade Plan</a>
      </div>
    `;
    
    // Create alert for driver limits
    const driversAlert = document.createElement('div');
    driversAlert.className = 'alert alert-info mb-4';
    driversAlert.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong><i class="fas fa-info-circle me-2"></i>Driver Limit</strong>
          <div>Your plan allows up to ${subscriptionInfo.maxDrivers} drivers per route.</div>
        </div>
      </div>
    `;
    
    // Add alerts to the beginning of the config tab
    configTab.insertBefore(driversAlert, configTab.firstChild);
    configTab.insertBefore(routesAlert, configTab.firstChild);
    
    // If user is on trial, add a trial alert
    if (subscriptionInfo.isTrial) {
      const trialAlert = document.createElement('div');
      trialAlert.className = 'alert alert-warning mb-4';
      trialAlert.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong><i class="fas fa-clock me-2"></i>Trial Account</strong>
            <div>You are currently on a trial account with limited features. Upgrade to a paid plan for more routes and drivers.</div>
          </div>
          <a href="/pricing" class="btn btn-sm btn-warning">View Plans</a>
        </div>
      `;
      configTab.insertBefore(trialAlert, configTab.firstChild);
    }
  }
  
  // Handle subscription limits in API responses
  function handleSubscriptionInfo(data) {
    if (data && data.subscription) {
      subscriptionInfo.maxRoutes = data.subscription.max_routes || 5;
      subscriptionInfo.maxDrivers = data.subscription.max_drivers || 3;
      subscriptionInfo.routesUsed = data.subscription.routes_used || 0;
      subscriptionInfo.isTrial = data.subscription.is_trial || false;
      
      // Update the UI
      updateMaxVehiclesInput();
      addSubscriptionAlerts();
      
      console.log('Subscription info updated:', subscriptionInfo);
    }
  }
  
  // Handle subscription limit errors
  function handleLimitError(errorResponse) {
    if (errorResponse && errorResponse.limit_exceeded) {
      const maxAllowed = errorResponse.max_allowed || 3;
      const errorMessage = errorResponse.error || `You can only use up to ${maxAllowed} drivers on your current plan.`;
      
      // Show error
      alert(errorMessage);
      
      // Update max vehicles input
      const maxVehiclesInput = document.getElementById('maxVehiclesInput');
      if (maxVehiclesInput) {
        maxVehiclesInput.value = maxAllowed;
      }
      
      return true; // Error was handled
    }
    
    if (errorResponse && errorResponse.limit_reached) {
      const errorMessage = errorResponse.error || 'You have reached your route creation limit for this billing period.';
      
      // Show error with option to upgrade
      if (confirm(`${errorMessage}\n\nWould you like to view upgrade options?`)) {
        window.location.href = errorResponse.redirect || '/pricing';
      }
      
      return true; // Error was handled
    }
    
    return false; // Error was not handled
  }
  
  // Add event listeners
  document.addEventListener('DOMContentLoaded', function() {
    // Modify existing API calls to handle subscription information
    const originalProcessData = window.processData;
    if (originalProcessData) {
      window.processData = function() {
        return originalProcessData().then(function(data) {
          if (data && data.success) {
            handleSubscriptionInfo(data);
          } else if (data && !data.success) {
            handleLimitError(data);
          }
          return data;
        });
      };
    }
    
    const originalGenerateRandom = window.generateRandomProblem;
    if (originalGenerateRandom) {
      window.generateRandomProblem = function() {
        return originalGenerateRandom().then(function(data) {
          if (data && data.success) {
            handleSubscriptionInfo(data);
          } else if (data && !data.success) {
            handleLimitError(data);
          }
          return data;
        });
      };
    }
    
    const originalSolveProblem = window.solveProblem;
    if (originalSolveProblem) {
      window.solveProblem = function() {
        return originalSolveProblem().then(function(data) {
          if (data && !data.success) {
            if (handleLimitError(data)) {
              throw new Error('Subscription limit reached');
            }
          }
          return data;
        });
      };
    }
    // Add this to your static/js folder and reference it in your HTML
    document.addEventListener('DOMContentLoaded', function() {
        // Get DOM elements
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        
        // Replace existing handler
        uploadBtn.onclick = function() {
            // Check if file is selected
            if (!fileInput.files || !fileInput.files.length) {
                alert('Please select a file to upload');
                return;
            }
            
            const file = fileInput.files[0];
            
            // Show loading state
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
            
            // Create FormData and send
            const formData = new FormData();
            formData.append('file', file);
            
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                // Reset button state
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';
                
                if (data.success) {
                    // Update UI with file data
                    if (typeof window.showDataPreview === 'function') {
                        window.showDataPreview(data);
                    }
                    
                    // Enable next step
                    const processDataBtn = document.getElementById('processDataBtn');
                    if (processDataBtn) {
                        processDataBtn.disabled = false;
                    }
                    
                    // Enable config tab
                    const configTab = document.getElementById('config-tab');
                    if (configTab) {
                        configTab.classList.remove('disabled');
                    }
                    
                    // Show success message
                    alert('File uploaded successfully!');
                } else {
                    // Show error
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';
                alert('Error uploading file: ' + error.message);
            });
        };
    });
    // Add to your main.js
    document.getElementById('debugDataBtn').addEventListener('click', function() {
        fetch('/debug-session-data')
            .then(response => response.json())
            .then(data => {
                console.log("Session data:", data);
                alert("Session data printed to console. Check browser developer tools.");
            });
    });
    // Initialize max vehicles input
    updateMaxVehiclesInput();
  });
});