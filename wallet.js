document.addEventListener('DOMContentLoaded', () => {
    // --- WALLET PAGE LOGIC ---
    const walletBalanceEl = document.getElementById('wallet-balance');
    if (walletBalanceEl) {
        const transTableBody = document.getElementById('transaction-table-body');
        const addFundsBtn = document.getElementById('add-funds-btn');
        const transModal = document.getElementById('transaction-modal');
        const closeTransModal = document.getElementById('close-trans-modal');
        const transForm = document.getElementById('transaction-form');
        const startDateEl = document.getElementById('start-date');
        const endDateEl = document.getElementById('end-date');
        const filterBtn = document.getElementById('filter-btn');
        const clearFilterBtn = document.getElementById('clear-filter-btn');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const pageIndicator = document.getElementById('page-indicator');

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

        // Load Transactions
        let walletChart = null;
        let expenseChart = null;
        let walletTransactions = JSON.parse(localStorage.getItem('walletTransactions')) || [];
        let loans = JSON.parse(localStorage.getItem('loans')) || [];
        let expenses = JSON.parse(localStorage.getItem('expenses')) || [];

        // --- FIRESTORE SETUP ---
        let db;
        let firestoreOps = {};

        const initFirestore = async () => {
            try {
                const { app } = await import('./firebase-config.js');
                const { getFirestore, collection, onSnapshot, doc, addDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                db = getFirestore(app);
                firestoreOps = { collection, addDoc, deleteDoc, doc };

                onSnapshot(collection(db, "wallet_transactions"), (snapshot) => {
                    walletTransactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    localStorage.setItem('walletTransactions', JSON.stringify(walletTransactions));
                    renderWallet();
                });
            } catch (e) { console.error("Firestore init failed:", e); }
        };
        initFirestore();

        let currentPage = 1;
        const rowsPerPage = 15;

        const getAllTransactions = () => {
            let allTransactions = [];
            
            // 1. Manual Transactions (Deposits/Withdrawals)
            walletTransactions.forEach((t, index) => {
                allTransactions.push({
                    date: t.date,
                    description: t.description,
                    type: t.type,
                    amount: parseFloat(t.amount),
                    isCredit: t.type === 'Deposit',
                    borrower: '-',
                    source: 'manual',
                    originalIndex: index,
                    id: t.id // Include Firestore ID
                });
            });

            // 2. Loan Disbursements (Money Out)
            loans.forEach(loan => {
                if (loan.amount && loan.dueDate) {
                    allTransactions.push({
                        date: loan.dueDate, // Issue Date
                        description: `Disbursement - ${loan.borrower}`,
                        type: 'Disbursement',
                        amount: parseFloat(loan.amount),
                        isCredit: false,
                        borrower: loan.borrower,
                        source: 'loan'
                    });
                }

                // 3. EMI Payments & Closures (Money In)
                const P = parseFloat(loan.amount) || 0;
                const R = parseFloat(loan.interest) || 0;
                const N = parseInt(loan.tenure) || 1;
                const emi = (P / N) + (P * (R / 100));
                const issueDate = new Date(loan.dueDate);

                if (loan.paidInstallments && loan.paidInstallments.length > 0) {
                    loan.paidInstallments.forEach(instNum => {
                        // Use actual paid date if available, else estimate based on due date
                        let payDate;
                        if (loan.paidDates && loan.paidDates[instNum]) {
                            payDate = new Date(loan.paidDates[instNum]);
                        } else {
                            payDate = new Date(issueDate);
                            payDate.setMonth(issueDate.getMonth() + parseInt(instNum));
                        }
                        
                        allTransactions.push({
                            date: payDate.toISOString(),
                            description: `EMI Received - ${loan.borrower} (#${instNum})`,
                            type: 'EMI Payment',
                            amount: emi,
                            isCredit: true,
                            borrower: loan.borrower,
                            source: 'loan'
                        });
                    });
                }

                // 4. Partial Payments
                if (loan.partialPayments) {
                    Object.entries(loan.partialPayments).forEach(([instNum, amount]) => {
                        let payDate;
                        if (loan.partialPaymentDates && loan.partialPaymentDates[instNum]) {
                            payDate = new Date(loan.partialPaymentDates[instNum]);
                        } else {
                            payDate = new Date(issueDate);
                            payDate.setMonth(issueDate.getMonth() + parseInt(instNum));
                        }

                        allTransactions.push({
                            date: payDate.toISOString(),
                            description: `Partial Payment - ${loan.borrower} (#${instNum})`,
                            type: 'Partial Payment',
                            amount: parseFloat(amount),
                            isCredit: true,
                            borrower: loan.borrower,
                            source: 'loan'
                        });
                    });
                }
            });

            // Sort by date descending
            return allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        };

        const renderChart = (transactions) => {
            const ctx = document.getElementById('walletChart');
            if (!ctx) return;

            // Group by Month (YYYY-MM)
            const monthlyData = {};
            
            transactions.forEach(t => {
                const date = new Date(t.date);
                const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const label = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                
                if (!monthlyData[sortKey]) {
                    monthlyData[sortKey] = { income: 0, expense: 0, label: label };
                }

                if (t.isCredit) {
                    monthlyData[sortKey].income += t.amount;
                } else {
                    monthlyData[sortKey].expense += t.amount;
                }
            });

            const sortedKeys = Object.keys(monthlyData).sort();
            const labels = sortedKeys.map(k => monthlyData[k].label);
            const incomeData = sortedKeys.map(k => monthlyData[k].income);
            const expenseData = sortedKeys.map(k => monthlyData[k].expense);

            if (walletChart) walletChart.destroy();

            walletChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Income', data: incomeData, backgroundColor: '#27ae60', borderRadius: 4 },
                        { label: 'Expenses', data: expenseData, backgroundColor: '#e74c3c', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        };

        const renderExpenseChart = (expensesData) => {
            const ctx = document.getElementById('expenseChart');
            if (!ctx) return;

            const categoryData = {};
            expensesData.forEach(exp => {
                const cat = exp.category || 'Other';
                if (!categoryData[cat]) categoryData[cat] = 0;
                categoryData[cat] += parseFloat(exp.amount);
            });

            const labels = Object.keys(categoryData);
            const data = Object.values(categoryData);
            
            if (expenseChart) expenseChart.destroy();

            expenseChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            });
        };

        const renderWallet = () => {
            let balance = 0;
            let totalIncome = 0;
            let totalExpense = 0;
            const allTransactions = getAllTransactions();
            transTableBody.innerHTML = '';

            // Calculate Balance
            allTransactions.forEach(t => {
                if (t.isCredit) {
                    balance += t.amount;
                    totalIncome += t.amount;
                } else {
                    balance -= t.amount;
                    totalExpense += t.amount;
                }
            });
            
            const totalIncomeEl = document.getElementById('total-income-display');
            const totalExpenseEl = document.getElementById('total-expense-display');

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

            animateValue(walletBalanceEl, 0, balance, 1500);
            if (totalIncomeEl) animateValue(totalIncomeEl, 0, totalIncome, 1500);
            if (totalExpenseEl) animateValue(totalExpenseEl, 0, totalExpense, 1500);

            // Render Chart with all data
            renderChart(allTransactions);

            // Filter transactions for display based on date range
            let transactionsToDisplay = allTransactions;
            const startDate = startDateEl.value;
            const endDate = endDateEl.value;

            if (startDate) {
                transactionsToDisplay = transactionsToDisplay.filter(t => t.date.split('T')[0] >= startDate);
            }
            if (endDate) {
                transactionsToDisplay = transactionsToDisplay.filter(t => t.date.split('T')[0] <= endDate);
            }

            // Filter Expenses for Pie Chart
            let expensesToDisplay = expenses;
            if (startDate) {
                expensesToDisplay = expensesToDisplay.filter(e => e.date >= startDate);
            }
            if (endDate) {
                expensesToDisplay = expensesToDisplay.filter(e => e.date <= endDate);
            }
            renderExpenseChart(expensesToDisplay);

            // Pagination Logic
            const totalPages = Math.ceil(transactionsToDisplay.length / rowsPerPage) || 1;
            
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedTransactions = transactionsToDisplay.slice(startIndex, endIndex);

            // Update Pagination Controls
            if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
            if (prevPageBtn) {
                prevPageBtn.disabled = currentPage === 1;
                prevPageBtn.style.backgroundColor = currentPage === 1 ? '#bdc3c7' : '#95a5a6';
            }
            if (nextPageBtn) {
                nextPageBtn.disabled = currentPage === totalPages;
                nextPageBtn.style.backgroundColor = currentPage === totalPages ? '#bdc3c7' : '#3498db';
            }

            // Render Table
            if (paginatedTransactions.length === 0) {
                transTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #777;">No transactions found for the selected period.</td></tr>';
            } else {
                paginatedTransactions.forEach(t => {
                    const color = t.isCredit ? '#27ae60' : '#e74c3c';
                    const sign = t.isCredit ? '+' : '-';
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 12%;">${formatDate(t.date)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 18%;">${t.borrower}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 40%;">${t.description}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; width: 15%;">
                            <span style="color: ${color}; font-weight: bold;">${t.type}</span>
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; width: 15%; color: ${color}; font-weight: bold;">${sign}₹${t.amount.toFixed(2)}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; width: 10%;">
                            <button class="delete-trans-btn" data-source="${t.source}" data-index="${t.originalIndex}" data-id="${t.id || ''}" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 1.1rem;" title="Delete">🗑️</button>
                        </td>
                    `;
                    transTableBody.appendChild(row);
                });
            }
        };

        renderWallet();

        // Delete Transaction Handler
        transTableBody.addEventListener('click', (e) => {
            let target = e.target;
            // Handle clicks on text nodes (e.g., the emoji icon)
            if (target.nodeType === 3) target = target.parentNode;
            
            const btn = target.closest ? target.closest('.delete-trans-btn') : null;

            if (btn) {
                const source = btn.getAttribute('data-source');
                const index = btn.getAttribute('data-index');
                const id = btn.getAttribute('data-id');

                if (source === 'manual') {
                    if (confirm('Are you sure you want to delete this transaction?')) {
                        if (db && firestoreOps.deleteDoc && id) {
                            firestoreOps.deleteDoc(firestoreOps.doc(db, "wallet_transactions", id))
                                .catch(e => alert("Error deleting: " + e.message));
                        } else {
                            walletTransactions.splice(index, 1);
                            localStorage.setItem('walletTransactions', JSON.stringify(walletTransactions));
                            renderWallet();
                        }
                    }
                } else {
                    alert('This transaction is linked to a loan record. Please manage it from the Loan Profile or Manage Loans page.');
                }
            }
        });

        // Export CSV Logic
        const exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                let transactionsToExport = getAllTransactions();
                const startDate = startDateEl.value;
                const endDate = endDateEl.value;

                // Apply the same filter logic for export
                if (startDate) {
                    transactionsToExport = transactionsToExport.filter(t => t.date.split('T')[0] >= startDate);
                }
                if (endDate) {
                    transactionsToExport = transactionsToExport.filter(t => t.date.split('T')[0] <= endDate);
                }

                if (transactionsToExport.length === 0) {
                    alert('No transactions to export in the selected range.');
                    return;
                }

                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "Date,Borrower,Description,Type,Amount\n";

                transactionsToExport.forEach(t => {
                    const date = formatDate(t.date);
                    const borrower = `"${t.borrower.replace(/"/g, '""')}"`;
                    const desc = `"${t.description.replace(/"/g, '""')}"`; // Escape quotes
                    const amount = (t.isCredit ? '' : '-') + t.amount.toFixed(2);
                    const row = [date, borrower, desc, t.type, amount].join(",");
                    csvContent += row + "\r\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "transaction_history.csv");
                link.click();
                document.body.removeChild(link);
            });
        }

        // Filter & Clear Button Handlers
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                currentPage = 1;
                renderWallet();
            });
        }
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                startDateEl.value = '';
                endDateEl.value = '';
                currentPage = 1;
                renderWallet();
            });
        }

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (currentPage > 1) currentPage--;
                renderWallet();
            });
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                currentPage++; 
                renderWallet();
            });
        }

        // Modal Handlers
        if (addFundsBtn) addFundsBtn.onclick = () => transModal.style.display = 'block';
        if (closeTransModal) closeTransModal.onclick = () => transModal.style.display = 'none';
        window.onclick = (e) => { if (e.target == transModal) transModal.style.display = 'none'; };

        if (transForm) {
            transForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newTrans = {
                    date: new Date().toISOString(),
                    type: document.getElementById('trans-type').value,
                    amount: parseFloat(document.getElementById('trans-amount').value),
                    description: document.getElementById('trans-desc').value
                };

                if (db && firestoreOps.addDoc) {
                    await firestoreOps.addDoc(firestoreOps.collection(db, "wallet_transactions"), newTrans);
                    transModal.style.display = 'none';
                    transForm.reset();
                } else {
                    walletTransactions.push(newTrans);
                    localStorage.setItem('walletTransactions', JSON.stringify(walletTransactions));
                    transModal.style.display = 'none';
                    transForm.reset();
                    renderWallet();
                }
            });
        }
    }
});