-- Glow & Style: barber selection + appointment reminders
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.

-- 1) Barber chosen for each appointment (empty = "any available barber").
--    Uses the same data type as barbers.id, whatever it is (uuid or bigint).
do $$
declare
    barber_id_type text;
begin
    select format_type(a.atttypid, a.atttypmod)
      into barber_id_type
      from pg_attribute a
     where a.attrelid = 'public.barbers'::regclass
       and a.attname = 'id';

    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'appointments'
           and column_name = 'barber_id'
    ) then
        execute format(
            'alter table public.appointments
                 add column barber_id %s references public.barbers(id) on delete set null',
            barber_id_type
        );
    end if;
end $$;

-- 2) Flags so each reminder email is sent only once.
alter table public.appointments
    add column if not exists reminder_morning_sent boolean not null default false,
    add column if not exists reminder_hour_sent   boolean not null default false;

-- Don't send reminders for appointments that are already over.
update public.appointments
   set reminder_morning_sent = true,
       reminder_hour_sent = true
 where appointment_date < current_date;

-- 3) Make Supabase pick up the new columns straight away.
notify pgrst, 'reload schema';

-- OPTIONAL (only if you want two customers to book the same time with
-- different barbers): your current unique rule allows one booking per time
-- slot for the whole salon. To make it per barber, find its name under
-- Table Editor -> appointments -> Constraints/Indexes, drop it, then e.g.:
--   alter table public.appointments drop constraint <old_constraint_name>;
--   create unique index appointments_barber_slot_unique
--       on public.appointments (barber_id, appointment_date, appointment_time)
--       where status <> 'Cancelled';
