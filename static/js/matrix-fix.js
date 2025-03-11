// This is a standalone script to fix the "Show Full Matrix" button functionality
// Add this to the bottom of static/js/main.js or as a separate script file

document.addEventListener('DOMContentLoaded', function() {
    // Direct reference to the toggle button
    const toggleMatrixBtn = document.getElementById('toggleMatrixBtn');
    
    if (toggleMatrixBtn) {
        console.log('Matrix toggle button found, attaching event listener');
        
        // Replace any existing event listeners with a direct one
        toggleMatrixBtn.onclick = function() {
            console.log('Toggle matrix button clicked');
            const fullMatrixContainer = document.getElementById('fullMatrixContainer');
            const matrixPreviewContainer = document.getElementById('matrixPreviewContainer');
            
            if (!fullMatrixContainer || !matrixPreviewContainer) {
                console.error('Matrix containers not found');
                return;
            }
            
            // Check current display state
            const isShowingFull = window.getComputedStyle(fullMatrixContainer).display !== 'none';
            
            if (isShowingFull) {
                // Switch to preview
                fullMatrixContainer.style.display = 'none';
                matrixPreviewContainer.style.display = 'block';
                toggleMatrixBtn.innerHTML = '<i class="fas fa-eye me-1"></i>Show Full Matrix';
                console.log('Switched to matrix preview');
            } else {
                // Switch to full matrix
                fullMatrixContainer.innerHTML = '<div class="matrix-loading"><i class="fas fa-spinner fa-spin me-2"></i>Loading full distance matrix...</div>';
                fullMatrixContainer.style.display = 'block';
                matrixPreviewContainer.style.display = 'none';
                toggleMatrixBtn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Hide Full Matrix';
                console.log('Loading full matrix');
                
                // Get the full matrix data
                fetchFullMatrixData();
            }
        };
    } else {
        console.error('Toggle matrix button not found!');
    }
    
    // Add enhanced matrix styles
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
});

// Standalone function to fetch matrix data
function fetchFullMatrixData() {
    console.log('Fetching full matrix data');
    const fullMatrixContainer = document.getElementById('fullMatrixContainer');
    
    // Fetch the full matrix data
    fetch('/get_distance_matrix')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Matrix data received:', data);
            if (data.success) {
                // Get matrix and nodes data
                const matrix = data.matrix;
                const numNodes = matrix.length;
                const nodeLabels = data.node_labels || Array.from({length: numNodes}, (_, i) => `Node ${i}`);
                const distanceType = data.distance_type || 'Euclidean';
                
                // Display the full matrix
                displayFullMatrix(matrix, nodeLabels, distanceType);
            } else {
                fullMatrixContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error loading distance matrix: ${data.error || 'Unknown error'}
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error fetching matrix data:', error);
            fullMatrixContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error loading distance matrix: ${error.message}
                </div>
            `;
        });
}

// Standalone function to display the full matrix
function displayFullMatrix(matrix, nodeLabels, distanceType) {
    console.log('Displaying full matrix with', matrix.length, 'nodes');
    const fullMatrixContainer = document.getElementById('fullMatrixContainer');
    
    // Clear container and create table
    fullMatrixContainer.innerHTML = '';
    const table = document.createElement('table');
    table.id = 'distanceMatrixTable';
    table.className = 'table table-sm table-bordered table-striped table-hover';
    
    // Create header
    const thead = document.createElement('thead');
    const titleRow = document.createElement('tr');
    const titleCell = document.createElement('th');
    titleCell.colSpan = matrix.length + 1;
    titleCell.className = 'text-center bg-light';
    titleCell.textContent = `Full Distance Matrix (${distanceType}) - ${matrix.length} nodes`;
    titleRow.appendChild(titleCell);
    thead.appendChild(titleRow);
    
    // Create column headers
    const headerRow = document.createElement('tr');
    const cornerCell = document.createElement('th');
    cornerCell.className = 'bg-light';
    cornerCell.textContent = 'From \\ To';
    headerRow.appendChild(cornerCell);
    
    // Add all column headers
    for (let i = 0; i < matrix.length; i++) {
        const th = document.createElement('th');
        th.className = 'bg-light';
        th.textContent = nodeLabels[i] || `Node ${i}`;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Create one row for each node
    for (let i = 0; i < matrix.length; i++) {
        const tr = document.createElement('tr');
        
        // Add row header
        const th = document.createElement('th');
        th.className = 'bg-light';
        th.textContent = nodeLabels[i] || `Node ${i}`;
        tr.appendChild(th);
        
        // Add all cells for this row
        for (let j = 0; j < matrix.length; j++) {
            const td = document.createElement('td');
            const value = matrix[i][j];
            
            // Format the distance in km
            if (value === 0) {
                td.textContent = '0.00';
            } else {
                td.textContent = (value / 1000).toFixed(2) + ' km';
            }
            
            // Highlight diagonal
            if (i === j) {
                td.className = 'table-secondary';
            }
            
            tr.appendChild(td);
        }
        
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    fullMatrixContainer.appendChild(table);
    
    // Add download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-sm btn-outline-secondary mt-2';
    downloadBtn.innerHTML = '<i class="fas fa-download me-1"></i>Download as CSV';
    downloadBtn.onclick = function() {
        downloadMatrixAsCSV(matrix, nodeLabels);
    };
    fullMatrixContainer.appendChild(downloadBtn);
}

// CSV download function (backup implementation)
function downloadMatrixAsCSV(matrix, labels) {
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add header row
    csvContent += "," + labels.join(",") + "\n";
    
    // Add data rows
    matrix.forEach((row, i) => {
        csvContent += labels[i] + "," + row.map(value => (value / 1000).toFixed(2)).join(",") + "\n";
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "distance_matrix.csv");
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    document.body.removeChild(link);
}