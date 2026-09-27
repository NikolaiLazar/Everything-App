-- Optionales Fälligkeitsdatum für Quests (reines Datum ohne Uhrzeit).
alter table public.todo_items add column if not exists due_date date;
