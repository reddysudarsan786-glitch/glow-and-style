require("dotenv").config();

const express = require("express");
const path = require("path");
const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY
);

// Serve website files from the Public folder.
app.use(express.static(path.join(__dirname, "Public")));

// Existing API test route
app.get("/api", (req, res) => {
    res.json({
        message: "Your Salon Booking Website backend is working!"
    });
});

// Send appointment confirmation email
app.post("/api/send-booking-email", async (req, res) => {
    try {
        // Get the customer's login token
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
            return res.status(401).json({
                error: "Please log in first."
            });
        }

        // Verify the logged-in customer
        const { data: userData, error: userError } =
            await supabase.auth.getUser(token);

        if (userError || !userData.user) {
            return res.status(401).json({
                error: "Invalid login session."
            });
        }

        const user = userData.user;
        const appointmentId = req.body.appointmentId;

        if (!appointmentId) {
            return res.status(400).json({
                error: "Appointment ID is required."
            });
        }

        // Connect to Supabase using the customer's token
        const customerSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_PUBLISHABLE_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        // Retrieve only this customer's appointment
        const { data: appointment, error: appointmentError } =
            await customerSupabase
                .from("appointments")
                .select("id, service, appointment_date, appointment_time, status")
                .eq("id", appointmentId)
                .eq("customer_id", user.id)
                .single();

        if (appointmentError || !appointment) {
            return res.status(404).json({
                error: "Appointment not found."
            });
        }

        if (!user.email) {
            return res.status(400).json({
                error: "Your account does not have an email address."
            });
        }

        // Send confirmation email
        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL,
            to: user.email,
            subject: "Appointment Confirmation - Glow & Style",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                    <h2>Glow & Style</h2>

                    <h3>Your appointment has been booked!</h3>

                    <p>Hello,</p>

                    <p>Thank you for booking with Glow & Style.</p>

                    <h3>Appointment Details</h3>

                    <p><strong>Service:</strong> ${escapeHTML(appointment.service)}</p>
                    <p><strong>Date:</strong> ${escapeHTML(appointment.appointment_date)}</p>
                    <p><strong>Time:</strong> ${escapeHTML(appointment.appointment_time)}</p>
                    <p><strong>Status:</strong> ${escapeHTML(appointment.status)}</p>

                    <p>We look forward to seeing you!</p>

                    <p>Regards,<br>Glow & Style Team</p>
                </div>
            `
        });

        if (error) {
            console.error("Resend error:", error);

            return res.status(500).json({
                error: "Appointment saved, but the confirmation email could not be sent."
            });
        }

        console.log("Confirmation email sent:", data.id);

        return res.json({
            message: "Confirmation email sent successfully."
        });

    } catch (error) {
        console.error("Email endpoint error:", error);

        return res.status(500).json({
            error: "Something went wrong while sending the email."
        });
    }
});

// Escape HTML values before inserting database content into an email
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// ---------------------------------------------------------------
// Appointment reminders
// 1) Morning reminder at 9:00 on the day of the appointment
// 2) Reminder 1 hour before the appointment
// Runs inside this server, so reminders are only sent while it is running.
// ---------------------------------------------------------------

const SALON_TIMEZONE = process.env.SALON_TIMEZONE || "Europe/Berlin";
const MORNING_REMINDER_HOUR = 9;
const REMINDER_CHECK_MS = 60 * 1000; // check every minute

// Server-only client with the secret key. It can read every customer's
// appointment, so the key must stay in .env and never go to the browser.
const adminSupabase = process.env.SUPABASE_SECRET_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
    : null;

// Current date ("YYYY-MM-DD") and minutes since midnight in the salon's time zone
function salonNow() {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: SALON_TIMEZONE,
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        }).formatToParts(new Date()).map(p => [p.type, p.value])
    );

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        minutes: Number(parts.hour) * 60 + Number(parts.minute)
    };
}

// Accepts "10:00 AM", "01:00 PM", "14:00" or "14:00:00"; returns minutes since midnight
function timeToMinutes(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3]?.toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
}

async function getCustomerEmail(customerId) {
    const { data: profile } = await adminSupabase
        .from("profiles")
        .select("email")
        .eq("id", customerId)
        .maybeSingle();

    if (profile?.email) return profile.email;

    const { data } = await adminSupabase.auth.admin.getUserById(customerId);
    return data?.user?.email || null;
}

// Mark a reminder as sent *before* sending, so two overlapping checks
// (or a restart) can never send the same reminder twice.
async function claimReminder(appointmentId, column, alsoSet = {}) {
    const { data, error } = await adminSupabase
        .from("appointments")
        .update({ [column]: true, ...alsoSet })
        .eq("id", appointmentId)
        .eq(column, false)
        .select("id");

    if (error) {
        console.error("Reminder claim error:", error.message);
        return false;
    }

    return data.length === 1;
}

async function sendReminderEmail(appointment, kind) {
    const email = await getCustomerEmail(appointment.customer_id);
    if (!email) throw new Error("Customer has no email address");

    const heading = kind === "hour"
        ? "Your appointment starts in about 1 hour"
        : "Reminder: you have an appointment today";

    const { error } = await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: `${heading} - Glow & Style`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
                <h2>Glow & Style</h2>
                <h3>${heading}</h3>
                <p><strong>Service:</strong> ${escapeHTML(appointment.service)}</p>
                <p><strong>Barber:</strong> ${escapeHTML(appointment.barbers?.name || "Any available barber")}</p>
                <p><strong>Date:</strong> ${escapeHTML(appointment.appointment_date)}</p>
                <p><strong>Time:</strong> ${escapeHTML(appointment.appointment_time)}</p>
                <p>Need to change it? You can cancel from your profile page.</p>
                <p>See you soon!<br>Glow & Style Team</p>
            </div>
        `
    });

    if (error) throw new Error(error.message || "Resend error");
}

let reminderCheckRunning = false;

async function checkReminders() {
    if (reminderCheckRunning) return;
    reminderCheckRunning = true;

    try {
        const now = salonNow();

        const { data: appointments, error } = await adminSupabase
            .from("appointments")
            .select("id, customer_id, service, appointment_date, appointment_time, status, reminder_morning_sent, reminder_hour_sent, barbers(name)")
            .eq("appointment_date", now.date)
            .in("status", ["Pending", "Confirmed"]);

        if (error) throw error;

        for (const appointment of appointments || []) {
            const start = timeToMinutes(appointment.appointment_time);
            if (start === null) continue;

            const minutesUntil = start - now.minutes;
            let kind = null;
            let claimed = false;

            if (minutesUntil > 0 && minutesUntil <= 60 && !appointment.reminder_hour_sent) {
                // 1-hour reminder. Also counts as the morning reminder,
                // so a 10:00 appointment doesn't get two emails at 9:00.
                kind = "hour";
                claimed = await claimReminder(appointment.id, "reminder_hour_sent", { reminder_morning_sent: true });
            } else if (
                minutesUntil > 60 &&
                !appointment.reminder_morning_sent &&
                now.minutes >= MORNING_REMINDER_HOUR * 60 &&
                now.minutes < (MORNING_REMINDER_HOUR + 1) * 60 // only 9:00-9:59
            ) {
                kind = "morning";
                claimed = await claimReminder(appointment.id, "reminder_morning_sent");
            }

            if (!claimed) continue;

            try {
                await sendReminderEmail(appointment, kind);
                console.log(`Sent ${kind} reminder for appointment ${appointment.id}`);
            } catch (sendError) {
                console.error(`Reminder email failed for appointment ${appointment.id}:`, sendError.message);
                // Undo the claim so the next check can try again
                const reset = kind === "hour"
                    ? { reminder_hour_sent: false, reminder_morning_sent: appointment.reminder_morning_sent }
                    : { reminder_morning_sent: false };
                await adminSupabase.from("appointments").update(reset).eq("id", appointment.id);
            }
        }
    } catch (error) {
        console.error("Reminder check error:", error.message || error);
    } finally {
        reminderCheckRunning = false;
    }
}

if (adminSupabase) {
    setInterval(checkReminders, REMINDER_CHECK_MS);
    checkReminders();
    console.log(`Appointment reminders enabled (${SALON_TIMEZONE})`);
} else {
    console.log("Appointment reminders disabled: SUPABASE_SECRET_KEY is not set in .env");
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});