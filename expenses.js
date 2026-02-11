document.addEventListener('DOMContentLoaded', () => {
    const expenseTableBody = document.getElementById('expense-table-body');
    const totalExpensesEl = document.getElementById('total-expenses');
    const addExpenseBtn = document.getElementById('add-expense-btn');
    const expenseModal = document.getElementById('expense-modal');
    const closeExpenseModal = document.getElementById('close-expense-modal');
    const expenseForm = document.getElementById('expense-form');

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

    // Load Expenses
    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    
    // --- FIRESTORE SETUP ---
    let db;
    let firestoreOps = {};

    const initFirestore = async () => {
        try {
            const { app } = await import('./firebase-config.js');
            const { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            db = getFirestore(app);
            firestoreOps = { collection, addDoc, deleteDoc, doc, updateDoc };

            onSnapshot(collection(db, "expenses"), (snapshot) => {
                expenses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                localStorage.setItem('expenses', JSON.stringify(expenses));
                renderExpenses();
            });
        } catch (e) { console.error("Firestore init failed:", e); }
    };
    initFirestore();

    const renderExpenses = () => {
        let total = 0;
        expenseTableBody.innerHTML = '';

        // Sort by date descending
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (expenses.length === 0) {
            expenseTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #777;">No expenses recorded.</td></tr>';
        } else {
            expenses.forEach((exp, index) => {
                const amount = parseFloat(exp.amount);
                total += amount;
                const status = exp.status || 'Paid'; // Default to Paid if undefined

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatDate(exp.date)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${exp.description}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        <span style="background-color: #f1f1f1; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${exp.category}</span>
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        <select class="status-select" data-index="${index}" style="border: 1px solid #ddd; padding: 4px; border-radius: 4px; font-size: 0.9rem; background-color: white;">
                            <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
                            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                        </select>
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #e74c3c; font-weight: bold;">₹${amount.toFixed(2)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
                        <button class="delete-exp-btn" data-index="${index}" style="background: none; border: none; cursor: pointer; color: #999;">🗑️</button>
                    </td>
                `;
                expenseTableBody.appendChild(row);
            });
        }
        totalExpensesEl.textContent = '₹' + total.toFixed(2);

        // Delete Handlers
        document.querySelectorAll('.delete-exp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                const expense = expenses[idx];
                if (confirm('Delete this expense?')) {
                    if (db && firestoreOps.deleteDoc && expense.id) {
                        firestoreOps.deleteDoc(firestoreOps.doc(db, "expenses", expense.id));
                    } else {
                        expenses.splice(idx, 1);
                        localStorage.setItem('expenses', JSON.stringify(expenses));
                        renderExpenses();
                    }
                }
            });
        });

        // Status Change Handlers
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-index');
                const expense = expenses[idx];
                if (db && firestoreOps.updateDoc && expense.id) {
                    firestoreOps.updateDoc(firestoreOps.doc(db, "expenses", expense.id), { status: e.target.value });
                } else {
                    expenses[idx].status = e.target.value;
                    localStorage.setItem('expenses', JSON.stringify(expenses));
                }
            });
        });
    };

    renderExpenses();

    // Modal Handlers
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener('click', () => {
            const dateInput = document.getElementById('exp-date');
            if (dateInput._flatpickr) {
                dateInput._flatpickr.setDate(new Date());
            } else {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            expenseModal.style.display = 'block';
        });
    }
    if (closeExpenseModal) closeExpenseModal.onclick = () => expenseModal.style.display = 'none';
    window.onclick = (e) => { if (e.target == expenseModal) expenseModal.style.display = 'none'; };

    if (expenseForm) {
        expenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newExpense = {
                date: document.getElementById('exp-date').value,
                description: document.getElementById('exp-desc').value,
                category: document.getElementById('exp-category').value,
                amount: document.getElementById('exp-amount').value,
                status: 'Paid'
            };
            
            if (db && firestoreOps.addDoc) {
                await firestoreOps.addDoc(firestoreOps.collection(db, "expenses"), newExpense);
            } else {
                expenses.push(newExpense);
                localStorage.setItem('expenses', JSON.stringify(expenses));
                renderExpenses();
            }

            expenseModal.style.display = 'none';
            expenseForm.reset();
        });
    }
});