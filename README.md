# School Management System

A comprehensive full-stack application built with Next.js 14 and TypeScript to manage disciplinary, pedagogical, and administrative occurrences in educational institutions.

## 🚀 Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Static typing for JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Supabase** - Backend-as-a-Service (authentication and database)
- **Apache ECharts** - Data visualization and analytics
- **ESLint** - Code quality linter

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/davicanada/Full-Stack-School-Management-System.git
cd Full-Stack-School-Management-System

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env.local and add your Supabase credentials
cp .env.example .env.local

# Run in development mode
npm run dev
```

## 🌐 Access

The system will be available at: http://localhost:3000

## 🎨 Interface Features

### Landing Page
- **Responsive header** with system name and educational icon
- **Login button** - Opens authentication modal
- **Request Access button** - Registration form for new users
- **Informative cards** showcasing system features
- **Responsive design** adapting to different devices
- **Dark mode** supported

### Interactive Modals
- **Login modal** - Form with email and password
- **Access request modal** - Complete registration with validations

## 📁 Project Structure

```
Full-Stack-School-Management-System/
├── app/                    # App Router pages
│   ├── admin/             # Admin dashboard pages
│   │   ├── dashboard/    # Analytics and reports
│   │   ├── alunos/       # Student management
│   │   ├── professores/  # Teacher management
│   │   └── turmas/       # Class management
│   ├── professor/         # Professor portal pages
│   │   ├── registrar/    # Register occurrences
│   │   └── ocorrencias/  # View occurrences
│   ├── master/            # Master admin page
│   ├── api/              # API routes
│   ├── page.tsx          # Landing page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/            # Reusable components
├── lib/                  # Utilities and configurations
│   └── supabase/         # Supabase configuration
│       ├── client.ts     # Client-side Supabase
│       └── server.ts     # Server-side Supabase
├── database/             # 🗄️ Database architecture & SQL
│   ├── README.md        # Complete database documentation
│   ├── schema.sql       # Full database schema
│   ├── migrations/      # Versioned database migrations
│   │   ├── 001_database_architecture_fixes.sql
│   │   └── 002_trash_system.sql
│   └── examples/        # SQL query examples
│       └── queries.sql  # Advanced analytics & reporting queries
├── types/               # TypeScript types
│   └── index.ts        # System interfaces
├── .env.example        # Environment variables template
└── package.json        # Project dependencies
```

## 🗄️ Database Architecture

This project features a **production-ready PostgreSQL database** with advanced features:

### Key Features
- **Multi-tenant architecture** supporting multiple institutions
- **Row Level Security (RLS)** for data isolation and security
- **Soft delete system** (trash/recycle bin) with audit trails
- **23 strategic indexes** for optimal query performance
- **Advanced SQL patterns**: CTEs, window functions, complex joins

### Database Highlights
- 9 core tables with comprehensive relationships
- 20+ RLS policies for role-based access control
- Helper functions for common operations
- Materialized views for analytics
- Full audit trail system

### SQL Skills Demonstrated
- Complex JOIN operations and aggregations
- Window functions (RANK, LAG, PERCENT_RANK)
- Common Table Expressions (CTEs)
- Subqueries and derived tables
- Index optimization strategies
- Query performance tuning
- Data validation and quality checks

**📖 Full Documentation**: See [database/README.md](./database/README.md) for complete schema documentation, ER diagrams, and example queries.

## 🔧 Available Scripts

```bash
# Development mode
npm run dev

# Production build
npm run build

# Start production server
npm start

# Code linting
npm run lint
```

## ✨ Key Features

### Multi-Role System
- **Master Admin** - Full system control across all institutions
- **Admin** - Complete management of their institution
- **Professor** - Register and view student occurrences

### Student Management
- Complete CRUD operations
- Class assignment and transfers
- Student history tracking
- Soft delete with trash/recovery system

### Occurrence Tracking
- Customizable occurrence types per institution
- Severity levels (low, medium, high)
- Detailed occurrence reports
- Teacher assignment and tracking

### Analytics Dashboard
- Real-time statistics and KPIs
- Interactive charts with Apache ECharts
- Monthly and yearly trends
- Occurrence distribution analysis
- At-risk student identification

### Security Features
- JWT authentication via Supabase
- Row Level Security (RLS) at database level
- Role-based access control (RBAC)
- Frontend and backend data validation
- CSRF protection

## 🎯 User Roles

- **Master** - System administrator with access to all institutions
- **Admin** - Institution administrator with full management capabilities
- **Professor** - Teacher who can register and view student occurrences

## 📱 Responsive Design

The system features a mobile-first design approach, ensuring optimal experience on:
- **Desktop** (1024px+)
- **Tablet** (768px - 1023px)
- **Mobile** (up to 767px)

## 🚀 Live Demo

[Add your demo link here if deployed]

## 📝 License

This project is for portfolio purposes.

---

Developed with ❤️ using modern web development best practices.
