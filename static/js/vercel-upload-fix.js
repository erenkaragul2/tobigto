// Vercel-compatible file upload handler
document.addEventListener('DOMContentLoaded', function() {
    console.log("Loading Vercel-compatible upload handler...");
    
    // Get DOM elements
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const dataPreviewContainer = document.getElementById('dataPreviewContainer');
    
    // Check if elements exist
    if (!fileInput || !uploadBtn || !dataPreviewContainer) {
        console.error("Critical elements missing from DOM");
        return;
    }
    
    // Store original click handler if it exists
    const originalUploadHandler = uploadBtn.onclick;
    console.log("Original upload handler found:", !!originalUploadHandler);
    
    // Remove any existing event listeners to prevent duplication
    uploadBtn.removeEventListener('click', window.uploadFile);
    
    // Vercel-optimized file upload handler
    function vercelOptimizedUpload(e) {
        // Prevent default button behavior
        if (e) e.preventDefault();
        
        console.log("Vercel-optimized upload function called");
        
        // Check if file input exists and has files
        if (!fileInput || !fileInput.files || !fileInput.files.length) {
            showAlert(dataPreviewContainer, 'Please select a file to upload', 'danger');
            return;
        }
        
        const file = fileInput.files[0];
        console.log("Selected file:", file.name, "Type:", file.type, "Size:", file.size);
        
        // Check file size limit for Vercel - typical limit is 4.5MB for serverless functions
        const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB
        if (file.size > MAX_FILE_SIZE) {
            showAlert(dataPreviewContainer, `File size (${(file.size/1024/1024).toFixed(2)}MB) exceeds the maximum allowed size (4.5MB) for Vercel deployments. Please use a smaller file.`, 'danger');
            return;
        }
        
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
        
        // Add timeout to handle Vercel's function timeout (default 10s)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 29000); // Just under 30s limit
        
        // Send the request with additional error handling
        fetch('/upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            // Remove custom headers that aren't needed
        })
        .then(response => {
            clearTimeout(timeoutId);
            console.log("Upload response status:", response.status);
            
            if (!response.ok) {
                if (response.status === 413) {
                    throw new Error('Request entity too large. The file exceeds Vercel\'s size limits.');
                } else {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
            }
            
            // Handle response based on content type
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            } else {
                return response.text().then(text => {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error(`Server returned non-JSON response. This may indicate a Vercel function timeout or memory limit exceeded.`);
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
                showAlert(dataPreviewContainer, data.message || 'File uploaded successfully!', 'success', false);
                
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
            clearTimeout(timeoutId);
            console.error("Upload error:", error);
            
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload and Process';
            
            // Enhanced error message with Vercel-specific advice
            let errorMsg = 'Error uploading file: ' + error.message;
            
            if (error.name === 'AbortError') {
                errorMsg = 'Upload timed out. This is likely due to Vercel\'s function execution time limit (10-30s). Please try a smaller file.';
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                errorMsg += ' This may be due to network issues or Vercel\'s function timeout. Try with a smaller file.';
            } else if (error.message.includes('entity too large')) {
                errorMsg = 'The file is too large for Vercel\'s serverless function limit. Please use a file smaller than 4.5MB.';
            }
            
            showAlert(dataPreviewContainer, errorMsg, 'danger');
            
            // Add retry button for convenience
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn btn-warning mt-2 me-2';
            retryBtn.innerHTML = '<i class="fas fa-sync me-2"></i>Retry Upload';
            retryBtn.onclick = vercelOptimizedUpload;
            dataPreviewContainer.appendChild(retryBtn);
            
            // Add button to use sample data as fallback
            const sampleDataBtn = document.createElement('button');
            sampleDataBtn.className = 'btn btn-outline-secondary mt-2';
            sampleDataBtn.innerHTML = '<i class="fas fa-database me-2"></i>Use Sample Data Instead';
            sampleDataBtn.onclick = function() {
                fetch('/sample_data')
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Handle successful sample data the same way as file upload
                            if (window.appState) {
                                window.appState.dataLoaded = true;
                                window.appState.dataProcessed = true;
                            }
                            
                            // Show data preview
                            if (typeof window.showDataPreview === 'function') {
                                window.showDataPreview(data);
                            }
                            
                            // Update UI state
                            if (typeof window.updateUIState === 'function') {
                                window.updateUIState();
                            }
                            
                            // Show success message
                            showAlert(dataPreviewContainer, 'Sample data loaded successfully!', 'success');
                            
                            // Enable config and solve tabs
                            const configTab = document.getElementById('config-tab');
                            if (configTab) {
                                configTab.classList.remove('disabled');
                                configTab.click();
                            }
                        } else {
                            showAlert(dataPreviewContainer, data.error || 'Error loading sample data', 'danger');
                        }
                    })
                    .catch(error => {
                        showAlert(dataPreviewContainer, 'Error loading sample data: ' + error.message, 'danger');
                    });
            };
            dataPreviewContainer.appendChild(sampleDataBtn);
        });
    }
    
    // Helper functions
    function showAlert(container, message, type = 'info', replace = true) {
        if (replace) {
            // Keep any buttons we've added
            const buttons = Array.from(container.querySelectorAll('button'));
            container.innerHTML = '';
            buttons.forEach(button => container.appendChild(button));
        }
        
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert', `alert-${type}`, 'alert-dismissible', 'fade', 'show');
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        container.insertBefore(alertDiv, container.firstChild);
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
    console.log("Attaching Vercel-optimized upload function to button");
    uploadBtn.onclick = vercelOptimizedUpload;
    
    // Also add event listener as a backup
    uploadBtn.addEventListener('click', vercelOptimizedUpload);
    
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
    
    console.log("Vercel-compatible upload handler loaded successfully");
});