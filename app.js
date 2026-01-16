document.addEventListener('DOMContentLoaded', () => {
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

    // 1. Load data from LocalStorage (Shared between pages)
    let loans = JSON.parse(localStorage.getItem('loans')) || [];
    let db;
    let firestoreOps = {};

    // --- FIRESTORE REAL-TIME LISTENER ---
    const initFirestore = async () => {
        try {
            const { app } = await import('./firebase-config.js');
            const { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            db = getFirestore(app);
            firestoreOps = { doc, setDoc, addDoc, deleteDoc, collection };
            
            onSnapshot(collection(db, "loans"), (snapshot) => {
                loans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                localStorage.setItem('loans', JSON.stringify(loans)); // Sync local storage
                document.dispatchEvent(new CustomEvent('loans-updated'));
            });

            // Sync Company Profile
            onSnapshot(doc(db, "settings", "companyProfile"), (docSnap) => {
                if (docSnap.exists()) {
                    localStorage.setItem('companyProfile', JSON.stringify(docSnap.data()));
                    updateSidebarProfile();
                }
            });

            // Sync Admin Users
            onSnapshot(collection(db, "admin_users"), (snapshot) => {
                const admins = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
                localStorage.setItem('adminUsers', JSON.stringify(admins));
            });
        } catch (e) {
            console.log("Firestore sync not active (offline or config missing)");
        }
    };
    initFirestore();

    const saveLoans = async (loanData = null, isDelete = false) => {
        localStorage.setItem('loans', JSON.stringify(loans));
        
        if (db && firestoreOps.doc && loanData) {
            const { doc, setDoc, addDoc, deleteDoc, collection } = firestoreOps;
            try {
                if (isDelete) {
                    if (loanData.id) await deleteDoc(doc(db, "loans", loanData.id));
                } else {
                    if (loanData.id) {
                        await setDoc(doc(db, "loans", loanData.id), loanData);
                    } else {
                        const docRef = await addDoc(collection(db, "loans"), loanData);
                        loanData.id = docRef.id;
                        localStorage.setItem('loans', JSON.stringify(loans)); // Update local with ID
                    }
                }
            } catch (e) { console.error("Firestore Error:", e); }
        }
    };

    // Helper to calculate next due date (Starts 1 month after Issue Date)
    const getNextDueDate = (loan) => {
        if (!loan.dueDate) return null;
        const issueDate = new Date(loan.dueDate);
        const tenure = parseInt(loan.tenure) || 1;
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

    // --- SIDEBAR PROFILE LOGIC ---
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
    updateSidebarProfile();

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
        const walletLink = document.querySelector('nav a[href="wallet.html"]');
        if (walletLink) walletLink.style.display = 'none';
        const profileLink = document.querySelector('nav a[href="profile.html"]');
        if (profileLink) profileLink.style.display = 'none';
    }

    // --- MANAGE LOANS PAGE LOGIC (index.html) ---
    const loanTableBody = document.querySelector('#loanTable tbody');
    const paperLoanForm = document.getElementById('paperLoanForm');

    // Elements for Manage Loans Stats
    const mlTotalBorrowersEl = document.getElementById('ml-total-borrowers');
    const mlActiveLoansEl = document.getElementById('ml-active-loans');
    const mlOverdueEl = document.getElementById('ml-overdue');
    const mlClosedLoansEl = document.getElementById('ml-closed-loans');
    const addLoanCard = document.getElementById('add-loan-card');

    const updateManageLoansStats = () => {
        if (mlTotalBorrowersEl) {
            const uniqueBorrowers = new Set(loans.map(l => l.borrower.trim())).size;
            const today = new Date().toISOString().split('T')[0];
            const overdueCount = loans.filter(l => {
                const nextDue = getNextDueDate(l);
                return nextDue && nextDue.toISOString().split('T')[0] < today;
            }).length;
            const closedCount = loans.filter(l => l.paidInstallments && l.paidInstallments.length >= (parseInt(l.tenure) || 1)).length;

            mlTotalBorrowersEl.textContent = uniqueBorrowers;
            mlActiveLoansEl.textContent = loans.length - closedCount;
            mlOverdueEl.textContent = overdueCount;
            if (mlClosedLoansEl) mlClosedLoansEl.textContent = closedCount;
        }
    };
    updateManageLoansStats();
    document.addEventListener('loans-updated', updateManageLoansStats);

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
            const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
            
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
            if(loan.loanRef) { const refEl = document.getElementById('display-loan-ref'); if(refEl) refEl.textContent = `Ref: ${loan.loanRef}`; }
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

            const newLoan = {
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
                guarantorSignature: getImgSrc('preview-sign-guarantor')
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
                const refNo = `LN${date.getFullYear().toString().slice(-2)}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${randomNum}`;
                newLoan.loanRef = refNo;

                loans.push(newLoan);
                await saveLoans(newLoan);
                message = `Loan Application Saved Successfully!<br>Generated Reference No: <strong>${refNo}</strong>`;
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
                const matches = loans.map((loan, index) => ({ ...loan, originalIndex: index }))
                                     .filter(l => l.borrower.toLowerCase().includes(query));
                
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
            // Calculate Stats
            const uniqueBorrowers = new Set(loans.map(l => l.borrower.trim())).size;
            const today = new Date().toISOString().split('T')[0];
            const closedCount = loans.filter(l => l.paidInstallments && l.paidInstallments.length >= (parseInt(l.tenure) || 1)).length;
            
            // Calculate Total Interest Earned (Projected)
            const totalInterest = loans.reduce((sum, loan) => {
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

            loans.forEach(loan => {
                const P = parseFloat(loan.amount) || 0;
                const R = parseFloat(loan.interest) || 0;
                const N = parseInt(loan.tenure) || 1;
                const emi = (P / N) + (P * (R / 100));
                const issueDate = new Date(loan.dueDate);

                if (loan.paidInstallments) {
                    loan.paidInstallments.forEach(inst => {
                        const instDate = new Date(issueDate);
                        instDate.setMonth(issueDate.getMonth() + parseInt(inst));
                        if (instDate.getMonth() === currentMonth && instDate.getFullYear() === currentYear) {
                            monthlyRevenue += emi;
                        }
                    });
                }

                if (loan.partialPayments) {
                    Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                        const instDate = new Date(issueDate);
                        instDate.setMonth(issueDate.getMonth() + parseInt(inst));
                        if (instDate.getMonth() === currentMonth && instDate.getFullYear() === currentYear) {
                            monthlyRevenue += parseFloat(amount);
                        }
                    });
                }
            });

            // Calculate Financial Overview Metrics
            const filterInput = document.getElementById('fin-overview-filter');
            const filterDate = filterInput ? filterInput.value : ''; // YYYY-MM

            let totalDisbursed = 0;
            let totalRepaid = 0;
            let overviewInterest = 0;

            loans.forEach(loan => {
                const P = parseFloat(loan.amount) || 0;
                const R = parseFloat(loan.interest) || 0;
                const N = parseInt(loan.tenure) || 1;
                const emi = (P / N) + (P * (R / 100));
                const issueDate = new Date(loan.dueDate);
                
                // 1. Disbursed & Interest (Filter by Issue Date)
                let includeLoan = true;
                if (filterDate) {
                    const loanMonth = issueDate.toISOString().slice(0, 7);
                    if (loanMonth !== filterDate) includeLoan = false;
                }
                
                if (includeLoan) {
                    totalDisbursed += P;
                    overviewInterest += (P * (R / 100) * N);
                }

                // 2. Repaid (Filter by Payment Date)
                if (loan.paidInstallments) {
                    loan.paidInstallments.forEach(inst => {
                        // Determine payment date (use actual if available, else scheduled)
                        let payDate = new Date(issueDate);
                        payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                        if (loan.paidDates && loan.paidDates[inst]) {
                            payDate = new Date(loan.paidDates[inst]);
                        }

                        let includePayment = true;
                        if (filterDate) {
                            const payMonth = payDate.toISOString().slice(0, 7);
                            if (payMonth !== filterDate) includePayment = false;
                        }

                        if (includePayment) totalRepaid += emi;
                    });
                }
                if (loan.partialPayments) {
                    Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                        let payDate = new Date(issueDate);
                        payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                        if (loan.partialPaymentDates && loan.partialPaymentDates[inst]) {
                            payDate = new Date(loan.partialPaymentDates[inst]);
                        }

                        let includePayment = true;
                        if (filterDate) {
                            const payMonth = payDate.toISOString().slice(0, 7);
                            if (payMonth !== filterDate) includePayment = false;
                        }

                        if (includePayment) totalRepaid += parseFloat(amount);
                    });
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
            activeLoansEl.textContent = loans.length - closedCount;
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
            animateValue(activeLoansEl, 0, loans.length - closedCount, 1500, false);
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
                        labels: ['Active Loans', 'Closed Loans'],   //to sho
                        datasets: [{
                            data: [loans.length - closedCount, closedCount],
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

                loans.forEach(loan => {
                    // Outflow: Disbursements
                    const issueMonth = loan.dueDate.slice(0, 7);
                    if (cashFlow.hasOwnProperty(issueMonth)) {
                        cashFlow[issueMonth] -= (parseFloat(loan.amount) || 0);
                    }

                    // Inflow: Repayments
                    const P = parseFloat(loan.amount) || 0;
                    const R = parseFloat(loan.interest) || 0;
                    const N = parseInt(loan.tenure) || 1;
                    const emi = (P / N) + (P * (R / 100));
                    const issueDate = new Date(loan.dueDate);

                    // Full Installments
                    if (loan.paidInstallments) {
                        loan.paidInstallments.forEach(inst => {
                            let payDate = new Date(issueDate);
                            payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                            if (loan.paidDates && loan.paidDates[inst]) payDate = new Date(loan.paidDates[inst]);
                            
                            const payMonth = payDate.toISOString().slice(0, 7);
                            if (cashFlow.hasOwnProperty(payMonth)) cashFlow[payMonth] += emi;
                        });
                    }

                    // Partial Payments
                    if (loan.partialPayments) {
                        Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                            let payDate = new Date(issueDate);
                            payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                            if (loan.partialPaymentDates && loan.partialPaymentDates[inst]) payDate = new Date(loan.partialPaymentDates[inst]);
                            
                            const payMonth = payDate.toISOString().slice(0, 7);
                            if (cashFlow.hasOwnProperty(payMonth)) cashFlow[payMonth] += parseFloat(amount);
                        });
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
                const modalTableBody = document.querySelector('#modal-loan-table tbody');
                
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
            const modalTableBody = document.querySelector('#modal-loan-table tbody');
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
                    reader.onload = function(event) {
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

    // --- DEMO DATA LOGIC ---
    const loadDemoBtn = document.getElementById('loadDemoBtn');
    if (loadDemoBtn) {
        loadDemoBtn.addEventListener('click', () => {
            const demoLoans = [
                { borrower: "Alice Johnson", amount: "5000", dueDate: "2025-06-15", tenure: "12", interest: "10" },
                { borrower: "Bob Smith", amount: "1200", dueDate: "2025-07-20", tenure: "6", interest: "12" },
                { borrower: "Charlie Brown", amount: "350", dueDate: "2024-12-01", tenure: "3", interest: "5" }, // Past date
                { borrower: "Diana Prince", amount: "10000", dueDate: "2025-08-10", tenure: "24", interest: "8" },
                { borrower: "Evan Wright", amount: "2500", dueDate: "2025-05-05", tenure: "12", interest: "10" },
                { borrower: "Fiona Green", amount: "750", dueDate: "2025-09-12", tenure: "6", interest: "15" }
            ];
            
            demoLoans.forEach(l => {
                loans.push(l);
                saveLoans(l);
            });
            alert('Demo borrowers and loans loaded successfully!');
            window.location.reload();
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
            let activeLoansList = loans.map((loan, index) => ({ ...loan, originalIndex: index }))
                                         .filter(l => !(l.paidInstallments && l.paidInstallments.length >= (parseInt(l.tenure) || 1)));

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
                            <button class="btn btn-sm btn-success whatsapp-reminder-btn" data-mobile="${loan.mobile}" data-name="${loan.borrower}" data-amount="${loan.amount}" data-next-due="${nextDueDisplay}" style="margin-left: 5px;" title="Send WhatsApp Reminder"><i class="bi bi-whatsapp"></i></button>
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

                if (mobile && mobile !== 'N/A') {
                    const message = `Hello ${name}, gentle reminder regarding your active loan of ₹${parseFloat(amount).toFixed(2)}. Next due date: ${nextDue}.`;
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
            if (loan.partialPayments) {
                Object.entries(loan.partialPayments).forEach(([inst, amount]) => {
                    if (!loan.paidInstallments.includes(parseInt(inst))) {
                        totalPaid += parseFloat(amount);
                    }
                });
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
                            for (let i = 1; i <= N; i++) {
                                loan.paidInstallments.push(i);
                            }
                            saveLoans(loan);
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
                const isPaid = loan.paidInstallments.includes(i);
                const partialAmount = (loan.partialPayments && loan.partialPayments[i]) ? loan.partialPayments[i] : 0;
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
                        loans[lIdx].paidInstallments.push(inst);
                        if (!loans[lIdx].paidDates) loans[lIdx].paidDates = {};
                        const payDate = new Date();
                        loans[lIdx].paidDates[inst] = payDate.toISOString();
                        
                        // Clear partial payments for this installment if any
                        if (loans[lIdx].partialPayments && loans[lIdx].partialPayments[inst]) {
                            delete loans[lIdx].partialPayments[inst];
                        }
                        saveLoans(loans[lIdx]);

                        // WhatsApp Receipt
                        if (loans[lIdx].mobile && loans[lIdx].mobile !== 'N/A') {
                            const msg = `Payment Receipt\n\nDear ${loans[lIdx].borrower},\nReceived with thanks: ₹${emi.toFixed(2)}\nTowards: Installment #${inst}\nDate: ${payDate.toLocaleDateString()}\n\nThank you!`;
                            if(confirm("Open WhatsApp to send receipt?")) {
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
                            if (!loans[lIdx].partialPayments) loans[lIdx].partialPayments = {};
                            const current = loans[lIdx].partialPayments[inst] || 0;
                            loans[lIdx].partialPayments[inst] = current + amount;
                            if (!loans[lIdx].partialPaymentDates) loans[lIdx].partialPaymentDates = {};
                            loans[lIdx].partialPaymentDates[inst] = new Date().toISOString();
                            saveLoans(loans[lIdx]);
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
                        isPartial: false
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
                                isPartial: true
                            });
                        }
                    });
                }

                // 4. Penalties
                if (loan.penalties) {
                    loan.penalties.forEach(p => {
                        transactions.push({
                            date: new Date(p.date),
                            paidDate: null,
                            type: 'Penalty',
                            amount: parseFloat(p.amount),
                            isPayment: false,
                            desc: p.description || 'Late Fee'
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
                    `;
                    transBody.appendChild(row);
                });

                // Handle Date Edit Click
                transBody.onclick = (e) => {
                    if (e.target.classList.contains('edit-trans-date')) {
                        const inst = e.target.getAttribute('data-inst');
                        const isPartial = e.target.getAttribute('data-partial') === 'true';
                        const newDateStr = prompt("Enter new payment date (YYYY-MM-DD):");
                        
                        if (newDateStr) {
                            const newDate = new Date(newDateStr);
                            if (!isNaN(newDate.getTime())) {
                                if (isPartial) {
                                    if (!loan.partialPaymentDates) loan.partialPaymentDates = {};
                                    loan.partialPaymentDates[inst] = newDate.toISOString();
                                } else {
                                    if (!loan.paidDates) loan.paidDates = {};
                                    loan.paidDates[inst] = newDate.toISOString();
                                }
                                saveLoans(loans[index]);
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
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Due Date</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Paid Date</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
                                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
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
                            </tbody>
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
            if(loan.loanRef) document.getElementById('vp-loan-ref').textContent = `Ref: ${loan.loanRef}`;
            
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

            const borrowerStats = {};
            loans.forEach((loan, index) => {
                const name = loan.borrower.trim();
                // A loan is closed if paid installments >= tenure. Otherwise it's active/pending.
                const isClosed = (loan.paidInstallments && loan.paidInstallments.length >= (parseInt(loan.tenure) || 1));

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
            currentPage++; renderBorrowers(); // Validation happens inside renderBorrowers
        });

        // Export CSV Logic
        const exportBtn = document.getElementById('export-borrowers-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                // 1. Aggregate Data (Same logic as renderBorrowers)
                const borrowerStats = {};
                loans.forEach((loan, index) => {
                    const name = loan.borrower.trim();
                    const isClosed = (loan.paidInstallments && loan.paidInstallments.length >= (parseInt(loan.tenure) || 1));

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
            
            const today = new Date().toISOString().split('T')[0];
            const overdueLoans = loans.filter(l => {
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
            
            const closedLoans = loans.filter(l => l.paidInstallments && l.paidInstallments.length >= (parseInt(l.tenure) || 1));

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
            const totalPaid = loan.paidInstallments.length * emi;
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
                
                const isPaid = loan.paidInstallments.includes(i);
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
                        loan.paidInstallments.push(installmentNo);
                        loans[loanIndex] = loan; // Update specific loan
                        saveLoans(loan);

                        // WhatsApp Receipt
                        if (loan.mobile && loan.mobile !== 'N/A') {
                            const msg = `Payment Receipt\n\nDear ${loan.borrower},\nReceived with thanks: ₹${emi.toFixed(2)}\nTowards: Installment #${installmentNo}\nDate: ${new Date().toLocaleDateString()}\n\nThank you!`;
                            if(confirm("Open WhatsApp to send receipt?")) {
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
                // OPTION 1: Flat Rate (Current App Logic)
                // const emi = (amount / tenure) + (amount * (interest / 100));

                // OPTION 2: Standard Reducing Balance EMI
                // Assuming 'interest' input is Monthly Interest Rate %
                const r = interest / 100;
                // Formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
                const emi = (amount * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);

                const totalPayment = emi * tenure;
                const totalInterest = totalPayment - amount;

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

    if (notificationBtn && notificationDropdown) {
        // Toggle Dropdown
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('show');
        });

        // Close on outside click
        window.addEventListener('click', () => {
            if (notificationDropdown.classList.contains('show')) {
                notificationDropdown.classList.remove('show');
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

    // --- SIDEBAR TOGGLE LOGIC ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
    if (sidebarCollapseBtn && sidebar) {
        sidebarCollapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // --- LOGOUT LOGIC ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('currentUser');
                alert('You have been logged out successfully.');
                window.location.href = 'login.html';
            }
        });
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
                    if(confirm('Are you sure you want to delete this form?')) {
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