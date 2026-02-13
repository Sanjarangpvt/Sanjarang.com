// Wrap all logic in a function that can be called on demand
function initManageLoansPage() {
    // --- FIRESTORE SETUP (For Deletion) ---
    let db;
    let firestoreOps = {};

    const initFirestore = async () => {
        try {
            const { app } = await import('./firebase-config.js');
            const { getFirestore, doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            db = getFirestore(app);
            firestoreOps = { doc, deleteDoc };
        } catch (e) { console.log("Firestore not loaded in manage-loans.js"); }
    };
    initFirestore();

    // --- HELPER FUNCTIONS ---
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

        // Check emi_schedule
        if (loan.emi_schedule) {
            for (let i = 1; i <= tenure; i++) {
                const entry = loan.emi_schedule[i] || loan.emi_schedule[i.toString()];
                if (!entry || entry.status !== 'Paid') {
                    const nextDate = new Date(issueDate);
                    nextDate.setMonth(issueDate.getMonth() + i);
                    return nextDate;
                }
            }
            return null;
        }

        // Legacy
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

    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        // Handle Firestore Timestamp
        if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
            return new Date(dateInput.seconds * 1000).toLocaleDateString('en-GB');
        }
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // --- MAIN RENDER LOGIC ---
    const renderTable = () => {
        const loans = window.loans || [];
        const tbody = document.getElementById('manage-loans-tbody');
        const searchInput = document.getElementById('loan-search-input');
        const filterSelect = document.getElementById('loan-filter-select');

        if (!tbody) return;
        tbody.innerHTML = '';

        const query = searchInput.value.toLowerCase();
        const filter = filterSelect.value;
        const today = new Date().toISOString().split('T')[0];

        // Filter Loans
        const filteredLoans = loans.map((loan, index) => {
            // Determine Status
            const nextDue = getNextDueDate(loan);
            const isClosed = nextDue === null;
            const isOverdue = !isClosed && nextDue && nextDue.toISOString().split('T')[0] < today;

            // Respect existing status (Pending/Rejected), otherwise calculate Active/Closed/Overdue
            let status = loan.status || 'Active';
            if (status === 'Active' || status === 'Overdue') {
                if (isClosed) status = 'Closed';
                else if (isOverdue) status = 'Overdue';
                else status = 'Active';
            }

            return { ...loan, originalIndex: index, status, nextDue };
        }).filter(loan => {
            // Apply Search
            const borrowerName = (loan.borrower || '').toLowerCase();
            const loanRef = (loan.loanRef || '').toLowerCase();
            const mobile = (loan.mobile || '').toString();

            const matchesSearch =
                borrowerName.includes(query) ||
                loanRef.includes(query) ||
                mobile.includes(query);

            if (!matchesSearch) return false;

            // Apply Filter
            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');

            if (userRole !== 'Administrator') {
                const matchesName = (loan.assignedTo === currentUser || loan.createdBy === currentUser);
                const matchesEmail = (loan.employeeEmail && loan.employeeEmail === currentUserEmail);
                if (!matchesName && !matchesEmail) return false;
            }

            if (filter === 'all') return loan.status !== 'Pending';
            if (filter === 'active') return loan.status === 'Active' || loan.status === 'Overdue'; // Overdue is technically active
            if (filter === 'pending') return loan.status === 'Pending';
            if (filter === 'rejected') return loan.status === 'Rejected';
            if (filter === 'overdue') return loan.status === 'Overdue';
            if (filter === 'closed') return loan.status === 'Closed';
            return true;
        });

        if (filteredLoans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #777;">No loans found matching criteria.</td></tr>';
            return;
        }

        filteredLoans.forEach(loan => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #eee';

            // Status Badge Style
            let statusColor = '#27ae60'; // Active
            if (loan.status === 'Overdue') statusColor = '#e74c3c';
            if (loan.status === 'Closed') statusColor = '#95a5a6';
            if (loan.status === 'Pending') statusColor = '#f39c12';
            if (loan.status === 'Rejected') statusColor = '#e74c3c';

            // Highlight Next Due Date if today or past
            let nextDueStyle = 'color: #555;';
            if (loan.nextDue) {
                const nextDueISO = loan.nextDue.toISOString().split('T')[0];
                if (nextDueISO <= today) {
                    nextDueStyle = 'color: #e74c3c; font-weight: bold;';
                }
            }

            row.innerHTML = `
                <td style="padding: 12px 15px; color: #555; font-size: 0.9rem;">${loan.loanRef || '-'}</td>
                <td style="padding: 12px 15px; font-weight: 600; color: #2c3e50;">${loan.borrower || 'Unknown Borrower'}</td>
                <td style="padding: 12px 15px; color: #555;">${loan.mobile || 'N/A'}</td>
                <td style="padding: 12px 15px; color: #555;">${formatDate(loan.dueDate)}</td>
                <td style="padding: 12px 15px; text-align: right; font-weight: bold; color: #2c3e50;">₹${parseFloat(loan.amount || 0).toFixed(2)}</td>
                <td style="padding: 12px 15px; ${nextDueStyle}">${loan.nextDue ? formatDate(loan.nextDue) : '-'}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${loan.status}</span>
                </td>
                <td style="padding: 12px 15px; text-align: center;">
                    <div style="display: flex; gap: 5px; justify-content: center;">
                        <button class="btn-action btn-profile" data-index="${loan.originalIndex}" title="Quick Profile" style="background: #3498db; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;"><i class="bi bi-person-lines-fill"></i></button>
                        <a href="loan-profile.html?id=${loan.originalIndex}" target="_blank" class="btn-action" title="Profile" style="background: #2c3e50; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; display: inline-block;"><i class="bi bi-eye"></i></a>
                        <button class="btn-action btn-whatsapp" data-mobile="${loan.mobile || ''}" data-name="${loan.borrower || 'Unknown'}" data-status="${loan.status}" title="WhatsApp" style="background: #25D366; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;"><i class="bi bi-whatsapp"></i></button>
                        <button class="btn-action btn-delete" data-index="${loan.originalIndex}" title="Delete" style="background: #e74c3c; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;"><i class="bi bi-trash-fill"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    };

    // --- EVENT LISTENERS ---
    const searchInput = document.getElementById('loan-search-input');
    const filterSelect = document.getElementById('loan-filter-select');
    const tbody = document.getElementById('manage-loans-tbody');

    if (searchInput) searchInput.addEventListener('input', renderTable);
    if (filterSelect) filterSelect.addEventListener('change', renderTable);

    // Button Filters (The colored buttons)
    document.querySelectorAll('.filter-btn-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterVal = e.currentTarget.getAttribute('data-filter');
            if (filterSelect) {
                filterSelect.value = filterVal;
                renderTable();
            }
        });
    });

    // --- DELETE MODAL LOGIC ---
    const deleteModal = document.getElementById('delete-confirmation-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    let loanToDeleteIndex = null;

    if (deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
        // Close Modal Helper
        const closeDeleteModal = () => {
            deleteModal.style.display = 'none';
            loanToDeleteIndex = null;
        };

        // Cancel Button
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);

        // Outside Click
        window.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });

        // Confirm Delete
        confirmDeleteBtn.addEventListener('click', async () => {
            if (loanToDeleteIndex !== null) {
                const loans = window.loans || [];
                const loanToDelete = loans[loanToDeleteIndex];

                // Delete from Firestore
                if (db && firestoreOps.deleteDoc && loanToDelete.id) {
                    try {
                        let colName = loanToDelete.firestoreCollection;
                        if (!colName) {
                            colName = (loanToDelete.status === 'Pending') ? "loan_applications" : "loans";
                        }
                        await firestoreOps.deleteDoc(firestoreOps.doc(db, colName, loanToDelete.id));
                    } catch (err) { console.error("Firestore delete error", err); }
                }

                // Delete from LocalStorage
                // No need to update local storage or manually render. 
                // The Firestore listener in app.js will detect the deletion, update window.loans, and fire 'loans-updated'.
                closeDeleteModal();
            }
        });
    }

    // Table Actions
    if (tbody) {
        tbody.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.classList.contains('btn-profile')) {
                const idx = target.getAttribute('data-index');
                // Use global function from app.js if available, else fallback
                if (typeof window.openLoanProfileModal === 'function') {
                    window.openLoanProfileModal(idx);
                } else {
                    window.location.href = `active-loans.html?id=${idx}`;
                }
            } else if (target.classList.contains('btn-whatsapp')) {
                const mobile = target.getAttribute('data-mobile');
                const name = target.getAttribute('data-name');
                const status = target.getAttribute('data-status');

                if (mobile && mobile !== 'N/A') {
                    let msg = `Hello ${name}, regarding your loan with Sanjarang Pvt Ltd.`;
                    if (status === 'Overdue') msg += ` Your payment is overdue. Please pay immediately.`;
                    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`, '_blank');
                } else {
                    alert('No mobile number available.');
                }
            } else if (target.classList.contains('btn-delete')) {
                // Show Custom Modal
                loanToDeleteIndex = target.getAttribute('data-index');
                if (deleteModal) deleteModal.style.display = 'block';
            }
        });
    }

    // Initial Render
    renderTable();
    // Re-render when loans data is updated elsewhere in the app
    document.addEventListener('loans-updated', renderTable);
}

// This makes the function globally available
window.initManageLoansPage = initManageLoansPage;

// This ensures the page works when loaded directly
const autoInit = () => {
    if (!document.body.classList.contains('manage-loans-initialized')) {
        initManageLoansPage();
        document.body.classList.add('manage-loans-initialized');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}
