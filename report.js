import { app } from './firebase-config.js';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const db = getFirestore(app);
    const currentUserEmail = localStorage.getItem('currentUserEmail');
    const userRole = localStorage.getItem('userRole');

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

    // Fetch Loans
    const fetchLoans = async () => {
        if (!currentUserEmail) {
            console.warn("No current user email found in localStorage.");
            return [];
        }
        try {
            const loansRef = collection(db, "loans");
            let q;

            // Allow Admin to see all loans
            if (userRole === 'Administrator') {
                q = query(loansRef);
            } else {
                q = query(loansRef, where("employeeEmail", "==", currentUserEmail));
            }

            const querySnapshot = await getDocs(q);

            const loanPromises = querySnapshot.docs.map(async (docSnapshot) => {
                const loanData = { id: docSnapshot.id, ...docSnapshot.data() };

                // Fetch EMI Schedule for this loan
                try {
                    const scheduleRef = doc(db, "emi_schedule", loanData.id);
                    const scheduleSnap = await getDoc(scheduleRef);

                    if (scheduleSnap.exists()) {
                        loanData.emi_schedule = scheduleSnap.data();
                    }
                } catch (err) {
                    console.warn(`Could not fetch schedule for loan ${loanData.id}`, err);
                }

                return loanData;
            });

            const loans = await Promise.all(loanPromises);
            return loans;

        } catch (error) {
            console.error("Error fetching loans:", error);
            return [];
        }
    };

    const myLoans = await fetchLoans();

    // Fetch Employees Mapping
    const fetchEmployees = async () => {
        try {
            const snapshot = await getDocs(collection(db, "employees"));
            const empMap = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.email) empMap[data.email] = data.name || data.email;
            });
            return empMap;
        } catch (e) {
            console.error("Error fetching employees:", e);
            return {};
        }
    };
    const employeeMap = await fetchEmployees();

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


    // 4. Render Employee Incentive Table (Replaces Chart)
    const incentiveBody = document.getElementById('incentive-table-body');
    if (incentiveBody) {
        // Calculate Monthly Incentives
        const incentiveData = {}; // key: YYYY-MM_email

        myLoans.forEach(loan => {
            if (!loan.emi_schedule) return;

            // Get Employee Name
            const email = loan.employeeEmail || 'unknown';
            const empName = employeeMap[email] || email || 'Unknown Employee';

            Object.values(loan.emi_schedule).forEach(payment => {
                if (payment.status === 'Paid' && payment.date) {
                    const amount = parseFloat(payment.amountPaid) || 0;
                    if (amount <= 0) return;

                    // Parse Date
                    let pDate;
                    if (payment.date.toDate) pDate = payment.date.toDate();
                    else pDate = new Date(payment.date);

                    if (isNaN(pDate.getTime())) return;

                    const monthKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
                    const groupKey = `${monthKey}_${email}`;

                    if (!incentiveData[groupKey]) {
                        incentiveData[groupKey] = {
                            monthRaw: monthKey,
                            monthDisplay: pDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
                            empName: empName,
                            totalCollected: 0
                        };
                    }
                    incentiveData[groupKey].totalCollected += amount;
                }
            });
        });

        const sortedIncentives = Object.values(incentiveData).sort((a, b) => b.monthRaw.localeCompare(a.monthRaw));

        incentiveBody.innerHTML = '';
        if (sortedIncentives.length === 0) {
            incentiveBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No incentive data found.</td></tr>';
        } else {
            sortedIncentives.forEach(item => {
                const incentive = item.totalCollected * 0.02;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.monthDisplay}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.empName}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #27ae60; font-weight: bold;">₹${incentive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                `;
                incentiveBody.appendChild(row);
            });
        }
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