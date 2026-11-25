# Glow & Style – Salon Booking Website

## Project Overview

Glow & Style is a salon booking website that allows customers to explore salon services, create accounts, log in, and manage their appointments.

The website also provides an administrator dashboard for managing salon operations and barber profiles.

The project uses a Node.js and Express backend, with Supabase providing authentication and database services.

## Main Features

### Customer Features
- Customer registration and login.
- Secure authentication using Supabase.
- Customer profile management.
- Browse salon services.
- Book salon appointments, with a choice of barber (or "any available barber").
- View and manage appointments.
- Appointment confirmation emails.
- Reminder emails at 9:00 on the day of the appointment and 1 hour before it.

### Administrator Features
- Dedicated administrator login.
- Admin dashboard.
- Customer management.
- Barber management.
- View barber information and portfolios.

### Barber Features
- Individual barber portfolio pages.
- Barber profiles with experience and specialties.
- Portfolio images.
- Links to appointment booking.

## Technologies Used

**Frontend**
- HTML5
- CSS3
- JavaScript

**Backend**
- Node.js
- Express.js

**Database and Authentication**
- Supabase
- Supabase JavaScript SDK

**Additional Libraries and Services**
- Resend
- dotenv

## Project Structure

```text
glow-and-style/
│
├── Public/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── profile.html
│   ├── admin-login.html
│   ├── admin-dashboard.html
│   ├── barber-portfolio.html
│   ├── booking.html
│   ├── style.css
│   └── JavaScript files
│
├── server.js
├── supabase-update.sql
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

## Requirements

Before running the project, install:

- Node.js (LTS version recommended).
- npm (included with Node.js).
- A Supabase project with the required database tables and authentication configured.
- A Resend account if appointment confirmation emails are required.

## Installation Instructions

### 1. Extract the project

Extract the downloaded ZIP file into a folder on your computer.

### 2. Open the project folder

Open the folder in Visual Studio Code or PowerShell.

### 3. Install dependencies

Run:

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project's root directory.

Use the following structure:

```env
PORT=3000

SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=your_verified_sender_email

SUPABASE_SECRET_KEY=your_supabase_secret_key
SALON_TIMEZONE=Europe/Berlin
```

`SUPABASE_SECRET_KEY` is only needed for reminder emails. It is used by the server only and must never be added to files in `Public/`.

Replace the placeholder values with the credentials from your own services.

Never share your `.env` file or commit it to GitHub.

### 5. Start the website

Run:

```bash
npm start
```

The server should start on port 3000.

### 6. Open the website

Visit:

- Homepage: http://localhost:3000/
- Customer Login: http://localhost:3000/login.html
- Customer Registration: http://localhost:3000/register.html
- Admin Login: http://localhost:3000/admin-login.html
- Admin Dashboard: http://localhost:3000/admin-dashboard.html

## Supabase Configuration

The project uses Supabase for customer authentication and database operations.

To run the complete application, configure the required database tables, authentication settings, and storage bucket in your Supabase project.

The barber portfolio feature uses the `barbers` table and a Supabase Storage bucket named `barbers`.

The application uses these tables: `profiles` (including a `role` column, `customer` or `admin`), `appointments`, `appointment_history`, `barbers`, `services` and `customer_feedback`.

To add barber selection and reminders to an existing database, run `supabase-update.sql` once in the Supabase SQL Editor. It adds `barber_id`, `reminder_morning_sent` and `reminder_hour_sent` to `appointments`.

## Appointment Reminders

While the server is running, it checks every minute for today's Pending or Confirmed appointments (in the `SALON_TIMEZONE` time zone) and emails the customer:

- at 9:00 on the day of the appointment, and
- about 1 hour before the appointment starts.

Each reminder is marked as sent in the database before the email goes out, so a customer never receives the same reminder twice, even if the server restarts. If sending fails, the flag is reset and the next check tries again. Reminders are only sent while the server is running.

## Email Configuration

Appointment confirmation emails are sent through Resend.

To enable this functionality:

1. Create a Resend account.
2. Obtain an API key.
3. Verify your sender email or domain.
4. Add the API key and sender email to your `.env` file.

## Security Notes

- Environment variables are used for private server-side credentials.
- The `.env` file must not be uploaded to public repositories.
- Supabase authentication is used for customer login.
- The application verifies customer authentication before retrieving appointment information for confirmation emails.

## Running the Project

After installing dependencies and configuring the environment variables, use:

```bash
npm start
```

Keep the terminal open while using the website.

## Author

Glow & Style – Salon Booking Website

## Repository

https://github.com/hrudayshanker/glow-and-style