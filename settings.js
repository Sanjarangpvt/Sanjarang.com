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

    // --- FIRESTORE SETUP ---
    let db;
    let firestoreOps = {};

    const initFirestore = async () => {
        try {
            const { app } = await import('./firebase-config.js');
            const { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, writeBatch, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            db = getFirestore(app);
            firestoreOps = { collection, doc, setDoc, addDoc, deleteDoc, writeBatch, updateDoc };

            // Sync Employees
            onSnapshot(collection(db, "employees"), (snapshot) => {
                const employees = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); // Firestore ID is used as 'id' if manual ID not present, but we use manual IDs for employees usually.
                // Actually, we store manual ID in 'id' field. Firestore doc ID can be same.
                localStorage.setItem('employees', JSON.stringify(employees));
                renderEmployees();
            });

            // Sync Admins
            onSnapshot(collection(db, "admin_users"), (snapshot) => {
                const admins = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
                localStorage.setItem('adminUsers', JSON.stringify(admins));
                if (typeof renderAdmins === 'function') renderAdmins();
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

    // 1. Data Management (Clear Data)
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete ALL loan data? This action cannot be undone.')) {
                localStorage.removeItem('loans');
                alert('All data has been cleared successfully.');
                window.location.reload();
            }
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
                    <button class="edit-emp-btn" data-index="${index}" style="background-color: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Edit</button>
                    <button class="generate-id-btn" data-index="${index}" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">ID Card</button>
                    <button class="delete-emp-btn" data-index="${index}" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add edit listeners
        document.querySelectorAll('.edit-emp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                const employees = JSON.parse(localStorage.getItem('employees')) || [];
                const emp = employees[idx];
                
                document.getElementById('emp-id').value = emp.id;
                document.getElementById('emp-password').value = emp.password || '';
                document.getElementById('emp-name').value = emp.name;
                document.getElementById('emp-designation').value = emp.designation;
                document.getElementById('emp-department').value = emp.department;
                document.getElementById('emp-doj').value = emp.doj;
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

    // 3. Employee Management - Form (Runs on add-employee.html)
    const createEmployeeForm = document.getElementById('createEmployeeForm');
    if (createEmployeeForm) {
        createEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newEmployee = {
                id: document.getElementById('emp-id').value,
                password: document.getElementById('emp-password').value,
                name: document.getElementById('emp-name').value,
                designation: document.getElementById('emp-designation').value,
                department: document.getElementById('emp-department').value,
                doj: document.getElementById('emp-doj').value,
                mobile: document.getElementById('emp-mobile').value,
                email: document.getElementById('emp-email').value,
                address: document.getElementById('emp-address').value,
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
        const currentUser = localStorage.getItem('currentUser') || 'admin';
        const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];
        
        // Find current user data
        let userObj = admins.find(a => a.username.toLowerCase() === currentUser.toLowerCase());
        
        // Pre-fill form
        document.getElementById('profile-username').value = currentUser;
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

            if (!newUsername) { alert('Username is required'); return; }

            let currentAdmins = JSON.parse(localStorage.getItem('adminUsers')) || [];
            
            // Check if new username is taken by SOMEONE ELSE
            const taken = currentAdmins.some(a => a.username.toLowerCase() === newUsername.toLowerCase() && a.username.toLowerCase() !== currentUser.toLowerCase());
            if (taken) { alert('Username already taken.'); return; }
            
            // Find index of current user in storage
            let targetIndex = currentAdmins.findIndex(a => a.username.toLowerCase() === currentUser.toLowerCase());
            let adminData = targetIndex !== -1 ? currentAdmins[targetIndex] : {};
            
            adminData.username = newUsername;
            adminData.email = newEmail;
            adminData.role = newRole;
            if (newPassword) adminData.password = newPassword;
            if (!adminData.password && targetIndex === -1) adminData.password = 'admin'; // Default

            if (db && firestoreOps.setDoc) {
                // If username changed, we might want to delete old doc and create new, but for simplicity let's just save to new ID
                // Ideally we delete the old one if username changed.
                if (currentUser !== newUsername && firestoreOps.deleteDoc) {
                     await firestoreOps.deleteDoc(firestoreOps.doc(db, "admin_users", currentUser));
                }
                await firestoreOps.setDoc(firestoreOps.doc(db, "admin_users", newUsername), adminData);
            } else {
                if (targetIndex === -1) currentAdmins.push(adminData);
                else currentAdmins[targetIndex] = adminData;
                localStorage.setItem('adminUsers', JSON.stringify(currentAdmins));
            }

            localStorage.setItem('currentUser', newUsername);
            
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
                    <td>${admin.username}</td>
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
                if(confirm('Delete this admin user?')) {
                    const idx = e.target.getAttribute('data-index');
                    const admin = admins[idx];
                    if (db && firestoreOps.deleteDoc) {
                        firestoreOps.deleteDoc(firestoreOps.doc(db, "admin_users", admin.username || admin.firestoreId));
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
            const u = document.getElementById('admin-username').value.trim();
            const p = document.getElementById('admin-password').value;
            const r = document.getElementById('admin-role').value;
            
            if(u && p) {
                const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];
                if (admins.some(a => a.username.toLowerCase() === u.toLowerCase()) || u.toLowerCase() === 'admin') {
                    alert('Username already exists!');
                    return;
                }
                
                if (db && firestoreOps.setDoc) {
                    await firestoreOps.setDoc(firestoreOps.doc(db, "admin_users", u), { username: u, password: p, role: r });
                } else {
                    admins.push({ username: u, password: p, role: r });
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
});