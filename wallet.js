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
        const searchInput = document.getElementById('trans-search');

        // Hide Add Funds button for non-admins
        const userRole = localStorage.getItem('userRole');
        if (userRole !== 'Administrator' && addFundsBtn) {
            addFundsBtn.style.display = 'none';
        }

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

        let walletChart = null;
        let expenseChart = null;
        let walletTransactions = [];
        let loans = [];
        let expenses = [];

        // --- FIRESTORE SETUP ---
        let db;
        let firestoreOps = {};

        const initFirestore = async () => {
            try {
                const { app } = await import('./firebase-config.js');
                const { getFirestore, collection, onSnapshot, doc, addDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                db = getFirestore(app);
                firestoreOps = { collection, addDoc, deleteDoc, doc };

                // Sync Manual Transactions
                onSnapshot(collection(db, "wallet_transactions"), (snapshot) => {
                    walletTransactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    renderWallet();
                }, (err) => console.error("Wallet Transactions listener error:", err));

                // Sync Expenses
                onSnapshot(collection(db, "expenses"), (snapshot) => {
                    expenses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    renderWallet();
                }, (err) => console.error("Expenses listener error:", err));
            } catch (e) { console.error("Firestore init failed:", e); }
        };
        initFirestore();

        // Listen for updates from app.js
        document.addEventListener('loans-updated', () => {
            loans = window.loans || [];
            renderWallet();
        });

        document.addEventListener('wallet-updated', () => {
            // app.js might not be tracking walletTransactions globally, but if it does:
            // walletTransactions = window.walletTransactions || [];
            renderWallet();
        });

        document.addEventListener('expenses-updated', () => {
            expenses = window.expenses || [];
            renderWallet();
        });

        let currentPage = 1;
        const rowsPerPage = 15;

        const isValidDate = (d) => d instanceof Date && !isNaN(d);

        const getAllTransactions = () => {
            let allTransactions = [];

            const userRole = localStorage.getItem('userRole');
            const currentUser = localStorage.getItem('currentUser');
            const currentUserEmail = localStorage.getItem('currentUserEmail');

            // 1. Manual Transactions (Deposits/Withdrawals)
            // Only Admins see manual company transactions
            const displayWalletTrans = (userRole === 'Administrator') ? walletTransactions : [];

            displayWalletTrans.forEach((t, index) => {
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
            // Filter loans for employees
            const displayLoans = (userRole !== 'Administrator') ? loans.filter(l => {
                const matchesName = (l.assignedTo === currentUser || l.createdBy === currentUser);
                const matchesEmail = (l.employeeEmail && l.employeeEmail === currentUserEmail);
                return matchesName || matchesEmail;
            }) : loans;

            displayLoans.forEach(loan => {
                if (loan.status === 'Pending' || loan.status === 'Rejected') return;

                const disbursementDate = parseSafeDate(loan.dueDate);
                if (disbursementDate.getTime() > 0) {
                    allTransactions.push({
                        date: disbursementDate.toISOString(), // Issue Date
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

                if (loan.emi_schedule && Object.keys(loan.emi_schedule).length > 0) {
                    Object.entries(loan.emi_schedule).forEach(([instNum, entry]) => {
                        if (entry.date && entry.amountPaid) {
                            allTransactions.push({
                                date: parseSafeDate(entry.date).toISOString(),
                                description: `${entry.status === 'Paid' ? 'EMI Received' : 'Partial Payment'} - ${loan.borrower} (#${instNum})`,
                                type: entry.status === 'Paid' ? 'EMI Payment' : 'Partial Payment',
                                amount: parseFloat(entry.amountPaid),
                                isCredit: true,
                                borrower: loan.borrower,
                                source: 'loan'
                            });
                        }
                    });
                } else {
                    // Legacy Support (Simplified date handling)
                    if (loan.paidInstallments && loan.paidInstallments.length > 0) {
                        loan.paidInstallments.forEach(instNum => {
                            let payDate = loan.paidDates && loan.paidDates[instNum] ? parseSafeDate(loan.paidDates[instNum]) : null;
                            if (!payDate && disbursementDate.getTime() > 0) {
                                payDate = new Date(disbursementDate);
                                payDate.setMonth(disbursementDate.getMonth() + parseInt(instNum));
                            }

                            if (payDate && payDate.getTime() > 0) {
                                allTransactions.push({
                                    date: payDate.toISOString(),
                                    description: `EMI Received - ${loan.borrower} (#${instNum})`,
                                    type: 'EMI Payment',
                                    amount: emi,
                                    isCredit: true,
                                    borrower: loan.borrower,
                                    source: 'loan'
                                });
                            }
                        });
                    }

                    // 4. Partial Payments
                    if (loan.partialPayments) {
                        Object.entries(loan.partialPayments).forEach(([instNum, amount]) => {
                            let payDate = loan.partialPaymentDates && loan.partialPaymentDates[instNum] ? parseSafeDate(loan.partialPaymentDates[instNum]) : null;
                            if (!payDate && disbursementDate.getTime() > 0) {
                                payDate = new Date(disbursementDate);
                                payDate.setMonth(disbursementDate.getMonth() + parseInt(instNum));
                            }

                            if (payDate && payDate.getTime() > 0) {
                                allTransactions.push({
                                    date: payDate.toISOString(),
                                    description: `Partial Payment - ${loan.borrower} (#${instNum})`,
                                    type: 'Partial Payment',
                                    amount: parseFloat(amount),
                                    isCredit: true,
                                    borrower: loan.borrower,
                                    source: 'loan'
                                });
                            }
                        });
                    }
                }
            });

            // 5. General Expenses (Money Out) - Added for complete wallet view
            // Only Admins see expenses
            const displayExpenses = (userRole === 'Administrator') ? expenses : [];

            displayExpenses.forEach((exp, index) => {
                const expDate = parseSafeDate(exp.date);
                if (expDate.getTime() > 0) {
                    allTransactions.push({
                        date: expDate.toISOString(),
                        description: exp.description || 'Expense',
                        type: 'Expense',
                        amount: parseFloat(exp.amount),
                        isCredit: false,
                        borrower: exp.category || '-',
                        source: 'expense',
                        originalIndex: index,
                        id: exp.id
                    });
                }
            });

            // Sort by date descending
            return allTransactions.sort((a, b) => {
                const dateA = parseSafeDate(a.date);
                const dateB = parseSafeDate(b.date);
                return dateB - dateA;
            });
        };

        const renderChart = (transactions) => {
            const ctx = document.getElementById('walletChart');
            if (!ctx) return;

            // Group by Month (YYYY-MM)
            const monthlyData = {};

            transactions.forEach(t => {
                const date = parseSafeDate(t.date);
                if (date.getTime() === 0) return; // Skip invalid dates in chart

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
            let totalDisbursement = 0;
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
                if (t.type === 'Disbursement') {
                    totalDisbursement += t.amount;
                }
            });

            const totalIncomeEl = document.getElementById('total-income-display');
            const totalExpenseEl = document.getElementById('total-expense-display');
            const totalDisbursementEl = document.getElementById('total-disbursement-display');


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
            if (totalDisbursementEl) animateValue(totalDisbursementEl, 0, totalDisbursement, 1500);

            // Render Chart with all data
            renderChart(allTransactions);

            // Filter transactions for display based on date range
            let transactionsToDisplay = allTransactions;
            const startDate = startDateEl.value;
            const endDate = endDateEl.value;
            const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

            if (searchQuery) {
                transactionsToDisplay = transactionsToDisplay.filter(t =>
                    t.borrower.toLowerCase().includes(searchQuery) ||
                    t.description.toLowerCase().includes(searchQuery) ||
                    t.type.toLowerCase().includes(searchQuery)
                );
            }

            if (startDate) {
                transactionsToDisplay = transactionsToDisplay.filter(t => {
                    const tDate = parseSafeDate(t.date).toISOString().split('T')[0];
                    return tDate >= startDate;
                });
            }
            if (endDate) {
                transactionsToDisplay = transactionsToDisplay.filter(t => {
                    const tDate = parseSafeDate(t.date).toISOString().split('T')[0];
                    return tDate <= endDate;
                });
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
                const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

                // Apply the same filter logic for export
                if (searchQuery) {
                    transactionsToExport = transactionsToExport.filter(t =>
                        t.borrower.toLowerCase().includes(searchQuery) ||
                        t.description.toLowerCase().includes(searchQuery) ||
                        t.type.toLowerCase().includes(searchQuery)
                    );
                }

                if (startDate) {
                    transactionsToExport = transactionsToExport.filter(t => parseSafeDate(t.date).toISOString().split('T')[0] >= startDate);
                }
                if (endDate) {
                    transactionsToExport = transactionsToExport.filter(t => parseSafeDate(t.date).toISOString().split('T')[0] <= endDate);
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
                if (searchInput) searchInput.value = '';
                currentPage = 1;
                renderWallet();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
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
                }
            });
        }

        // Initial render
        renderWallet();
    }
});