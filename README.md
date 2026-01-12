# Loan Management System (SNJ Project)

A comprehensive web-based application designed to manage microfinance operations, loans, borrowers, employees, and company finances. The system is built with vanilla JavaScript and uses LocalStorage for data persistence, with optional cloud migration capabilities to Firebase Firestore.

## 🚀 Features

### 📊 Dashboard & Analytics
- **Real-time Statistics**: View active loans, closed loans, total borrowers, and monthly revenue.
- **Financial Charts**: Visual breakdown of income vs. expenses and profit/loss trends using Chart.js.
- **Notifications**: Alerts for overdue loans and upcoming payments.

### 💰 Loan Management
- **Loan Operations**: Create, edit, and delete loan applications.
- **EMI Calculator**: Built-in calculator for estimating installments and interest.
- **Loan Profiles**: Detailed view of individual loans with transaction history, document previews (photos/signatures), and settlement options.
- **Status Tracking**: Automatic tracking of active, overdue, and closed loans.
- **Closure Certificates**: Generate and download PDF closure certificates for settled loans.

### 👥 Staff & Admin Management
- **Employee CRUD**: Manage staff details including designation, department, and contact info.
- **ID Card Generation**: Auto-generate printable PDF ID cards for employees.
- **Admin Roles**: Manage admin users and access controls.
- **Company Profile**: Update company details and logo for reports and sidebar branding.

### 💸 Financials
- **Wallet**: Track all cash flows (Disbursements, EMI collections, Manual deposits/withdrawals).
- **Expenses**: Record and categorize operational expenses.
- **Transaction History**: Filterable list of all financial transactions with CSV export.

### ⚙️ Customization & Settings
- **Themes**: Switch between Light, Dark, Blue, Green, and Glass themes.
- **Custom Backgrounds**: Upload custom wallpapers with blur and opacity controls.
- **Data Management**: Options to clear local data or migrate data to Firebase Firestore.

### 📄 Forms & Reports
- **Document Repository**: Download blank loan application forms, agreements, and NOC templates.
- **Custom Uploads**: Upload and manage your own PDF forms.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Storage**: LocalStorage (Primary), Firebase Firestore (Optional Backup/Sync)
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) - For data visualization.
  - [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) - For generating PDF reports and ID cards.
  - [Flatpickr](https://flatpickr.js.org/) - For date pickers.
  - [Firebase SDK](https://firebase.google.com/) - For cloud data migration.

## 📂 Project Structure

- **app.js**: Core logic for loans, dashboard, and general UI interactions.
- **settings.js**: Logic for settings, employee management, and cloud migration.
- **wallet.js**: Financial logic for the wallet and transaction history.
- **expenses.js**: Expense tracking logic.
- **firebase.json**: Firebase configuration.

## 🚀 Getting Started

1. **Clone or Download** the repository.
2. **Open the Application**:
   Simply open `index.html` (or the entry point HTML file) in your web browser. No build step is required.
3. **Initial Setup**:
   - Go to **Settings** to configure your Company Profile (Name, Address, Logo).
   - Create Admin users if necessary.
   - Add Employees and start managing Loans.

## ☁️ Cloud Migration (Optional)

The system supports migrating local data to Firebase Firestore.
1. Ensure `firebase-config.js` is present with your Firebase project credentials.
2. Navigate to **Settings > Cloud Migration**.
3. Click **Migrate to Cloud** to upload Loans, Employees, and Expenses to Firestore.

## 📝 License

Private / Proprietary Software.

---
*Generated for SNJ Project*
