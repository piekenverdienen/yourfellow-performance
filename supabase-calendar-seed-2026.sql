-- ===========================================
-- YourFellow Performance - Marketing Calendar 2026
-- ===========================================
-- Belangrijke marketing momenten voor Nederland/België
-- Run dit in Supabase SQL Editor na de migration

-- Verwijder eventuele bestaande 2026 global events om duplicaten te voorkomen
DELETE FROM public.marketing_events
WHERE is_global = TRUE
AND event_date >= '2026-01-01'
AND event_date <= '2026-12-31';

-- ===========================================
-- JANUARI 2026
-- ===========================================
INSERT INTO public.marketing_events (title, description, event_date, event_type, color, is_global) VALUES
('Nieuwjaarsdag', 'Start van het nieuwe jaar - goede voornemens campagnes', '2026-01-01', 'holiday', '#8B5CF6', TRUE),
('Dry January Start', 'Maand zonder alcohol - gezondheid & wellness marketing', '2026-01-01', 'campaign', '#22C55E', TRUE),
('Blue Monday', 'Meest deprimerende dag van het jaar - positieve marketing kans', '2026-01-19', 'campaign', '#3B82F6', TRUE),
('Nationale Complimentendag', 'Ideaal voor feel-good content en engagement', '2026-01-24', 'campaign', '#EC4899', TRUE),

-- ===========================================
-- FEBRUARI 2026
-- ===========================================
('Valentijnsdag', 'Dag van de liefde - cadeaus, romantiek, experiences', '2026-02-14', 'holiday', '#EC4899', TRUE),
('Carnaval Start', 'Start carnavalsweekend (vooral Zuid-NL en België)', '2026-02-15', 'holiday', '#F97316', TRUE),
('Carnaval', 'Carnavalszondag', '2026-02-17', 'holiday', '#F97316', TRUE),

-- ===========================================
-- MAART 2026
-- ===========================================
('Internationale Vrouwendag', 'Empowerment campagnes, vrouwgerichte marketing', '2026-03-08', 'campaign', '#EC4899', TRUE),
('Start Lente', 'Eerste lentedag - seizoensgebonden campagnes', '2026-03-20', 'campaign', '#22C55E', TRUE),
('Moederdag België', 'Moederdag in België - cadeaus & bloemen', '2026-03-08', 'holiday', '#EC4899', TRUE),

-- ===========================================
-- APRIL 2026
-- ===========================================
('Pasen', 'Eerste Paasdag', '2026-04-05', 'holiday', '#F97316', TRUE),
('Tweede Paasdag', 'Tweede Paasdag', '2026-04-06', 'holiday', '#F97316', TRUE),
('Koningsdag', 'Nederlandse feestdag - oranje gekte, sales', '2026-04-27', 'holiday', '#F97316', TRUE),
('Earth Day', 'Duurzaamheid & milieu campagnes', '2026-04-22', 'campaign', '#22C55E', TRUE),

-- ===========================================
-- MEI 2026
-- ===========================================
('Bevrijdingsdag', 'Nederlandse feestdag - 81 jaar vrijheid', '2026-05-05', 'holiday', '#EF4444', TRUE),
('Moederdag NL', 'Moederdag in Nederland - tweede zondag mei', '2026-05-10', 'holiday', '#EC4899', TRUE),
('Hemelvaart', 'Nationale feestdag - lang weekend', '2026-05-14', 'holiday', '#8B5CF6', TRUE),
('Eerste Pinksterdag', 'Pinksteren - lang weekend', '2026-05-24', 'holiday', '#8B5CF6', TRUE),
('Tweede Pinksterdag', 'Pinksteren', '2026-05-25', 'holiday', '#8B5CF6', TRUE),

-- ===========================================
-- JUNI 2026
-- ===========================================
('Vaderdag', 'Vaderdag - derde zondag juni', '2026-06-21', 'holiday', '#3B82F6', TRUE),
('Start Zomer', 'Eerste zomerdag - vakantie campagnes', '2026-06-21', 'campaign', '#F97316', TRUE),
('Pride Month Start', 'LGBTQ+ Pride maand begint', '2026-06-01', 'campaign', '#8B5CF6', TRUE),

-- ===========================================
-- JULI 2026
-- ===========================================
('Start Bouwvak', 'Bouwvak begint - vakantie sector', '2026-07-18', 'campaign', '#F97316', TRUE),
('Amazon Prime Day', 'Verwachte Prime Day (exacte datum TBC)', '2026-07-14', 'sale', '#F97316', TRUE),

-- ===========================================
-- AUGUSTUS 2026
-- ===========================================
('Back to School Start', 'Schoolspullen, kleding, elektronica', '2026-08-15', 'campaign', '#3B82F6', TRUE),
('Einde Bouwvak', 'Einde bouwvakvakantie', '2026-08-15', 'campaign', '#3B82F6', TRUE),

-- ===========================================
-- SEPTEMBER 2026
-- ===========================================
('Start Herfst', 'Eerste herfstdag - seizoenswisseling', '2026-09-22', 'campaign', '#F97316', TRUE),
('Prinsjesdag', 'Troonrede - zakelijke & financiële content', '2026-09-15', 'campaign', '#F97316', TRUE),
('Fashion Week', 'Verwachte Amsterdam Fashion Week', '2026-09-01', 'campaign', '#EC4899', TRUE),

-- ===========================================
-- OKTOBER 2026
-- ===========================================
('Dierendag', 'Wereld Dierendag - huisdier marketing', '2026-10-04', 'campaign', '#22C55E', TRUE),
('Halloween', 'Halloween - costumes, decoratie, snoep', '2026-10-31', 'holiday', '#F97316', TRUE),
('Herfstvakantie Start', 'Start herfstvakantie (regio afhankelijk)', '2026-10-17', 'campaign', '#F97316', TRUE),

-- ===========================================
-- NOVEMBER 2026
-- ===========================================
('Singles Day', '11.11 - Grootste shopping dag ter wereld (China)', '2026-11-11', 'sale', '#EF4444', TRUE),
('Sint Maarten', 'Kinderen met lampionnen', '2026-11-11', 'holiday', '#F97316', TRUE),
('Black Friday', 'Grootste shopping dag - kortingen', '2026-11-27', 'sale', '#000000', TRUE),
('Black Friday Week Start', 'Start Black Friday deals week', '2026-11-23', 'sale', '#000000', TRUE),
('Cyber Monday', 'Online shopping dag na Black Friday', '2026-11-30', 'sale', '#3B82F6', TRUE),
('Sinterklaas Intocht', 'Sinterklaas komt aan in Nederland', '2026-11-14', 'holiday', '#EF4444', TRUE),

-- ===========================================
-- DECEMBER 2026
-- ===========================================
('Sinterklaasavond', 'Pakjesavond - cadeau deadline!', '2026-12-05', 'holiday', '#EF4444', TRUE),
('Giving Tuesday', 'Dag van geven - goede doelen', '2026-12-01', 'campaign', '#22C55E', TRUE),
('Free Shipping Day', 'Gratis verzending dag (US traditie)', '2026-12-14', 'sale', '#3B82F6', TRUE),
('Laatste Verzenddag Kerst', 'Deadline voor kerst bezorging', '2026-12-21', 'deadline', '#EF4444', TRUE),
('Eerste Kerstdag', 'Kerst', '2026-12-25', 'holiday', '#22C55E', TRUE),
('Tweede Kerstdag', 'Kerst - Boxing Day sales', '2026-12-26', 'holiday', '#22C55E', TRUE),
('Eindejaarsuitverkoop Start', 'Start winter sales', '2026-12-26', 'sale', '#EF4444', TRUE),
('Oudjaarsavond', 'Oud & Nieuw - feest & goede voornemens', '2026-12-31', 'holiday', '#8B5CF6', TRUE);

-- ===========================================
-- SPECIALE MARKETING MOMENTEN (jaarlijks terugkerend)
-- ===========================================
INSERT INTO public.marketing_events (title, description, event_date, event_type, color, is_global) VALUES
('Q1 Planning Deadline', 'Q1 campagnes moeten klaarstaan', '2026-01-05', 'deadline', '#EF4444', TRUE),
('Q2 Planning Deadline', 'Q2 campagnes moeten klaarstaan', '2026-04-01', 'deadline', '#EF4444', TRUE),
('Q3 Planning Deadline', 'Q3 campagnes moeten klaarstaan', '2026-07-01', 'deadline', '#EF4444', TRUE),
('Q4 Planning Deadline', 'Q4/Holiday season campagnes klaar', '2026-10-01', 'deadline', '#EF4444', TRUE),
('Black Friday Prep Start', 'Begin voorbereiding Black Friday campagnes', '2026-10-15', 'deadline', '#F97316', TRUE),
('Kerst Campagne Start', 'Start kerst marketing campagnes', '2026-11-01', 'campaign', '#22C55E', TRUE);

-- Done!
-- Je kalender bevat nu alle belangrijke marketing momenten voor 2026
