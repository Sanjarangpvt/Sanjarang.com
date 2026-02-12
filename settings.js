document.addEventListener('DOMContentLoaded', () => {
    // --- ACCESS CONTROL ---
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'Administrator') {
        alert('Access Denied: Only Administrators can access Settings.');
        window.location.href = 'dashboard.html';
        return;
    }

    // --- INITIALIZE FLATPICKR (DATE PICKER) ---
    if (typeof flatpickr !== 'undefined') {
        flatpickr('input[type="date"]', {
            altInput: true,
            altFormat: "d/m/Y", // Display format
            dateFormat: "Y-m-d", // Value format (ISO)
            allowInput: true
        });
    }

    // --- SETTINGS PAGE LOGIC (settings.html) ---

    // --- LOADING SPINNER ---
    const showSpinner = () => {
        if (document.getElementById('settings-sync-spinner')) return;
        const overlay = document.createElement('div');
        overlay.id = 'settings-sync-spinner';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;backdrop-filter:blur(2px);';
        overlay.innerHTML = '<div class="spinner" style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div><div style="margin-top:15px;font-weight:600;color:#2c3e50;">Syncing Data...</div><style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>';
        document.body.appendChild(overlay);
    };
    const hideSpinner = () => {
        const overlay = document.getElementById('settings-sync-spinner');
        if (overlay) overlay.remove();
    };

    // --- FIRESTORE SETUP ---
    let db;
    let firestoreOps = {};

    const initFirestore = async () => {
        try {
            const { app } = await import('./firebase-config.js');
            const { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, writeBatch, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

            db = getFirestore(app);
            const auth = getAuth(app);
            firestoreOps = { collection, doc, setDoc, addDoc, deleteDoc, writeBatch, updateDoc };

            // Wait for Auth to initialize before querying
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    showSpinner();
                    // Sync Employees
                    onSnapshot(collection(db, "employees"), (snapshot) => {
                        const employees = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                        localStorage.setItem('employees', JSON.stringify(employees));
                        if (typeof renderEmployees === 'function') renderEmployees();
                        hideSpinner();
                    }, (error) => { console.error("Employees sync error:", error); hideSpinner(); });

                    // Sync Admins
                    onSnapshot(collection(db, "admin_users"), (snapshot) => {
                        const admins = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
                        localStorage.setItem('adminUsers', JSON.stringify(admins));
                        if (typeof renderAdmins === 'function') renderAdmins();
                    }, (error) => console.error("Admins sync error:", error));

                    // Sync Dashboard Message
                    onSnapshot(doc(db, "settings", "dashboardMessage"), (docSnap) => {
                        const messageInput = document.getElementById('dashboard-message');
                        if (docSnap.exists() && messageInput) {
                            messageInput.value = docSnap.data().text || '';
                        }
                    }, (error) => console.error("Message sync error:", error));
                }
            });

        } catch (e) { console.error("Firestore init failed:", e); }
    };
    initFirestore();

    // Helper for date formatting (dd/mm/yyyy)
    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // --- CLOUD MIGRATION LOGIC ---
    const migrateBtn = document.getElementById('migrateBtn');
    if (migrateBtn) {
        migrateBtn.addEventListener('click', async () => {
            if (!confirm('This will upload all local data (Loans, Employees, Expenses) to Firestore. Continue?')) return;

            const status = document.getElementById('migrationStatus');
            migrateBtn.disabled = true;
            if (status) {
                status.textContent = 'Preparing data...';
                status.style.color = '#3498db';
            }

            try {
                const { app } = await import('./firebase-config.js');
                const { getFirestore, doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

                const db = getFirestore(app);

                // Read Data
                const loans = JSON.parse(localStorage.getItem('loans')) || [];
                const employees = JSON.parse(localStorage.getItem('employees')) || [];
                const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
                const walletTransactions = JSON.parse(localStorage.getItem('walletTransactions')) || [];
                const profile = JSON.parse(localStorage.getItem('companyProfile')) || {};
                const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];

                // Prepare Batches
                const batchSize = 450;
                let batches = [];
                let currentBatch = writeBatch(db);
                let operationCount = 0;

                // Helper to sanitize data (remove undefined values which cause Firestore errors)
                const sanitize = (obj) => JSON.parse(JSON.stringify(obj));

                const addToBatch = (ref, data) => {
                    currentBatch.set(ref, data);
                    operationCount++;
                    if (operationCount >= batchSize) {
                        batches.push(currentBatch);
                        currentBatch = writeBatch(db);
                        operationCount = 0;
                    }
                };

                // Queue Operations
                loans.forEach((loan, index) => {
                    const loanId = loan.id || `loan_${Date.now()}_${index}`;
                    const loanRef = doc(db, "loans", loanId);
                    addToBatch(loanRef, sanitize(loan));
                });

                employees.forEach((emp, index) => {
                    const empId = emp.id || `emp_${Date.now()}_${index}`;
                    const empRef = doc(db, "employees", empId);
                    addToBatch(empRef, sanitize(emp));
                });

                expenses.forEach((exp, index) => {
                    const expId = exp.id || `exp_${Date.now()}_${index}`;
                    const expRef = doc(db, "expenses", expId);
                    addToBatch(expRef, sanitize(exp));
                });

                walletTransactions.forEach((trans, index) => {
                    const transId = trans.id || `trans_${Date.now()}_${index}`;
                    const transRef = doc(db, "wallet_transactions", transId);
                    addToBatch(transRef, sanitize(trans));
                });

                // Sync EMI Schedules
                loans.forEach((loan) => {
                    if (loan.emi_schedule && loan.id) {
                        try {
                            const schedRef = doc(db, "emi_schedule", loan.id);
                            addToBatch(schedRef, sanitize(loan.emi_schedule));
                        } catch (e) { console.error("Error processing schedule:", e); }
                    }
                });

                admins.forEach((admin, index) => {
                    const adminRef = doc(db, "admin_users", admin.username); // Use username as ID
                    addToBatch(adminRef, sanitize(admin));
                });

                const profileRef = doc(db, "settings", "companyProfile");
                addToBatch(profileRef, sanitize(profile));

                if (operationCount > 0) batches.push(currentBatch);

                // Commit
                if (status) status.textContent = `Uploading ${batches.length} batches...`;

                for (let i = 0; i < batches.length; i++) {
                    await batches[i].commit();
                    if (status) status.textContent = `Uploaded batch ${i + 1} of ${batches.length}...`;
                }

                if (status) {
                    status.textContent = 'Migration Successful!';
                    status.style.color = '#27ae60';
                }
                alert('All data has been successfully migrated to Firestore!');

            } catch (error) {
                console.error("Migration failed: ", error);
                if (status) {
                    status.textContent = 'Error: ' + error.message;
                    status.style.color = '#e74c3c';
                }
                alert('Migration Failed: ' + error.message);
            } finally {
                migrateBtn.disabled = false;
            }
        });
    }

    // --- MANUAL SYNC LOGIC ---
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            if (!confirm('This will sync your local data with Firestore. Continue?')) return;

            const status = document.getElementById('syncStatus');
            syncBtn.disabled = true;
            syncBtn.textContent = 'Syncing...';
            if (status) {
                status.textContent = 'Preparing data...';
                status.style.color = '#3498db';
            }

            try {
                // Use the global manualSync function from app.js
                if (typeof window.manualSync === 'function') {
                    await window.manualSync();
                    if (status) {
                        status.textContent = 'Sync completed successfully!';
                        status.style.color = '#27ae60';
                    }
                } else {
                    // Fallback: implement sync here
                    const { app } = await import('./firebase-config.js');
                    const { getFirestore, doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

                    const db = getFirestore(app);

                    // Read Data
                    const loans = JSON.parse(localStorage.getItem('loans')) || [];
                    const employees = JSON.parse(localStorage.getItem('employees')) || [];
                    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
                    const walletTransactions = JSON.parse(localStorage.getItem('walletTransactions')) || [];
                    const profile = JSON.parse(localStorage.getItem('companyProfile')) || {};
                    const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];

                    if (loans.length === 0 && employees.length === 0 && expenses.length === 0 && walletTransactions.length === 0) {
                        if (status) {
                            status.textContent = 'No local data to sync';
                            status.style.color = '#7f8c8d';
                        }
                        return;
                    }

                    // Prepare Batches
                    const batchSize = 450;
                    let batches = [];
                    let currentBatch = writeBatch(db);
                    let operationCount = 0;

                    // Helper to sanitize data
                    const sanitize = (obj) => JSON.parse(JSON.stringify(obj));

                    const addToBatch = (ref, data) => {
                        currentBatch.set(ref, data);
                        operationCount++;
                        if (operationCount >= batchSize) {
                            batches.push(currentBatch);
                            currentBatch = writeBatch(db);
                            operationCount = 0;
                        }
                    };

                    // Queue Operations
                    loans.forEach((loan, index) => {
                        const loanId = loan.id || `loan_${Date.now()}_${index}`;
                        const loanRef = doc(db, "loans", loanId);
                        addToBatch(loanRef, sanitize(loan));
                    });

                    employees.forEach((emp, index) => {
                        const empId = emp.id || `emp_${Date.now()}_${index}`;
                        const empRef = doc(db, "employees", empId);
                        addToBatch(empRef, sanitize(emp));
                    });

                    expenses.forEach((exp, index) => {
                        const expId = exp.id || `exp_${Date.now()}_${index}`;
                        const expRef = doc(db, "expenses", expId);
                        addToBatch(expRef, sanitize(exp));
                    });

                    walletTransactions.forEach((trans, index) => {
                        const transId = trans.id || `trans_${Date.now()}_${index}`;
                        const transRef = doc(db, "wallet_transactions", transId);
                        addToBatch(transRef, sanitize(trans));
                    });

                    // Sync EMI Schedules
                    loans.forEach((loan) => {
                        if (loan.emi_schedule && loan.id) {
                            try {
                                const schedRef = doc(db, "emi_schedule", loan.id);
                                addToBatch(schedRef, sanitize(loan.emi_schedule));
                            } catch (e) { console.error("Error processing schedule:", e); }
                        }
                    });

                    admins.forEach((admin, index) => {
                        const adminRef = doc(db, "admin_users", admin.username);
                        addToBatch(adminRef, sanitize(admin));
                    });

                    const profileRef = doc(db, "settings", "companyProfile");
                    addToBatch(profileRef, sanitize(profile));

                    if (operationCount > 0) batches.push(currentBatch);

                    // Commit with timeout
                    if (status) status.textContent = `Syncing ${batches.length} batches...`;

                    const commitPromises = batches.map(batch => batch.commit());
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Sync timeout")), 30000)
                    );

                    await Promise.race([
                        Promise.all(commitPromises),
                        timeoutPromise
                    ]);

                    if (status) {
                        status.textContent = 'Sync completed successfully!';
                        status.style.color = '#27ae60';
                    }
                }

            } catch (error) {
                console.error("Sync failed: ", error);
                if (status) {
                    status.textContent = 'Sync failed: ' + error.message;
                    status.style.color = '#e74c3c';
                }
            } finally {
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sync Now';
            }
        });
    }

    // --- BACKUP DATA LOGIC ---
    const backupBtn = document.getElementById('backupDataBtn');
    if (backupBtn) {
        backupBtn.addEventListener('click', () => {
            const data = {
                loans: JSON.parse(localStorage.getItem('loans')) || [],
                employees: JSON.parse(localStorage.getItem('employees')) || [],
                expenses: JSON.parse(localStorage.getItem('expenses')) || [],
                walletTransactions: JSON.parse(localStorage.getItem('walletTransactions')) || [],
                companyProfile: JSON.parse(localStorage.getItem('companyProfile')) || {},
                adminUsers: JSON.parse(localStorage.getItem('adminUsers')) || [],
                customForms: JSON.parse(localStorage.getItem('customForms')) || [],
                preferences: {
                    theme: localStorage.getItem('appTheme'),
                    bgOpacity: localStorage.getItem('appBgOpacity'),
                    bgBlur: localStorage.getItem('appBgBlur'),
                    themeTransparency: localStorage.getItem('appThemeTransparency')
                }
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `LoanManager_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    let editingIndex = -1;

    // 2. Employee Management - List (Runs on settings.html)
    const renderEmployees = () => {
        const tbody = document.querySelector('#employee-table tbody');
        if (!tbody) return;

        const employees = JSON.parse(localStorage.getItem('employees')) || [];
        tbody.innerHTML = '';

        if (employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #777;">No employees found.</td></tr>';
            return;
        }

        employees.forEach((emp, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${emp.id}</td>
                <td>${emp.name}</td>
                <td>${emp.designation}</td>
                <td>${emp.department}</td>
                <td>${emp.mobile}</td>
                <td>
                    <button class="view-emp-btn" data-index="${index}" style="background-color: #2c3e50; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="View Profile"><i class="bi bi-eye"></i></button>
                    <button class="edit-emp-btn" data-index="${index}" style="background-color: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Edit</button>
                    <button class="generate-id-btn" data-index="${index}" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">ID Card</button>
                    <button class="delete-emp-btn" data-index="${index}" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add view listeners
        document.querySelectorAll('.view-emp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.closest('.view-emp-btn');
                const index = target.getAttribute('data-index');
                const employees = JSON.parse(localStorage.getItem('employees')) || [];
                const emp = employees[index];

                if (emp) {
                    const detailsHtml = `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Employee ID</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.id}</span>
                            </div>
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Full Name</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.name}</span>
                            </div>
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Role</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.designation || '-'}</span>
                            </div>
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Department</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.department || '-'}</span>
                            </div>
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Mobile</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.mobile || '-'}</span>
                            </div>
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Email</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.email || '-'}</span>
                            </div>
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 5px; grid-column: 1 / -1;">
                                <span style="color: #7f8c8d; font-size: 12px; display: block;">Address</span>
                                <span style="font-weight: 600; color: #2c3e50;">${emp.address || '-'}</span>
                            </div>
                        </div>
                    `;
                    const detailsContainer = document.getElementById('view-emp-details');
                    if (detailsContainer) detailsContainer.innerHTML = detailsHtml;
                    const modal = document.getElementById('view-employee-modal');
                    if (modal) modal.style.display = 'block';
                }
            });
        });

        // Add edit listeners
        document.querySelectorAll('.edit-emp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                const employees = JSON.parse(localStorage.getItem('employees')) || [];
                const emp = employees[idx];

                document.getElementById('emp-id').value = emp.id;
                const passwordInput = document.getElementById('emp-password');
                passwordInput.value = ''; // Clear password field for editing
                passwordInput.placeholder = 'Leave blank to keep unchanged';
                passwordInput.required = false;
                document.getElementById('emp-name').value = emp.name;
                const designationEl = document.getElementById('emp-designation');
                if (designationEl) designationEl.value = emp.designation;
                const departmentEl = document.getElementById('emp-department');
                if (departmentEl) departmentEl.value = emp.department;
                const dojEl = document.getElementById('emp-doj');
                if (dojEl) dojEl.value = emp.doj;
                document.getElementById('emp-mobile').value = emp.mobile;
                document.getElementById('emp-email').value = emp.email;
                document.getElementById('emp-address').value = emp.address;

                editingIndex = idx;
                const submitBtn = document.querySelector('#createEmployeeForm button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Update Employee';

                const empModal = document.getElementById('employee-modal');
                if (empModal) empModal.style.display = 'block';
            });
        });

        // Add delete listeners
        document.querySelectorAll('.delete-emp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                if (confirm('Delete this employee?')) {
                    const employees = JSON.parse(localStorage.getItem('employees')) || [];
                    const emp = employees[idx];
                    if (db && firestoreOps.deleteDoc && emp.id) {
                        firestoreOps.deleteDoc(firestoreOps.doc(db, "employees", emp.id));
                    } else {
                        employees.splice(idx, 1);
                        localStorage.setItem('employees', JSON.stringify(employees));
                        renderEmployees();
                    }
                }
            });
        });

        // Add ID Card generation listeners
        document.querySelectorAll('.generate-id-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                const emp = JSON.parse(localStorage.getItem('employees'))[idx];

                // Populate Template
                document.getElementById('card-name').textContent = emp.name;
                document.getElementById('card-designation').textContent = emp.designation;
                document.getElementById('card-id').textContent = emp.id;
                document.getElementById('card-dept').textContent = emp.department;
                document.getElementById('card-mobile').textContent = emp.mobile;
                document.getElementById('card-doj').textContent = emp.doj || 'N/A';

                // Generate PDF
                const element = document.getElementById('id-card-template');
                if (!element) {
                    alert('ID Card template not found on this page.');
                    return;
                }
                const opt = {
                    margin: 0,
                    filename: `ID_Card_${emp.id}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: [54, 86], orientation: 'portrait' } // CR80 Size
                };
                html2pdf().set(opt).from(element).save();
            });
        });
    };

    renderEmployees(); // Initial Load if table exists

    // --- MODAL LOGIC FOR MANAGE STAFF ---
    const addEmpBtn = document.getElementById('add-emp-btn');
    const empModal = document.getElementById('employee-modal');
    const closeEmpModal = document.getElementById('close-emp-modal');

    if (addEmpBtn && empModal) {
        addEmpBtn.addEventListener('click', () => {
            const form = document.getElementById('createEmployeeForm');
            if (form) {
                form.reset();
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Create Employee ID';
                // Set password as required for new employees
                const passwordInput = document.getElementById('emp-password');
                passwordInput.placeholder = 'Create Password';
                passwordInput.required = true;
            }
            editingIndex = -1;
            empModal.style.display = 'block';
        });
    }
    if (closeEmpModal && empModal) {
        closeEmpModal.addEventListener('click', () => {
            empModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (e) => {
        if (e.target == empModal) empModal.style.display = 'none';
    });

    // --- VIEW MODAL LOGIC ---
    const viewModal = document.getElementById('view-employee-modal');
    const closeViewModal = document.getElementById('close-view-emp-modal');
    if (closeViewModal && viewModal) {
        closeViewModal.addEventListener('click', () => {
            viewModal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target == viewModal) viewModal.style.display = 'none';
        });
    }

    // 3. Employee Management - Form (Runs on add-employee.html)
    const createEmployeeForm = document.getElementById('createEmployeeForm');
    if (createEmployeeForm) {
        createEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newEmployee = {
                id: document.getElementById('emp-id').value,
                password: document.getElementById('emp-password').value,
                name: document.getElementById('emp-name').value,
                designation: document.getElementById('emp-designation')?.value || '',
                department: document.getElementById('emp-department')?.value || '',
                doj: document.getElementById('emp-doj')?.value || '',
                mobile: document.getElementById('emp-mobile').value,
                email: document.getElementById('emp-email').value,
                address: document.getElementById('emp-address').value,
                role: 'employee', // Add default role for employees to pass login check
                createdAt: new Date().toISOString()
            };

            let employees = JSON.parse(localStorage.getItem('employees')) || [];

            if (editingIndex >= 0) {
                // Update Existing (Local Check)
                if (employees.some((emp, i) => emp.id === newEmployee.id && i != editingIndex)) {
                    alert('Error: Employee ID already exists!');
                    return;
                }
                newEmployee.createdAt = employees[editingIndex].createdAt; // Preserve creation date

                // If password field is empty during update, keep the old one
                if (!newEmployee.password) {
                    newEmployee.password = employees[editingIndex].password;
                }

                if (db && firestoreOps.setDoc) {
                    await firestoreOps.setDoc(firestoreOps.doc(db, "employees", newEmployee.id), newEmployee);
                    alert('Employee Updated Successfully!');
                } else {
                    employees[editingIndex] = newEmployee;
                    localStorage.setItem('employees', JSON.stringify(employees));
                    renderEmployees();
                    alert('Employee Updated Locally!');
                }

                editingIndex = -1;
                const submitBtn = createEmployeeForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Create Employee ID';
            } else {
                // Create New (Local Check)
                if (employees.some(emp => emp.id === newEmployee.id)) {
                    alert('Error: Employee ID already exists!');
                    return;
                }

                if (db && firestoreOps.setDoc) {
                    await firestoreOps.setDoc(firestoreOps.doc(db, "employees", newEmployee.id), newEmployee);
                    alert('Employee ID Created Successfully!');
                } else {
                    employees.push(newEmployee);
                    localStorage.setItem('employees', JSON.stringify(employees));
                    renderEmployees();
                    alert('Employee ID Created Locally!');
                }
            }

            // Local storage update handled by onSnapshot

            createEmployeeForm.reset();
            if (empModal) empModal.style.display = 'none'; // Close modal if exists
        });
    }

    // --- ADMIN PROFILE SETTINGS (Update Own Profile) ---
    const toggleAdminProfileBtn = document.getElementById('toggle-admin-profile-btn');
    const adminProfileContent = document.getElementById('admin-profile-content');
    if (toggleAdminProfileBtn && adminProfileContent) {
        toggleAdminProfileBtn.addEventListener('click', () => {
            if (adminProfileContent.style.display === 'none') {
                adminProfileContent.style.display = 'block';
                toggleAdminProfileBtn.textContent = 'Hide';
            } else {
                adminProfileContent.style.display = 'none';
                toggleAdminProfileBtn.textContent = 'Show';
            }
        });
    }

    const adminProfileForm = document.getElementById('adminProfileForm');
    if (adminProfileForm) {
        const currentUserEmail = localStorage.getItem('currentUserEmail') || '';
        const currentUsername = localStorage.getItem('currentUser') || 'admin';
        const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];

        // Find current user data
        let userObj = admins.find(a => a.email && a.email.toLowerCase() === currentUserEmail.toLowerCase());

        // Pre-fill form
        document.getElementById('profile-username').value = currentUsername;
        if (userObj) {
            document.getElementById('profile-email').value = userObj.email || '';
            document.getElementById('profile-role').value = userObj.role || 'Administrator';
        }

        adminProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsername = document.getElementById('profile-username').value.trim();
            const newEmail = document.getElementById('profile-email').value.trim();
            const newPassword = document.getElementById('profile-password').value;
            const newRole = document.getElementById('profile-role').value;

            if (!newUsername || !newEmail) { alert('Username and Email are required'); return; }

            let currentAdmins = JSON.parse(localStorage.getItem('adminUsers')) || [];

            // Check if new email is taken by SOMEONE ELSE
            const isEmailTaken = currentAdmins.some(a => a.email && a.email.toLowerCase() === newEmail.toLowerCase() && a.email.toLowerCase() !== currentUserEmail.toLowerCase());
            if (isEmailTaken) { alert('This email is already in use by another admin.'); return; }

            // Find index of current user in storage
            let targetIndex = currentAdmins.findIndex(a => a.email && a.email.toLowerCase() === currentUserEmail.toLowerCase());
            let adminData = targetIndex !== -1 ? currentAdmins[targetIndex] : {};

            adminData.username = newUsername;
            adminData.email = newEmail;
            adminData.role = newRole;
            if (newPassword) adminData.password = newPassword;
            if (!adminData.password && targetIndex === -1) adminData.password = 'password'; // Default for safety

            if (db && firestoreOps.setDoc) {
                // If the email (which is the document ID) has changed, we must delete the old document
                // and create a new one.
                if (currentUserEmail && currentUserEmail.toLowerCase() !== newEmail.toLowerCase() && firestoreOps.deleteDoc) {
                    await firestoreOps.deleteDoc(firestoreOps.doc(db, "admin_users", currentUserEmail));
                }
                // Save the document with the new email as the ID
                await firestoreOps.setDoc(firestoreOps.doc(db, "admin_users", newEmail), adminData);
            } else {
                if (targetIndex === -1) currentAdmins.push(adminData);
                else currentAdmins[targetIndex] = adminData;
                localStorage.setItem('adminUsers', JSON.stringify(currentAdmins));
            }

            localStorage.setItem('currentUser', newUsername);
            localStorage.setItem('currentUserEmail', newEmail);

            alert('Profile updated successfully.');
            window.location.reload();
        });
    }

    // --- ADMIN ACCESS CONTROL TOGGLE ---
    const toggleAdminAccessBtn = document.getElementById('toggle-admin-access-btn');
    const adminAccessContent = document.getElementById('admin-access-content');
    if (toggleAdminAccessBtn && adminAccessContent) {
        toggleAdminAccessBtn.addEventListener('click', () => {
            if (adminAccessContent.style.display === 'none') {
                adminAccessContent.style.display = 'block';
                toggleAdminAccessBtn.textContent = 'Hide';
            } else {
                adminAccessContent.style.display = 'none';
                toggleAdminAccessBtn.textContent = 'Show';
            }
        });
    }

    // --- ADMIN MANAGEMENT LOGIC ---
    const createAdminForm = document.getElementById('createAdminForm');
    const adminTableBody = document.querySelector('#admin-list-table tbody');

    const renderAdmins = () => {
        if (!adminTableBody) return;
        const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];
        adminTableBody.innerHTML = '';

        if (admins.length === 0) {
            adminTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #777;">No custom admins. Default "admin" is active.</td></tr>';
        } else {
            admins.forEach((admin, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${admin.email || admin.username}</td>
                    <td>${admin.role || 'Administrator'}</td>
                    <td>
                        <button class="delete-admin-btn" data-index="${index}" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                    </td>
                `;
                adminTableBody.appendChild(row);
            });
        }

        document.querySelectorAll('.delete-admin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Delete this admin user?')) {
                    const idx = e.target.getAttribute('data-index');
                    const admin = admins[idx];
                    if (db && firestoreOps.deleteDoc) {
                        // Use email as the ID to delete
                        firestoreOps.deleteDoc(firestoreOps.doc(db, "admin_users", admin.email || admin.username || admin.firestoreId));
                    } else {
                        admins.splice(idx, 1);
                        localStorage.setItem('adminUsers', JSON.stringify(admins));
                        renderAdmins();
                    }
                }
            });
        });
    };

    if (createAdminForm) {
        renderAdmins();
        createAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-username').value.trim(); // This input should be for the admin's email
            const p = document.getElementById('admin-password').value;
            const r = document.getElementById('admin-role').value;

            if (email && p) {
                const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];
                if (admins.some(a => a.email && a.email.toLowerCase() === email.toLowerCase())) {
                    alert('An admin with this email already exists!');
                    return;
                }

                if (db && firestoreOps.setDoc) {
                    // Use the email as the document ID and also save it in the document
                    await firestoreOps.setDoc(firestoreOps.doc(db, "admin_users", email), { username: email, email: email, password: p, role: r });
                } else {
                    admins.push({ username: email, email: email, password: p, role: r });
                    localStorage.setItem('adminUsers', JSON.stringify(admins));
                    renderAdmins();
                }

                createAdminForm.reset();
                alert('Admin created successfully.');
            }
        });
    }

    // --- THEME CUSTOMIZATION TOGGLE ---
    const toggleThemeBtn = document.getElementById('toggle-theme-btn');
    const themeContent = document.getElementById('theme-content');
    if (toggleThemeBtn && themeContent) {
        toggleThemeBtn.addEventListener('click', () => {
            if (themeContent.style.display === 'none') {
                themeContent.style.display = 'block';
                toggleThemeBtn.textContent = 'Hide';
            } else {
                themeContent.style.display = 'none';
                toggleThemeBtn.textContent = 'Show';
            }
        });
    }

    // --- THEME SETTINGS LOGIC ---
    const themeBtns = document.querySelectorAll('.theme-btn');
    const bgUpload = document.getElementById('bg-upload');
    const clearBgBtn = document.getElementById('clear-bg-btn');
    const bgOpacityInput = document.getElementById('bg-opacity');
    const opacityValDisplay = document.getElementById('opacity-val');
    const bgBlurInput = document.getElementById('bg-blur');
    const blurValDisplay = document.getElementById('blur-val');
    const themeTransparencyInput = document.getElementById('theme-transparency');
    const transparencyValDisplay = document.getElementById('transparency-val');
    const uploadBgBtn = document.getElementById('upload-bg-btn');
    const resetThemeBtn = document.getElementById('reset-theme-btn');

    // Theme Selection
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            localStorage.setItem('appTheme', theme);

            // Apply immediately
            document.body.classList.remove('dark-mode', 'blue-theme', 'green-theme', 'glass-theme');

            if (theme === 'dark') document.body.classList.add('dark-mode');
            else if (theme === 'blue') document.body.classList.add('blue-theme');
            else if (theme === 'green') document.body.classList.add('green-theme');
            else if (theme === 'glass') document.body.classList.add('glass-theme');
        });
    });

    // Opacity Slider Logic
    if (bgOpacityInput) {
        const savedOpacity = localStorage.getItem('appBgOpacity') || '1';
        bgOpacityInput.value = savedOpacity;
        if (opacityValDisplay) opacityValDisplay.textContent = Math.round(savedOpacity * 100) + '%';

        bgOpacityInput.addEventListener('input', (e) => {
            const val = e.target.value;
            localStorage.setItem('appBgOpacity', val);
            if (opacityValDisplay) opacityValDisplay.textContent = Math.round(val * 100) + '%';

            const overlay = document.getElementById('bg-overlay');
            if (overlay) overlay.style.opacity = val;
        });
    }

    // Blur Slider Logic
    if (bgBlurInput) {
        const savedBlur = localStorage.getItem('appBgBlur') || '0';
        bgBlurInput.value = savedBlur;
        if (blurValDisplay) blurValDisplay.textContent = savedBlur + 'px';

        bgBlurInput.addEventListener('input', (e) => {
            const val = e.target.value;
            localStorage.setItem('appBgBlur', val);
            if (blurValDisplay) blurValDisplay.textContent = val + 'px';

            const overlay = document.getElementById('bg-overlay');
            if (overlay) overlay.style.filter = `blur(${val}px)`;
        });
    }

    // Theme Transparency Slider Logic
    if (themeTransparencyInput) {
        const savedTransparency = localStorage.getItem('appThemeTransparency') || '0.65';
        themeTransparencyInput.value = savedTransparency;
        if (transparencyValDisplay) transparencyValDisplay.textContent = Math.round(savedTransparency * 100) + '%';

        themeTransparencyInput.addEventListener('input', (e) => {
            const val = e.target.value;
            localStorage.setItem('appThemeTransparency', val);
            if (transparencyValDisplay) transparencyValDisplay.textContent = Math.round(val * 100) + '%';
            document.documentElement.style.setProperty('--glass-opacity', val);
        });
    }

    // Background Upload
    if (uploadBgBtn && bgUpload) {
        uploadBgBtn.addEventListener('click', () => {
            const file = bgUpload.files[0];
            if (file) {
                if (file.size > 2 * 1024 * 1024) { // 2MB limit
                    alert('Image is too large! Please upload an image smaller than 2MB.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        localStorage.setItem('appCustomBg', event.target.result);

                        // Update Overlay
                        let overlay = document.getElementById('bg-overlay');
                        if (!overlay) {
                            overlay = document.createElement('div');
                            overlay.id = 'bg-overlay';
                            overlay.style.position = 'fixed';
                            overlay.style.top = '0';
                            overlay.style.left = '0';
                            overlay.style.width = '100%';
                            overlay.style.height = '100%';
                            overlay.style.zIndex = '0';
                            overlay.style.pointerEvents = 'none';
                            overlay.style.backgroundSize = 'cover';
                            overlay.style.backgroundAttachment = 'fixed';
                            overlay.style.backgroundPosition = 'center';
                            document.body.appendChild(overlay);
                        }
                    } catch (e) {
                        alert('Storage full! Cannot save background image. Please try a smaller image.');
                        return;
                    }

                    const overlay = document.getElementById('bg-overlay');
                    document.body.classList.add('custom-bg-active');
                    overlay.style.backgroundImage = `url('${event.target.result}')`;
                    overlay.style.opacity = bgOpacityInput ? bgOpacityInput.value : '1';
                    overlay.style.filter = `blur(${bgBlurInput ? bgBlurInput.value : '0'}px)`;

                    const mainContent = document.querySelector('.main-content');
                    const appLayout = document.querySelector('.app-layout');
                    if (mainContent) mainContent.style.backgroundColor = 'transparent';
                    if (appLayout) appLayout.style.backgroundColor = 'transparent';

                    if (clearBgBtn) clearBgBtn.style.display = 'inline-block';
                };
                reader.readAsDataURL(file);
            } else {
                alert('Please select an image file first.');
            }
        });
    }

    if (clearBgBtn) {
        if (localStorage.getItem('appCustomBg')) clearBgBtn.style.display = 'inline-block';
        clearBgBtn.addEventListener('click', () => {
            localStorage.removeItem('appCustomBg');
            document.body.classList.remove('custom-bg-active');
            const overlay = document.getElementById('bg-overlay');
            if (overlay) overlay.style.backgroundImage = '';

            const mainContent = document.querySelector('.main-content');
            const appLayout = document.querySelector('.app-layout');
            if (mainContent) mainContent.style.backgroundColor = '';
            if (appLayout) appLayout.style.backgroundColor = '';

            clearBgBtn.style.display = 'none';
            bgUpload.value = '';
        });
    }

    // Reset Theme Logic
    if (resetThemeBtn) {
        resetThemeBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all theme settings to default?')) {
                // Clear LocalStorage
                localStorage.removeItem('appTheme');
                localStorage.removeItem('appCustomBg');
                localStorage.removeItem('appBgOpacity');
                localStorage.removeItem('appBgBlur');
                localStorage.removeItem('appThemeTransparency');

                // Reset UI Controls
                if (bgOpacityInput) { bgOpacityInput.value = '1'; if (opacityValDisplay) opacityValDisplay.textContent = '100%'; }
                if (bgBlurInput) { bgBlurInput.value = '0'; if (blurValDisplay) blurValDisplay.textContent = '0px'; }
                if (themeTransparencyInput) { themeTransparencyInput.value = '0.65'; if (transparencyValDisplay) transparencyValDisplay.textContent = '65%'; }
                if (bgUpload) bgUpload.value = '';
                if (clearBgBtn) clearBgBtn.style.display = 'none';

                // Apply Default Styles
                document.body.classList.remove('dark-mode', 'blue-theme', 'green-theme', 'glass-theme', 'custom-bg-active');
                document.documentElement.style.setProperty('--glass-opacity', '0.65');

                const overlay = document.getElementById('bg-overlay');
                if (overlay) {
                    overlay.style.backgroundImage = '';
                    overlay.style.opacity = '1';
                    overlay.style.filter = 'blur(0px)';
                }

                const mainContent = document.querySelector('.main-content');
                const appLayout = document.querySelector('.app-layout');
                if (mainContent) mainContent.style.backgroundColor = '';
                if (appLayout) appLayout.style.backgroundColor = '';

                alert('Theme settings have been reset.');
            }
        });
    }

    // --- DASHBOARD MESSAGE LOGIC ---
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('dashboard-message');

    if (messageInput) {
        // Pre-fill from local storage as a fallback
        const savedMessage = localStorage.getItem('dashboardMessage');
        if (savedMessage) {
            messageInput.value = savedMessage;
        }
        // Firestore will overwrite this if it connects successfully via the listener in initFirestore
    }

    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = messageInput.value.trim();

            if (db && firestoreOps.setDoc && firestoreOps.doc) {
                try {
                    await firestoreOps.setDoc(firestoreOps.doc(db, "settings", "dashboardMessage"), { text: message, updatedAt: new Date().toISOString() });
                    alert('Message saved successfully!');
                } catch (error) {
                    console.error("Error saving message to Firestore:", error);
                    alert('Failed to save message to cloud. Check console for details.');
                }
            } else {
                console.warn('Firestore not available. Falling back to local storage.');
                localStorage.setItem('dashboardMessage', message);
                alert('Message saved locally. It may not be visible to all users.');
            }
        });
    }
});