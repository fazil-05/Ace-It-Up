-- ACE IT UP: Trending Questions & Practice Sessions Patch
-- Run this script in your Supabase SQL Editor to populate your modules with trending industry questions.

-- ==========================================
-- 0. DEDUPLICATION (Removes repeated questions)
-- ==========================================
DELETE FROM public.module_questions
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY question_text ORDER BY id) as rnum
    FROM public.module_questions
  ) t
  WHERE t.rnum > 1
);

-- ==========================================
-- 1. APTITUDE MODULE (Quants, Logical, Verbal)
-- ==========================================

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Quants', 'If 3 workers can complete a task in 12 days, how many days will 4 workers take to complete the same task?', '["8 days", "9 days", "10 days", "16 days"]', '1', 'Intermediate', 'Inverse proportion: (3 * 12) / 4 = 9 days.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'If 3 workers can complete a task in 12 days, how many days will 4 workers take to complete the same task?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Quants', 'A train running at 72 km/h crosses a 250m long platform in 26 seconds. What is the length of the train?', '["270m", "250m", "230m", "220m"]', '0', 'Intermediate', 'Speed = 72 km/h = 20 m/s. Total distance = 20 * 26 = 520m. Train length = 520 - 250 = 270m.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'A train running at 72 km/h crosses a 250m long platform in 26 seconds. What is the length of the train?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Quants', 'In how many ways can the letters of the word "LEADER" be arranged?', '["720", "144", "360", "72"]', '2', 'Expert', 'Total letters = 6, E is repeated twice. Ways = 6! / 2! = 720 / 2 = 360.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'In how many ways can the letters of the word "LEADER" be arranged?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Quants', 'What is the probability of getting a sum of 9 from two throws of a dice?', '["1/6", "1/8", "1/9", "1/12"]', '2', 'Intermediate', 'Favorable outcomes: (3,6), (4,5), (5,4), (6,3). Probability = 4/36 = 1/9.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'What is the probability of getting a sum of 9 from two throws of a dice?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Quants', 'The ratio of ages of A and B is 3:4. After 4 years, the ratio becomes 4:5. What is the present age of B?', '["12", "16", "20", "24"]', '1', 'Beginner', 'Let ages be 3x and 4x. (3x+4)/(4x+4) = 4/5 => 15x+20 = 16x+16 => x=4. Age of B = 4(4) = 16.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'The ratio of ages of A and B is 3:4. After 4 years, the ratio becomes 4:5. What is the present age of B?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Logical', 'Pointing to a photograph, a man said, "I have no brother or sister but that man''s father is my father''s son." Whose photograph was it?', '["His own", "His son''s", "His father''s", "His nephew''s"]', '1', 'Intermediate', 'Since he has no siblings, "my father''s son" is himself. So the man''s father is himself. The photograph is of his son.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Pointing to a photograph, a man said, "I have no brother or sister but that man''s father is my father''s son." Whose photograph was it?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Logical', 'Find the next number in the series: 3, 9, 21, 45, ?', '["85", "93", "95", "99"]', '1', 'Intermediate', 'Difference is 6, 12, 24. Next difference is 48. 45 + 48 = 93.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Find the next number in the series: 3, 9, 21, 45, ?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Logical', 'Which word does not belong with the others?', '["Ounce", "Inch", "Centimeter", "Yard"]', '0', 'Beginner', 'Ounce is a measure of weight, the others are measures of length/distance.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Which word does not belong with the others?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Logical', 'If RED is coded as 6720, how is GREEN coded?', '["1677209", "1677199", "16717209", "9207716"]', '0', 'Expert', 'Letters are reversed and represented by numeric values + 2. R=18, E=5, D=4. Rev: 4,5,18. Add 2: 6,7,20. G=7, R=18, E=5, E=5, N=14. Rev: 14,5,5,18,7. Add 2: 16,7,7,20,9.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'If RED is coded as 6720, how is GREEN coded?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Verbal', 'Select the correct antonym for "EPHEMERAL":', '["Transient", "Eternal", "Fictional", "Ethereal"]', '1', 'Intermediate', 'Ephemeral means short-lived. Eternal is the opposite.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Select the correct antonym for "EPHEMERAL":');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Verbal', 'Choose the word that correctly spells the noun meaning "accommodation":', '["Accomodation", "Acommodation", "Accommodation", "Acomodation"]', '2', 'Beginner', 'Accommodation requires two ''c''s and two ''m''s.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Choose the word that correctly spells the noun meaning "accommodation":');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'aptitude', 'Verbal', 'Complete the sentence: "Despite his ______ efforts, the project was a failure."', '["Valiant", "Lethargic", "Indifferent", "Erratic"]', '0', 'Intermediate', 'The word "Despite" indicates a contrast. "Valiant" (brave/determined) fits the context of trying hard but failing.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Complete the sentence: "Despite his ______ efforts, the project was a failure."');

-- ==========================================
-- 2. INTERVIEW MODULE (Behavioral, Technical, HR, Leadership, System Design)
-- ==========================================

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'Behavioral', 'Tell me about a time you failed and what you learned from it.', '[]', '', 'Intermediate', 'Use the STAR method to focus on accountability and the learning outcome.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Tell me about a time you failed and what you learned from it.');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'Behavioral', 'Describe a situation where you disagreed with a team member.', '[]', '', 'Intermediate', 'Focus on conflict resolution, empathy, and professional compromise.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Describe a situation where you disagreed with a team member.');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'Technical', 'Explain the difference between REST and GraphQL.', '[]', '', 'Expert', 'REST uses multiple endpoints for data fetching; GraphQL uses a single endpoint with precise data queries.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Explain the difference between REST and GraphQL.');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'Technical', 'What are the main differences between relational and non-relational databases?', '[]', '', 'Intermediate', 'Discuss schemas (fixed vs dynamic), structure (tables vs documents), and scaling (vertical vs horizontal).'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'What are the main differences between relational and non-relational databases?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'HR', 'Where do you see yourself in 5 years?', '[]', '', 'Beginner', 'Align your personal career goals with the potential growth trajectory within the company.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Where do you see yourself in 5 years?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'HR', 'Why should we hire you?', '[]', '', 'Beginner', 'Highlight your unique blend of skills, cultural fit, and specific value you bring to their immediate problems.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Why should we hire you?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'Leadership', 'Tell me about a time you had to lead a project without formal authority.', '[]', '', 'Expert', 'Focus on influence, collaboration, and driving consensus without direct management power.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Tell me about a time you had to lead a project without formal authority.');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'interview', 'System Design', 'How would you design a scalable URL shortener like bit.ly?', '[]', '', 'Expert', 'Discuss base62 encoding, database schema (NoSQL vs SQL), caching, and load balancing.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'How would you design a scalable URL shortener like bit.ly?');

-- ==========================================
-- 3. GROUP DISCUSSION MODULE
-- ==========================================

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'gd', 'Technology', 'Artificial Intelligence: A boon or a bane for employment?', '[]', '', 'Intermediate', 'Discuss automation of repetitive tasks vs creation of new AI-centric job roles.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Artificial Intelligence: A boon or a bane for employment?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'gd', 'Business', 'Is Remote Work sustainable for long-term corporate growth?', '[]', '', 'Intermediate', 'Address productivity metrics, mental health, and operational costs.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Is Remote Work sustainable for long-term corporate growth?');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'gd', 'Social', 'The impact of Social Media on modern interpersonal relationships.', '[]', '', 'Beginner', 'Explore connectivity versus isolation and the echo chamber effect.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'The impact of Social Media on modern interpersonal relationships.');

-- ==========================================
-- 4. COMMUNICATION MODULE (Speech Prompts, Pitch, Debate, Negotiation)
-- ==========================================

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'communication', 'Extempore', 'Speak for 2 minutes on: "The future of renewable energy".', '[]', '', 'Intermediate', 'Maintain a clear structure: Introduction, Current State, Future Potential, Conclusion.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Speak for 2 minutes on: "The future of renewable energy".');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'communication', 'Pitch', 'Elevator Pitch: Sell a completely useless object (like a broken umbrella) in 60 seconds.', '[]', '', 'Expert', 'Focus on tone, confidence, creativity, and persuasive rhetoric.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Elevator Pitch: Sell a completely useless object (like a broken umbrella) in 60 seconds.');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'communication', 'Debate', 'Argue FOR or AGAINST: "A four-day workweek should be mandatory".', '[]', '', 'Intermediate', 'Provide clear logic, anticipate counter-arguments, and maintain a respectful tone.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Argue FOR or AGAINST: "A four-day workweek should be mandatory".');

INSERT INTO public.module_questions (module_type, category, question_text, options, correct_answer, difficulty, explanation) 
SELECT 'communication', 'Negotiation', 'Roleplay: You are negotiating a 20% salary increase with a strict manager. Defend your value.', '[]', '', 'Expert', 'Focus on articulating value, staying calm under pressure, and finding mutual benefit.'
WHERE NOT EXISTS (SELECT 1 FROM public.module_questions WHERE question_text = 'Roleplay: You are negotiating a 20% salary increase with a strict manager. Defend your value.');
