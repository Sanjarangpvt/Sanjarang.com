import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, writeBatch, collection, query, where, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- TOGGLE LOGIN TYPE ---
    const btnAdmin = document.getElementById('btn-admin');
    const btnEmployee = document.getElementById('btn-employee');
    const usernameLabel = document.querySelector('label[for="username"]');
    const usernameInput = document.getElementById('username');
    let loginType = 'admin';

    if (btnAdmin && btnEmployee) {
        btnAdmin.addEventListener('click', () => {
            loginType = 'admin';
            btnAdmin.style.background = 'white';
            btnAdmin.style.color = '#667eea';
            btnAdmin.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            btnEmployee.style.background = 'transparent';
            btnEmployee.style.color = '#7f8c8d';
            btnEmployee.style.boxShadow = 'none';
            usernameLabel.textContent = 'Email';
            usernameInput.placeholder = 'admin@example.com';
        });

        btnEmployee.addEventListener('click', () => {
            loginType = 'employee';
            btnEmployee.style.background = 'white';
            btnEmployee.style.color = '#667eea';
            btnEmployee.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            btnAdmin.style.background = 'transparent';
            btnAdmin.style.color = '#7f8c8d';
            btnAdmin.style.boxShadow = 'none';
            usernameLabel.textContent = 'Email';
            usernameInput.placeholder = 'employee@example.com';
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-message');
            const card = document.querySelector('.login-card');
            
            // Set Loading State
            const btn = document.querySelector('.login-btn');
            btn.innerHTML = '<div class="spinner"></div> Authenticating...';
            btn.disabled = true;
            btn.style.opacity = '0.8';
            btn.style.cursor = 'not-allowed';
            errorMsg.style.display = 'none';

            const handleLoginSuccess = async (userEmail, role) => {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('currentUser', userEmail);
                localStorage.setItem('userRole', role);
                localStorage.setItem('showWelcomeToast', 'true');

                btn.innerHTML = '<div class="spinner"></div> Syncing Data...';

                // --- AUTO BACKUP LOGIC (Only for Admins usually, but keeping for now) ---
                if (role === 'Administrator') {
                    try {
                        const loans = JSON.parse(localStorage.getItem('loans')) || [];
                        const employees = JSON.parse(localStorage.getItem('employees')) || [];
                        const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
                        const walletTransactions = JSON.parse(localStorage.getItem('walletTransactions')) || [];
                        const profile = JSON.parse(localStorage.getItem('companyProfile')) || {};
                        const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];

                        const batchSize = 450;
                        let batches = [];
                        let currentBatch = writeBatch(db);
                        let operationCount = 0;

                        const sanitize = (obj) => JSON.parse(JSON.stringify(obj));

                        const addToBatch = (ref, data) => {
                            currentBatch.set(ref, data);
                            operationCount++;
                            if (operationCount >= batchSize) {
                                batches.push(currentBatch);
                                currentBatch = writeBatch(db);
                                operationCount = 0;
                            }
                        };

                        loans.forEach((loan, index) => {
                            const loanId = loan.id || `loan_${Date.now()}_${index}`;
                            const loanRef = doc(db, "loans", loanId);
                            addToBatch(loanRef, sanitize(loan));
                        });

                        employees.forEach((emp, index) => {
                            const empId = emp.id || `emp_${Date.now()}_${index}`;
                            const empRef = doc(db, "employees", empId);
                            addToBatch(empRef, sanitize(emp));
                        });

                        expenses.forEach((exp, index) => {
                            const expId = exp.id || `exp_${Date.now()}_${index}`;
                            const expRef = doc(db, "expenses", expId);
                            addToBatch(expRef, sanitize(exp));
                        });

                        walletTransactions.forEach((trans, index) => {
                            const transId = trans.id || `trans_${Date.now()}_${index}`;
                            const transRef = doc(db, "wallet_transactions", transId);
                            addToBatch(transRef, sanitize(trans));
                        });

                        admins.forEach((admin, index) => {
                            const adminRef = doc(db, "admin_users", admin.username);
                            addToBatch(adminRef, sanitize(admin));
                        });

                        const profileRef = doc(db, "settings", "companyProfile");
                        addToBatch(profileRef, sanitize(profile));

                        if (operationCount > 0) batches.push(currentBatch);

                        await Promise.all(batches.map(b => b.commit()));
                    } catch (e) {
                        console.error("Auto-backup failed:", e);
                    }
                }

                // Load Company Profile Details
                try {
                    const profileSnap = await getDoc(doc(db, "settings", "companyProfile"));
                    if (profileSnap.exists()) {
                        localStorage.setItem('companyProfile', JSON.stringify(profileSnap.data()));
                    }
                } catch (e) {
                    console.error("Failed to load company profile:", e);
                }

                if (role === 'Administrator') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'Employee-dashboard.html';
                }
            };

            const handleLoginError = (msg) => {
                errorMsg.style.display = 'block';
                errorMsg.textContent = msg || 'Invalid credentials';
                
                // Reset button
                btn.innerHTML = 'Login';
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';

                // Shake animation
                card.style.animation = 'none';
                card.offsetHeight; /* trigger reflow */
                card.style.animation = 'shake 0.4s ease-in-out';
            };

            if (loginType === 'admin') {
                // ADMIN LOGIN (Firebase Auth)
                signInWithEmailAndPassword(auth, username, password)
                    .then((userCredential) => {
                        handleLoginSuccess(userCredential.user.email, 'Administrator');
                    })
                    .catch((error) => {
                        handleLoginError('Invalid email or password');
                    });
            } else {
                // EMPLOYEE LOGIN (Firebase Auth)
                signInWithEmailAndPassword(auth, username, password)
                    .then(async (userCredential) => {
                        const email = userCredential.user.email;
                        try {
                            // Try to get details from Firestore to get name/designation
                            const q = query(collection(db, "employees"), where("email", "==", email));
                            const querySnapshot = await getDocs(q);
                            
                            if (!querySnapshot.empty) {
                                const data = querySnapshot.docs[0].data();
                                handleLoginSuccess(data.name, data.designation || 'Staff');
                            } else {
                                handleLoginSuccess(email, 'Staff');
                            }
                        } catch (e) {
                            handleLoginSuccess(email, 'Staff');
                        }
                    })
                    .catch((error) => {
                        console.error("Firebase Auth failed:", error);
                        // Fallback: Check Local Storage (Offline Mode)
                        const localEmployees = JSON.parse(localStorage.getItem('employees')) || [];
                        // Check by Email
                        const localEmp = localEmployees.find(e => e.email === username);

                        if (localEmp) {
                            if (localEmp.password === password) {
                                handleLoginSuccess(localEmp.name, localEmp.designation || 'Staff');
                            } else {
                                handleLoginError('Incorrect password');
                            }
                        } else {
                            handleLoginError('Invalid email or password');
                        }
                    });
            }
        });
    }

    // Toggle Password Visibility
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }

    // --- FORGOT PASSWORD LOGIC ---
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('username');
            const email = emailInput.value.trim();

            if (!email) {
                alert("Please enter your email address in the login field above to reset your password.");
                emailInput.focus();
                return;
            }

            if(confirm(`Send password reset email to ${email}?`)) {
                sendPasswordResetEmail(auth, email)
                    .then(() => {
                        alert("Password reset email sent! Please check your inbox.");
                    })
                    .catch((error) => {
                        console.error("Error sending password reset email:", error);
                        alert("Error: " + error.message);
                    });
            }
        });
    }
});