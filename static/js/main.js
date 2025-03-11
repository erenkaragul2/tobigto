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
        titleCell.textContent = `Distance Matrix (${distanceType})`;
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
            th.title = label;
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
            th.title = nodeLabels[i];
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
                Array.from({length: Math.min(5, data.nodes)}, (_, i) => `<th>Node ${i}</th>`).join('');
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            data.distanceMatrixPreview.forEach((row, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>Node ${i}</strong></td>` + 
                    row.map(val => `<td>${val}</td>`).join('');
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