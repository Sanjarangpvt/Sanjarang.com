document.addEventListener('DOMContentLoaded', () => {
    // Helper functions can be copied from app.js or defined here
    const parseSafeDate = (dateInput) => {
        if (!dateInput) return new Date(0);
        if (dateInput instanceof Date) return dateInput;
        if (typeof dateInput === 'object' && dateInput.seconds) {
            return new Date(dateInput.seconds * 1000);
        }
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? new Date(0) : d;
    };

    const formatDate = (dateInput) => {
        const date = parseSafeDate(dateInput);
        if (date.getTime() === 0) return 'N/A';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getNextDueDate = (loan) => {
        if (!loan.dueDate) return null;
        const issueDate = parseSafeDate(loan.dueDate);
        if (isNaN(issueDate.getTime())) return null;
        const tenure = parseInt(loan.tenure) || 1;
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

    const renderReport = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const employeeEmail = urlParams.get('email');

        if (!employeeEmail) {
            document.getElementById('content-area').innerHTML = '<h1 style="text-align:center; margin-top: 50px;">No employee specified.</h1>';
            return;
        }

        const allLoans = JSON.parse(localStorage.getItem('loans')) || [];
        const allEmployees = JSON.parse(localStorage.getItem('employees')) || [];

        const employee = allEmployees.find(emp => emp.email === employeeEmail);
        if (!employee) {
            document.getElementById('content-area').innerHTML = `<h1 style="text-align:center; margin-top: 50px;">Employee not found: ${employeeEmail}</h1>`;
            return;
        }

        // Set headers
        document.getElementById('report-title').textContent = `Report for ${employee.name}`;
        document.getElementById('employee-name-header').textContent = employee.name;

        // Filter loans for this employee
        const employeeLoans = allLoans.filter(loan => {
            return (loan.employeeEmail === employeeEmail || loan.assignedTo === employee.name);
        });

        // --- CALCULATE STATS ---
        let totalDisbursed = 0;
        let totalCollected = 0;
        let overdueCount = 0;
        const borrowers = new Set();
        const today = new Date().toISOString().split('T')[0];
        let activeLoans = 0;
        let closedLoans = 0;
        const monthlyDisbursements = {};

        employeeLoans.forEach(loan => {
            // Only count disbursed loans for stats
            if (loan.status === 'Pending' || loan.status === 'Rejected') return;

            totalDisbursed += parseFloat(loan.amount || 0);
            borrowers.add(loan.borrower);

            // Calculate total collected from EMI schedule
            if (loan.emi_schedule) {
                totalCollected += Object.values(loan.emi_schedule).reduce((sum, entry) => {
                    return sum + parseFloat(entry.amountPaid || 0);
                }, 0);
            }

            // Check status
            const nextDue = getNextDueDate(loan);
            if (nextDue === null) {
                closedLoans++;
            } else {
                activeLoans++;
                if (nextDue.toISOString().split('T')[0] < today) {
                    overdueCount++;
                }
            }

            // For disbursement chart
            const issueDate = parseSafeDate(loan.dueDate);
            if (issueDate.getTime() > 0) {
                const monthKey = issueDate.toISOString().slice(0, 7); // YYYY-MM
                monthlyDisbursements[monthKey] = (monthlyDisbursements[monthKey] || 0) + parseFloat(loan.amount || 0);
            }
        });

        // --- POPULATE STAT CARDS ---
        document.getElementById('stat-total-disbursed').textContent = `₹${totalDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('stat-total-borrowers').textContent = borrowers.size;
        document.getElementById('stat-total-collected').textContent = `₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('stat-overdue-loans').textContent = overdueCount;

        // --- RENDER LOANS TABLE ---
        const tableBody = document.querySelector('#employee-loans-table tbody');
        tableBody.innerHTML = '';
        if (employeeLoans.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No loans found for this employee.</td></tr>';
        } else {
            employeeLoans.forEach(loan => {
                const loanIndex = allLoans.findIndex(l => l.id === loan.id);
                const row = document.createElement('tr');

                let status = loan.status;
                let statusColor = '#f39c12'; // Pending
                if (status !== 'Pending' && status !== 'Rejected') {
                    const nextDue = getNextDueDate(loan);
                    if (nextDue === null) {
                        status = 'Closed';
                        statusColor = '#95a5a6';
                    } else if (nextDue.toISOString().split('T')[0] < today) {
                        status = 'Overdue';
                        statusColor = '#e74c3c';
                    } else {
                        status = 'Active';
                        statusColor = '#27ae60';
                    }
                } else if (status === 'Rejected') {
                    statusColor = '#e74c3c';
                }

                row.innerHTML = `
                    <td>${loan.loanRef || '-'}</td>
                    <td>${loan.borrower}</td>
                    <td>₹${parseFloat(loan.amount || 0).toFixed(2)}</td>
                    <td>${formatDate(loan.dueDate)}</td>
                    <td><span style="background:${statusColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${status}</span></td>
                    <td>
                        <a href="loan-profile.html?id=${loanIndex}" target="_blank" style="background-color: #3498db; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px; font-size: 12px;">View</a>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        // --- RENDER CHARTS ---
        // Disbursement Chart
        const disburseCtx = document.getElementById('disbursement-chart').getContext('2d');
        const sortedMonths = Object.keys(monthlyDisbursements).sort();
        new Chart(disburseCtx, {
            type: 'bar',
            data: { labels: sortedMonths, datasets: [{ label: 'Amount Disbursed', data: sortedMonths.map(key => monthlyDisbursements[key]), backgroundColor: '#3498db' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // Status Chart
        const statusCtx = document.getElementById('loan-status-chart').getContext('2d');
        new Chart(statusCtx, {
            type: 'doughnut',
            data: { labels: ['Active', 'Overdue', 'Closed'], datasets: [{ data: [activeLoans, overdueCount, closedLoans], backgroundColor: ['#27ae60', '#e74c3c', '#95a5a6'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    };

    // Initial render and listen for updates from the main app script
    renderReport();
    document.addEventListener('loans-updated', renderReport);
});