document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#applications-table tbody');
    const searchInput = document.getElementById('app-search');
    const rejectModal = document.getElementById('reject-modal');
    const closeModal = document.querySelector('.close');
    const confirmRejectBtn = document.getElementById('confirm-reject-btn');
    const rejectReasonInput = document.getElementById('reject-reason');
    
    let currentRejectId = null;

    // Helper to format date
    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        // Handle Firestore Timestamp
        if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
            return new Date(dateInput.seconds * 1000).toLocaleDateString('en-GB');
        }
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : 'Invalid Date';
        return date.toLocaleDateString('en-GB');
    };

    const renderApplications = () => {
        const loans = JSON.parse(localStorage.getItem('loans')) || [];
        // Filter for applications specifically from the 'loan_applications' collection
        const applications = loans.filter(l => l.firestoreCollection === 'loan_applications');
        
        const query = searchInput.value.toLowerCase();
        const filtered = applications.filter(app => 
            (app.borrower || '').toLowerCase().includes(query) ||
            (app.loanRef || '').toLowerCase().includes(query)
        );

        tableBody.innerHTML = '';

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #777;">No pending applications found.</td></tr>';
            return;
        }

        filtered.forEach((app) => {
            // Determine Status Badge Color
            let statusColor = '#f39c12'; // Pending (Orange)
            if (app.status === 'Rejected') statusColor = '#e74c3c'; // Rejected (Red)

            // Determine Actions
            const actionButtons = app.status === 'Rejected' 
                ? `<button class="action-btn btn-view" data-id="${app.id}">View</button>` 
                : `<button class="action-btn btn-view" data-id="${app.id}">View</button>
                   <button class="action-btn btn-approve" data-id="${app.id}">Approve</button>
                   <button class="action-btn btn-reject" data-id="${app.id}">Reject</button>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.loanRef || '-'}</td>
                <td style="font-weight: 600;">${app.borrower}</td>
                <td>₹${parseFloat(app.amount).toFixed(2)}</td>
                <td>${formatDate(app.date || app.createdAt || new Date())}</td>
                <td><span style="background: ${statusColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">${app.status || 'Pending'}</span></td>
                <td>${actionButtons}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Initial Render
    renderApplications();

    // Listen for updates from app.js
    document.addEventListener('loans-updated', renderApplications);
    searchInput.addEventListener('input', renderApplications);

    // Handle Actions
    tableBody.addEventListener('click', async (e) => {
        const btn = e.target;
        const id = btn.getAttribute('data-id');
        if (!id) return;

        const loans = JSON.parse(localStorage.getItem('loans')) || [];
        const loan = loans.find(l => l.id === id);
        const index = loans.findIndex(l => l.id === id);

        if (!loan) return;

        if (btn.classList.contains('btn-view')) {
            // Open Loan Profile
            window.open(`loan-profile.html?id=${index}`, '_blank');
        } 
        else if (btn.classList.contains('btn-approve')) {
            if (confirm(`Approve loan for ${loan.borrower}?`)) {
                await approveLoan(loan);
            }
        } 
        else if (btn.classList.contains('btn-reject')) {
            currentRejectId = id;
            rejectReasonInput.value = '';
            rejectModal.style.display = 'block';
        }
    });

    // Modal Logic
    closeModal.onclick = () => rejectModal.style.display = 'none';
    window.onclick = (e) => { if (e.target == rejectModal) rejectModal.style.display = 'none'; };

    confirmRejectBtn.addEventListener('click', async () => {
        if (currentRejectId !== null) {
            const reason = rejectReasonInput.value.trim();
            if (!reason) {
                alert("Please enter a reason for rejection.");
                return;
            }
            
            const loans = JSON.parse(localStorage.getItem('loans')) || [];
            const loan = loans.find(l => l.id === currentRejectId);
            
            if (loan) {
                await rejectLoan(loan, reason);
                rejectModal.style.display = 'none';
            }
        }
    });

    // --- LOGIC TO MOVE DATA BETWEEN COLLECTIONS ---
    
    async function approveLoan(loan) {
        if (window.saveLoans) {
            // 1. Delete from 'loan_applications'
            const pendingLoan = { ...loan, firestoreCollection: 'loan_applications' };
            await window.saveLoans(pendingLoan, true); // Delete

            // 2. Add to 'loans' as Active
            const activeLoan = { ...loan, status: 'Active', firestoreCollection: 'loans', approvedDate: new Date().toISOString() };
            await window.saveLoans(activeLoan);
            alert("Loan Approved Successfully!");
        }
    }

    async function rejectLoan(loan, reason) {
        if (window.saveLoans) {
            // Update status to Rejected in the SAME collection (loan_applications)
            const rejectedLoan = { ...loan, status: 'Rejected', rejectionReason: reason, rejectedDate: new Date().toISOString(), firestoreCollection: 'loan_applications' };
            await window.saveLoans(rejectedLoan);
            alert("Loan Rejected.");
        }
    }
});