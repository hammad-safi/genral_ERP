# Shop ERP - Quick Start Guide

## ✅ Your Application is Ready!

Your Shop ERP application has been successfully built and packaged for distribution.

## 📦 What You Have

**Main Distribution File**: `Shop-ERP-Portable.zip` (111 MB)

This is a portable, self-contained application that requires no installation.

## 🚀 How to Use

### Option 1: Extract and Use (Fastest)
1. **Right-click** `Shop-ERP-Portable.zip`
2. **Extract All...** to your desired location
3. **Double-click** `Shop ERP.exe`
4. ✅ The application starts immediately!

### Option 2: Using the Launcher Script
1. Extract `Shop-ERP-Portable.zip`
2. Double-click `START_APP.bat`
3. The application will launch

## 💾 Your Files

In the `release` folder you'll find:

- **`Shop-ERP-Portable.zip`** ← **USE THIS** to distribute the application
  - Portable ZIP that works on any Windows computer
  - No installation required
  - Can be moved, copied, or distributed easily

- **`win-unpacked/`** - The unpacked application files
  - Contains all the application code and dependencies
  - Can run `Shop ERP.exe` directly from here

## 🔧 Requirements

- **Windows**: Windows 7 or later (Windows 10+ recommended)
- **Memory**: At least 4 GB RAM recommended
- **Disk Space**: ~250 MB
- **No Installation**: Works immediately after extraction

## 📋 What's Inside the ZIP

When you extract `Shop-ERP-Portable.zip`, you'll get:

```
Shop-ERP-Portable/
├── Shop-ERP/           # Application folder
│   └── Shop ERP.exe    # Main executable
├── START_APP.bat       # Optional launcher script
└── README.md           # This file
```

## 🎯 Feature Overview

- **Dashboard**: Visual analytics and key metrics
- **Customers**: Manage customer information and contacts
- **Products**: Inventory and product catalog management
- **Sales**: Record and track sales transactions
- **Purchases**: Manage supplier purchases
- **Reports**: Generate business reports
- **Offline Access**: Works completely without internet

## 💡 Tips

- **First Run**: The application will start fresh with an empty database
- **Data Entry**: Start by adding your products, customers, and suppliers
- **Offline Use**: All data is saved locally on your computer
- **Backup**: The app stores data in its local database - consider regular backups

## ❓ Common Questions

**Q: Do I need to install it?**
A: No! Just extract the ZIP and run `Shop ERP.exe`

**Q: Can I move the folder after extracting?**
A: Yes! Move it anywhere on your computer

**Q: Can I delete the ZIP file after extracting?**
A: Yes, you can delete it. Keep a copy somewhere safe for other installations

**Q: How do I uninstall it?**
A: Simply delete the folder. No files are added to Windows system folders

**Q: Will it work without internet?**
A: Yes! The app is designed for completely offline use

**Q: Where is my data stored?**
A: In the application's local database. It's not uploaded anywhere

## 📞 Creating a Shortcut

To make it easier to launch, create a shortcut:

1. Right-click the empty space in your extracted folder
2. Select **New** → **Shortcut**
3. Navigate to `Shop ERP → Show more options → Browse`
4. Find and select `Shop ERP.exe`
5. Click **Finish** and name it appropriately
6. Now you can drag this shortcut to your Desktop

## 🔄 Updating the Application

To update to a new version:

1. Rebuild the application: `npm run build-portable`
2. This creates a new `Shop-ERP-Portable.zip`
3. Extract the new ZIP to replace your current installation
   - Or extract to a new folder and keep both versions

## 📚 For Developers

rebuild the application from source:

```bash
# Install dependencies (first time only)
npm install

# Build the portable version
npm run build-portable

# This creates: release/Shop-ERP-Portable.zip
```

## ✨ You're All Set!

Your Shop ERP application is ready to use and distribute. 

**Next Step**: Extract `Shop-ERP-Portable.zip` and try running it!

---

**Application**: Shop ERP v1.0.0  
**Built with**: Electron + React + Vite  
**Distribution Type**: Portable (No Installation Required)
