-- 2026 Marketing Calendar Seed Data
-- Run this after running supabase-calendar-migration.sql
-- These are global events visible to all users
-- Safe to run multiple times - duplicates are skipped

-- First clear existing 2026 global events to avoid duplicates
DELETE FROM marketing_events
WHERE is_global = true
AND event_date >= '2026-01-01'
AND event_date <= '2026-12-31';

-- Nederlandse feestdagen en marketing momenten 2026
INSERT INTO marketing_events (title, description, event_date, event_type, color, is_global, created_by) VALUES

-- Q1 2026
('Nieuwjaarsdag', 'Start van het nieuwe jaar - New Year campagnes', '2026-01-01', 'holiday', '#FFD700', true, NULL),
('Drie Koningen', 'Epifanie - einde kerstperiode', '2026-01-06', 'holiday', '#9333EA', true, NULL),
('Blue Monday', 'Meest deprimerende dag - feel-good campagnes', '2026-01-19', 'campaign', '#3B82F6', true, NULL),
('Valentijnsdag', 'Romantische campagnes en cadeau-acties', '2026-02-14', 'sale', '#EC4899', true, NULL),
('Carnaval Start', 'Begin carnavalsweekend', '2026-02-15', 'holiday', '#F97316', true, NULL),
('Internationale Vrouwendag', 'Campagnes gericht op vrouwen', '2026-03-08', 'campaign', '#EC4899', true, NULL),

-- Q2 2026
('Zomertijd Start', 'Klokken 1 uur vooruit', '2026-03-29', 'life', '#60A5FA', true, NULL),
('Goede Vrijdag', 'Paasweekend start', '2026-04-03', 'holiday', '#9333EA', true, NULL),
('Pasen', 'Eerste paasdag', '2026-04-05', 'holiday', '#22C55E', true, NULL),
('Tweede Paasdag', 'Tweede paasdag', '2026-04-06', 'holiday', '#22C55E', true, NULL),
('Koningsdag', 'Grootste Nederlandse feestdag - oranje campagnes!', '2026-04-27', 'holiday', '#F97316', true, NULL),
('Bevrijdingsdag', 'Nationale vrije dag', '2026-05-05', 'holiday', '#EF4444', true, NULL),
('Moederdag', 'Cadeau campagnes voor moeders', '2026-05-10', 'sale', '#EC4899', true, NULL),
('Hemelvaartsdag', 'Vrije dag - lang weekend', '2026-05-14', 'holiday', '#60A5FA', true, NULL),
('Pinksteren', 'Eerste pinksterdag', '2026-05-24', 'holiday', '#22C55E', true, NULL),
('Tweede Pinksterdag', 'Tweede pinksterdag', '2026-05-25', 'holiday', '#22C55E', true, NULL),
('Vaderdag', 'Cadeau campagnes voor vaders', '2026-06-21', 'sale', '#3B82F6', true, NULL),

-- Q3 2026
('Start Zomervakantie (regio Noord)', 'Vakantie campagnes', '2026-07-04', 'campaign', '#F59E0B', true, NULL),
('Amazon Prime Day (verwacht)', 'Grote online sale dag', '2026-07-14', 'sale', '#FF9900', true, NULL),
('Start Zomervakantie (regio Zuid)', 'Vakantie campagnes', '2026-07-18', 'campaign', '#F59E0B', true, NULL),
('Back to School Start', 'Start schoolcampagnes', '2026-08-15', 'campaign', '#3B82F6', true, NULL),
('Prinsjesdag', 'Troonrede en miljoenennota', '2026-09-15', 'life', '#F97316', true, NULL),

-- Q4 2026
('Start Herfstvakantie', 'Herfstvakantie campagnes', '2026-10-17', 'campaign', '#F59E0B', true, NULL),
('Wintertijd Start', 'Klokken 1 uur terug', '2026-10-25', 'life', '#60A5FA', true, NULL),
('Halloween', 'Griezelige campagnes', '2026-10-31', 'campaign', '#F97316', true, NULL),
('Singles Day (11.11)', 'Chinese shopping dag - grote sales', '2026-11-11', 'sale', '#EF4444', true, NULL),
('Sint Maarten', 'Lampionnen en zoetigheid', '2026-11-11', 'holiday', '#F59E0B', true, NULL),
('Black Friday', 'Grootste sale dag van het jaar!', '2026-11-27', 'sale', '#000000', true, NULL),
('Small Business Saturday', 'Support lokale ondernemers', '2026-11-28', 'campaign', '#22C55E', true, NULL),
('Cyber Monday', 'Online sale dag', '2026-11-30', 'sale', '#3B82F6', true, NULL),
('Groene Vrijdag', 'Duurzame Black Friday alternatief', '2026-12-04', 'campaign', '#22C55E', true, NULL),
('Sinterklaas', 'Pakjesavond - laatste cadeau rush', '2026-12-05', 'holiday', '#EF4444', true, NULL),
('Free Shipping Day', 'Gratis verzending campagnes', '2026-12-14', 'sale', '#3B82F6', true, NULL),
('Laatste Besteldag Kerst', 'Deadline voor kerst bezorging', '2026-12-21', 'deadline', '#EF4444', true, NULL),
('Kerstavond', 'Start kerstperiode', '2026-12-24', 'holiday', '#22C55E', true, NULL),
('Eerste Kerstdag', 'Kerstdag', '2026-12-25', 'holiday', '#22C55E', true, NULL),
('Tweede Kerstdag', 'Boxing Day sales', '2026-12-26', 'holiday', '#22C55E', true, NULL),
('Oudejaarsavond', 'Einde jaar campagnes', '2026-12-31', 'holiday', '#FFD700', true, NULL);
