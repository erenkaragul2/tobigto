// Enhanced File Upload Fix
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading enhanced file upload fix...");
    
    // Get DOM elements
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const dataPreviewContainer = document.getElementById('dataPreviewContainer');
    
    // Check if elements exist
    if (!fileInput || !uploadBtn || !dataPreviewContainer) {
        console.error("Critical elements missing from DOM:", {
            fileInput: !!fileInput,
            uploadBtn: !!uploadBtn,
            dataPreviewContainer: !!dataPreviewContainer
        });
        return; // Exit if elements aren't found
    }
    
    // Debug the current click handler
    console.log("Original uploadBtn click handler:", uploadBtn.onclick);
    
    // Remove any existing event listeners to prevent duplication
    uploadBtn.removeEventListener('click', window.uploadFile);
    
    // Direct file upload handler with robust error handling
    function enhancedUploadFile() {
        console.log("Enhanced upload function called");
        
        // Check if file input exists and has files
        if (!fileInput || !fileInput.files || !fileInput.files.length) {
            showAlert(dataPreviewContainer, 'Please select a file to upload', 'danger');
            return;
        }
        
        const file = fileInput.files[0];
        console.log("Selected file:", file.name, "Type:", file.type, "Size:", file.size);
        
        // Validate file type
        const validTypes = [
            'text/csv', 
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!validTypes.includes(file.type) && 
            !file.name.endsWith('.csv') && 
            !file.name.endsWith('.xlsx') && 
            !file.name.endsWith('.xls')) {
            showAlert(dataPreviewContainer, 'Please select a CSV or Excel file', 'danger');
            return;
        }
        
        // Create FormData object and append the file
        const formData = new FormData();
        formData.append('file', file);
    
        // Show loading state
        showAlert(dataPreviewContainer, 'Uploading and processing file...', 'info');
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
        
        // Add debug headers to help diagnose issues
        const debugHeaders = {
            'X-Debug-Info': 'file-upload-fix',
            'X-File-Name': file.name,
            'X-File-Size': file.size
        };
        
        // Send the request with additional error handling
        fetch('/upload', {
            method: 'POST',
            body: formData,
            headers: debugHeaders
        })
        .then(response => {
            console.log("Upload response status:", response.status);
            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                // If response is not JSON, try to get text and convert
                return response.text().then(text => {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
                    }
                });
            }
        })
        .then(data => {
            console.log("Processed upload response data:", data);
            
            // Reset button state
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';
    
            if (data.success) {
                // Store success in global state if it exists
                if (window.appState) {
                    window.appState.dataLoaded = true;
                }
                
                // Show data preview
                if (typeof window.showDataPreview === 'function') {
                    window.showDataPreview(data);
                } else {
                    // Fallback if showDataPreview is not available
                    showDataPreviewFallback(data, dataPreviewContainer);
                }
                
                // Update UI state if function exists
                if (typeof window.updateUIState === 'function') {
                    window.updateUIState();
                }
                
                // Show success message
                showAlert(dataPreviewContainer, data.message, 'success', false);
                
                // Enable process data button
                const processDataBtn = document.getElementById('processDataBtn');
                if (processDataBtn) {
                    processDataBtn.disabled = false;
                }
                
                // Enable configuration tab
                const configTab = document.getElementById('config-tab');
                if (configTab) {
                    configTab.classList.remove('disabled');
                    // Automatically switch to config tab
                    setTimeout(() => {
                        configTab.click();
                    }, 500);
                }
            } else {
                showAlert(dataPreviewContainer, data.error || 'Unknown error during upload', 'danger');
            }
        })
        .catch(error => {
            console.error("Upload error:", error);
            
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';
            
            // Enhanced error message with debugging info
            let errorMsg = 'Error uploading file: ' + error.message;
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMsg += '. This may be due to network issues or server timeout. Try with a smaller file or check your connection.';
            }
            
            showAlert(dataPreviewContainer, errorMsg, 'danger');
            
            // Add retry button for convenience
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn btn-warning mt-2';
            retryBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Retry Upload';
            retryBtn.onclick = enhancedUploadFile;
            dataPreviewContainer.appendChild(retryBtn);
        });
    }
    
    // Helper functions
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
    
    // Fallback function to display data preview if the original is missing
    function showDataPreviewFallback(data, container) {
        container.innerHTML = '';
        
        // Create column info
        const columnInfo = document.createElement('div');
        columnInfo.classList.add('mb-3');
        columnInfo.innerHTML = `
            <h6>Detected Columns:</h6>
            <ul class="list-group">
                ${data.columns.map(col => `<li class="list-group-item">${col}</li>`).join('')}
            </ul>
        `;
        container.appendChild(columnInfo);
        
        // Create data preview table if data exists
        if (data.previewData && data.previewData.length > 0) {
            const tableContainer = document.createElement('div');
            tableContainer.classList.add('table-responsive', 'mt-3');
            
            const table = document.createElement('table');
            table.classList.add('table', 'table-sm', 'table-bordered', 'data-table');
            
            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            // Get all columns from the preview data
            const allColumns = new Set();
            data.previewData.forEach(row => {
                Object.keys(row).forEach(key => allColumns.add(key));
            });
            
            // Add headers for each column
            Array.from(allColumns).forEach(column => {
                const th = document.createElement('th');
                th.textContent = column;
                headerRow.appendChild(th);
            });
            
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create table body
            const tbody = document.createElement('tbody');
            
            // Add a row for each preview data item
            data.previewData.forEach(row => {
                const tr = document.createElement('tr');
                
                Array.from(allColumns).forEach(column => {
                    const td = document.createElement('td');
                    td.textContent = row[column] !== undefined ? row[column] : '';
                    tr.appendChild(td);
                });
                
                tbody.appendChild(tr);
            });
            
            table.appendChild(tbody);
            tableContainer.appendChild(table);
            container.appendChild(tableContainer);
        }
    }
    
    // Replace the upload button click handler
    console.log("Attaching enhanced upload function to button");
    uploadBtn.onclick = enhancedUploadFile;
    
    // Also add event listener as a backup
    uploadBtn.addEventListener('click', enhancedUploadFile);
    
    // Fix file input to better handle file changes
    fileInput.addEventListener('change', function() {
        const fileName = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file chosen';
        console.log("File input changed:", fileName);
        
        // Find any file name display element and update it
        const fileDisplay = document.querySelector('.custom-file-label');
        if (fileDisplay) {
            fileDisplay.textContent = fileName;
        }
        
        // Clear any previous error messages
        const alerts = dataPreviewContainer.querySelectorAll('.alert-danger');
        alerts.forEach(alert => alert.remove());
    });
    
    console.log("Enhanced file upload fix loaded successfully");
});