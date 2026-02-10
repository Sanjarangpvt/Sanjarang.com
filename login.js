import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, writeBatch, collection, query, where, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase-config.js";

let auth, db;
try {
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Initialization Failed. Check firebase-config.js:", e);
}

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

            if (!auth) {
                alert("System Error: Firebase is not initialized. Please check the console (F12) for details.");
                return;
            }

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-message');
            const card = document.querySelector('.login-card');
            
            // Basic validation
            if (!username || !password) {
                errorMsg.style.display = 'block';
                errorMsg.textContent = 'Please enter both email and password';
                return;
            }

            // Check network connectivity
            if (!navigator.onLine) {
                errorMsg.style.display = 'block';
                errorMsg.textContent = 'No internet connection. Please check your network.';
                return;
            }
            
            // Set Loading State
            const btn = document.querySelector('.login-btn');
            btn.innerHTML = '<div class="spinner"></div> Authenticating...';
            btn.disabled = true;
            btn.style.opacity = '0.8';
            btn.style.cursor = 'not-allowed';
            errorMsg.style.display = 'none';

            const handleLoginSuccess = async (userEmail, role) => {
                console.log("Login successful, processing user data...");
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('currentUser', userEmail);
                localStorage.setItem('userRole', role);
                localStorage.setItem('showWelcomeToast', 'true');

                // Start background sync (non-blocking)
                if (role === 'Administrator') {
                    syncDataInBackground();
                }

                // Always redirect immediately
                console.log("Redirecting to dashboard...");
                if (role === 'Administrator') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'Employee-dashboard.html';
                }
            };

            // Background sync function (doesn't block login)
            const syncDataInBackground = async () => {
                try {
                    console.log("Starting background data sync...");
                    const loans = JSON.parse(localStorage.getItem('loans')) || [];
                    const employees = JSON.parse(localStorage.getItem('employees')) || [];
                    const expenses = JSON.parse(localStorage.getItem('expenses')) || [];
                    const walletTransactions = JSON.parse(localStorage.getItem('walletTransactions')) || [];
                    const profile = JSON.parse(localStorage.getItem('companyProfile')) || {};
                    const admins = JSON.parse(localStorage.getItem('adminUsers')) || [];

                    if (loans.length === 0 && employees.length === 0 && expenses.length === 0 && walletTransactions.length === 0) {
                        console.log("No local data to sync");
                        return;
                    }

                    const batchSize = 450;
                    let batches = [];
                    let currentBatch = writeBatch(db);
                    let operationCount = 0;

                    const sanitize = (obj) => {
                        try {
                            return JSON.parse(JSON.stringify(obj));
                        } catch (e) {
                            console.warn("Failed to sanitize object:", e);
                            return {};
                        }
                    };

                    const addToBatch = (ref, data) => {
                        try {
                            currentBatch.set(ref, data);
                            operationCount++;
                            if (operationCount >= batchSize) {
                                batches.push(currentBatch);
                                currentBatch = writeBatch(db);
                                operationCount = 0;
                            }
                        } catch (e) {
                            console.error("Failed to add to batch:", e);
                        }
                    };

                    // Process all data types
                    loans.forEach((loan, index) => {
                        try {
                            const loanId = loan.id || `loan_${Date.now()}_${index}`;
                            const loanRef = doc(db, "loans", loanId);
                            addToBatch(loanRef, sanitize(loan));
                        } catch (e) {
                            console.error("Error processing loan:", e);
                        }
                    });

                    employees.forEach((emp, index) => {
                        try {
                            const empId = emp.id || `emp_${Date.now()}_${index}`;
                            const empRef = doc(db, "employees", empId);
                            addToBatch(empRef, sanitize(emp));
                        } catch (e) {
                            console.error("Error processing employee:", e);
                        }
                    });

                    expenses.forEach((exp, index) => {
                        try {
                            const expId = exp.id || `exp_${Date.now()}_${index}`;
                            const expRef = doc(db, "expenses", expId);
                            addToBatch(expRef, sanitize(exp));
                        } catch (e) {
                            console.error("Error processing expense:", e);
                        }
                    });

                    walletTransactions.forEach((trans, index) => {
                        try {
                            const transId = trans.id || `trans_${Date.now()}_${index}`;
                            const transRef = doc(db, "wallet_transactions", transId);
                            addToBatch(transRef, sanitize(trans));
                        } catch (e) {
                            console.error("Error processing transaction:", e);
                        }
                    });

                    admins.forEach((admin, index) => {
                        try {
                            const adminRef = doc(db, "admin_users", admin.username);
                            addToBatch(adminRef, sanitize(admin));
                        } catch (e) {
                            console.error("Error processing admin:", e);
                        }
                    });

                    const profileRef = doc(db, "settings", "companyProfile");
                    addToBatch(profileRef, sanitize(profile));

                    if (operationCount > 0) batches.push(currentBatch);

                    console.log(`Committing ${batches.length} batches...`);
                    
                    // Add timeout to prevent hanging
                    const commitPromises = batches.map(batch => batch.commit());
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Sync timeout")), 15000)
                    );

                    await Promise.race([
                        Promise.all(commitPromises),
                        timeoutPromise
                    ]);

                    console.log("✅ Data sync completed successfully");

                    // Load latest company profile
                    try {
                        const profileSnap = await getDoc(doc(db, "settings", "companyProfile"));
                        if (profileSnap.exists()) {
                            localStorage.setItem('companyProfile', JSON.stringify(profileSnap.data()));
                            console.log("Company profile updated");
                        }
                    } catch (e) {
                        console.log("Could not load company profile:", e.message);
                    }

                } catch (syncError) {
                    console.warn("⚠️ Data sync failed (non-critical):", syncError.message);
                    // Show a toast notification if possible
                    if (typeof showToast === 'function') {
                        showToast('Data sync failed - working offline', 'warning');
                    }
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

                // Add offline login option for testing
                if (msg.includes('network') || msg.includes('timeout')) {
                    setTimeout(() => {
                        if (confirm('Network issues detected. Try offline login? (For testing only)')) {
                            // Simple offline login for admin
                            if (loginType === 'admin' && username === 'admin@test.com' && password === 'admin123') {
                                handleLoginSuccess('admin@test.com', 'Administrator');
                            } else if (loginType === 'employee') {
                                // Check local employees
                                const localEmployees = JSON.parse(localStorage.getItem('employees')) || [];
                                const localEmp = localEmployees.find(e => e.email === username);
                                if (localEmp && localEmp.password === password) {
                                    handleLoginSuccess(localEmp.name, localEmp.designation || 'Staff');
                                } else {
                                    alert('Offline login failed. Please check your credentials.');
                                }
                            } else {
                                alert('Offline login failed. Please check your credentials.');
                            }
                        }
                    }, 1000);
                }
            };

            if (loginType === 'admin') {
                // ADMIN LOGIN (Firebase Auth)
                console.log("Attempting admin login for:", username);
                
                // Add timeout to prevent hanging
                const loginPromise = signInWithEmailAndPassword(auth, username, password);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Login timeout - check network connection")), 15000)
                );

                Promise.race([loginPromise, timeoutPromise])
                    .then((userCredential) => {
                        console.log("Admin login successful");
                        handleLoginSuccess(userCredential.user.email, 'Administrator');
                    })
                    .catch((error) => {
                        console.error("Admin Login Error:", error);
                        handleLoginError(error.message || 'Login failed - check network connection');
                    });
            } else {
                // EMPLOYEE LOGIN (Firebase Auth)
                console.log("Attempting employee login for:", username);
                
                // Add timeout to prevent hanging
                const loginPromise = signInWithEmailAndPassword(auth, username, password);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Login timeout - check network connection")), 15000)
                );

                Promise.race([loginPromise, timeoutPromise])
                    .then(async (userCredential) => {
                        console.log("Employee Firebase auth successful");
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
                            console.error("Error fetching employee details:", e);
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
                                console.log("Employee login successful via local storage");
                                handleLoginSuccess(localEmp.name, localEmp.designation || 'Staff');
                            } else {
                                handleLoginError('Incorrect password');
                            }
                        } else {
                            console.warn("Login Failed: User not found in Firebase or LocalStorage.");
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