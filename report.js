document.addEventListener('DOMContentLoaded', () => {
    const loans = JSON.parse(localStorage.getItem('loans')) || [];
    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];

    // Helper for date formatting
    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return dateInput;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // 1. Aggregate Data
    let totalDisbursed = 0;
    let totalRepaid = 0;
    let totalExpenses = 0;
    const timeline = [];

    // Process Loans (Disbursements)
    loans.forEach(loan => {
        const amount = parseFloat(loan.amount) || 0;
        totalDisbursed += amount;
        
        timeline.push({
            date: new Date(loan.dueDate),
            description: `Loan Disbursed - ${loan.borrower}`,
            type: 'Disbursement',
            amount: -amount,
            color: '#3498db'
        });

        // Process Repayments
        const P = amount;
        const R = parseFloat(loan.interest) || 0;
        const N = parseInt(loan.tenure) || 1;
        const emi = (P / N) + (P * (R / 100));
        const issueDate = new Date(loan.dueDate);

        if (loan.paidInstallments) {
            loan.paidInstallments.forEach(inst => {
                let payDate = new Date(issueDate);
                payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                if (loan.paidDates && loan.paidDates[inst]) payDate = new Date(loan.paidDates[inst]);
                
                totalRepaid += emi;
                timeline.push({
                    date: payDate,
                    description: `EMI Received - ${loan.borrower} (#${inst})`,
                    type: 'Repayment',
                    amount: emi,
                    color: '#27ae60'
                });
            });
        }

        if (loan.partialPayments) {
            Object.entries(loan.partialPayments).forEach(([inst, amt]) => {
                let payDate = new Date(issueDate);
                payDate.setMonth(issueDate.getMonth() + parseInt(inst));
                if (loan.partialPaymentDates && loan.partialPaymentDates[inst]) payDate = new Date(loan.partialPaymentDates[inst]);
                
                const val = parseFloat(amt);
                totalRepaid += val;
                timeline.push({
                    date: payDate,
                    description: `Partial Payment - ${loan.borrower} (#${inst})`,
                    type: 'Repayment',
                    amount: val,
                    color: '#27ae60'
                });
            });
        }
    });

    // Process Expenses
    expenses.forEach(exp => {
        const amount = parseFloat(exp.amount) || 0;
        totalExpenses += amount;
        
        timeline.push({
            date: new Date(exp.date),
            description: `Expense - ${exp.description} (${exp.category})`,
            type: 'Expense',
            amount: -amount,
            color: '#e74c3c'
        });
    });

    // Sort Timeline
    timeline.sort((a, b) => b.date - a.date);

    // Animation Helper
    const animateValue = (obj, start, end, duration) => {
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
            const currentVal = start + (end - start) * easeProgress;
            obj.textContent = '₹' + currentVal.toFixed(2);
            if (progress < 1) window.requestAnimationFrame(step);
            else obj.textContent = '₹' + end.toFixed(2);
        };
        window.requestAnimationFrame(step);
    };

    // 2. Update Summary Cards
    animateValue(document.getElementById('rep-total-disbursed'), 0, totalDisbursed, 1500);
    animateValue(document.getElementById('rep-total-repaid'), 0, totalRepaid, 1500);
    animateValue(document.getElementById('rep-total-expenses'), 0, totalExpenses, 1500);
    
    const netBalance = totalRepaid - totalDisbursed - totalExpenses;
    const netEl = document.getElementById('rep-net-balance');
    netEl.style.color = netBalance >= 0 ? '#27ae60' : '#e74c3c';
    animateValue(netEl, 0, netBalance, 1500);

    // 3. Render Table
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';
    
    timeline.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatDate(item.date)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: ${item.color}; font-weight: bold;">${item.type}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${item.amount >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                ${item.amount >= 0 ? '+' : ''}₹${Math.abs(item.amount).toFixed(2)}
            </td>
        `;
        tbody.appendChild(row);
    });

    // 4. Render Chart
    const ctx = document.getElementById('reportChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Disbursed', 'Total Repaid', 'Total Expenses'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [totalDisbursed, totalRepaid, totalExpenses],
                    backgroundColor: ['#3498db', '#27ae60', '#e74c3c'],
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Financial Summary' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // 5. Download CSV
    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Date,Description,Type,Amount\n";

            timeline.forEach(item => {
                const row = [
                    formatDate(item.date),
                    `"${item.description.replace(/"/g, '""')}"`,
                    item.type,
                    item.amount.toFixed(2)
                ].join(",");
                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "financial_report.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
});