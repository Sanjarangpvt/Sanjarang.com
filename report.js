import { app } from './firebase-config.js';
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const db = getFirestore(app);
    const currentUserEmail = localStorage.getItem('currentUserEmail');

    // Helper for date formatting
    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        // Handle Firestore Timestamps
        if (dateInput.toDate) {
            dateInput = dateInput.toDate();
        }
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return String(dateInput); // Return original if invalid
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Fetch Loans for Current User
    const fetchLoans = async () => {
        if (!currentUserEmail) {
            console.warn("No current user email found in localStorage.");
            return [];
        }
        try {
            const loansRef = collection(db, "loans");
            const q = query(loansRef, where("employeeEmail", "==", currentUserEmail));
            const querySnapshot = await getDocs(q);
            const loans = [];
            querySnapshot.forEach((doc) => {
                loans.push({ id: doc.id, ...doc.data() });
            });
            return loans;
        } catch (error) {
            console.error("Error fetching loans:", error);
            return [];
        }
    };

    const myLoans = await fetchLoans();

    // 1. Aggregate Data
    let totalDisbursed = 0;
    let totalRepaid = 0;
    const timeline = [];

    // Process Loans (Disbursements)
    myLoans.forEach(loan => {
        if (loan.status === 'Pending' || loan.status === 'Rejected') return;

        const amount = parseFloat(loan.amount) || 0;
        totalDisbursed += amount;

        const disbursementDate = loan.dueDate ? (loan.dueDate.toDate ? loan.dueDate.toDate() : new Date(loan.dueDate)) : new Date();


        timeline.push({
            date: disbursementDate,
            description: `Loan Disbursed - ${loan.borrower}`,
            type: 'Disbursement',
            amount: -amount,
            color: '#3498db'
        });

        if (loan.emi_schedule) {
            Object.entries(loan.emi_schedule).forEach(([inst, entry]) => {
                if (entry.status === 'Paid') {
                    const val = parseFloat(entry.amountPaid) || 0;
                    totalRepaid += val;

                    if (entry.date) {
                        const paymentDate = entry.date.toDate ? entry.date.toDate() : new Date(entry.date);
                        timeline.push({
                            date: paymentDate,
                            description: `EMI Received - ${loan.borrower} (#${inst})`,
                            type: 'Repayment',
                            amount: val,
                            color: '#27ae60'
                        });
                    }
                }
            });
        }
    });

    // Calculate Net Balance & Incentive
    const netBalance = totalDisbursed - totalRepaid;
    const incentive = totalRepaid * 0.02;

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
            obj.textContent = '₹' + currentVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (progress < 1) window.requestAnimationFrame(step);
            else obj.textContent = '₹' + end.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        window.requestAnimationFrame(step);
    };

    // 2. Update Summary Cards
    animateValue(document.getElementById('rep-total-disbursed'), 0, totalDisbursed, 1500);
    animateValue(document.getElementById('rep-total-repaid'), 0, totalRepaid, 1500);

    const netEl = document.getElementById('rep-net-balance');
    if (netEl) {
        netEl.style.color = '#f39c12';
        animateValue(netEl, 0, netBalance, 1500);
    }

    const incEl = document.getElementById('rep-incentive');
    if (incEl) animateValue(incEl, 0, incentive, 1500);

    // 3. Render Table
    const tbody = document.getElementById('report-table-body');
    if (tbody) {
        tbody.innerHTML = ''; // Clear previous entries
        if (timeline.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" style="text-align: center; padding: 20px;">No financial activity found.</td>`;
            tbody.appendChild(row);
        } else {
            timeline.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatDate(item.date)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: ${item.color}; font-weight: bold;">${item.type}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${item.amount >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                        ${item.amount >= 0 ? '+' : ''}₹${Math.abs(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    }


    // 4. Render Chart
    const ctx = document.getElementById('reportChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Disbursed', 'Total Repaid', 'Net Balance', 'Incentive'],
                datasets: [{
                    label: 'Amount (₹)',
                    data: [totalDisbursed, totalRepaid, netBalance, incentive],
                    backgroundColor: ['#3498db', '#27ae60', '#f39c12', '#9b59b6'],
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'My Performance Overview' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
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