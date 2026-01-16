# Loan Manager - Sanjarang Private Limited

A comprehensive web-based Loan Management System designed to streamline the process of tracking borrowers, loans, repayments, and financial health for micro-finance institutions.

## Features

### 🔐 Authentication & Roles
- **Admin Dashboard**: Full access to all features including settings, wallet, and staff management.
- **Employee Dashboard**: Restricted access focused on daily operations (Loans, Expenses, Forms).
- **Firebase Integration**: Secure login and cloud data synchronization.

### 💸 Loan Management
- **Dashboard Overview**: Real-time stats on active loans, overdue payments, and monthly revenue.
- **Loan Lifecycle**: Create new loan applications, track active loans, manage overdue accounts, and archive closed loans.
- **Repayment Tracking**: Schedule EMIs, mark installments as paid/partially paid, and calculate penalties.
- **Document Generation**: Auto-generate Loan Agreements, NOCs, and Closure Certificates (PDF).

### 💰 Financial Tools
- **Wallet**: Track capital injection (deposits) and withdrawals.
- **Expenses**: Manage operational expenses with categorization.
- **Reports**: Visual charts for income vs. expenses, profit/loss analysis, and CSV exports.
- **EMI Calculator**: Built-in tool for calculating monthly installments.

### ⚙️ Customization & Settings
- **Theming**: Light, Dark, Blue, Green, and Glassmorphism themes with custom background support.
- **Data Management**: Local storage with option to migrate to Firebase Firestore.
- **Backup**: Export/Import data capabilities.

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend/Database**: Firebase Authentication, Cloud Firestore (Optional LocalStorage fallback)
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) - Data visualization
  - [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) - PDF generation
  - [Flatpickr](https://flatpickr.js.org/) - Date pickers
  - [Bootstrap Icons](https://icons.getbootstrap.com/) - UI Icons

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   ```

2. **Configure Firebase**
   - Create a project in the [Firebase Console](https://console.firebase.google.com/).
   - Enable **Authentication** (Email/Password).
   - Enable **Cloud Firestore**.
   - Copy your web app configuration.
   - Update `firebase-config.js` with your credentials.

3. **Run the Application**
   - Open `login.html` in your web browser.
   - Ensure you have an internet connection for Firebase features to work.

## File Structure

- **Core**: `login.html`, `dashboard.html`, `app.js`, `style.css`
- **Loan Modules**: `manage-loans.html`, `add-loan.html`, `active-loans.html`, `overdue-loans.html`, `closed-loans.html`
- **Finance**: `wallet.html`, `expenses.html`, `report.html`
- **Utilities**: `forms.html`, `settings.html`, `profile.html`

## License

Proprietary software for Sanjarang Private Limited.