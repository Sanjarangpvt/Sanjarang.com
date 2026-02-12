document.addEventListener('DOMContentLoaded', () => {
    // --- DYNAMIC SIDEBAR LOADER ---
    // --- HELPER: UPDATE SIDEBAR PROFILE ---
    // Defined here so it is available for loadSidebar and Firestore listeners
    const updateSidebarProfile = () => {
        const savedProfile = JSON.parse(localStorage.getItem('companyProfile')) || {};
        const sidebarLogo = document.getElementById('sidebar-logo');
        const sidebarCompanyName = document.getElementById('sidebar-company-name');

        if (savedProfile.name && sidebarCompanyName) {
            sidebarCompanyName.textContent = savedProfile.name;
        }
        if (savedProfile.logo && sidebarLogo) {
            sidebarLogo.src = savedProfile.logo;
            sidebarLogo.style.display = 'block';
        }
    };

    // --- DYNAMIC SIDEBAR LOADER (WITH CACHING) ---
    const loadSidebar = async () => {
        const sidebar = document.querySelector('.sidebar');
        const headerLeft = document.querySelector('.header-left');
        const CACHE_KEY = 'sidebar_html_cache';

        if (sidebar) {
            // 1. Load HTML
            // Helper to setup sidebar events/state after HTML injection
            const initSidebar = () => {
                // Highlight Active Link
                const currentPath = window.location.pathname.split('/').pop() || 'index.html';
                sidebar.querySelectorAll('nav a').forEach(link => {
                    link.classList.remove('active'); // Clear cached active state
                    if (link.getAttribute('href') === currentPath) link.classList.add('active');
                });

                // Adjust Dashboard Link for Non-Admins (Employees)
                const userRole = localStorage.getItem('userRole');
                if (userRole !== 'Administrator') {
                    const dashboardLink = sidebar.querySelector('a[href="dashboard.html"]');
                    if (dashboardLink) dashboardLink.setAttribute('href', 'Employee-dashboard.html');

                    // Hide Wallet Link for Employees
                    const walletLink = sidebar.querySelector('a[href="wallet.html"]');
                    if (walletLink) walletLink.style.display = 'none';

                    // Hide Expenses Link for Employees
                    const expensesLink = sidebar.querySelector('a[href="expenses.html"]');
                    if (expensesLink) expensesLink.style.display = 'none';
                }

                // Update Profile Info
                updateSidebarProfile();

                // Setup Logout
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    // Clone to remove old listeners if any
                    const newBtn = logoutBtn.cloneNode(true);
                    logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
                    newBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (confirm('Are you sure you want to logout?')) {
                            localStorage.removeItem('isLoggedIn');
                            localStorage.removeItem('currentUser');
                            window.location.href = 'login.html';
                        }
                    });
                }
            };

            // 1. Load from Cache Immediately (Fixes Flickering)
            const cachedHTML = localStorage.getItem(CACHE_KEY);
            if (cachedHTML) {
                sidebar.innerHTML = cachedHTML;
                initSidebar();
            }

            // 2. Fetch Fresh Content in Background
            try {
                const response = await fetch('sidebar.html');
                if (response.ok) {
                    const html = await response.text();
                    // Only update DOM if content changed
                    if (html !== cachedHTML) {
                        sidebar.innerHTML = html;
                        localStorage.setItem(CACHE_KEY, html);
                        initSidebar();
                    }
                }
            } catch (e) { console.error("Sidebar fetch error", e); }

            // 3. Setup Sidebar State & Toggle
            const savedState = localStorage.getItem('sidebarState');
            if (savedState === 'expanded') {
                sidebar.classList.remove('collapsed');
            } else {
                sidebar.classList.add('collapsed');
            }

            // Remove legacy static button if present to avoid duplicates
            const staticBtn = document.getElementById('sidebar-toggle');
            if (staticBtn) staticBtn.remove();

            if (headerLeft && !document.getElementById('main-sidebar-toggle')) {
                const headerToggleBtn = document.createElement('button');
                headerToggleBtn.id = 'main-sidebar-toggle';
                headerToggleBtn.className = 'icon-btn';
                headerToggleBtn.innerHTML = '<i class="bi bi-list" style="font-size: 1.5rem;"></i>';
                headerLeft.prepend(headerToggleBtn);
                headerToggleBtn.addEventListener('click', () => {
                    sidebar.classList.toggle('collapsed');
                    localStorage.setItem('sidebarState', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
                });
            }
        }
    };
    loadSidebar();

    // --- WELCOME TOAST LOGIC ---
    if (localStorage.getItem('showWelcomeToast') === 'true') {
        const user = localStorage.getItem('currentUser') || 'User';
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `<i class="bi bi-check-circle-fill" style="font-size: 1.2rem;"></i> <span>Welcome back, ${user}!</span>`;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after 3.5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);

        localStorage.removeItem('showWelcomeToast');
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

    // --- GLOBAL THEME APPLICATION ---
    const applyThemeGlobal = () => {
        const theme = localStorage.getItem('appTheme') || 'light';
        const customBg = localStorage.getItem('appCustomBg');
        const bgOpacity = localStorage.getItem('appBgOpacity') || '1';
        const bgBlur = localStorage.getItem('appBgBlur') || '0';
        const themeTransparency = localStorage.getItem('appThemeTransparency') || '0.65';

        // Apply Theme Class
        document.body.classList.remove('dark-mode', 'blue-theme', 'green-theme', 'glass-theme');

        if (theme === 'dark') document.body.classList.add('dark-mode');
        else if (theme === 'blue') document.body.classList.add('blue-theme');
        else if (theme === 'green') document.body.classList.add('green-theme');
        else if (theme === 'glass') document.body.classList.add('glass-theme');

        // Apply Theme Transparency
        document.documentElement.style.setProperty('--glass-opacity', themeTransparency);

        // Apply Custom Background via Overlay
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

        const mainContent = document.querySelector('.main-content');
        const appLayout = document.querySelector('.app-layout');

        if (customBg) {
            document.body.classList.add('custom-bg-active');
            overlay.style.backgroundImage = `url('${customBg}')`;
            overlay.style.opacity = bgOpacity;
            overlay.style.filter = `blur(${bgBlur}px)`;

            if (mainContent) mainContent.style.backgroundColor = 'transparent';
            if (appLayout) appLayout.style.backgroundColor = 'transparent';
        } else {
            document.body.classList.remove('custom-bg-active');
            overlay.style.backgroundImage = '';

            if (mainContent) mainContent.style.backgroundColor = '';
            if (appLayout) appLayout.style.backgroundColor = '';
        }
    };
    applyThemeGlobal();

    // Helper to safely parse any date format (String, ISO, or Firestore Timestamp)
    const parseSafeDate = (dateInput) => {
        if (!dateInput) return new Date(0);
        if (dateInput instanceof Date) return dateInput;
        if (typeof dateInput === 'object' && dateInput.seconds) {
            return new Date(dateInput.seconds * 1000);
        }
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? new Date(0) : d;
    };

    // Helper for date formatting (dd/mm/yyyy)
    const formatDate = (dateInput) => {
        const date = parseSafeDate(dateInput);
        if (date.getTime() === 0) return 'N/A';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Load JSON safely from localStorage
    const getLocalJSON = (key) => {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`Error parsing localStorage key "${key}":`, e);
            return [];
        }
    };

    // 1. Load data from LocalStorage (Shared between pages)
    let loans = getLocalJSON('loans');
    // Split local data to prevent flickering before Firestore loads
    let fetchedLoans = loans.filter(l => l.firestoreCollection !== 'loan_applications');
    let fetchedApps = loans.filter(l => l.firestoreCollection === 'loan_applications');
    let fetchedSchedules = {}; // Map: loanId -> schedule object

    let db;
    let firestoreOps = {};

    // Helper to combine data from both collections
    const updateAllLoans = () => {
        loans = [...fetchedLoans, ...fetchedApps].map(loan => {
            if (fetchedSchedules[loan.id]) {
                return { ...loan, emi_schedule: fetchedSchedules[loan.id] };
            }
            return loan;
        });
        localStorage.setItem('loans', JSON.stringify(loans));
        document.dispatchEvent(new CustomEvent('loans-updated'));
    };

    // --- FIRESTORE REAL-TIME LISTENER ---
    const initFirestore = async () => {
        try {
            const { app } = await import('./firebase-config.js');
            const { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

            db = getFirestore(app);
            firestoreOps = { doc, setDoc, addDoc, deleteDoc, collection };
            const auth = getAuth(app);

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    const userRole = localStorage.getItem('userRole');
                    const isEmployee = userRole !== 'Administrator';

                    // Listener 1: Active/Closed Loans
                    let loansQuery = collection(db, "loans");
                    if (isEmployee) {
                        loansQuery = query(collection(db, "loans"), where("employeeEmail", "==", user.email));
                    }

                    onSnapshot(loansQuery, (snapshot) => {
                        fetchedLoans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, firestoreCollection: 'loans' }));
                        updateAllLoans();
                    }, (err) => console.error("Loans listener error:", err));

                    // Listener 2: Loan Applications (Pending)
                    let appsQuery = collection(db, "loan_applications");
                    if (isEmployee) {
                        appsQuery = query(collection(db, "loan_applications"), where("employeeEmail", "==", user.email));
                    }

                    onSnapshot(appsQuery, (snapshot) => {
                        fetchedApps = snapshot.docs.map(doc => {
                            const data = doc.data();
                            return { ...data, id: doc.id, status: data.status || 'Pending', firestoreCollection: 'loan_applications' };
                        });
                        updateAllLoans();
                    }, (err) => console.error("Loan Applications listener error:", err));

                    // Listener 3: EMI Schedules
                    if (!isEmployee) {
                        onSnapshot(collection(db, "emi_schedule"), (snapshot) => {
                            fetchedSchedules = {};
                            snapshot.docs.forEach(doc => {
                                fetchedSchedules[doc.id] = doc.data();
                            });
                            updateAllLoans();
                        }, (err) => console.error("EMI Schedule listener error:", err));
                    }

                    // Listener 4: Expenses
                    onSnapshot(collection(db, "expenses"), (snapshot) => {
                        const expenses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                        localStorage.setItem('expenses', JSON.stringify(expenses));
                        document.dispatchEvent(new CustomEvent('expenses-updated'));
                    }, (err) => console.error("Expenses sync error:", err));

                    // Listener 5: Wallet Transactions
                    onSnapshot(collection(db, "wallet_transactions"), (snapshot) => {
                        const transactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                        localStorage.setItem('walletTransactions', JSON.stringify(transactions));
                        document.dispatchEvent(new CustomEvent('wallet-updated'));
                    }, (err) => console.error("Wallet sync error:", err));

                    // Sync Company Profile
                    onSnapshot(doc(db, "settings", "companyProfile"), (docSnap) => {
                        if (docSnap.exists()) {
                            localStorage.setItem('companyProfile', JSON.stringify(docSnap.data()));
                            updateSidebarProfile();
                        }
                    }, (err) => console.error("Company Profile sync error:", err));

                    // Sync Admin Users
                    if (!isEmployee) {
                        onSnapshot(collection(db, "admin_users"), (snapshot) => {
                            const admins = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
                            localStorage.setItem('adminUsers', JSON.stringify(admins));
                        }, (err) => console.error("Admin Users sync error:", err));
                    }

                    // Listener for Employees
                    onSnapshot(collection(db, "employees"), (snapshot) => {
                        const employees = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                        localStorage.setItem('employees', JSON.stringify(employees));
                        document.dispatchEvent(new CustomEvent('loans-updated'));
                    }, (err) => console.error("Employees sync error:", err));

                    // Listener for Dashboard Message
                    onSnapshot(doc(db, "settings", "dashboardMessage"), (docSnap) => {
                        const messageBar = document.querySelector('.message-bar');
                        const messageText = document.getElementById('dashboard-message-text');

                        if (messageBar && messageText) {
                            if (docSnap.exists() && docSnap.data().text && docSnap.data().text.trim() !== '') {
                                messageText.textContent = docSnap.data().text;
                                messageBar.style.display = 'block';
                            } else {
                                messageBar.style.display = 'none';
                            }
                        }
                    });
                } else {
                    console.log("User not authenticated. Firestore listeners paused.");
                }
            });
        } catch (e) {
            console.log("Firestore sync not active (offline or config missing)");
        }
    };
    initFirestore();

    // --- SYNC STATUS MANAGEMENT ---
    let syncStatus = 'synced'; // 'synced', 'syncing', 'offline', 'error' 

    const updateSyncStatus = (status, message = '') => {
        syncStatus = status;
        const syncElement = document.getElementById('sync-status');
        if (syncElement) {
            syncElement.innerHTML = getSyncStatusHTML(status, message);
        }
        console.log(`Sync status: ${status}${message ? ' - ' + message : ''}`);
    };

    const getSyncStatusHTML = (status, message) => {
        const icons = {
            synced: '<i class="bi bi-cloud-check"></i>',
            syncing: '<i class="bi bi-cloud-upload"></i>',
            offline: '<i class="bi bi-cloud-slash"></i>',
            error: '<i class="bi bi-cloud-exclamation"></i>'
        };

        const texts = {
            synced: 'Synced',
            syncing: 'Syncing...',
            offline: 'Offline',
            error: 'Sync Error'
        };

        const colors = {
            synced: '#27ae60',
            syncing: '#f39c12',
            offline: '#7f8c8d',
            error: '#e74c3c'
        };

        return `<span style="color: ${colors[status]}">${icons[status]} ${texts[status]}${message ? ': ' + message : ''}</span>`;
    };

    // Initialize sync status
    updateSyncStatus('synced');

    // Global sync function for manual sync
    window.manualSync = async () => {
        if (syncStatus === 'syncing') return;

        updateSyncStatus('syncing');
        try {
            // Import sync function from login.js or recreate it
            const { app } = await import('./firebase-config.js');
            const { getFirestore, writeBatch, doc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const db = getFirestore(app);

            const loans = JSON.parse(localStorage.getItem('loans')) || [];
            const employees = JSON.parse(localStorage.getItem('employees')) || [];
            const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
            const walletTransactions = JSON.parse(localStorage.getItem('walletTransactions')) || [];
            const profile = JSON.parse(localStorage.getItem('companyProfile')) || {};
            const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];

            const batchSize = 450;
            let batches = [];
            let currentBatch = writeBatch(db);
            let operationCount = 0;

            const sanitize = (obj) => {
                try {
                    return JSON.parse(JSON.stringify(obj));
                } catch (e) {
                    console.warn("Failed to sanitize object:", e);
                    return {};
                }
            };

            const addToBatch = (ref, data) => {
                try {
                    currentBatch.set(ref, data);
                    operationCount++;
                    if (operationCount >= batchSize) {
                        batches.push(currentBatch);
                        currentBatch = writeBatch(db);
                        operationCount = 0;
                    }
                } catch (e) {
                    console.error("Failed to add to batch:", e);
                }
            };

            // Process all data types
            loans.forEach((loan, index) => {
                try {
                    const loanId = loan.id || `loan_${Date.now()}_${index}`;
                    const loanRef = doc(db, "loans", loanId);
                    addToBatch(loanRef, sanitize(loan));
                } catch (e) {
                    console.error("Error processing loan:", e);
                }
            });

            employees.forEach((emp, index) => {
                try {
                    const empId = emp.id || `emp_${Date.now()}_${index}`;
                    const empRef = doc(db, "employees", empId);
                    addToBatch(empRef, sanitize(emp));
                } catch (e) {
                    console.error("Error processing employee:", e);
                }
            });

            expenses.forEach((exp, index) => {
                try {
                    const expId = exp.id || `exp_${Date.now()}_${index}`;
                    const expRef = doc(db, "expenses", expId);
                    addToBatch(expRef, sanitize(exp));
                } catch (e) {
                    console.error("Error processing expense:", e);
                }
            });

            walletTransactions.forEach((trans, index) => {
                try {
                    const transId = trans.id || `trans_${Date.now()}_${index}`;
                    const transRef = doc(db, "wallet_transactions", transId);
                    addToBatch(transRef, sanitize(trans));
                } catch (e) {
                    console.error("Error processing transaction:", e);
                }
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
                try {
                    const adminRef = doc(db, "admin_users", admin.username);
                    addToBatch(adminRef, sanitize(admin));
                } catch (e) {
                    console.error("Error processing admin:", e);
                }
            });

            const profileRef = doc(db, "settings", "companyProfile");
            addToBatch(profileRef, sanitize(profile));

            if (operationCount > 0) batches.push(currentBatch);

            console.log(`Manual sync: Committing ${batches.length} batches...`);

            // Add timeout
            const commitPromises = batches.map(batch => batch.commit());
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Sync timeout")), 30000)
            );

            await Promise.race([
                Promise.all(commitPromises),
                timeoutPromise
            ]);

            updateSyncStatus('synced', 'Manual sync completed');
            setTimeout(() => updateSyncStatus('synced'), 3000); // Reset after 3 seconds

        } catch (syncError) {
            console.error("Manual sync failed:", syncError);
            updateSyncStatus('error', syncError.message);
            setTimeout(() => updateSyncStatus('synced'), 5000); // Reset after 5 seconds
        }
    };

    const saveLoans = async (loanData = null, isDelete = false) => {
        localStorage.setItem('loans', JSON.stringify(loans));

        if (db && firestoreOps.doc && loanData) {
            const { doc, setDoc, addDoc, deleteDoc, collection } = firestoreOps;
            try {
                // Determine Collection: Use existing property or infer from status
                let colName = loanData.firestoreCollection;
                if (!colName) {
                    colName = (loanData.status === 'Pending') ? "loan_applications" : "loans";
                }

                if (isDelete) {
                    if (loanData.id) await deleteDoc(doc(db, colName, loanData.id));
                } else {
                    // Create a copy to save, excluding emi_schedule (saved separately)
                    const dataToSave = { ...loanData };
                    delete dataToSave.emi_schedule;

                    if (loanData.id) {
                        await setDoc(doc(db, colName, loanData.id), dataToSave);
                    } else {
                        const docRef = await addDoc(collection(db, colName), dataToSave);
                        loanData.id = docRef.id;
                        loanData.firestoreCollection = colName;
                        localStorage.setItem('loans', JSON.stringify(loans)); // Update local with ID
                    }
                }
            } catch (e) { console.error("Firestore Error:", e); }
        }
    };
    // Expose saveLoans globally
    window.saveLoans = saveLoans;

    // --- SAVE EMI SCHEDULE (New Function) ---
    const saveEmiSchedule = async (loanId, scheduleData) => {
        // Update local memory
        const loanIdx = loans.findIndex(l => l.id === loanId);
        if (loanIdx > -1) {
            loans[loanIdx].emi_schedule = scheduleData;
            localStorage.setItem('loans', JSON.stringify(loans));
        }

        // Save to Firestore
        if (db && firestoreOps.setDoc) {
            try {
                await firestoreOps.setDoc(firestoreOps.doc(db, "emi_schedule", loanId), scheduleData);
            } catch (e) { console.error("Error saving schedule:", e); }
        }
    };
    window.saveEmiSchedule = saveEmiSchedule;

    // Helper to calculate next due date (Starts 1 month after Issue Date)
    const getNextDueDate = (loan) => {
        if (!loan.dueDate) return null;

        let issueDate;
        if (typeof loan.dueDate === 'object' && 'seconds' in loan.dueDate) {
            issueDate = new Date(loan.dueDate.seconds * 1000);
        } else {
            issueDate = new Date(loan.dueDate);
        }
        if (isNaN(issueDate.getTime())) return null;

        const tenure = parseInt(loan.tenure) || 1;

        // Check emi_schedule first
        if (loan.emi_schedule) {
            for (let i = 1; i <= tenure; i++) {
                const entry = loan.emi_schedule[i] || loan.emi_schedule[i.toString()];
                if (!entry || entry.status !== 'Paid') {
                    const nextDate = new Date(issueDate);
                    nextDate.setMonth(issueDate.getMonth() + i);
                    return nextDate;
                }
            }
            return null; // All paid
        }

        // Legacy Fallback
        const paid = loan.paidInstallments || [];

        for (let i = 1; i <= tenure; i++) {
            if (!paid.includes(i)) {
                const nextDate = new Date(issueDate);
                nextDate.setMonth(issueDate.getMonth() + i);
                return nextDate;
            }
        }
        return null; // Loan fully paid or closed
    };

    // --- UPDATE HEADER USERNAME ---
    const headerUserName = document.querySelector('.user-name');
    const headerUserRole = document.querySelector('.user-role');
    const currentUser = localStorage.getItem('currentUser');
    const userRole = localStorage.getItem('userRole') || 'Staff';

    if (headerUserName && currentUser) {
        headerUserName.textContent = currentUser;
    }
    if (headerUserRole) {
        headerUserRole.textContent = userRole;
    }

    // Restrict Sidebar Access for Non-Admins
    if (userRole !== 'Administrator') {
        const settingsLink = document.querySelector('nav a[href="settings.html"]');
        if (settingsLink) settingsLink.style.display = 'none';
        const profileLink = document.querySelector('nav a[href="profile.html"]');
        if (profileLink) profileLink.style.display = 'none';

        // Hide Wallet from Quick Actions
    }

    // --- MANAGE LOANS PAGE LOGIC (index.html) ---
    const loanTableBody = document.querySelector('#loanTable body');
    const paperLoanForm = document.getElementById('paperLoanForm');

    if (loanTableBody) {
        // Function to render the table
        function renderLoans() {
            loanTableBody.innerHTML = ''; // Clear current list

            loans.forEach((loan, index) => {
                const row = document.createElement('tr');

                row.innerHTML = `
                    <td>
                        <div style="font-weight: 600;">${loan.borrower}</div>
                        ${loan.loanRef ? `<div style="font-size: 0.75rem; color: #7f8c8d;">${loan.loanRef}</div>` : ''}
                    </td>
                    <td>₹${parseFloat(loan.amount).toFixed(2)}</td>
                    <td>${formatDate(loan.dueDate)}</td>
                    <td>
                        <button class="delete-btn" data-index="${index}">Delete</button>
                    </td>
                `;

                loanTableBody.appendChild(row);
            });

            // Re-attach event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', handleDelete);
            });

            updateManageLoansStats();
        }

        // Handle delete action
        function handleDelete(e) {
            const index = e.target.getAttribute('data-index');
            const loanToDelete = loans[index];
            loans.splice(index, 1);
            saveLoans(loanToDelete, true); // Save to storage
            renderLoans();
        }

        // Initial render
        renderLoans();
        document.addEventListener('loans-updated', renderLoans);
    }

    // Handle Paper Form Submission
    if (paperLoanForm) {
        // Helper to setup file upload previews
        const setupFileUpload = (inputId, previewId, placeholderId = null) => {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            const placeholder = placeholderId ? document.getElementById(placeholderId) : null;

            if (input) {
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            if (preview) {
                                preview.src = event.target.result;
                                preview.style.display = 'block';
                            }
                            if (placeholder) placeholder.style.display = 'none';
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }
        };

        setupFileUpload('loan-photo', 'preview-photo', 'photo-text');
        setupFileUpload('loan-sign-applicant', 'preview-sign-applicant', 'sign-app-text');
        setupFileUpload('loan-sign-guarantor', 'preview-sign-guarantor', 'sign-guar-text');

        // Auto-Calculate EMI in Form
        const calculateFormEMI = () => {
            const amount = parseFloat(document.getElementById('p-amount').value) || 0;
            const interest = parseFloat(document.getElementById('p-interest').value) || 0;
            const tenure = parseInt(document.getElementById('p-tenure').value) || 0;
            const emiField = document.getElementById('p-emi');

            if (amount > 0 && tenure > 0 && emiField) {
                const emi = (amount / tenure) + (amount * (interest / 100));
                emiField.value = '₹' + emi.toFixed(2);
            } else if (emiField) {
                emiField.value = '';
            }
        };
        ['p-amount', 'p-interest', 'p-tenure'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calculateFormEMI);
        });

        // Check for Edit Mode
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        const mode = urlParams.get('mode');

        if (mode === 'edit' && editId !== null && loans[editId]) {
            const loan = loans[editId];
            document.title = "Edit Loan Application";

            // Populate Fields
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

            setVal('p-borrower', loan.borrower);
            setVal('p-dob', loan.dob);
            setVal('p-father', loan.fatherName);
            setVal('p-guarantor', loan.guarantorName);
            setVal('p-village', loan.village);
            setVal('p-po', loan.po);
            setVal('p-district', loan.district);
            setVal('p-pin', loan.pin);
            setVal('p-mobile', loan.mobile);
            setVal('p-whatsapp', loan.whatsapp);
            setVal('p-email', loan.email);
            setVal('p-aadhaar', loan.aadhaar);
            setVal('p-pan', loan.pan);
            setVal('p-amount', loan.amount);
            setVal('p-interest', loan.interest);
            setVal('p-tenure', loan.tenure);
            setVal('p-dueDate', loan.dueDate);
            setVal('p-purpose', loan.purpose);
            if (loan.loanRef) { const refEl = document.getElementById('display-loan-ref'); if (refEl) refEl.textContent = `Ref: ${loan.loanRef}`; }
            calculateFormEMI(); // Calculate EMI for existing data

            // Populate Images
            const setPreview = (previewId, placeholderId, data) => {
                if (data) {
                    const img = document.getElementById(previewId);
                    const ph = document.getElementById(placeholderId);
                    if (img) { img.src = data; img.style.display = 'block'; }
                    if (ph) ph.style.display = 'none';
                }
            };
            setPreview('preview-photo', 'photo-text', loan.photo);
            setPreview('preview-sign-applicant', 'sign-app-text', loan.applicantSignature);
            setPreview('preview-sign-guarantor', 'sign-guar-text', loan.guarantorSignature);

            const submitBtn = paperLoanForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Application';
        }

        paperLoanForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Get image data safely
            const getImgSrc = (id) => {
                const el = document.getElementById(id);
                return (el && el.src && el.src.startsWith('data:image')) ? el.src : '';
            };

            const userRole = localStorage.getItem('userRole');
            const loanStatus = userRole === 'Administrator' ? 'Active' : 'Pending';

            const newLoan = {
                employeeEmail: localStorage.getItem('currentUserEmail'),
                assignedTo: document.getElementById('p-assigned-to') ? document.getElementById('p-assigned-to').value : (localStorage.getItem('currentUser') || ''),
                createdBy: localStorage.getItem('currentUser'),
                borrower: document.getElementById('p-borrower').value,
                amount: document.getElementById('p-amount').value,
                dueDate: document.getElementById('p-dueDate').value,
                // Additional fields
                dob: document.getElementById('p-dob').value,
                fatherName: document.getElementById('p-father').value,
                guarantorName: document.getElementById('p-guarantor').value,
                village: document.getElementById('p-village').value,
                po: document.getElementById('p-po').value,
                district: document.getElementById('p-district').value,
                pin: document.getElementById('p-pin').value,
                mobile: document.getElementById('p-mobile').value,
                whatsapp: document.getElementById('p-whatsapp').value,
                email: document.getElementById('p-email').value,
                aadhaar: document.getElementById('p-aadhaar').value,
                pan: document.getElementById('p-pan').value,
                interest: document.getElementById('p-interest').value,
                tenure: document.getElementById('p-tenure').value,
                purpose: document.getElementById('p-purpose').value,
                photo: getImgSrc('preview-photo'),
                applicantSignature: getImgSrc('preview-sign-applicant'),
                guarantorSignature: getImgSrc('preview-sign-guarantor'),
                status: loanStatus,
                createdBy: localStorage.getItem('currentUser')
            };

            let message = '';
            if (mode === 'edit' && editId !== null) {
                // Preserve existing data like payments
                const updatedLoan = { ...loans[editId], ...newLoan };
                loans[editId] = updatedLoan;
                await saveLoans(updatedLoan);
                message = 'Loan Application Updated Successfully!';
            } else {
                // Generate Loan Reference Number
                const date = new Date();
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                const refNo = `LN${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${randomNum}`;
                newLoan.loanRef = refNo;

                loans.push(newLoan);
                await saveLoans(newLoan);
                if (loanStatus === 'Pending') {
                    message = `Application Submitted for Approval!<br>Ref No: <strong>${refNo}</strong>`;
                } else {
                    message = `Loan Disbursed Successfully!<br>Ref No: <strong>${refNo}</strong>`;
                }
            }

            const successPopup = document.getElementById('success-popup');
            const handleClose = () => {
                paperLoanForm.reset();
                if (window.location.pathname.includes('add-loan.html')) {
                    if (window.opener && !window.opener.closed) {
                        window.opener.location.reload();
                    }
                    window.close();
                } else {
                    window.location.reload();
                }
            };

            if (successPopup) {
                const msgEl = document.getElementById('success-message');
                if (msgEl) msgEl.innerHTML = message;
                successPopup.style.display = 'flex';

                const closeBtn = document.getElementById('close-success-btn');
                if (closeBtn) closeBtn.onclick = handleClose;
            } else {
                alert(message.replace(/<br>/g, '\n').replace(/<strong>|<\/strong>/g, ''));
                handleClose();
            }
        });

        document.getElementById('cancelLoanBtn').addEventListener('click', () => {
            window.close();
        });
    }

    // --- GLOBAL SEARCH LOGIC ---
    const searchInput = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');

    if (searchInput && searchResults) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            searchResults.innerHTML = '';

            if (query.length > 0) {
                const userRole = localStorage.getItem('userRole');
                const currentUser = localStorage.getItem('currentUser');

                const matches = loans.map((loan, index) => ({ ...loan, originalIndex: index }))
                    .filter(l => {
                        if (userRole !== 'Administrator') {
                            const currentUserEmail = localStorage.getItem('currentUserEmail');
                            const matchesName = (l.assignedTo === currentUser || l.createdBy === currentUser);
                            const matchesEmail = (l.employeeEmail && l.employeeEmail === currentUserEmail);
                            if (!matchesName && !matchesEmail) return false;
                        }
                        return l.borrower.toLowerCase().includes(query);
                    });

                if (matches.length > 0) {
                    searchResults.style.display = 'block';
                    matches.forEach(match => {
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        div.innerHTML = `
                            <div style="flex-grow: 1;">
                                <div style="font-weight:bold;">${match.borrower}</div>
                                <div style="font-size:0.8rem; color:#777;">Amount: ₹${parseFloat(match.amount).toFixed(2)}</div>
                            </div>
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <a href="loan-profile.html?id=${match.originalIndex}" target="_blank" style="background-color: #3498db; color: white; padding: 4px 8px; text-decoration: none; border-radius: 4px; font-size: 11px; white-space: nowrap;">View Profile</a>
                                <button class="search-loan-profile-btn" data-index="${match.originalIndex}" style="background-color: #2c3e50; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap;">Loan Profile</button>
                            </div>
                        `;

                        div.style.display = 'flex';
                        div.style.justifyContent = 'space-between';
                        div.style.alignItems = 'center';
                        div.style.cursor = 'default';

                        div.addEventListener('click', (e) => {
                            if (e.target.classList.contains('search-loan-profile-btn')) {
                                e.stopPropagation();
                                const idx = e.target.getAttribute('data-index');
                                if (typeof window.openLoanProfileModal === 'function') {
                                    window.openLoanProfileModal(idx);
                                } else {
                                    window.location.href = `active-loans.html?id=${idx}`;
                                }
                                searchResults.style.display = 'none';
                                searchInput.value = '';
                            }
                        });
                        searchResults.appendChild(div);
                    });
                } else {
                    searchResults.style.display = 'none';
                }
            } else {
                searchResults.style.display = 'none';
            }
        });

        // Close search on outside click
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }

    // --- DASHBOARD PAGE LOGIC (dashboard.html) ---
    const activeLoansEl = document.getElementById('stat-active-loans');
    const pendingAppsEl = document.getElementById('stat-pending-applications');

    if (activeLoansEl) {
        const closedLoansEl = document.getElementById('stat-closed-loans');
        const totalBorrowersEl = document.getElementById('stat-total-borrowers');
        const monthlyRevenueEl = document.getElementById('stat-monthly-revenue');
        const totalInterestEl = document.getElementById('stat-total-interest');
        const chartCanvas = document.getElementById('loanStatusChart');

        let loanChart = null;
        let plChart = null;
        let finChart = null;

        const renderDashboard = () => {
            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');

            const displayLoans = (userRole !== 'Administrator') ? loans.filter(l => {
                const matchesName = (l.assignedTo === currentUser || l.createdBy === currentUser);
                const matchesEmail = (l.employeeEmail && l.employeeEmail === currentUserEmail);
                return matchesName || matchesEmail;
            }) : loans;

            // Calculate Stats
            const closedCount = displayLoans.filter(l => getNextDueDate(l) === null).length;
            const pendingCount = displayLoans.filter(l => l.status === 'Pending').length;
            const activeLoans = displayLoans.filter(l => l.status !== 'Pending' && getNextDueDate(l) !== null);
            const uniqueBorrowers = new Set(displayLoans.map(l => (l.borrower || '').trim()).filter(b => b)).size;

            // For "My Applications" count on employee dashboard
            const myApplicationsEl = document.getElementById('stat-my-applications');
            if (myApplicationsEl) {
                const myPendingApps = fetchedApps.filter(app => {
                    const matchesName = (app.createdBy === currentUser);
                    const matchesEmail = (app.employeeEmail && app.employeeEmail === currentUserEmail);
                    return (matchesName || matchesEmail) && app.status === 'Pending';
                }).length;
                myApplicationsEl.textContent = myPendingApps;
            }

            // Calculate Total Interest Earned (Projected)
            const totalInterest = displayLoans.reduce((sum, loan) => {
                if (loan.status === 'Pending' || loan.status === 'Rejected') return sum;
                const P = parseFloat(loan.amount) || 0;
                const R = parseFloat(loan.interest) || 0;
                const N = parseInt(loan.tenure) || 0;
                return sum + (P * (R / 100) * N);
            }, 0);

            // Calculate Monthly Revenue
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            let monthlyRevenue = 0;

            displayLoans.forEach(loan => {
                if (loan.status === 'Pending' || loan.status === 'Rejected') return;

                const P = parseFloat(loan.amount) || 0;
                const R = parseFloat(loan.interest) || 0;
                const N = parseInt(loan.tenure) || 1;
                const emi = (P / N) + (P * (R / 100));
                const issueDate = parseSafeDate(loan.dueDate);

                if (loan.emi_schedule) {
                    Object.values(loan.emi_schedule).forEach(entry => {
                        if (entry.date) {
                            const payDate = parseSafeDate(entry.date);
                            if (payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear) {
                                monthlyRevenue += parseFloat(entry.amountPaid || 0);
                            }
                        }
                    });
                } else {
                    // Legacy Logic
                    if (loan.paidInstallments) {
                        loan.paidInstallments.forEach(inst => {
                            const instDate = new Date(issueDate);
                            if (instDate.getTime() > 0) {
                                instDate.setMonth(issueDate.getMonth() + parseInt(inst));
                                if (instDate.getMonth() === currentMonth && instDate.getFullYear() === currentYear) {
                                    monthlyRevenue += emi;
                                }
                            }
                        });
                    }

                    if (loan.partialPayments) {
                        Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                            const instDate = new Date(issueDate);
                            if (instDate.getTime() > 0) {
                                instDate.setMonth(issueDate.getMonth() + parseInt(inst));
                                if (instDate.getMonth() === currentMonth && instDate.getFullYear() === currentYear) {
                                    monthlyRevenue += parseFloat(amount);
                                }
                            }
                        });
                    }
                }
            });

            // Calculate Financial Overview Metrics
            const filterInput = document.getElementById('fin-overview-filter');
            const filterDate = filterInput ? filterInput.value : ''; // YYYY-MM

            let totalDisbursed = 0;
            let totalRepaid = 0;
            let overviewInterest = 0;

            displayLoans.forEach(loan => {
                if (loan.status === 'Pending' || loan.status === 'Rejected') return;

                const P = parseFloat(loan.amount) || 0;
                const R = parseFloat(loan.interest) || 0;
                const N = parseInt(loan.tenure) || 1;
                const emi = (P / N) + (P * (R / 100));
                const issueDate = parseSafeDate(loan.dueDate);

                // 1. Disbursed & Interest (Filter by Issue Date)
                let includeLoan = true;
                if (filterDate && issueDate.getTime() > 0) {
                    const loanMonth = issueDate.toISOString().slice(0, 7);
                    if (loanMonth !== filterDate) includeLoan = false;
                } else if (filterDate && issueDate.getTime() === 0) {
                    includeLoan = false; // Filter set but date invalid/missing
                }

                if (includeLoan) {
                    totalDisbursed += P;
                    overviewInterest += (P * (R / 100) * N);
                }

                // 2. Repaid (Filter by Payment Date)
                if (loan.emi_schedule) {
                    Object.values(loan.emi_schedule).forEach(entry => {
                        if (entry.date) {
                            const payDate = parseSafeDate(entry.date);
                            let includePayment = true;
                            if (filterDate && payDate.getTime() > 0) {
                                const payMonth = payDate.toISOString().slice(0, 7);
                                if (payMonth !== filterDate) includePayment = false;
                            } else if (filterDate && payDate.getTime() === 0) {
                                includePayment = false;
                            }
                            if (includePayment) totalRepaid += parseFloat(entry.amountPaid || 0);
                        }
                    });
                } else {
                    // Legacy Logic
                    if (loan.paidInstallments) {
                        loan.paidInstallments.forEach(inst => {
                            // Determine payment date (use actual if available, else scheduled)
                            let payDate = issueDate.getTime() > 0 ? new Date(issueDate) : null;
                            if (payDate) {
                                payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                                if (loan.paidDates && loan.paidDates[inst]) {
                                    payDate = parseSafeDate(loan.paidDates[inst]);
                                }

                                let includePayment = true;
                                if (filterDate && payDate.getTime() > 0) {
                                    const payMonth = payDate.toISOString().slice(0, 7);
                                    if (payMonth !== filterDate) includePayment = false;
                                } else if (filterDate) {
                                    includePayment = false;
                                }

                                if (includePayment) totalRepaid += emi;
                            }
                        });
                    }
                    if (loan.partialPayments) {
                        Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                            let payDate = issueDate.getTime() > 0 ? new Date(issueDate) : null;
                            if (payDate) {
                                payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                                if (loan.partialPaymentDates && loan.partialPaymentDates[inst]) {
                                    payDate = parseSafeDate(loan.partialPaymentDates[inst]);
                                }

                                let includePayment = true;
                                if (filterDate && payDate.getTime() > 0) {
                                    const payMonth = payDate.toISOString().slice(0, 7);
                                    if (payMonth !== filterDate) includePayment = false;
                                } else if (filterDate) {
                                    includePayment = false;
                                }

                                if (includePayment) totalRepaid += parseFloat(amount);
                            }
                        });
                    }
                }
            });

            // Determine Row 3 Metric (Outstanding vs Net Flow)
            let labelOutstanding = "Outstanding Balance";
            let valOutstanding = 0;
            let colorOutstanding = "#e74c3c"; // Default Red for Debt

            if (filterDate) {
                // Filtered View: Show Net Cash Flow
                labelOutstanding = "Net Cash Flow";
                valOutstanding = totalRepaid - totalDisbursed;
                // Green if positive (Profit), Red if negative (Investment)
                colorOutstanding = valOutstanding >= 0 ? "#27ae60" : "#e74c3c";
            } else {
                // Global View: Show Total Outstanding
                // Outstanding = (Total Disbursed + Total Interest) - Total Repaid
                valOutstanding = (totalDisbursed + overviewInterest) - totalRepaid;
            }

            // Update DOM
            activeLoansEl.textContent = activeLoans.length;
            if (pendingAppsEl) pendingAppsEl.textContent = pendingCount;
            if (closedLoansEl) closedLoansEl.textContent = closedCount;
            if (totalBorrowersEl) totalBorrowersEl.textContent = uniqueBorrowers;
            if (monthlyRevenueEl) monthlyRevenueEl.textContent = '₹' + monthlyRevenue.toFixed(2);
            if (totalInterestEl) totalInterestEl.textContent = '₹' + totalInterest.toFixed(2);
            // Animation Helper
            const animateValue = (obj, start, end, duration, isCurrency) => {
                if (!obj) return;
                let startTimestamp = null;
                const step = (timestamp) => {
                    if (!startTimestamp) startTimestamp = timestamp;
                    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
                    const currentVal = start + (end - start) * easeProgress;

                    if (isCurrency) obj.textContent = '₹' + currentVal.toFixed(2);
                    else obj.textContent = Math.floor(currentVal);

                    if (progress < 1) window.requestAnimationFrame(step);
                    else obj.textContent = isCurrency ? '₹' + end.toFixed(2) : end;
                };
                window.requestAnimationFrame(step);
            };

            // Update DOM with Animation
            animateValue(activeLoansEl, 0, activeLoans.length, 1500, false);
            if (pendingAppsEl) animateValue(pendingAppsEl, 0, pendingCount, 1500, false);
            if (closedLoansEl) animateValue(closedLoansEl, 0, closedCount, 1500, false);
            if (totalBorrowersEl) animateValue(totalBorrowersEl, 0, uniqueBorrowers, 1500, false);
            if (monthlyRevenueEl) animateValue(monthlyRevenueEl, 0, monthlyRevenue, 1500, true);
            if (totalInterestEl) animateValue(totalInterestEl, 0, totalInterest, 1500, true);

            // Update Financial Overview Chart
            const finCanvas = document.getElementById('financialOverviewChart');
            if (finCanvas) {
                let chartLabels, chartData, chartColors, chartTitle;

                if (filterDate) {
                    // Filtered View: Inflow vs Outflow
                    chartLabels = ['Disbursed (Outflow)', 'Repaid (Inflow)'];
                    chartData = [totalDisbursed, totalRepaid];
                    chartColors = ['#3498db', '#27ae60'];
                    chartTitle = `Financial Activity (${filterDate})`;
                } else {
                    // Global View: Repaid vs Outstanding
                    chartLabels = ['Total Repaid', 'Outstanding Balance'];
                    chartData = [totalRepaid, valOutstanding];
                    chartColors = ['#27ae60', '#e74c3c'];
                    chartTitle = 'Overall Recovery Progress';
                }

                if (finChart) finChart.destroy();
                finChart = new Chart(finCanvas, {
                    type: 'pie',
                    data: {
                        labels: chartLabels,
                        datasets: [{
                            data: chartData,
                            backgroundColor: chartColors,
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            title: { display: true, text: chartTitle },
                            tooltip: { callbacks: { label: (c) => ` ${c.label}: ₹${c.raw.toFixed(2)}` } }
                        }
                    }
                });
            }

            // Render Chart
            if (chartCanvas) {
                if (loanChart) {
                    loanChart.destroy();
                }
                loanChart = new Chart(chartCanvas, {
                    type: 'doughnut',
                    data: {
                        labels: ['Active Loans', 'Closed Loans'],   //to show details of Loan Status Distribution graph 
                        datasets: [{
                            data: [activeLoans.length, closedCount],
                            backgroundColor: ['#3498db', '#e74c3c'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }

            // Render Profit/Loss Chart (Net Cash Flow - Last 6 Months)
            const plCanvas = document.getElementById('profitLossChart');
            if (plCanvas) {
                const months = [];
                const monthLabels = [];
                const today = new Date();

                // Generate last 6 months keys
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                    const key = d.toISOString().slice(0, 7); // YYYY-MM
                    months.push(key);
                    monthLabels.push(d.toLocaleString('default', { month: 'short', year: 'numeric' }));
                }

                const cashFlow = {};
                months.forEach(m => cashFlow[m] = 0);

                displayLoans.forEach(loan => {
                    if (loan.status === 'Pending' || loan.status === 'Rejected') return;

                    // Outflow: Disbursements
                    if (loan.dueDate) {
                        const issueMonth = loan.dueDate.slice(0, 7);
                        if (cashFlow.hasOwnProperty(issueMonth)) {
                            cashFlow[issueMonth] -= (parseFloat(loan.amount) || 0);
                        }
                    }

                    // Inflow: Repayments
                    const P = parseFloat(loan.amount) || 0;
                    const R = parseFloat(loan.interest) || 0;
                    const N = parseInt(loan.tenure) || 1;
                    const emi = (P / N) + (P * (R / 100));
                    const issueDate = loan.dueDate ? new Date(loan.dueDate) : new Date();

                    // Full Installments
                    if (loan.emi_schedule) {
                        Object.values(loan.emi_schedule).forEach(entry => {
                            if (entry.date && entry.amountPaid) {
                                const d = new Date(entry.date);
                                if (!isNaN(d.getTime())) {
                                    const payMonth = d.toISOString().slice(0, 7);
                                    if (cashFlow.hasOwnProperty(payMonth)) cashFlow[payMonth] += parseFloat(entry.amountPaid);
                                }
                            }
                        });
                    } else {
                        // Legacy
                        if (loan.paidInstallments) {
                            loan.paidInstallments.forEach(inst => {
                                let payDate = new Date(issueDate);
                                if (isNaN(payDate.getTime())) return;
                                payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                                if (loan.paidDates && loan.paidDates[inst]) payDate = new Date(loan.paidDates[inst]);

                                if (!isNaN(payDate.getTime())) {
                                    const payMonth = payDate.toISOString().slice(0, 7);
                                    if (cashFlow.hasOwnProperty(payMonth)) cashFlow[payMonth] += emi;
                                }
                            });
                        }

                        // Partial Payments
                        if (loan.partialPayments) {
                            Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                                let payDate = new Date(issueDate);
                                if (isNaN(payDate.getTime())) return;
                                payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                                if (loan.partialPaymentDates && loan.partialPaymentDates[inst]) payDate = new Date(loan.partialPaymentDates[inst]);

                                if (!isNaN(payDate.getTime())) {
                                    const payMonth = payDate.toISOString().slice(0, 7);
                                    if (cashFlow.hasOwnProperty(payMonth)) cashFlow[payMonth] += parseFloat(amount);
                                }
                            });
                        }
                    }
                });

                const dataValues = months.map(m => cashFlow[m]);
                const bgColors = dataValues.map(v => v >= 0 ? '#28a745' : '#dc3545');

                if (plChart) plChart.destroy();
                plChart = new Chart(plCanvas, {
                    type: 'bar',
                    data: {
                        labels: monthLabels,
                        datasets: [{
                            label: 'Net Cash Flow',
                            data: dataValues,
                            backgroundColor: bgColors,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` Net Flow: ₹${c.raw.toFixed(2)}` } } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }

            // --- EMPLOYEE PERFORMANCE TABLE LOGIC ---
            const empTableBody = document.getElementById('employee-performance-tbody');
            if (empTableBody) {
                const employees = JSON.parse(localStorage.getItem('employees')) || [];
                const empStats = {};

                // Initialize stats for all employees
                employees.forEach(emp => {
                    empStats[emp.email] = { name: emp.name, count: 0, amount: 0, email: emp.email };
                });

                // Calculate stats based on loans
                displayLoans.forEach(loan => {
                    // Only count disbursed loans (Active, Closed, Overdue) - exclude Pending/Rejected
                    if (loan.status === 'Pending' || loan.status === 'Rejected') return;

                    // Try to match loan to an employee
                    let matchedEmail = null;
                    if (loan.employeeEmail && empStats[loan.employeeEmail]) {
                        matchedEmail = loan.employeeEmail;
                    } else if (loan.assignedTo) {
                        // Fallback: Match by name
                        const found = employees.find(e => e.name === loan.assignedTo);
                        if (found) matchedEmail = found.email;
                    }

                    if (matchedEmail) {
                        empStats[matchedEmail].count++;
                        empStats[matchedEmail].amount += parseFloat(loan.amount || 0);
                    }
                });

                empTableBody.innerHTML = '';
                if (employees.length === 0) {
                    empTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #7f8c8d;">No employees found. Add staff in "Manage Staff".</td></tr>';
                } else {
                    // Sort by Total Disbursed (High to Low)
                    const sortedStats = Object.values(empStats).sort((a, b) => b.amount - a.amount);

                    sortedStats.forEach(stat => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>
                                <a href="employee-report.html?email=${encodeURIComponent(stat.email)}" style="text-decoration: none; color: inherit;" title="View Detailed Report for ${stat.name}">
                                    <div style="font-weight: 600;">${stat.name}</div>
                                    <div style="font-size: 0.75rem; color: #7f8c8d;">${stat.email}</div>
                                </a>
                            </td>
                            <td style="text-align: center;">${stat.count}</td>
                            <td style="text-align: right;">₹${stat.amount.toFixed(2)}</td>
                        `;
                        empTableBody.appendChild(row);
                    });
                }
            }
        };

        renderDashboard();
        document.addEventListener('loans-updated', renderDashboard);

        // Add Listener for Date Filter
        const finFilter = document.getElementById('fin-overview-filter');
        if (finFilter) {
            finFilter.addEventListener('change', renderDashboard);
        }

        // Modal Logic
        const modal = document.getElementById('borrower-modal');
        const closeModal = document.querySelector('.custom-close-modal');
        let currentBorrowerName = '';

        if (modal && closeModal) {

            closeModal.addEventListener('click', () => {
                modal.style.display = "none";
            });

            window.addEventListener('click', (e) => {
                if (e.target == modal) {
                    modal.style.display = "none";
                }
            });

            // Expose function globally for search bar
            window.showBorrowerDetailsGlobal = showBorrowerDetails;

            function showBorrowerDetails(name) {
                const modalTitle = document.getElementById('modal-borrower-name');
                const modalTableBody = document.querySelector('#modal-loan-table ');

                modalTitle.textContent = name;
                modalTableBody.innerHTML = '';

                const today = new Date().toISOString().split('T')[0];

                // Map loans to include original index for editing
                const borrowerLoans = loans.map((loan, index) => ({ ...loan, originalIndex: index }))
                    .filter(l => l.borrower.trim() === name);

                borrowerLoans.forEach(loan => {
                    const row = document.createElement('tr');
                    const nextDue = getNextDueDate(loan);
                    const nextDueStr = nextDue ? nextDue.toISOString().split('T')[0] : 'Closed';
                    const isOverdue = nextDue && nextDueStr < today;
                    const statusText = isOverdue ? 'Overdue' : 'Active';
                    const statusColor = isOverdue ? '#e74c3c' : '#27ae60';

                    row.innerHTML = `
                        <td>₹${parseFloat(loan.amount).toFixed(2)}</td>
                        <td>${loan.dueDate}</td>
                        <td>${nextDueStr}</td>
                        <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                        <td>
                            <a href="loan-profile.html?id=${loan.originalIndex}" target="_blank" style="background-color: #3498db; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Profile</a>
                        </td>
                    `;
                    modalTableBody.appendChild(row);
                });

                modal.style.display = "block";
            }

            // Edit/Save Event Listener
            const modalTableBody = document.querySelector('#modal-loan-table ');
            modalTableBody.addEventListener('click', (e) => {
                if (e.target.classList.contains('edit-loan-btn')) {
                    const btn = e.target;
                    const row = btn.closest('tr');
                    const index = btn.getAttribute('data-index');
                    const loan = loans[index];

                    // Convert cells to inputs
                    const amountCell = row.children[0];
                    const dateCell = row.children[1];

                    amountCell.innerHTML = `<input type="number" value="${loan.amount}" step="0.01" style="width: 80px; padding: 5px;">`;
                    dateCell.innerHTML = `<input type="date" value="${loan.dueDate}" style="padding: 5px;">`;

                    // Change button to Save
                    btn.textContent = 'Save';
                    btn.className = 'save-loan-btn';
                    btn.style.backgroundColor = '#27ae60';
                } else if (e.target.classList.contains('save-loan-btn')) {
                    const btn = e.target;
                    const row = btn.closest('tr');
                    const index = btn.getAttribute('data-index');

                    const newAmount = row.children[0].querySelector('input').value;
                    const newDate = row.children[1].querySelector('input').value;

                    if (newAmount && newDate) {
                        loans[index].amount = newAmount;
                        loans[index].dueDate = newDate;
                        saveLoans(loans[index]);
                        renderDashboard(); // Update background stats
                        showBorrowerDetails(currentBorrowerName); // Re-render modal
                    } else {
                        alert('Please fill in both fields.');
                    }
                }
            });
        }
    }

    // --- EMPLOYEE DASHBOARD SPECIFIC LOGIC ---
    if (window.location.pathname.includes('Employee-dashboard.html')) {
        const mainContent = document.querySelector('main');
        if (mainContent) {
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.justifyContent = 'flex-end';
            btnContainer.style.marginBottom = '20px';

            const reportsBtn = document.createElement('button');
            reportsBtn.className = 'btn';
            reportsBtn.innerHTML = '<i class="bi bi-bar-chart-line"></i> My Reports';
            reportsBtn.style.backgroundColor = '#8e44ad';
            reportsBtn.style.color = 'white';
            reportsBtn.style.border = 'none';
            reportsBtn.style.padding = '10px 20px';
            reportsBtn.style.borderRadius = '30px';
            reportsBtn.style.fontWeight = 'bold';
            reportsBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            reportsBtn.style.display = 'flex';
            reportsBtn.style.alignItems = 'center';
            reportsBtn.style.gap = '8px';
            reportsBtn.style.cursor = 'pointer';
            reportsBtn.style.transition = 'transform 0.2s, box-shadow 0.2s';
            reportsBtn.style.marginRight = '10px';

            reportsBtn.onmouseover = () => {
                reportsBtn.style.transform = 'translateY(-2px)';
                reportsBtn.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
            };
            reportsBtn.onmouseout = () => {
                reportsBtn.style.transform = 'translateY(0)';
                reportsBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            };

            reportsBtn.addEventListener('click', () => {
                window.location.href = 'report.html';
            });

            const profileBtn = document.createElement('button');
            profileBtn.className = 'btn';
            profileBtn.innerHTML = '<i class="bi bi-person-circle"></i> My Profile';
            profileBtn.style.backgroundColor = '#c70f81ff';
            profileBtn.style.color = 'white';
            profileBtn.style.border = 'none';
            profileBtn.style.padding = '10px 20px';
            profileBtn.style.borderRadius = '30px';
            profileBtn.style.fontWeight = 'bold';
            profileBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            profileBtn.style.display = 'flex';
            profileBtn.style.alignItems = 'center';
            profileBtn.style.gap = '8px';
            profileBtn.style.cursor = 'pointer';
            profileBtn.style.transition = 'transform 0.2s, box-shadow 0.2s';

            profileBtn.onmouseover = () => {
                profileBtn.style.transform = 'translateY(-2px)';
                profileBtn.style.boxShadow = '0 6px 12px rgba(255, 255, 255, 0.15)';
            };
            profileBtn.onmouseout = () => {
                profileBtn.style.transform = 'translateY(0)';
                profileBtn.style.boxShadow = '0 4px 6px rgba(7, 7, 7, 0.1)';
            };

            profileBtn.addEventListener('click', () => {
                window.location.href = 'employee-profile.html';
            });

            btnContainer.appendChild(reportsBtn);
            btnContainer.appendChild(profileBtn);

            const messageBar = mainContent.querySelector('.message-bar');
            if (messageBar) {
                messageBar.insertAdjacentElement('afterend', btnContainer);
            } else {
                mainContent.insertBefore(btnContainer, mainContent.firstChild);
            }

            // --- NEW: My Applications Table ---
            const gridSection = mainContent.querySelector('.dashboard-grid');
            const tableContainer = document.createElement('div');
            tableContainer.style.marginTop = '20px';
            tableContainer.innerHTML = `
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <h3 style="margin-bottom: 15px; color: #2c3e50;">My Applications</h3>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f8f9fa; text-align: left;">
                                    <th style="padding: 12px; border-bottom: 2px solid #eee;">Reference</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #eee;">Borrower</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #eee;">Amount</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #eee;">Date</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #eee;">Status</th>
                                    <th style="padding: 12px; border-bottom: 2px solid #eee;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="emp-apps-tbody">
                                <tr><td colspan="6" style="text-align:center; padding: 20px;">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Add Event Listener for Action Buttons
            tableContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                // Try to get index from attribute, or recalculate if needed
                let index = btn.getAttribute('data-index');
                const docId = btn.getAttribute('data-doc-id');

                if (index === '-1' || index === null) {
                    index = loans.findIndex(l => l.id === docId);
                }

                if (index !== -1 && index !== null) {
                    if (btn.classList.contains('btn-view-app')) {
                        window.open(`loan-profile.html?id=${index}`, '_blank');
                    } else if (btn.classList.contains('btn-edit-app')) {
                        window.open(`add-loan.html?id=${index}&mode=edit`, '_blank');
                    }
                } else {
                    alert("Loan data is syncing. Please try again in a moment.");
                }
            });

            if (gridSection) {
                gridSection.parentNode.insertBefore(tableContainer, gridSection.nextSibling);
            } else {
                mainContent.appendChild(tableContainer);
            }

            const initEmployeeApps = async () => {
                const email = localStorage.getItem('currentUserEmail');
                if (!email) return;

                try {
                    const { app } = await import('./firebase-config.js');
                    const { getFirestore, collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const db = getFirestore(app);

                    const q = query(collection(db, "loan_applications"), where("employeeEmail", "==", email));

                    onSnapshot(q, (snapshot) => {
                        const tbody = document.getElementById('emp-apps-tbody');
                        if (!tbody) return;

                        tbody.innerHTML = '';
                        if (snapshot.empty) {
                            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #777;">No applications found.</td></tr>';
                            return;
                        }

                        snapshot.forEach(doc => {
                            const app = doc.data();
                            const tr = document.createElement('tr');
                            let statusColor = '#f39c12'; // Pending
                            if (app.status === 'Rejected') statusColor = '#e74c3c';
                            if (app.status === 'Approved' || app.status === 'Active') statusColor = '#27ae60';

                            // Safe Date Formatting
                            let dateStr = 'N/A';
                            if (app.date) dateStr = formatDate(app.date);
                            else if (app.createdAt && app.createdAt.seconds) dateStr = formatDate(new Date(app.createdAt.seconds * 1000));
                            else if (app.createdAt) dateStr = formatDate(app.createdAt);
                            else dateStr = formatDate(new Date());

                            const globalIndex = loans.findIndex(l => l.id === doc.id);

                            tr.innerHTML = `
                                <td style="padding: 12px; border-bottom: 1px solid #eee;">${app.loanRef || '-'}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">${app.borrower}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #eee;">₹${parseFloat(app.amount || 0).toFixed(2)}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #eee;">${dateStr}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                                    <span style="background:${statusColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${app.status || 'Pending'}</span>
                                </td>
                                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                                    <button class="btn-view-app" data-index="${globalIndex}" data-doc-id="${doc.id}" style="background: #3498db; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="View"><i class="bi bi-eye"></i></button>
                                    <button class="btn-edit-app" data-index="${globalIndex}" data-doc-id="${doc.id}" style="background: #f39c12; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;" title="Edit"><i class="bi bi-pencil"></i></button>
                                </td>
                            `;
                            tbody.appendChild(tr);
                        });
                    });
                } catch (e) {
                    console.error("Error fetching employee apps:", e);
                }
            };
            initEmployeeApps();
        }
    }

    // --- PROFILE PAGE LOGIC (profile.html) ---
    const profileForm = document.getElementById('companyProfileForm');
    if (profileForm) {
        const savedProfile = JSON.parse(localStorage.getItem('companyProfile')) || {};

        document.getElementById('cp-name').value = savedProfile.name || '';
        document.getElementById('cp-address').value = savedProfile.address || '';
        document.getElementById('cp-contact').value = savedProfile.contact || '';
        document.getElementById('cp-email').value = savedProfile.email || '';

        // Logo Logic
        const logoInput = document.getElementById('cp-logo-upload');
        const logoPreview = document.getElementById('cp-logo-preview');
        let logoDataUrl = savedProfile.logo || '';

        if (logoDataUrl && logoPreview) {
            logoPreview.src = logoDataUrl;
            logoPreview.style.display = 'block';
        }

        if (logoInput) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        logoDataUrl = event.target.result;
                        if (logoPreview) {
                            logoPreview.src = logoDataUrl;
                            logoPreview.style.display = 'block';
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const profile = {
                name: document.getElementById('cp-name').value,
                address: document.getElementById('cp-address').value,
                contact: document.getElementById('cp-contact').value,
                email: document.getElementById('cp-email').value,
                logo: logoDataUrl
            };

            // Save to Firestore if available
            if (db && firestoreOps.doc && firestoreOps.setDoc) {
                firestoreOps.setDoc(firestoreOps.doc(db, "settings", "companyProfile"), profile)
                    .then(() => alert('Company details saved to cloud successfully!'))
                    .catch(e => alert('Error saving to cloud: ' + e.message));
            } else {
                localStorage.setItem('companyProfile', JSON.stringify(profile));
                alert('Company details saved locally!');
                updateSidebarProfile();
            }
        });
    }

    // --- ACTIVE LOANS PAGE LOGIC (active-loans.html) ---
    const fullActiveLoansTable = document.getElementById('full-active-loans-table');
    if (fullActiveLoansTable) {
        const renderActiveLoans = () => {
            const tbody = fullActiveLoansTable.querySelector('tbody');
            tbody.innerHTML = '';

            const searchInput = document.getElementById('active-loan-search');
            const query = searchInput ? searchInput.value.toLowerCase() : '';

            const today = new Date().toISOString().split('T')[0];
            // Filter out closed loans
            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');
            let activeLoansList = loans.map((loan, index) => ({ ...loan, originalIndex: index }))
                .filter(l => {
                    if (userRole !== 'Administrator') {
                        const matchesName = (l.assignedTo === currentUser || l.createdBy === currentUser);
                        const matchesEmail = (l.employeeEmail && l.employeeEmail === currentUserEmail);
                        if (!matchesName && !matchesEmail) return false;
                    }
                    return getNextDueDate(l) !== null;
                });

            if (query) {
                activeLoansList = activeLoansList.filter(l =>
                    l.borrower.toLowerCase().includes(query) ||
                    (l.loanRef && l.loanRef.toLowerCase().includes(query))
                );
            }

            if (activeLoansList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #777;">No active loans found</td></tr>';
            } else {
                activeLoansList.forEach((loan) => {
                    const index = loan.originalIndex;
                    const row = document.createElement('tr');

                    // Calculate EMI for reminder
                    const P = parseFloat(loan.amount) || 0;
                    const R = parseFloat(loan.interest) || 0;
                    const N = parseInt(loan.tenure) || 1;
                    const emi = (P / N) + (P * (R / 100));

                    const nextDue = getNextDueDate(loan);
                    const nextDueISO = nextDue ? nextDue.toISOString().split('T')[0] : null;
                    const nextDueDisplay = nextDue ? formatDate(nextDue) : 'N/A';
                    const isOverdue = nextDue && nextDueISO < today;
                    const statusText = isOverdue ? 'Overdue' : 'Active';
                    const statusColor = isOverdue ? '#e74c3c' : '#27ae60';

                    row.innerHTML = `
                        <td><div style="font-weight: 600;">${loan.borrower}</div></td>
                        <td style="font-size: 0.9rem; color: #555;">${loan.loanRef || '-'}</td>
                        <td>${loan.mobile || 'N/A'}</td>
                        <td>₹${parseFloat(loan.amount).toFixed(2)}</td>
                        <td>${nextDueDisplay}</td>
                        <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                        <td>
                            <a href="loan-profile.html?id=${index}" target="_blank" style="background-color: #3498db; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Profile</a>
                            <button class="btn btn-sm btn-dark open-profile-modal" data-index="${index}" style="margin-left: 5px;">Loan Profile</button>
                            <button class="btn btn-sm btn-success whatsapp-reminder-btn" data-mobile="${loan.mobile}" data-name="${loan.borrower}" data-amount="${loan.amount}" data-emi="${emi.toFixed(2)}" data-next-due="${nextDueDisplay}" style="margin-left: 5px;" title="Send WhatsApp Reminder"><i class="bi bi-whatsapp"></i></button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        };
        renderActiveLoans();

        const searchInput = document.getElementById('active-loan-search');
        if (searchInput) {
            searchInput.addEventListener('input', renderActiveLoans);
        }

        document.addEventListener('loans-updated', renderActiveLoans);

        // Handle "Loan Profile" Modal
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('open-profile-modal')) {
                const index = e.target.getAttribute('data-index');
                openLoanProfileModal(index);
            } else if (e.target.closest('.whatsapp-reminder-btn')) {
                const btn = e.target.closest('.whatsapp-reminder-btn');
                const mobile = btn.getAttribute('data-mobile');
                const name = btn.getAttribute('data-name');
                const amount = btn.getAttribute('data-amount');
                const nextDue = btn.getAttribute('data-next-due');
                const emi = btn.getAttribute('data-emi');

                if (mobile && mobile !== 'N/A') {
                    const message = `Hello ${name}, gentle reminder regarding your active loan of ₹${parseFloat(amount).toFixed(2)}. Due Amount: ₹${emi}. Next due date: ${nextDue}.`;
                    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(message)}`, '_blank');
                } else {
                    alert('No mobile number available for this borrower.');
                }
            }
        });

        function openLoanProfileModal(index) {
            const loan = loans[index];
            if (!loan) return;

            // Initialize paid installments
            if (!loan.paidInstallments) loan.paidInstallments = [];

            // Calculations
            const P = parseFloat(loan.amount) || 0;
            const R = parseFloat(loan.interest) || 0;
            const N = parseInt(loan.tenure) || 1;
            const emi = (P / N) + (P * (R / 100));

            let totalPaid = loan.paidInstallments.length * emi;

            // Calculate Total Paid from emi_schedule if available
            if (loan.emi_schedule) {
                totalPaid = Object.values(loan.emi_schedule).reduce((sum, entry) => sum + parseFloat(entry.amountPaid || 0), 0);
            } else {
                if (loan.partialPayments) {
                    Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                        if (!loan.paidInstallments.includes(parseInt(inst))) {
                            totalPaid += parseFloat(amount);
                        }
                    });
                }
            }

            // Calculate Penalties
            let totalPenalties = 0;
            if (loan.penalties) {
                loan.penalties.forEach(p => totalPenalties += parseFloat(p.amount));
            }

            const totalAmount = emi * N;
            const outstanding = totalAmount + totalPenalties - totalPaid;
            const progress = (totalPaid / totalAmount) * 100;

            const issueDate = new Date(loan.dueDate);
            const endDate = new Date(issueDate);
            endDate.setMonth(issueDate.getMonth() + N);

            // Populate Summary
            document.getElementById('profile-borrower').textContent = loan.borrower;
            document.getElementById('profile-mobile').textContent = loan.mobile || 'N/A';
            document.getElementById('summary-emi').textContent = '₹' + emi.toFixed(2);
            document.getElementById('summary-end-date').textContent = formatDate(endDate);
            document.getElementById('summary-principal-paid').textContent = '₹' + totalPaid.toFixed(2);
            document.getElementById('summary-principal-outstanding').textContent = '₹' + outstanding.toFixed(2);

            const progressBar = document.getElementById('summary-progress-bar');
            progressBar.style.width = progress + '%';
            document.getElementById('summary-progress-text').textContent = progress.toFixed(0) + '% cleared';

            // Populate Documents Tab
            const setDocImage = (imgId, placeholderId, dataUrl) => {
                const img = document.getElementById(imgId);
                const ph = document.getElementById(placeholderId);
                if (img && ph) {
                    if (dataUrl && dataUrl.startsWith('data:image')) {
                        img.src = dataUrl;
                        img.style.display = 'block';
                        ph.style.display = 'none';
                    } else {
                        img.style.display = 'none';
                        ph.style.display = 'block';
                    }
                }
            };
            setDocImage('doc-photo', 'doc-photo-placeholder', loan.photo);
            setDocImage('doc-sign-app', 'doc-sign-app-placeholder', loan.applicantSignature);
            setDocImage('doc-sign-guar', 'doc-sign-guar-placeholder', loan.guarantorSignature);

            // View Form Button
            document.getElementById('profile-view-btn').onclick = () => window.open(`loan-profile.html?id=${index}`, '_blank');
            document.getElementById('profile-edit-btn').onclick = () => window.open(`add-loan.html?id=${index}&mode=edit`, '_blank');

            // Settle Loan & Closure Certificate Logic
            const settleBtn = document.getElementById('btn-settle-loan');
            const closureBtn = document.getElementById('btn-closure-cert');

            if (outstanding > 0.1) {
                // Loan is NOT settled
                if (settleBtn) {
                    settleBtn.classList.remove('d-none');
                    settleBtn.onclick = () => {
                        if (confirm(`Settle Loan?\n\nOutstanding Amount: ₹${outstanding.toFixed(2)}\n\nThis will mark all remaining installments as PAID.`)) {
                            loan.paidInstallments = [];
                            if (!loan.emi_schedule) loan.emi_schedule = {};
                            for (let i = 1; i <= N; i++) {
                                // Mark all as paid in emi_schedule
                                if (!loan.emi_schedule[i] || loan.emi_schedule[i].status !== 'Paid') {
                                    loan.emi_schedule[i] = { status: 'Paid', amountPaid: emi, date: new Date().toISOString() };
                                }
                            }
                            saveEmiSchedule(loan.id, loan.emi_schedule);
                            openLoanProfileModal(index); // Refresh Modal
                        }
                    };
                }
                if (closureBtn) closureBtn.classList.add('d-none');
            } else {
                // Loan IS settled
                if (settleBtn) settleBtn.classList.add('d-none');
                if (closureBtn) {
                    closureBtn.classList.remove('d-none');
                    closureBtn.onclick = () => {
                        // Populate Certificate
                        document.getElementById('cert-borrower').textContent = loan.borrower;
                        document.getElementById('cert-ref').textContent = loan.loanRef || `LN-${parseInt(index) + 1001}`;
                        document.getElementById('cert-amount').textContent = parseFloat(loan.amount).toLocaleString();
                        document.getElementById('cert-date').textContent = formatDate(new Date());

                        const element = document.getElementById('closure-certificate');
                        const opt = {
                            margin: 10,
                            filename: `Closure_Certificate_${loan.borrower.replace(/\s+/g, '_')}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };
                        html2pdf().set(opt).from(element).save();
                    };
                }
            }

            // Populate Scheduled List
            const scheduleList = document.getElementById('scheduled-list');
            scheduleList.innerHTML = '';

            for (let i = 1; i <= N; i++) {
                const dueDate = new Date(issueDate);
                dueDate.setMonth(issueDate.getMonth() + i);

                let isPaid = false;
                let partialAmount = 0;

                if (loan.emi_schedule && loan.emi_schedule[i]) {
                    isPaid = loan.emi_schedule[i].status === 'Paid';
                    partialAmount = parseFloat(loan.emi_schedule[i].amountPaid || 0);
                    if (isPaid) partialAmount = 0; // Don't show partial if fully paid visually in calculation logic below
                } else {
                    isPaid = loan.paidInstallments.includes(i);
                    partialAmount = (loan.partialPayments && loan.partialPayments[i]) ? loan.partialPayments[i] : 0;
                }

                const remaining = emi - partialAmount;

                const item = document.createElement('div');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';
                item.innerHTML = `
                    <div>
                        <div class="fw-bold">Installment ${i}</div>
                        <small class="text-muted">Due: ${formatDate(dueDate)}</small>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold">₹${emi.toFixed(2)}</div>
                        ${partialAmount > 0 && !isPaid ? `<div class="text-warning small fw-bold">Paid: ₹${partialAmount.toFixed(2)}</div>` : ''}
                        ${isPaid
                        ? '<span class="badge bg-success">PAID</span>'
                        : `
                                <button class="btn btn-sm btn-outline-warning mark-modal-partially-paid me-1" data-loan-index="${index}" data-installment="${i}" style="margin-right:5px;">${partialAmount > 0 ? `Pay Remaining (INR ${remaining.toFixed(2)})` : 'Paid Partially'}</button>
                                <button class="btn btn-sm btn-outline-success mark-modal-paid" data-loan-index="${index}" data-installment="${i}">Mark Paid</button>
                              `
                    }
                    </div>
                `;
                scheduleList.appendChild(item);
            }

            // Handle Mark Paid inside Modal
            scheduleList.onclick = (e) => {
                if (e.target.classList.contains('mark-modal-paid')) {
                    const lIdx = e.target.getAttribute('data-loan-index');
                    const inst = parseInt(e.target.getAttribute('data-installment'));
                    if (confirm('Confirm full payment?')) {
                        if (!loans[lIdx].emi_schedule) loans[lIdx].emi_schedule = {};

                        loans[lIdx].emi_schedule[inst] = {
                            status: 'Paid',
                            amountPaid: emi,
                            date: new Date().toISOString()
                        };

                        saveEmiSchedule(loans[lIdx].id, loans[lIdx].emi_schedule);

                        // WhatsApp Receipt
                        if (loans[lIdx].mobile && loans[lIdx].mobile !== 'N/A') {
                            const msg = `Payment Receipt\n\nDear ${loans[lIdx].borrower},\nReceived with thanks: ₹${emi.toFixed(2)}\nTowards: Installment #${inst}\nDate: ${payDate.toLocaleDateString()}\n\nThank you!`;
                            if (confirm("Open WhatsApp to send receipt?")) {
                                window.open(`https://wa.me/${loans[lIdx].mobile}?text=${encodeURIComponent(msg)}`, '_blank');
                            }
                        }

                        openLoanProfileModal(lIdx); // Refresh modal
                    }
                } else if (e.target.classList.contains('mark-modal-partially-paid')) {
                    const lIdx = e.target.getAttribute('data-loan-index');
                    const inst = parseInt(e.target.getAttribute('data-installment'));
                    const amountStr = prompt("Enter partial payment amount:");
                    if (amountStr) {
                        const amount = parseFloat(amountStr);
                        if (!isNaN(amount) && amount > 0) {
                            if (!loans[lIdx].emi_schedule) loans[lIdx].emi_schedule = {};
                            const current = (loans[lIdx].emi_schedule[inst] && loans[lIdx].emi_schedule[inst].amountPaid) ? parseFloat(loans[lIdx].emi_schedule[inst].amountPaid) : 0;
                            loans[lIdx].emi_schedule[inst] = {
                                status: 'Partial',
                                amountPaid: current + amount,
                                date: new Date().toISOString()
                            };
                            saveEmiSchedule(loans[lIdx].id, loans[lIdx].emi_schedule);
                            openLoanProfileModal(lIdx);
                        } else {
                            alert("Invalid amount entered.");
                        }
                    }
                }
            };

            // Populate Transaction History Table
            const transBody = document.getElementById('profile-trans-body');
            if (transBody) {
                transBody.innerHTML = '';
                const transactions = [];

                // 1. Loan Disbursed (Start of Timeline)
                transactions.push({
                    date: issueDate,
                    paidDate: issueDate,
                    type: 'Loan Disbursed',
                    amount: totalAmount, // Tracking Total Repayable (Principal + Interest)
                    isPayment: false,
                    desc: 'Total Repayable Amount'
                });

                if (loan.emi_schedule) {
                    Object.entries(loan.emi_schedule).forEach(([inst, entry]) => {
                        transactions.push({
                            date: new Date(issueDate.setMonth(new Date(loan.dueDate).getMonth() + parseInt(inst))), // Approximate due date logic
                            paidDate: entry.date ? new Date(entry.date) : null,
                            type: entry.status === 'Paid' ? 'EMI Payment' : 'Partial Payment',
                            amount: parseFloat(entry.amountPaid || 0),
                            isPayment: true,
                            desc: entry.status === 'Paid' ? `Installment #${inst}` : `Part Payment #${inst}`,
                            inst: inst,
                            isPartial: entry.status !== 'Paid',
                            source: 'emi_schedule'
                        });
                    });
                } else {
                    // Legacy
                    // 2. Full EMI Payments
                    loan.paidInstallments.forEach(inst => {
                        const d = new Date(issueDate);
                        d.setMonth(issueDate.getMonth() + parseInt(inst));

                        let pDate = null;
                        if (loan.paidDates && loan.paidDates[inst]) {
                            pDate = new Date(loan.paidDates[inst]);
                        }
                        transactions.push({
                            date: d,
                            paidDate: pDate,
                            type: 'EMI Payment',
                            amount: emi,
                            isPayment: true,
                            desc: `Installment #${inst}`,
                            inst: inst,
                            isPartial: false,
                            source: 'legacy_full'
                        });
                    });

                    // 3. Partial Payments (Only if installment is not fully paid yet)
                    if (loan.partialPayments) {
                        Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                            if (!loan.paidInstallments.includes(parseInt(inst))) {
                                const d = new Date(issueDate);
                                d.setMonth(issueDate.getMonth() + parseInt(inst));

                                let pDate = null;
                                if (loan.partialPaymentDates && loan.partialPaymentDates[inst]) {
                                    pDate = new Date(loan.partialPaymentDates[inst]);
                                }
                                transactions.push({
                                    date: d,
                                    paidDate: pDate,
                                    type: 'Partial Payment',
                                    amount: parseFloat(amount),
                                    isPayment: true,
                                    desc: `Part Payment #${inst}`,
                                    inst: inst,
                                    isPartial: true,
                                    source: 'legacy_partial'
                                });
                            }
                        });
                    }
                }

                // 4. Penalties
                if (loan.penalties) {
                    loan.penalties.forEach((p, idx) => {
                        transactions.push({
                            date: new Date(p.date),
                            paidDate: null,
                            type: 'Penalty',
                            amount: parseFloat(p.amount),
                            isPayment: false,
                            desc: p.description || 'Late Fee',
                            source: 'penalty',
                            penaltyIndex: idx
                        });
                    });
                }

                // Sort by Date
                transactions.sort((a, b) => a.date - b.date);

                let runningBal = 0;
                transactions.forEach(t => {
                    if (!t.isPayment) {
                        runningBal += t.amount;
                    } else {
                        runningBal -= t.amount;
                    }

                    const paidDateStr = t.paidDate ? formatDate(t.paidDate) : '-';
                    let dateCellHtml = paidDateStr;
                    if (t.isPayment) {
                        dateCellHtml += ` <span class="edit-trans-date" data-inst="${t.inst}" data-partial="${t.isPartial}" style="cursor:pointer; margin-left:5px; font-size:0.8rem;" title="Edit Date">✏️</span>`;
                    }

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${formatDate(t.date)}</td>
                        <td>${dateCellHtml}</td>
                        <td>
                            <div class="fw-bold">${t.type}</div>
                            <small class="text-muted">${t.desc}</small>
                        </td>
                        <td class="${t.isPayment ? 'text-success' : ''}">${t.isPayment ? '-' : ''}₹${t.amount.toFixed(2)}</td>
                        <td class="fw-bold">₹${Math.max(0, runningBal).toFixed(2)}</td>
                        <td class="text-center">
                            ${t.type !== 'Loan Disbursed' ?
                            `<button class="btn btn-sm btn-outline-danger delete-trans-btn" 
                                    data-source="${t.source || ''}" 
                                    data-inst="${t.inst || ''}" 
                                    data-index="${t.penaltyIndex !== undefined ? t.penaltyIndex : ''}" 
                                    title="Delete Transaction">
                                    <i class="bi bi-trash"></i>
                                </button>`
                            : ''}
                        </td>
                    `;
                    transBody.appendChild(row);
                });

                // Handle Date Edit & Delete Click
                transBody.onclick = (e) => {
                    // Delete Logic
                    const delBtn = e.target.closest('.delete-trans-btn');
                    if (delBtn) {
                        if (!confirm('Are you sure you want to delete this transaction?')) return;

                        const source = delBtn.getAttribute('data-source');
                        const inst = delBtn.getAttribute('data-inst');
                        const index = delBtn.getAttribute('data-index');

                        if (source === 'emi_schedule') {
                            if (loan.emi_schedule && loan.emi_schedule[inst]) {
                                delete loan.emi_schedule[inst];
                                saveEmiSchedule(loan.id, loan.emi_schedule);
                            }
                        } else if (source === 'legacy_full') {
                            if (loan.paidInstallments) loan.paidInstallments = loan.paidInstallments.filter(i => i != inst);
                            if (loan.paidDates) delete loan.paidDates[inst];
                        } else if (source === 'legacy_partial') {
                            if (loan.partialPayments) delete loan.partialPayments[inst];
                            if (loan.partialPaymentDates) delete loan.partialPaymentDates[inst];
                        } else if (source === 'penalty') {
                            if (loan.penalties) loan.penalties.splice(index, 1);
                        }

                        if (source !== 'emi_schedule') saveLoans(loans[index]);
                        openLoanProfileModal(index);
                        return;
                    }

                    if (e.target.classList.contains('edit-trans-date')) {
                        const inst = e.target.getAttribute('data-inst');
                        const isPartial = e.target.getAttribute('data-partial') === 'true';
                        const newDateStr = prompt("Enter new payment date (YYYY-MM-DD):");

                        if (newDateStr) {
                            const newDate = new Date(newDateStr);
                            if (!isNaN(newDate.getTime())) {
                                if (loan.emi_schedule && loan.emi_schedule[inst]) {
                                    loan.emi_schedule[inst].date = newDate.toISOString();
                                    saveEmiSchedule(loan.id, loan.emi_schedule);
                                } else {
                                    // Legacy fallback
                                    if (!loan.paidDates) loan.paidDates = {}; loan.paidDates[inst] = newDate.toISOString();
                                    saveLoans(loans[index]);
                                }
                                openLoanProfileModal(index);
                            } else {
                                alert("Invalid date format.");
                            }
                        }
                    }
                };
            }

            // Handle PDF Download for Transactions
            const downloadTransBtn = document.getElementById('btn-download-trans-pdf');
            if (downloadTransBtn) {
                downloadTransBtn.onclick = () => {
                    const transBody = document.getElementById('profile-trans-body');
                    // Create a temporary container for PDF generation
                    const pdfContainer = document.createElement('div');
                    pdfContainer.style.padding = '20px';
                    pdfContainer.innerHTML = `
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="margin: 0; color: #2c3e50;">Transaction History</h2>
                            <p style="margin: 5px 0; color: #7f8c8d;">${loan.borrower}</p>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: sans-serif;">
                            <thread>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Due Date</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Paid Date</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Balance</th>
                                </tr>
                            </thread>
                            <>
                                ${Array.from(transBody.rows).map(row => {
                        const cells = row.cells;
                        return `
                                        <tr>
                                            <td style="border: 1px solid #ddd; padding: 8px;">${cells[0].innerText}</td>
                                            <td style="border: 1px solid #ddd; padding: 8px;">${cells[1].innerText}</td>
                                            <td style="border: 1px solid #ddd; padding: 8px;">${cells[2].innerHTML}</td>
                                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cells[3].innerText}</td>
                                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${cells[4].innerText}</td>
                                        </tr>
                                    `;
                    }).join('')}
                            </>
                        </table>
                        <div style="margin-top: 20px; font-size: 10px; text-align: right; color: #999;">
                            Generated on ${formatDate(new Date())}
                        </div>
                    `;

                    const opt = {
                        margin: 10,
                        filename: `Transactions_${loan.borrower.replace(/\s+/g, '_')}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2 },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    html2pdf().set(opt).from(pdfContainer).save();
                };
            }

            // Handle Add Penalty
            const addPenaltyBtn = document.getElementById('btn-add-penalty');
            if (addPenaltyBtn) {
                addPenaltyBtn.onclick = () => {
                    const amountStr = prompt("Enter Penalty Amount (₹):");
                    if (amountStr) {
                        const amount = parseFloat(amountStr);
                        if (!isNaN(amount) && amount > 0) {
                            const desc = prompt("Enter Reason (e.g. Late Fee):") || "Late Fee";
                            if (!loan.penalties) loan.penalties = [];
                            loan.penalties.push({
                                date: new Date().toISOString(),
                                amount: amount,
                                description: desc
                            });
                            saveLoans(loans[index]);
                            openLoanProfileModal(index);
                        } else {
                            alert("Invalid amount.");
                        }
                    }
                };
            }

            // Show Modal (Using Bootstrap API)
            const modalEl = document.getElementById('loanProfileModal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
        window.openLoanProfileModal = openLoanProfileModal;

        // Auto-open modal if ID is in URL
        const urlParams = new URLSearchParams(window.location.search);
        const loanId = urlParams.get('id');
        if (loanId !== null && loans[loanId]) {
            openLoanProfileModal(loanId);
        }
    }

    // --- LOAN PROFILE PAGE LOGIC (loan-profile.html) ---
    const viewProfileForm = document.getElementById('viewProfileForm');
    if (viewProfileForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const loanIndex = urlParams.get('id');
        const loan = loans[loanIndex];

        if (loan) {
            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');
            const matchesName = (loan.assignedTo === currentUser || loan.createdBy === currentUser);
            const matchesEmail = (loan.employeeEmail && loan.employeeEmail === currentUserEmail);

            if (userRole !== 'Administrator' && !matchesName && !matchesEmail) {
                document.body.innerHTML = '<h1 style="text-align:center; color:white; margin-top:50px;">Access Denied</h1>';
                return;
            }

            // Populate fields
            document.getElementById('vp-borrower').value = loan.borrower || '';
            document.getElementById('vp-dob').value = loan.dob || '';
            document.getElementById('vp-father').value = loan.fatherName || '';
            document.getElementById('vp-guarantor').value = loan.guarantorName || '';
            document.getElementById('vp-village').value = loan.village || '';
            document.getElementById('vp-po').value = loan.po || '';
            document.getElementById('vp-district').value = loan.district || '';
            document.getElementById('vp-pin').value = loan.pin || '';
            document.getElementById('vp-mobile').value = loan.mobile || '';
            document.getElementById('vp-whatsapp').value = loan.whatsapp || '';
            document.getElementById('vp-email').value = loan.email || '';
            document.getElementById('vp-aadhaar').value = loan.aadhaar || '';
            document.getElementById('vp-pan').value = loan.pan || '';
            document.getElementById('vp-amount').value = loan.amount || '';
            document.getElementById('vp-interest').value = loan.interest || '';
            document.getElementById('vp-tenure').value = loan.tenure || '';
            document.getElementById('vp-dueDate').value = loan.dueDate || '';
            document.getElementById('vp-purpose').value = loan.purpose || '';
            if (loan.loanRef) document.getElementById('vp-loan-ref').textContent = `Ref: ${loan.loanRef}`;

            // Populate Images
            if (loan.photo) {
                const img = document.getElementById('vp-photo');
                img.src = loan.photo;
                img.style.display = 'block';
                document.getElementById('vp-photo-text').style.display = 'none';
            }
            if (loan.applicantSignature) {
                const img = document.getElementById('vp-sign-app');
                img.src = loan.applicantSignature;
                img.style.display = 'block';
            }
            if (loan.guarantorSignature) {
                const img = document.getElementById('vp-sign-guar');
                img.src = loan.guarantorSignature;
                img.style.display = 'block';
            }

            // Set Footer Date
            const dateEl = document.getElementById('print-date');
            if (dateEl) dateEl.textContent = formatDate(new Date());

            // Add Edit Button dynamically
            const btnContainer = document.querySelector('.btn-container');
            if (btnContainer && !document.getElementById('vp-edit-btn')) {
                const editBtn = document.createElement('button');
                editBtn.id = 'vp-edit-btn';
                editBtn.type = 'button';
                editBtn.className = 'btn';
                editBtn.style.backgroundColor = '#f39c12';
                editBtn.style.marginLeft = '10px';
                editBtn.textContent = 'Edit Details';
                editBtn.onclick = () => window.location.href = `add-loan.html?id=${loanIndex}&mode=edit`;
                btnContainer.appendChild(editBtn);
            }
        } else {
            document.body.innerHTML = '<h1 style="text-align:center; color:white; margin-top:50px;">Loan Not Found</h1>';
        }
    }

    // --- BORROWERS LIST PAGE LOGIC (borrowers-list.html) ---
    const borrowersListTable = document.getElementById('borrowers-list-table');
    if (borrowersListTable) {
        let currentPage = 1;
        const rowsPerPage = 10;
        const tbody = borrowersListTable.querySelector('tbody');

        const renderBorrowers = () => {
            tbody.innerHTML = '';

            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');

            const borrowerStats = {};
            loans.forEach((loan, index) => {
                const matchesName = (loan.assignedTo === currentUser || loan.createdBy === currentUser);
                const matchesEmail = (loan.employeeEmail && loan.employeeEmail === currentUserEmail);

                if (userRole !== 'Administrator' && !matchesName && !matchesEmail) return;
                const name = loan.borrower.trim();
                // A loan is closed if paid installments >= tenure. Otherwise it's active/pending.
                const isClosed = getNextDueDate(loan) === null;

                if (!borrowerStats[name]) {
                    borrowerStats[name] = {
                        count: 0,
                        total: 0,
                        mobile: loan.mobile || 'N/A',
                        hasActive: false,
                        originalIndex: index,
                        lastDate: loan.dueDate,
                        refNos: []
                    };
                } else if (loan.dueDate > (borrowerStats[name].lastDate || '')) {
                    borrowerStats[name].lastDate = loan.dueDate;
                }

                borrowerStats[name].count++;
                borrowerStats[name].total += parseFloat(loan.amount || 0);

                if (!isClosed) {
                    borrowerStats[name].hasActive = true;
                }

                // Update mobile if available and not set
                if (borrowerStats[name].mobile === 'N/A' && loan.mobile) {
                    borrowerStats[name].mobile = loan.mobile;
                }

                if (loan.loanRef) borrowerStats[name].refNos.push(loan.loanRef);
            });

            // Convert to array and sort by Date (Most Recent First)
            const sortedBorrowers = Object.keys(borrowerStats).map(name => ({
                name,
                ...borrowerStats[name]
            })).sort((a, b) => new Date(b.lastDate || 0) - new Date(a.lastDate || 0));

            let displayList = sortedBorrowers;
            const searchInput = document.getElementById('borrower-search');
            if (searchInput && searchInput.value) {
                const q = searchInput.value.toLowerCase();
                displayList = displayList.filter(b =>
                    b.name.toLowerCase().includes(q) ||
                    b.refNos.some(ref => ref.toLowerCase().includes(q))
                );
            }

            // Pagination Logic
            const totalPages = Math.ceil(displayList.length / rowsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * rowsPerPage;
            const paginatedList = displayList.slice(startIndex, startIndex + rowsPerPage);

            // Update Controls
            const pageIndicator = document.getElementById('page-indicator');
            const prevBtn = document.getElementById('prev-page-btn');
            const nextBtn = document.getElementById('next-page-btn');

            if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
            if (prevBtn) { prevBtn.disabled = currentPage === 1; prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1'; prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer'; }
            if (nextBtn) { nextBtn.disabled = currentPage === totalPages; nextBtn.style.opacity = currentPage === totalPages ? '0.5' : '1'; nextBtn.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer'; }

            if (displayList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #777;">No borrowers found</td></tr>';
            } else {
                paginatedList.forEach(stats => {
                    // Determine status: Active if they have ongoing loans, Closed otherwise.
                    const statusText = stats.hasActive ? 'Active' : 'Closed';
                    const statusColor = stats.hasActive ? '#27ae60' : '#95a5a6';

                    const refs = stats.refNos.length > 0 ? stats.refNos.join('<br>') : '-';
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${stats.name}</td>
                        <td style="font-size: 0.85rem; color: #555;">${refs}</td>
                        <td>${stats.mobile}</td>
                        <td>${stats.count}</td>
                        <td>₹${stats.total.toFixed(2)}</td>
                        <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                        <td>
                            <a href="loan-profile.html?id=${stats.originalIndex}" target="_blank" style="background-color: #3498db; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Profile</a>
                            <button class="delete-borrower-btn" data-name="${stats.name.replace(/"/g, '&quot;')}" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 5px;">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        };
        renderBorrowers();

        const searchInput = document.getElementById('borrower-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                currentPage = 1; // Reset to first page on search
                renderBorrowers();
            });
        }

        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; renderBorrowers(); }
        });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            currentPage++; // Validation happens inside renderBorrowers
        });

        // Export CSV Logic
        const exportBtn = document.getElementById('export-borrowers-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                // 1. Aggregate Data (Same logic as renderBorrowers)
                const borrowerStats = {};
                loans.forEach((loan, index) => {
                    const name = loan.borrower.trim();
                    const isClosed = getNextDueDate(loan) === null;

                    if (!borrowerStats[name]) {
                        borrowerStats[name] = { count: 0, total: 0, mobile: loan.mobile || 'N/A', hasActive: false, lastDate: loan.dueDate, refNos: [] };
                    } else if (loan.dueDate > (borrowerStats[name].lastDate || '')) {
                        borrowerStats[name].lastDate = loan.dueDate;
                    }

                    borrowerStats[name].count++;
                    borrowerStats[name].total += parseFloat(loan.amount || 0);
                    if (!isClosed) borrowerStats[name].hasActive = true;
                    if (borrowerStats[name].mobile === 'N/A' && loan.mobile) borrowerStats[name].mobile = loan.mobile;
                    if (loan.loanRef) borrowerStats[name].refNos.push(loan.loanRef);
                });

                let displayList = Object.keys(borrowerStats).map(name => ({
                    name,
                    ...borrowerStats[name]
                })).sort((a, b) => new Date(b.lastDate || 0) - new Date(a.lastDate || 0));

                // 2. Apply Search Filter
                const searchInput = document.getElementById('borrower-search');
                if (searchInput && searchInput.value) {
                    const q = searchInput.value.toLowerCase();
                    displayList = displayList.filter(b =>
                        b.name.toLowerCase().includes(q) ||
                        b.refNos.some(ref => ref.toLowerCase().includes(q))
                    );
                }

                // 3. Generate CSV
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "Name,Reference Nos,Mobile,Active Loans,Total Debt,Status\n";

                displayList.forEach(b => {
                    const row = [
                        `"${b.name.replace(/"/g, '""')}"`,
                        `"${b.refNos.join('; ')}"`,
                        `"${b.mobile}"`,
                        b.count,
                        b.total.toFixed(2),
                        b.hasActive ? 'Active' : 'Closed'
                    ].join(",");
                    csvContent += row + "\r\n";
                });

                // 4. Download
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "borrowers_list.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        tbody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-borrower-btn')) {
                const name = e.target.getAttribute('data-name');
                if (confirm(`Are you sure you want to delete borrower "${name}" and ALL associated loans? This action cannot be undone.`)) {
                    const loansToDelete = loans.filter(l => l.borrower.trim() === name);

                    // Remove from local array
                    loans = loans.filter(l => l.borrower.trim() !== name);

                    // Sync changes (Save new array to LS, delete docs from Firestore)
                    // Use Promise.all to wait for all async deletions to complete
                    const deletePromises = loansToDelete.map(loan => saveLoans(loan, true));
                    await Promise.all(deletePromises);

                    // The 'loans-updated' event will trigger a re-render from the snapshot listener if connected.
                    // If not connected, this ensures the UI updates.
                    document.dispatchEvent(new CustomEvent('loans-updated'));
                }
            }
        });

        document.addEventListener('loans-updated', renderBorrowers);
    }

    // --- OVERDUE LOANS PAGE LOGIC (overdue-loans.html) ---
    const overdueLoansTable = document.getElementById('overdue-loans-table');
    if (overdueLoansTable) {
        const renderOverdue = () => {
            const tbody = overdueLoansTable.querySelector('tbody');
            tbody.innerHTML = '';

            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');

            const today = new Date().toISOString().split('T')[0];
            const overdueLoans = loans.filter(l => {
                if (userRole !== 'Administrator') {
                    const matchesName = (l.assignedTo === currentUser || l.createdBy === currentUser);
                    const matchesEmail = (l.employeeEmail && l.employeeEmail === currentUserEmail);
                    if (!matchesName && !matchesEmail) return false;
                }
                const nextDue = getNextDueDate(l);
                return nextDue && nextDue.toISOString().split('T')[0] < today;
            });

            if (overdueLoans.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #27ae60;">No overdue loans!</td></tr>';
            } else {
                overdueLoans.forEach((loan) => {
                    const index = loans.indexOf(loan);
                    const nextDue = getNextDueDate(loan);
                    const nextDueDisplay = nextDue ? formatDate(nextDue) : 'N/A';
                    const row = document.createElement('tr');
                    const daysOverdue = Math.floor((new Date() - nextDue) / (1000 * 60 * 60 * 24));
                    row.innerHTML = `
                        <td>
                            <div style="font-weight: 600;">${loan.borrower}</div>
                            ${loan.loanRef ? `<div style="font-size: 0.75rem; color: #7f8c8d;">${loan.loanRef}</div>` : ''}
                        </td>
                        <td>${loan.mobile || 'N/A'}</td>
                        <td>₹${parseFloat(loan.amount).toFixed(2)}</td>
                        <td>${nextDueDisplay}</td>
                        <td style="color: #e74c3c; font-weight: bold;">${daysOverdue} Days</td>
                        <td>
                            <a href="loan-profile.html?id=${index}" target="_blank" style="background-color: #3498db; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px; font-size: 12px; margin-right: 5px;">View Profile</a>
                            <button class="send-reminder-btn" data-mobile="${loan.mobile}" data-name="${loan.borrower}" style="background-color: #e67e22; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Reminder</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        };
        renderOverdue();
        document.addEventListener('loans-updated', renderOverdue);

        const tbody = overdueLoansTable.querySelector('tbody');

        tbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('send-reminder-btn')) {
                const mobile = e.target.getAttribute('data-mobile');
                const name = e.target.getAttribute('data-name');

                if (mobile && mobile !== 'N/A') {
                    const message = `Hello ${name}, this is a reminder that your loan payment is overdue. Please pay as soon as possible.`;
                    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(message)}`, '_blank');
                } else {
                    alert('No mobile number available for this borrower.');
                }
            }
        });
    }

    // --- CLOSED LOANS PAGE LOGIC (closed-loans.html) ---
    const closedLoansTable = document.getElementById('closed-loans-table');
    if (closedLoansTable) {
        const renderClosedLoans = () => {
            const tbody = closedLoansTable.querySelector('tbody');
            tbody.innerHTML = '';

            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');

            const closedLoans = loans.filter(l => {
                if (userRole !== 'Administrator') {
                    const matchesName = (l.assignedTo === currentUser || l.createdBy === currentUser);
                    const matchesEmail = (l.employeeEmail && l.employeeEmail === currentUserEmail);
                    if (!matchesName && !matchesEmail) return false;
                }
                return getNextDueDate(l) === null;
            });

            if (closedLoans.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #777;">No closed loans found</td></tr>';
            } else {
                closedLoans.forEach((loan) => {
                    // Find original index for reference
                    const originalIndex = loans.indexOf(loan);

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>
                            <div style="font-weight: 600;">${loan.borrower}</div>
                            ${loan.loanRef ? `<div style="font-size: 0.75rem; color: #7f8c8d;">${loan.loanRef}</div>` : ''}
                        </td>
                        <td>${loan.mobile || 'N/A'}</td>
                        <td>₹${parseFloat(loan.amount).toFixed(2)}</td>
                        <td>${formatDate(loan.dueDate)}</td>
                        <td>
                            <button class="download-cert-btn" data-index="${originalIndex}" style="background-color: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Download Certificate</button>
                            <button class="delete-closed-loan-btn" data-index="${originalIndex}" style="background-color: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        };
        renderClosedLoans();
        document.addEventListener('loans-updated', renderClosedLoans);

        const tbody = closedLoansTable.querySelector('tbody');

        tbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-closed-loan-btn')) {
                const index = e.target.getAttribute('data-index');
                if (confirm('Are you sure you want to permanently delete this closed loan record?')) {
                    const loanToDelete = loans[index];
                    loans.splice(index, 1);
                    saveLoans(loanToDelete, true);
                    renderClosedLoans();
                }
            } else if (e.target.classList.contains('download-cert-btn')) {
                const index = e.target.getAttribute('data-index');
                const loan = loans[index];

                document.getElementById('cert-borrower').textContent = loan.borrower;
                document.getElementById('cert-ref').textContent = loan.loanRef || `LN-${parseInt(index) + 1001}`;
                document.getElementById('cert-amount').textContent = parseFloat(loan.amount).toLocaleString();
                document.getElementById('cert-date').textContent = formatDate(new Date());

                const element = document.getElementById('closure-certificate');
                const opt = {
                    margin: 10,
                    filename: `Closure_Certificate_${loan.borrower.replace(/\s+/g, '_')}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().set(opt).from(element).save();
            }
        });
    }

    // --- LOAN PAYMENTS PAGE LOGIC (loan-payments.html) ---
    const paymentTable = document.getElementById('payment-table');
    if (paymentTable) {
        const urlParams = new URLSearchParams(window.location.search);
        const loanIndex = urlParams.get('id');
        const loan = loans[loanIndex];
        const paymentInfo = document.getElementById('payment-info');
        const tbody = paymentTable.querySelector('tbody');

        if (loan) {
            // Initialize paid installments array if not exists
            if (!loan.paidInstallments) {
                loan.paidInstallments = [];
            }

            // Calculate EMI (Using the logic from the form: Principal/Months + Monthly Interest)
            const P = parseFloat(loan.amount) || 0;
            const R = parseFloat(loan.interest) || 0;
            const N = parseInt(loan.tenure) || 1; // Avoid division by zero
            const emi = (P / N) + (P * (R / 100));

            // Render Summary
            let totalPaid = 0;
            if (loan.emi_schedule) {
                totalPaid = Object.values(loan.emi_schedule).reduce((sum, entry) => sum + parseFloat(entry.amountPaid || 0), 0);
            } else {
                totalPaid = loan.paidInstallments.length * emi;
            }
            const totalDue = (emi * N) - totalPaid;

            paymentInfo.innerHTML = `
                <div class="payment-summary">
                    <div class="summary-item"><h3>Borrower</h3><p>${loan.borrower}</p></div>
                    <div class="summary-item"><h3>Loan Amount</h3><p>₹${P.toLocaleString()}</p></div>
                    <div class="summary-item"><h3>Monthly EMI</h3><p>₹${emi.toFixed(2)}</p></div>
                    <div class="summary-item"><h3>Total Paid</h3><p style="color: #27ae60;">₹${totalPaid.toFixed(2)}</p></div>
                    <div class="summary-item"><h3>Balance Due</h3><p style="color: #e74c3c;">₹${totalDue.toFixed(2)}</p></div>
                </div>
            `;

            // Generate Schedule
            tbody.innerHTML = '';
            const issueDate = new Date(loan.dueDate);

            for (let i = 1; i <= N; i++) {
                const dueDate = new Date(issueDate);
                dueDate.setMonth(issueDate.getMonth() + i);

                let isPaid = false;
                if (loan.emi_schedule && loan.emi_schedule[i]) {
                    isPaid = loan.emi_schedule[i].status === 'Paid';
                } else {
                    isPaid = loan.paidInstallments.includes(i);
                }
                const row = document.createElement('tr');

                row.innerHTML = `
                    <td>${i}</td>
                    <td>${formatDate(dueDate)}</td>
                    <td>₹${emi.toFixed(2)}</td>
                    <td>${isPaid ? '<span class="paid-badge">PAID</span>' : '<span class="unpaid-badge">UNPAID</span>'}</td>
                    <td>
                        ${isPaid
                        ? '<button class="pay-btn" disabled>Paid</button>'
                        : `<button class="pay-btn mark-paid-btn" data-installment="${i}">Mark as Paid</button>`
                    }
                    </td>
                `;
                tbody.appendChild(row);
            }

            // Handle Mark as Paid
            tbody.addEventListener('click', (e) => {
                if (e.target.classList.contains('mark-paid-btn')) {
                    const installmentNo = parseInt(e.target.getAttribute('data-installment'));
                    if (confirm(`Mark installment #${installmentNo} as PAID?`)) {
                        if (!loan.emi_schedule) loan.emi_schedule = {};
                        loan.emi_schedule[installmentNo] = {
                            status: 'Paid',
                            amountPaid: emi,
                            date: new Date().toISOString()
                        };
                        loans[loanIndex] = loan; // Update specific loan
                        saveLoans(loan);

                        // WhatsApp Receipt
                        if (loan.mobile && loan.mobile !== 'N/A') {
                            const msg = `Payment Receipt\n\nDear ${loan.borrower},\nReceived with thanks: ₹${emi.toFixed(2)}\nTowards: Installment #${installmentNo}\nDate: ${new Date().toLocaleDateString()}\n\nThank you!`;
                            if (confirm("Open WhatsApp to send receipt?")) {
                                window.open(`https://wa.me/${loan.mobile}?text=${encodeURIComponent(msg)}`, '_blank');
                            }
                        }

                        window.location.reload(); // Refresh to update UI
                    }
                }
            });

        } else {
            paymentInfo.innerHTML = '<h2 style="text-align:center; color:red;">Loan Not Found</h2>';
        }
    }

    // --- LOAN CALCULATOR LOGIC (loan-calculator.html) ---
    const calcBtn = document.getElementById('btn-calculate');
    if (calcBtn) {
        const clearBtn = document.getElementById('btn-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                document.getElementById('calc-amount').value = '';
                document.getElementById('calc-interest').value = '';
                document.getElementById('calc-tenure').value = '';
                document.getElementById('calc-results').style.display = 'none';
            });
        }

        calcBtn.addEventListener('click', () => {
            const amount = parseFloat(document.getElementById('calc-amount').value) || 0;
            const interest = parseFloat(document.getElementById('calc-interest').value) || 0;
            const tenure = parseInt(document.getElementById('calc-tenure').value) || 0;

            if (amount > 0 && tenure > 0) {
                // Simple Interest Calculation (Monthly)
                // Interest is calculated monthly: totalInterest = principal * (rate/100) * tenure
                const totalInterest = amount * (interest / 100) * tenure;
                const totalPayment = amount + totalInterest;
                const emi = totalPayment / tenure;

                document.getElementById('res-emi').textContent = '₹' + emi.toFixed(2);
                document.getElementById('res-interest').textContent = '₹' + totalInterest.toFixed(2);
                document.getElementById('res-total').textContent = '₹' + totalPayment.toFixed(2);
                document.getElementById('calc-results').style.display = 'block';
            } else {
                alert('Please enter valid values.');
            }
        });
    }

    // --- HEADER DATE & TIME ---
    const dateTimeEl = document.getElementById('current-datetime');
    if (dateTimeEl) {
        const updateTime = () => {
            const now = new Date();
            dateTimeEl.textContent = now.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
        updateTime();
        setInterval(updateTime, 1000);
    }

    // --- NOTIFICATIONS LOGIC ---
    const notificationBtn = document.getElementById('notification-btn');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationList = document.getElementById('notification-list');
    const notificationCount = document.getElementById('notification-count');

    // --- QUICK ACTIONS LOGIC ---
    const quickActionsBtn = document.getElementById('quick-actions-btn');
    const quickActionsDropdown = document.getElementById('quick-actions-dropdown');

    if (quickActionsBtn && quickActionsDropdown) {
        quickActionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notificationDropdown) notificationDropdown.classList.remove('show');
            quickActionsDropdown.classList.toggle('show');
        });
    }

    if (notificationBtn && notificationDropdown) {
        // Toggle Dropdown
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (quickActionsDropdown) quickActionsDropdown.classList.remove('show');
            notificationDropdown.classList.toggle('show');
        });

        // Close on outside click
        window.addEventListener('click', () => {
            if (notificationDropdown.classList.contains('show')) {
                notificationDropdown.classList.remove('show');
            }
            if (quickActionsDropdown && quickActionsDropdown.classList.contains('show')) {
                quickActionsDropdown.classList.remove('show');
            }
        });

        // Prevent closing when clicking inside dropdown
        notificationDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Populate Notifications (Overdue Loans)
        const updateNotifications = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day

            const alerts = [];

            loans.forEach((loan, index) => {
                const nextDue = getNextDueDate(loan);
                if (!nextDue) return; // Skip closed loans

                const daysDiff = Math.floor((nextDue - today) / (1000 * 60 * 60 * 24));

                if (daysDiff < 0) {
                    // Overdue
                    alerts.push({
                        type: 'Overdue',
                        loan: loan,
                        index: index,
                        nextDue: nextDue,
                        days: Math.abs(daysDiff)
                    });
                } else if (daysDiff <= 5) {
                    // Upcoming
                    alerts.push({
                        type: 'Upcoming',
                        loan: loan,
                        index: index,
                        nextDue: nextDue,
                        days: daysDiff
                    });
                }
            });

            // Sort alerts: Overdue first, then by how soon they are due.
            alerts.sort((a, b) => {
                if (a.type === 'Overdue' && b.type !== 'Overdue') return -1;
                if (a.type !== 'Overdue' && b.type === 'Overdue') return 1;
                return a.days - b.days;
            });

            notificationList.innerHTML = '';

            if (alerts.length > 0) {
                notificationCount.textContent = alerts.length;
                notificationCount.style.display = 'block';

                alerts.forEach(alert => {
                    const { loan, index, nextDue, days } = alert;
                    const nextDueDisplay = formatDate(nextDue);
                    const li = document.createElement('li');

                    let title, subtitle, color;
                    if (alert.type === 'Overdue') {
                        title = `Overdue: ${loan.borrower}`;
                        subtitle = `${days} Days Overdue`;
                        color = '#e74c3c'; // Red
                    } else {
                        title = `Due Soon: ${loan.borrower}`;
                        subtitle = days === 0 ? 'Due Today' : `Due in ${days} Days`;
                        color = '#f39c12'; // Orange
                    }

                    li.innerHTML = `
                        <div class="alert-item">
                            <span class="alert-title" style="color: ${color};">${title}</span>
                            <span>Amount: ₹${parseFloat(loan.amount).toFixed(2)}</span>
                            <div style="display: flex; justify-content: space-between;">
                                <small style="color:#999">Due: ${nextDueDisplay}</small>
                                <small style="color:${color}; font-weight:bold;">${subtitle}</small>
                            </div>
                            <button class="view-alert-btn" data-index="${index}" style="background-color: #3498db; color: white; border: none; padding: 5px; width: 100%; margin-top: 5px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Loan Profile</button>
                        </div>
                    `;
                    notificationList.appendChild(li);
                });
            } else {
                notificationCount.style.display = 'none';
                notificationList.innerHTML = '<li style="padding:15px; text-align:center; color:#999;">No new alerts</li>';
            }
        };

        updateNotifications();

        // Handle Notification Button Click
        notificationList.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-alert-btn')) {
                const index = e.target.getAttribute('data-index');
                window.location.href = `active-loans.html?id=${index}`;
            }
        });
    }

    // --- AUTO LOGOUT LOGIC (20 MIN INACTIVITY) ---
    if (localStorage.getItem('isLoggedIn') === 'true') {
        const inactivityLimit = 20 * 60 * 1000; // 20 Minutes
        let inactivityTimer;

        const performAutoLogout = () => {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userRole');
            alert('You have been logged out due to inactivity.');
            window.location.href = 'login.html';
        };

        const resetInactivityTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(performAutoLogout, inactivityLimit);
        };

        // Listen for user activity to reset timer
        ['mouseover', 'click', 'keypress', 'scroll', 'touch start'].forEach(event => {
            document.addEventListener(event, resetInactivityTimer);
        });

        resetInactivityTimer(); // Start timer
    }

    // --- FORMS REPOSITORY LOGIC (forms.html) ---
    const downloadBlankFormBtn = document.getElementById('download-blank-form-btn');
    if (downloadBlankFormBtn) {
        downloadBlankFormBtn.addEventListener('click', () => {
            const element = document.getElementById('blank-loan-form');
            const opt = {
                margin: 0,
                filename: 'Blank_Loan_Application_Form.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    }

    const downloadNocBtn = document.getElementById('download-noc-btn');
    if (downloadNocBtn) {
        downloadNocBtn.addEventListener('click', () => {
            const savedProfile = JSON.parse(localStorage.getItem('companyProfile')) || {};

            if (savedProfile.name) {
                document.getElementById('noc-company-name').innerText = (savedProfile.name).toUpperCase();
                document.getElementById('noc-company-sign-name').innerText = savedProfile.name;
            }

            const element = document.getElementById('noc-template');
            const opt = {
                margin: 0,
                filename: 'No_Objection_Certificate_Template.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    }

    // --- EMPLOYEE PROFILE PAGE LOGIC (employee-profile.html) ---
    const empProfileForm = document.getElementById('employeeProfileForm');
    if (empProfileForm) {
        const loadEmpProfile = async () => {
            const email = localStorage.getItem('currentUserEmail');
            if (!email) {
                alert("User email not found. Please login again.");
                return;
            }

            try {
                const { app } = await import('./firebase-config.js');
                const { getFirestore, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const db = getFirestore(app);

                // Query 'employees' collection by email to find the document
                const q = query(collection(db, "employees"), where("email", "==", email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    const data = docSnap.data();

                    // Populate fields
                    document.getElementById('ep-id').value = docSnap.id; // Document ID is the Employee ID
                    document.getElementById('ep-name').value = data.name || '';
                    document.getElementById('ep-email').value = data.email || '';
                    document.getElementById('ep-mobile').value = data.mobile || '';
                    document.getElementById('ep-designation').value = data.designation || '';
                    document.getElementById('ep-department').value = data.department || '';
                    document.getElementById('ep-address').value = data.address || '';
                    document.getElementById('ep-doj').value = data.doj || '';
                }
            } catch (e) {
                console.error("Error loading profile:", e);
            }
        };
        loadEmpProfile();

        // Edit Profile Logic
        const editBtn = document.getElementById('edit-profile-btn');
        const saveBtn = document.getElementById('save-profile-btn');
        const cancelBtn = document.getElementById('cancel-profile-btn');
        const mobileInput = document.getElementById('ep-mobile');
        const addressInput = document.getElementById('ep-address');

        if (editBtn && saveBtn && cancelBtn) {
            editBtn.addEventListener('click', () => {
                mobileInput.removeAttribute('readonly');
                addressInput.removeAttribute('readonly');
                mobileInput.style.backgroundColor = '#fff';
                addressInput.style.backgroundColor = '#fff';
                mobileInput.style.border = '1px solid #3498db';
                addressInput.style.border = '1px solid #3498db';
                mobileInput.focus();

                editBtn.style.display = 'none';
                saveBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
            });

            cancelBtn.addEventListener('click', () => {
                window.location.reload();
            });

            empProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const docId = document.getElementById('ep-id').value;

                try {
                    const { app } = await import('./firebase-config.js');
                    const { getFirestore, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const db = getFirestore(app);

                    await updateDoc(doc(db, "employees", docId), {
                        mobile: mobileInput.value,
                        address: addressInput.value
                    });
                    alert("Profile updated successfully!");
                    window.location.reload();
                } catch (err) {
                    console.error("Error updating profile:", err);
                    alert("Failed to update profile: " + err.message);
                }
            });
        }
    }

    // --- CUSTOM FORMS UPLOAD LOGIC (forms.html) ---
    const uploadFormBtn = document.getElementById('upload-form-btn');
    const uploadFormModal = document.getElementById('upload-form-modal');
    const closeUploadModal = document.getElementById('close-upload-modal');
    const uploadForm = document.getElementById('uploadForm');
    const customFormsList = document.getElementById('custom-forms-list');

    if (uploadFormBtn && uploadFormModal) {
        // Modal Toggles
        uploadFormBtn.onclick = () => uploadFormModal.style.display = 'block';
        if (closeUploadModal) closeUploadModal.onclick = () => uploadFormModal.style.display = 'none';

        window.addEventListener('click', (e) => {
            if (e.target == uploadFormModal) uploadFormModal.style.display = 'none';
        });

        // Render List
        const renderCustomForms = () => {
            const forms = JSON.parse(localStorage.getItem('customForms')) || [];
            if (!customFormsList) return;

            customFormsList.innerHTML = '';

            if (forms.length === 0) {
                customFormsList.innerHTML = '<li style="text-align:center; color:#777; padding:20px;">No custom forms uploaded yet.</li>';
                return;
            }

            forms.forEach((form, index) => {
                const li = document.createElement('li');
                li.style.cssText = 'background: #f8f9fa; padding: 20px; margin-bottom: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';
                li.innerHTML = `
                    <div>
                        <div style="font-weight: bold; font-size: 1.1rem; color: #2c3e50;">${form.name}</div>
                        <div style="font-size: 0.9rem; color: #7f8c8d; margin-top: 5px;">${form.description}</div>
                        <div style="font-size: 0.8rem; color: #999; margin-top: 5px;">Uploaded: ${new Date(form.date).toLocaleDateString()}</div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="download-custom-btn" data-index="${index}" style="background-color: #27ae60; color: white; padding: 8px 15px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Download</button>
                        <button class="delete-custom-btn" data-index="${index}" style="background-color: #e74c3c; color: white; padding: 8px 15px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Delete</button>
                    </div>
                `;
                customFormsList.appendChild(li);
            });

            // Add Event Listeners
            document.querySelectorAll('.download-custom-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.target.getAttribute('data-index');
                    const form = forms[idx];
                    const link = document.createElement('a');
                    link.href = form.data;
                    link.download = form.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                });
            });

            document.querySelectorAll('.delete-custom-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (confirm('Are you sure you want to delete this form?')) {
                        const idx = e.target.getAttribute('data-index');
                        forms.splice(idx, 1);
                        localStorage.setItem('customForms', JSON.stringify(forms));
                        renderCustomForms();
                    }
                });
            });
        };

        renderCustomForms();

        // Handle Upload
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const fileInput = document.getElementById('custom-form-file');
                const file = fileInput.files[0];

                if (file) {
                    if (file.size > 2 * 1024 * 1024) { // 2MB limit check for localStorage sanity
                        alert('File is too large! Please upload a PDF smaller than 2MB.');
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const newForm = {
                            id: Date.now(),
                            name: document.getElementById('custom-form-name').value,
                            description: document.getElementById('custom-form-desc').value,
                            fileName: file.name,
                            data: event.target.result,
                            date: new Date().toISOString()
                        };

                        const forms = JSON.parse(localStorage.getItem('customForms')) || [];
                        forms.push(newForm);

                        try {
                            localStorage.setItem('customForms', JSON.stringify(forms));
                            alert('Form uploaded successfully!');
                            uploadForm.reset();
                            uploadFormModal.style.display = 'none';
                            renderCustomForms();
                        } catch (err) {
                            alert('Storage full! Cannot save this file. Please delete some items or upload a smaller file.');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }
});
// Function to fetch and display content without page reload
function loadContent(page) {
    const contentArea = document.getElementById('content-area');

    // Show a loading indicator
    if (contentArea) {
        contentArea.innerHTML = '<div class="loader" style="text-align: center; padding: 50px; font-size: 1.2rem;">Loading...</div>';
    } else {
        console.error("Fatal Error: #content-area element not found in the DOM.");
        return;
    }

    fetch(page)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, page: ${page}`);
            }
            return response.text();
        })
        .then(html => {
            contentArea.innerHTML = html;

            // Re-execute scripts from the loaded content and call page-specific init functions
            const scripts = contentArea.querySelectorAll("script");
            scripts.forEach(oldScript => {
                // IMPORTANT: Do not re-run the main app.js script
                if (oldScript.src.includes('app.js')) {
                    oldScript.remove();
                    return;
                }
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                if (oldScript.innerHTML) {
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                }
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Call the specific init function for the loaded page
            // This is a more robust pattern than general script re-execution
            if (page === 'manage-loans.html' && typeof initManageLoansPage === 'function') {
                initManageLoansPage();
            }
            // Future pages can be added here
            // else if (page === 'wallet.html' && typeof initWalletPage === 'function') {
            //     initWalletPage();
            // }

        })
        .catch(error => {
            console.error('Error loading page:', error);
            contentArea.innerHTML = `
                <div class="error-message" style="padding: 20px; text-align: center; background-color: #fff3f3; border: 1px solid #e74c3c; border-radius: 5px; margin: 20px;">
                    <h2>Oops! Content Failed to Load</h2>
                    <p>The requested page "<strong>${page}</strong>" could not be loaded.</p>
                    <p>This might be because the file is missing or there was a network issue.</p>
                    <p><i>${error.message}</i></p>
                </div>`;
        });
}